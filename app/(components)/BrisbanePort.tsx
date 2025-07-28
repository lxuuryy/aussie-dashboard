'use client'
import { useState, useEffect } from 'react';
import { 
  Ship, Anchor, Clock, TrendingUp, MapPin, Activity, Search, Filter, RefreshCw, 
  AlertCircle, BarChart3, Gauge, Calendar, Flag, Users, Archive, Navigation,
  ArrowUp, ArrowDown, Timer, Building, Globe, Truck, FileText, Container,
  Palmtree, Car, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

interface ShipMovement {
  vessel: string;
  arrived: string;
  dwt: string;
  grt: string;
  built: string;
  size: string;
  vesselType?: string;
  flag?: string;
  mmsi?: string;
  status: 'in-port' | 'expected';
}

interface ExpectedArrival {
  mmsi: string;
  vessel: string;
  flag: string;
  port: string;
  estimatedArrival: string;
  vesselType?: string;
}

interface PortCallHistory {
  vessel: string;
  mmsi?: string;
  imo?: string;
  flag: string;
  event: 'arrival' | 'departure';
  timestamp: string;
  port?: string;
  vesselType?: string;
  iconType?: string;
}

interface ProcessedData {
  totalVessels: number;
  inPortCount: number;
  expectedArrivals: number;
  portCallHistory: number;
  vesselTypes: { [key: string]: number };
  flagDistribution: { [key: string]: number };
  recentArrivals: ShipMovement[];
  upcomingArrivals: ExpectedArrival[];
  largestVessels: ShipMovement[];
  recentPortCalls: PortCallHistory[];
  containerShips: ShipMovement[];
  cruiseShips: ShipMovement[];
  bulkCarriers: ShipMovement[];
  generalCargo: ShipMovement[];
  analysis: any;
}

interface BrisbanePortData {
  success: boolean;
  data: {
    scraped_at: string;
    port: string;
    data_sources: string[];
    raw_data: {
      in_port_vessels: ShipMovement[];
      expected_arrivals: ExpectedArrival[];
      port_call_history: PortCallHistory[];
    };
    processed_data: ProcessedData;
    summary: {
      total_data_points: number;
      sources_active: string[];
    };
  };
}

export default function BrisbanePortDashboard() {
  const [data, setData] = useState<BrisbanePortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    vesselSize: '',
    flag: '',
    vesselName: '',
    vesselType: '',
    eventType: '',
    cargoType: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'inport' | 'arrivals' | 'history' | 'analytics'>('overview');
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch Brisbane vessel data
  const fetchBrisbaneData = async (withAnalysis = false) => {
    setLoading(true);
    setError(null);
    if (withAnalysis) setAnalyzing(true);

    try {
      const url = withAnalysis 
        ? '/api/scrape-brisbane-vessels?analyze=true'
        : '/api/scrape-brisbane-vessels';
        
      const response = await fetch(url, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchBrisbaneData();
    
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => fetchBrisbaneData(), 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getFlagEmoji = (flagCode: string) => {
    const flagMap: { [key: string]: string } = {
      'AU': '🇦🇺', 'SG': '🇸🇬', 'PA': '🇵🇦', 'LR': '🇱🇷', 'HK': '🇭🇰',
      'MT': '🇲🇹', 'MH': '🇲🇭', 'NO': '🇳🇴', 'CY': '🇨🇾', 'JP': '🇯🇵',
      'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'NL': '🇳🇱', 'DK': '🇩🇰',
      'CN': '🇨🇳', 'KR': '🇰🇷', 'MY': '🇲🇾', 'TH': '🇹🇭', 'IN': '🇮🇳',
    };
    return flagMap[flagCode] || '🏴';
  };

  const getVesselSizeCategory = (size: string) => {
    const sizeNum = parseInt(size);
    if (sizeNum > 300) return { category: 'Ultra Large', color: 'bg-red-100 text-red-800' };
    if (sizeNum > 200) return { category: 'Large', color: 'bg-orange-100 text-orange-800' };
    if (sizeNum > 100) return { category: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
    if (sizeNum > 50) return { category: 'Small', color: 'bg-blue-100 text-blue-800' };
    return { category: 'Coastal', color: 'bg-gray-100 text-gray-800' };
  };

  const getVesselTypeIcon = (vesselType: string) => {
    if (vesselType?.includes('Container')) return <Container className="h-4 w-4 text-blue-600" />;
    if (vesselType?.includes('Cruise')) return <Palmtree className="h-4 w-4 text-green-600" />;
    if (vesselType?.includes('Car')) return <Car className="h-4 w-4 text-purple-600" />;
    if (vesselType?.includes('Bulk')) return <Package className="h-4 w-4 text-orange-600" />;
    return <Ship className="h-4 w-4 text-gray-600" />;
  };

  const getEventIcon = (event: string) => {
    return event === 'arrival' ? <ArrowDown className="h-4 w-4 text-green-600" /> : <ArrowUp className="h-4 w-4 text-blue-600" />;
  };

  const formatDate = (dateString: string) => {
    try {
      // Handle ISO timestamp (has 'T' and 'Z')
      if (dateString.includes('T') && dateString.includes('Z')) {
        const date = new Date(dateString);
        return date.toLocaleString('en-AU', {
          timeZone: 'Australia/Brisbane',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      
      // Handle raw scraped format (already converted to Brisbane time)
      const [datePart, timePart] = dateString.split(' ');
      if (!timePart) return dateString;
      
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${hour}:${minute}`;
    } catch {
      return dateString;
    }
  };

  // Filter functions
  const getFilteredInPortVessels = () => {
    if (!data) return [];
    return data.data.raw_data.in_port_vessels.filter(vessel =>
      vessel.vessel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.dwt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.vesselType?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredExpectedArrivals = () => {
    if (!data) return [];
    return data.data.raw_data.expected_arrivals.filter(arrival =>
      arrival.vessel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      arrival.flag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      arrival.mmsi.includes(searchTerm) ||
      arrival.vesselType?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredPortCallHistory = () => {
    if (!data) return [];
    return data.data.raw_data.port_call_history.filter(call =>
      call.vessel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.flag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (call.vesselType && call.vesselType.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-center text-muted-foreground">Loading Brisbane Port data...</p>
            <p className="text-center text-sm text-muted-foreground">
              Scraping MyShipTracking and port call history...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
            <Button onClick={() => fetchBrisbaneData()} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8">No data available</div>;
  }

  const processedData = data.data.processed_data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Container className="h-8 w-8 text-emerald-600" />
                <div>
                  <CardTitle className="text-2xl md:text-3xl">Port Brisbane Vessel Dashboard</CardTitle>
                  <CardDescription>Queensland's premier container port and cruise gateway</CardDescription>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => fetchBrisbaneData()}
                  disabled={loading}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
                
                <Button
                  onClick={() => fetchBrisbaneData(true)}
                  disabled={analyzing}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                >
                  <BarChart3 className={`mr-2 h-4 w-4 ${analyzing ? 'animate-pulse' : ''}`} />
                  {analyzing ? 'Analyzing...' : 'AI Analysis'}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground pt-2 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">Last updated:</span><br />
                  {formatDate(data.data.scraped_at)}
                </div>
                <div>
                  <span className="font-medium">Port:</span><br />
                  {data.data.port}
                </div>
                <div>
                  <span className="font-medium">Data Points:</span><br />
                  {data.data.summary.total_data_points.toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Active Sources:</span><br />
                  {data.data.summary.sources_active.length}/3
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Brisbane Stats Cards */}
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm">In Port</p>
                      <p className="text-2xl font-bold">{processedData.inPortCount}</p>
                    </div>
                    <Anchor className="h-8 w-8 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-sm">Expected</p>
                      <p className="text-2xl font-bold">{processedData.expectedArrivals}</p>
                    </div>
                    <Clock className="h-8 w-8 text-teal-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Containers</p>
                      <p className="text-2xl font-bold">{processedData.containerShips.length}</p>
                    </div>
                    <Container className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Cruise Ships</p>
                      <p className="text-2xl font-bold">{processedData.cruiseShips.length}</p>
                    </div>
                    <Palmtree className="h-8 w-8 text-green-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Port Calls</p>
                      <p className="text-2xl font-bold">{processedData.portCallHistory}</p>
                    </div>
                    <Archive className="h-8 w-8 text-orange-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Total Activity</p>
                      <p className="text-2xl font-bold">{processedData.totalVessels}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Data Sources Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Activity className="mr-2 h-5 w-5" />
              Data Sources Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.data.data_sources.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm font-medium">{source.replace('MyShipTracking ', '')}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Search className="mr-2 h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vessels, types, flags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filters.vesselSize || "all"} onValueChange={(value) => setFilters({...filters, vesselSize: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Vessel Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="large">Large (200m+)</SelectItem>
                  <SelectItem value="medium">Medium (100-200m)</SelectItem>
                  <SelectItem value="small">Small (&lt;100m)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.cargoType || "all"} onValueChange={(value) => setFilters({...filters, cargoType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Cargo Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="container">Container</SelectItem>
                  <SelectItem value="cruise">Cruise</SelectItem>
                  <SelectItem value="bulk">Bulk</SelectItem>
                  <SelectItem value="general">General Cargo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.vesselType || "all"} onValueChange={(value) => setFilters({...filters, vesselType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="container">Container Ship</SelectItem>
                  <SelectItem value="cruise">Cruise Ship</SelectItem>
                  <SelectItem value="tanker">Tanker</SelectItem>
                  <SelectItem value="bulk">Bulk Carrier</SelectItem>
                  <SelectItem value="general">General Cargo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.eventType || "all"} onValueChange={(value) => setFilters({...filters, eventType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="arrival">Arrivals</SelectItem>
                  <SelectItem value="departure">Departures</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={() => fetchBrisbaneData()}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inport">In Port ({processedData.inPortCount})</TabsTrigger>
            <TabsTrigger value="arrivals">Expected ({processedData.expectedArrivals})</TabsTrigger>
            <TabsTrigger value="history">History ({processedData.portCallHistory})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Vessel Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Vessel Type Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(processedData.vesselTypes).map(([type, count]) => (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {getVesselTypeIcon(type)}
                            <span className="truncate">{type}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                        <Progress 
                          value={(count / processedData.inPortCount) * 100} 
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Flag State Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Flag className="mr-2 h-5 w-5" />
                    Flag State Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(processedData.flagDistribution)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 8)
                      .map(([flag, count]) => (
                        <div key={flag} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span>{getFlagEmoji(flag)}</span>
                            <span className="text-sm">{flag}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Container Ships */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Container className="mr-2 h-5 w-5" />
                    Container Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {processedData.containerShips.slice(0, 5).map((vessel, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm border-l-2 border-blue-500 pl-3">
                        <div>
                          <div className="font-medium">{vessel.vessel}</div>
                          <div className="text-muted-foreground text-xs">
                            {vessel.dwt} • {vessel.size}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Container
                        </Badge>
                      </div>
                    ))}
                    {processedData.containerShips.length === 0 && (
                      <p className="text-sm text-muted-foreground">No container ships currently in port</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cruise Ships */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Palmtree className="mr-2 h-5 w-5" />
                    Cruise Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {processedData.cruiseShips.slice(0, 5).map((vessel, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm border-l-2 border-green-500 pl-3">
                        <div>
                          <div className="font-medium">{vessel.vessel}</div>
                          <div className="text-muted-foreground text-xs">
                            {(vessel.arrived)}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          Cruise
                        </Badge>
                      </div>
                    ))}
                    {processedData.cruiseShips.length === 0 && (
                      <p className="text-sm text-muted-foreground">No cruise ships currently in port</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Timer className="mr-2 h-5 w-5" />
                    Recent Port Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {processedData.recentPortCalls.slice(0, 6).map((call, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm border-l-2 border-emerald-500 pl-3">
                        <div>
                          <div className="font-medium">{call.vessel}</div>
                          <div className="text-muted-foreground text-xs">
                            {(call.timestamp)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getEventIcon(call.event)}
                          <span className="text-xs">{call.event}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Brisbane Port Stats */}
              <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center text-white">
                    <Container className="mr-2 h-5 w-5" />
                    Brisbane Port
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-emerald-100 text-sm">Queensland's premier container and cruise gateway</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-emerald-100">Port Activity</span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {processedData.inPortCount > 50 ? 'High' : processedData.inPortCount > 25 ? 'Moderate' : 'Normal'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-emerald-100">Container Focus</span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {processedData.containerShips.length > 0 ? 'Active' : 'Standby'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* In Port Tab */}
          <TabsContent value="inport" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Anchor className="mr-2 h-5 w-5" />
                  Vessels Currently In Port ({getFilteredInPortVessels().length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vessel Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Arrived</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="hidden md:table-cell">DWT</TableHead>
                        <TableHead className="hidden lg:table-cell">GRT</TableHead>
                        <TableHead className="hidden xl:table-cell">Built</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="hidden xl:table-cell">MMSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredInPortVessels().map((vessel, idx) => {
                        const sizeCategory = getVesselSizeCategory(vessel.size);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{vessel.vessel}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getVesselTypeIcon(vessel.vesselType || '')}
                                <Badge variant="outline" className="text-xs">
                                  {vessel.vesselType || 'Unknown'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {(vessel.arrived)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{vessel.size}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{vessel.dwt}</TableCell>
                            <TableCell className="hidden lg:table-cell">{vessel.grt}</TableCell>
                            <TableCell className="hidden xl:table-cell">{vessel.built}</TableCell>
                            <TableCell>
                              <Badge className={sizeCategory.color}>
                                {sizeCategory.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell font-mono text-xs">
                              {vessel.mmsi || 'N/A'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {getFilteredInPortVessels().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ship className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No vessels found</p>
                      <p className="text-sm mt-1">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expected Arrivals Tab */}
          <TabsContent value="arrivals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Clock className="mr-2 h-5 w-5" />
                  Expected Arrivals ({getFilteredExpectedArrivals().length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MMSI</TableHead>
                        <TableHead>Vessel Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Flag</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>ETA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredExpectedArrivals().map((arrival, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">{arrival.mmsi}</TableCell>
                          <TableCell className="font-medium">{arrival.vessel}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getVesselTypeIcon(arrival.vesselType || '')}
                              <Badge variant="outline" className="text-xs">
                                {arrival.vesselType || 'Unknown'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getFlagEmoji(arrival.flag)}</span>
                              <Badge variant="outline">{arrival.flag}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{arrival.port}</TableCell>
                          <TableCell>{(arrival.estimatedArrival)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {getFilteredExpectedArrivals().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No expected arrivals found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Port Call History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Archive className="mr-2 h-5 w-5" />
                  Port Call History ({getFilteredPortCallHistory().length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Vessel Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Flag</TableHead>
                        <TableHead className="hidden md:table-cell">MMSI</TableHead>
                        <TableHead className="hidden lg:table-cell">IMO</TableHead>
                        <TableHead className="hidden lg:table-cell">Port</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredPortCallHistory().slice(0, 50).map((call, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getEventIcon(call.event)}
                              <Badge variant={call.event === 'arrival' ? 'default' : 'outline'}>
                                {call.event}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {(call.timestamp)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{call.vessel}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getVesselTypeIcon(call.vesselType || '')}
                              {call.vesselType ? (
                                <Badge variant="secondary" className="text-xs">{call.vesselType}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Unknown</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getFlagEmoji(call.flag)}</span>
                              <Badge variant="outline">{call.flag}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {call.mmsi || 'N/A'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">
                            {call.imo || 'N/A'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {call.port || 'BRISBANE'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {getFilteredPortCallHistory().length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Archive className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No port call history found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {processedData.analysis ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Port Activity Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Activity className="mr-2 h-5 w-5" />
                      Port Activity Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Activity Level</h4>
                        <Badge variant="outline" className="text-lg">
                          {processedData.analysis.port_activity_analysis?.activity_level || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Container Performance</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.container_performance || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Cruise Performance</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.cruise_performance || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Operational Efficiency</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.operational_efficiency || 'No data available'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Vessel Composition */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Ship className="mr-2 h-5 w-5" />
                      Vessel Composition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Dominant Vessel Types</h4>
                        <div className="flex flex-wrap gap-2">
                          {processedData.analysis.vessel_composition?.dominant_vessel_types?.map((type: string, idx: number) => (
                            <Badge key={idx} variant="secondary">{type}</Badge>
                          )) || <span className="text-sm text-muted-foreground">No data available</span>}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Container Ship Analysis</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.vessel_composition?.container_ship_analysis || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Cruise Ship Analysis</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.vessel_composition?.cruise_ship_analysis || 'No data available'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trade Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Globe className="mr-2 h-5 w-5" />
                      Trade Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Primary Trade Routes</h4>
                        <div className="flex flex-wrap gap-2">
                          {processedData.analysis.trade_insights?.primary_trade_routes?.map((route: string, idx: number) => (
                            <Badge key={idx} variant="outline">{route}</Badge>
                          )) || <span className="text-sm text-muted-foreground">No data available</span>}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Container Trade Trends</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.trade_insights?.container_trade_trends || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Cruise Tourism Trends</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.trade_insights?.cruise_tourism_trends || 'No data available'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Strategic Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <TrendingUp className="mr-2 h-5 w-5" />
                      Strategic Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Container Terminal Optimization</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.strategic_recommendations?.container_terminal_optimization?.map((rec: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              {rec}
                            </li>
                          )) || <li>No recommendations available</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Cruise Infrastructure Enhancement</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.strategic_recommendations?.cruise_infrastructure_enhancement?.map((enh: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-500 mt-1">•</span>
                              {enh}
                            </li>
                          )) || <li>No enhancement recommendations available</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Brisbane Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Container className="mr-2 h-5 w-5" />
                      Brisbane Port Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Container Hub Strengths</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.brisbane_insights?.container_hub_strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-500 mt-1">✓</span>
                              {strength}
                            </li>
                          )) || <li>No strengths data available</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Cruise Destination Advantages</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.brisbane_insights?.cruise_destination_advantages?.map((adv: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-500 mt-1">✓</span>
                              {adv}
                            </li>
                          )) || <li>No advantages data available</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Growth Opportunities</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.brisbane_insights?.growth_opportunities?.map((opp: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-500 mt-1">→</span>
                              {opp}
                            </li>
                          )) || <li>No growth opportunities data available</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Brisbane Container Terminal Card */}
                <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg text-white">
                      <Container className="mr-2 h-5 w-5" />
                      Brisbane Container Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-100 text-sm">Container Terminal</span>
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                          {processedData.containerShips.length > 0 ? 'Active' : 'Standby'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-100 text-sm">Cruise Terminal</span>
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                          {processedData.cruiseShips.length > 0 ? 'Active' : 'Seasonal'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-100 text-sm">Asia-Pacific Gateway</span>
                        <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                          24/7
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "AI Analysis" to generate comprehensive Brisbane port insights
                  </p>
                  <Button onClick={() => fetchBrisbaneData(true)} disabled={analyzing}>
                    <BarChart3 className={`mr-2 h-4 w-4 ${analyzing ? 'animate-pulse' : ''}`} />
                    {analyzing ? 'Analyzing...' : 'Generate Analysis'}
                  </Button>
                </CardContent>
              </Card>
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