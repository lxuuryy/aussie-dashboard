'use client'
import { useState, useEffect } from 'react';
import { Ship, Anchor, Clock, TrendingUp, MapPin, Activity, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VesselScheduleAssistant from './VesselScheduleAssistant';

interface VesselMovement {
  date: string;
  time: string;
  expected: string;
  arrivalDeparture: string;
  vesselName: string;
  vesselType: string;
  agent: string;
  from: string;
  to: string;
  inPort: string;
}

interface PortData {
  source: string;
  raw_movements: VesselMovement[];
  processed_data: {
    totalMovements: number;
    arrivals: number;
    departures: number;
    shifts: number;
    vesselTypes: { [key: string]: number };
    busyBerths: string[];
    upcomingArrivals: VesselMovement[];
    recentDepartures: VesselMovement[];
    analysis?: any;
  };
}

interface VesselData {
  scraped_at: string;
  ports_included: string;
  newcastle: PortData | null;
  sydney: PortData | null;
  comparative_analysis?: any;
}

export default function VesselDashboard() {
  const [data, setData] = useState<VesselData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPort, setSelectedPort] = useState<'both' | 'newcastle' | 'sydney'>('both');
  const [filters, setFilters] = useState({
    vesselType: '',
    movementType: '',
    agent: '',
    destination: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Fetch vessel data function
  const fetchVesselData = async (withAnalysis = false, applyFilters = false) => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/scrape-vessels';
      let options: RequestInit = { method: 'GET' };

      if (applyFilters && Object.values(filters).some(f => f)) {
        url = '/api/scrape-vessels';
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            filters,
            port: selectedPort 
          })
        };
      } else {
        const params = new URLSearchParams();
        params.append('port', selectedPort);
        if (withAnalysis) params.append('analyze', 'true');
        url += '?' + params.toString();
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        if (withAnalysis || applyFilters) {
          setShowAnalysis(true);
        }
      } else {
        setError(result.error || 'Failed to fetch vessel data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch on component mount
  useEffect(() => {
    fetchVesselData();
  }, []);

  // Refetch when port selection changes
  useEffect(() => {
    if (data) { // Only refetch if we already have data (not initial load)
      fetchVesselData(showAnalysis);
    }
  }, [selectedPort]);

  // Get current movements based on selected port
  const getCurrentMovements = (): VesselMovement[] => {
    if (!data) return [];
    
    let movements: VesselMovement[] = [];
    
    if (selectedPort === 'both') {
      if (data.newcastle) movements = movements.concat(data.newcastle.raw_movements);
      if (data.sydney) movements = movements.concat(data.sydney.raw_movements);
    } else if (selectedPort === 'newcastle' && data.newcastle) {
      movements = data.newcastle.raw_movements;
    } else if (selectedPort === 'sydney' && data.sydney) {
      movements = data.sydney.raw_movements;
    }
    
    return movements;
  };

  // Get processed data based on selected port
  const getProcessedData = () => {
    if (!data) return null;
    
    if (selectedPort === 'both') {
      // Combine data from both ports
      const newcastleData = data.newcastle?.processed_data;
      const sydneyData = data.sydney?.processed_data;
      
      if (!newcastleData && !sydneyData) return null;
      
      const combined = {
        totalMovements: (newcastleData?.totalMovements || 0) + (sydneyData?.totalMovements || 0),
        arrivals: (newcastleData?.arrivals || 0) + (sydneyData?.arrivals || 0),
        departures: (newcastleData?.departures || 0) + (sydneyData?.departures || 0),
        shifts: (newcastleData?.shifts || 0) + (sydneyData?.shifts || 0),
        vesselTypes: { ...(newcastleData?.vesselTypes || {}), ...(sydneyData?.vesselTypes || {}) },
        busyBerths: [...(newcastleData?.busyBerths || []), ...(sydneyData?.busyBerths || [])].slice(0, 5),
        upcomingArrivals: [...(newcastleData?.upcomingArrivals || []), ...(sydneyData?.upcomingArrivals || [])].slice(0, 10),
        recentDepartures: [...(newcastleData?.recentDepartures || []), ...(sydneyData?.recentDepartures || [])].slice(0, 10)
      };
      
      return combined;
    } else if (selectedPort === 'newcastle') {
      return data.newcastle?.processed_data || null;
    } else if (selectedPort === 'sydney') {
      return data.sydney?.processed_data || null;
    }
    
    return null;
  };

  const currentMovements = getCurrentMovements();
  const processedData = getProcessedData();

  const filteredMovements = currentMovements.filter(movement =>
    movement.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movement.vesselType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movement.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movement.to.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getMovementBadgeVariant = (type: string) => {
    if (type.toLowerCase().includes('arrival')) return 'default';
    if (type.toLowerCase().includes('departure')) return 'secondary';
    if (type.toLowerCase().includes('shift')) return 'outline';
    return 'destructive';
  };

  const getVesselTypeIcon = (type: string) => {
    if (type.toLowerCase().includes('bulk')) return '🚢';
    if (type.toLowerCase().includes('cargo')) return '📦';
    if (type.toLowerCase().includes('tanker')) return '🛢️';
    if (type.toLowerCase().includes('container')) return '📦';
    if (type.toLowerCase().includes('cruise') || type.toLowerCase().includes('passenger')) return '🛳️';
    return '⚓';
  };

  const getActivityLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
      case 'very_high':
        return 'destructive';
      case 'moderate':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-center text-muted-foreground">Loading vessel movements...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Ship className="h-8 w-8 text-blue-600" />
                <div>
                  <CardTitle className="text-2xl md:text-3xl">NSW Port Vessel Movements</CardTitle>
                  <CardDescription>Real-time vessel tracking across Newcastle and Sydney</CardDescription>
                </div>
              </div>
              <div className="flex flex-col  gap-3">
                <Select value={selectedPort} onValueChange={(value: 'both' | 'newcastle' | 'sydney') => setSelectedPort(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both Ports</SelectItem>
                    <SelectItem value="newcastle">Newcastle</SelectItem>
                    <SelectItem value="sydney">Sydney</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => fetchVesselData(true)}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Loading...' : 'Refresh & Analyze'}
                </Button>
              </div>
            </div>

            {data && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Last updated: {new Date(data.scraped_at).toLocaleString()}
                <span className="mx-2">•</span>
                Ports: {data.ports_included}
                {data.newcastle && (
                  <>
                    <span className="mx-2">•</span>
                    Newcastle: {data.newcastle.raw_movements.length} movements
                  </>
                )}
                {data.sydney && (
                  <>
                    <span className="mx-2">•</span>
                    Sydney: {data.sydney.raw_movements.length} movements
                  </>
                )}
              </div>
            )}
          </CardHeader>

          {/* Stats */}
          {processedData && (
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Arrivals</p>
                        <p className="text-2xl font-bold">{processedData.arrivals}</p>
                      </div>
                      <Anchor className="h-8 w-8 text-green-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Departures</p>
                        <p className="text-2xl font-bold">{processedData.departures}</p>
                      </div>
                      <Ship className="h-8 w-8 text-blue-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-100 text-sm">Shifts</p>
                        <p className="text-2xl font-bold">{processedData.shifts}</p>
                      </div>
                      <Activity className="h-8 w-8 text-yellow-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Total</p>
                        <p className="text-2xl font-bold">{processedData.totalMovements}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-200" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Schedule Assistant */}
        <VesselScheduleAssistant vesselData={data} />

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Filter className="mr-2 h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vessels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filters.vesselType || "all"} onValueChange={(value) => setFilters({...filters, vesselType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bulk carrier">Bulk Carrier</SelectItem>
                  <SelectItem value="tanker">Tanker</SelectItem>
                  <SelectItem value="cargo">Cargo Ship</SelectItem>
                  <SelectItem value="container">Container Ship</SelectItem>
                  <SelectItem value="cruise">Cruise Ship</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.movementType || "all"} onValueChange={(value) => setFilters({...filters, movementType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Movement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Movements</SelectItem>
                  <SelectItem value="arrival">Arrivals</SelectItem>
                  <SelectItem value="departure">Departures</SelectItem>
                  <SelectItem value="shift">Shifts</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Agent..."
                value={filters.agent}
                onChange={(e) => setFilters({...filters, agent: e.target.value})}
              />

              <Button 
                onClick={() => fetchVesselData(true, true)}
                disabled={loading}
                className="w-full"
              >
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="movements" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="movements">Vessel Movements</TabsTrigger>
            <TabsTrigger value="analysis" disabled={!showAnalysis}>AI Analysis</TabsTrigger>
            <TabsTrigger value="insights" className="hidden lg:flex">Quick Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="movements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Clock className="mr-2 h-5 w-5" />
                  Vessel Movements ({filteredMovements.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Date & Time</TableHead>
                        <TableHead>Movement</TableHead>
                        <TableHead className="min-w-[150px]">Vessel</TableHead>
                        <TableHead className="hidden md:table-cell">Type</TableHead>
                        <TableHead className="hidden lg:table-cell">Agent</TableHead>
                        <TableHead className="hidden xl:table-cell min-w-[200px]">Route</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map((movement, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-medium text-sm">{movement.date}</div>
                            <div className="text-xs text-muted-foreground">{movement.time}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getMovementBadgeVariant(movement.arrivalDeparture)} className="text-xs">
                              {movement.arrivalDeparture}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{movement.vesselName}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center text-sm">
                              <span className="mr-1">{getVesselTypeIcon(movement.vesselType)}</span>
                              <span className="truncate max-w-[120px]">{movement.vesselType}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline" className="text-xs">{movement.agent}</Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            <div className="flex items-center text-xs">
                              <MapPin className="mr-1 h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[180px]" title={`${movement.from} → ${movement.to}`}>
                                {movement.from} → {movement.to}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={movement.inPort === 'Yes' ? 'default' : 'secondary'} className="text-xs">
                              {movement.inPort === 'Yes' ? 'In Port' : 'At Sea'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {filteredMovements.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ship className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No vessel movements found</p>
                      <p className="text-sm mt-1">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            {data?.comparative_analysis && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
                      Comparative Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Activity Comparison</h3>
                      <p className="text-sm text-muted-foreground">{data.comparative_analysis.activity_comparison}</p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Vessel Type Differences</h3>
                      <p className="text-sm text-muted-foreground">{data.comparative_analysis.vessel_type_differences}</p>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Strategic Insights</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {data.comparative_analysis.strategic_insights?.map((insight: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-blue-500 mr-2 mt-1">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Operational Recommendations</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {data.comparative_analysis.recommendations?.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-green-500 mr-2 mt-1">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-medium mb-2">Operational Differences</h3>
                      <p className="text-sm text-muted-foreground">{data.comparative_analysis.operational_differences}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {processedData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vessel Types Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(processedData.vesselTypes)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-sm truncate flex-1">{type}</span>
                            <Badge variant="secondary" className="ml-2">{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Busiest Berths/Terminals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {processedData.busyBerths.slice(0, 5).map((berth, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className="text-blue-500 mr-2">#{idx + 1}</span>
                          <span className="text-sm">{berth}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Next Arrivals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {processedData.upcomingArrivals.slice(0, 3).map((arrival, idx) => (
                        <div key={idx} className="border-l-2 border-green-500 pl-3">
                          <div className="font-medium text-sm">{arrival.vesselName}</div>
                          <div className="text-xs text-muted-foreground">{arrival.date} {arrival.time}</div>
                          <div className="text-xs text-muted-foreground">{arrival.from}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}