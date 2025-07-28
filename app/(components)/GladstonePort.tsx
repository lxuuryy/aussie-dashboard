'use client'
import { useState, useEffect } from 'react';
import { 
  Ship, Anchor, Clock, TrendingUp, MapPin, Activity, Search, Filter, RefreshCw, 
  AlertCircle, BarChart3, Gauge, Calendar, Flag, Users, Archive, Navigation,
  ArrowUp, ArrowDown, Timer, Building, Globe, Truck, FileText, Zap, Factory,
  Mountain, Flame, Package, Battery, Fuel, Droplets, Beaker, Layers
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
  coalCarriers: ShipMovement[];
  lngTankers: ShipMovement[];
  bulkCarriers: ShipMovement[];
  aluminaCarriers: ShipMovement[];
  analysis: any;
}

interface GladstonePortData {
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

export default function GladstonePortDashboard() {
  const [data, setData] = useState<GladstonePortData | null>(null);
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
  const [activeTab, setActiveTab] = useState<'overview' | 'inport' | 'arrivals' | 'history' | 'analytics' | 'commodities'>('overview');
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch Gladstone vessel data
  const fetchGladstoneData = async (withAnalysis = false) => {
    setLoading(true);
    setError(null);
    if (withAnalysis) setAnalyzing(true);

    try {
      const url = withAnalysis 
        ? '/api/scrape-gladstone-vessels?analyze=true'
        : '/api/scrape-gladstone-vessels';
        
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
    fetchGladstoneData();
    
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => fetchGladstoneData(), 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getFlagEmoji = (flagCode: string) => {
    const flagMap: { [key: string]: string } = {
      'AU': '🇦🇺', 'SG': '🇸🇬', 'PA': '🇵🇦', 'LR': '🇱🇷', 'HK': '🇭🇰',
      'MT': '🇲🇹', 'MH': '🇲🇭', 'NO': '🇳🇴', 'CY': '🇨🇾', 'JP': '🇯🇵',
      'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'NL': '🇳🇱', 'DK': '🇩🇰',
      'CN': '🇨🇳', 'KR': '🇰🇷', 'MY': '🇲🇾', 'TH': '🇹🇭', 'IN': '🇮🇳',
      'QA': '🇶🇦', 'OM': '🇴🇲', 'AE': '🇦🇪', 'SA': '🇸🇦', 'KW': '🇰🇼',
    };
    return flagMap[flagCode] || '🏴';
  };

  const getVesselSizeCategory = (size: string) => {
    const sizeNum = parseInt(size);
    if (sizeNum > 300) return { category: 'Q-Max/Q-Flex', color: 'bg-purple-100 text-purple-800' };
    if (sizeNum > 250) return { category: 'Large LNG/Cape', color: 'bg-red-100 text-red-800' };
    if (sizeNum > 200) return { category: 'Conventional LNG', color: 'bg-orange-100 text-orange-800' };
    if (sizeNum > 100) return { category: 'Handymax', color: 'bg-yellow-100 text-yellow-800' };
    if (sizeNum > 50) return { category: 'Handysize', color: 'bg-blue-100 text-blue-800' };
    return { category: 'Coastal', color: 'bg-gray-100 text-gray-800' };
  };

  const getCargoTypeIcon = (vesselType: string) => {
    if (vesselType?.toLowerCase().includes('lng') || vesselType?.toLowerCase().includes('gas')) {
      return <Fuel className="h-4 w-4 text-blue-600" />;
    } else if (vesselType?.toLowerCase().includes('coal')) {
      return <Mountain className="h-4 w-4 text-gray-800" />;
    } else if (vesselType?.toLowerCase().includes('alumina') || vesselType?.toLowerCase().includes('bauxite')) {
      return <Layers className="h-4 w-4 text-red-600" />;
    } else if (vesselType?.toLowerCase().includes('bulk')) {
      return <Package className="h-4 w-4 text-amber-600" />;
    } else if (vesselType?.toLowerCase().includes('tanker') || vesselType?.toLowerCase().includes('chemical')) {
      return <Droplets className="h-4 w-4 text-blue-600" />;
    }
    return <Ship className="h-4 w-4 text-gray-600" />;
  };

  const getCommodityColor = (vesselType: string) => {
    if (vesselType?.toLowerCase().includes('lng') || vesselType?.toLowerCase().includes('gas')) {
      return 'bg-blue-500';
    } else if (vesselType?.toLowerCase().includes('coal')) {
      return 'bg-gray-700';
    } else if (vesselType?.toLowerCase().includes('alumina') || vesselType?.toLowerCase().includes('bauxite')) {
      return 'bg-red-500';
    } else if (vesselType?.toLowerCase().includes('bulk')) {
      return 'bg-amber-500';
    }
    return 'bg-slate-500';
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-center text-muted-foreground">Loading Gladstone Port data...</p>
            <p className="text-center text-sm text-muted-foreground">
              Scraping LNG, coal & alumina operations...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Error:</strong> {error}
              </AlertDescription>
            </Alert>
            <Button onClick={() => fetchGladstoneData()} className="mt-4">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Factory className="h-8 w-8 text-blue-600" />
                  <Fuel className="h-4 w-4 text-blue-500 absolute -top-1 -right-1" />
                </div>
                <div>
                  <CardTitle className="text-2xl md:text-3xl text-blue-800">Port of Gladstone Dashboard</CardTitle>
                  <CardDescription>Australia's largest multi-commodity port • LNG • Coal • Alumina</CardDescription>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => fetchGladstoneData()}
                  disabled={loading}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Refreshing...' : 'Refresh'}
                </Button>
                
                <Button
                  onClick={() => fetchGladstoneData(true)}
                  disabled={analyzing}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
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

          {/* Gladstone Stats Cards */}
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">In Port</p>
                      <p className="text-2xl font-bold">{processedData.inPortCount}</p>
                    </div>
                    <Anchor className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-cyan-100 text-sm">Expected</p>
                      <p className="text-2xl font-bold">{processedData.expectedArrivals}</p>
                    </div>
                    <Clock className="h-8 w-8 text-cyan-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">LNG Tankers</p>
                      <p className="text-2xl font-bold">{processedData.lngTankers?.length || 0}</p>
                    </div>
                    <Fuel className="h-8 w-8 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-gray-700 to-gray-800 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-100 text-sm">Coal Carriers</p>
                      <p className="text-2xl font-bold">{processedData.coalCarriers?.length || 0}</p>
                    </div>
                    <Mountain className="h-8 w-8 text-gray-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm">Alumina</p>
                      <p className="text-2xl font-bold">{processedData.aluminaCarriers?.length || 0}</p>
                    </div>
                    <Layers className="h-8 w-8 text-red-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-100 text-sm">Total Activity</p>
                      <p className="text-2xl font-bold">{processedData.totalVessels}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-indigo-200" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Commodity Performance Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <BarChart3 className="mr-2 h-5 w-5" />
              Multi-Commodity Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <div className="flex items-center space-x-3">
                  <Fuel className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">LNG Export</p>
                    <p className="text-xs text-blue-600">Liquefied Natural Gas</p>
                  </div>
                </div>
                <Badge className="bg-blue-500 text-white">{processedData.lngTankers?.length || 0}</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border-l-4 border-gray-700">
                <div className="flex items-center space-x-3">
                  <Mountain className="h-6 w-6 text-gray-700" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Coal Export</p>
                    <p className="text-xs text-gray-600">Thermal & Metallurgical</p>
                  </div>
                </div>
                <Badge className="bg-gray-700 text-white">{processedData.coalCarriers?.length || 0}</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <div className="flex items-center space-x-3">
                  <Layers className="h-6 w-6 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Alumina Export</p>
                    <p className="text-xs text-red-600">Refined Bauxite</p>
                  </div>
                </div>
                <Badge className="bg-red-500 text-white">{processedData.aluminaCarriers?.length || 0}</Badge>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                <div className="flex items-center space-x-3">
                  <Package className="h-6 w-6 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Bulk Cargo</p>
                    <p className="text-xs text-amber-600">General Commodities</p>
                  </div>
                </div>
                <Badge className="bg-amber-500 text-white">{processedData.bulkCarriers?.length || 0}</Badge>
              </div>
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
                  placeholder="Search vessels, cargo types, flags..."
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
                  <SelectItem value="large">Q-Max/Large (300m+)</SelectItem>
                  <SelectItem value="medium">Conventional (200-300m)</SelectItem>
                  <SelectItem value="small">Handysize (&lt;200m)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.cargoType || "all"} onValueChange={(value) => setFilters({...filters, cargoType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Cargo Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cargo</SelectItem>
                  <SelectItem value="lng">LNG</SelectItem>
                  <SelectItem value="coal">Coal</SelectItem>
                  <SelectItem value="alumina">Alumina</SelectItem>
                  <SelectItem value="bulk">Bulk Commodities</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.vesselType || "all"} onValueChange={(value) => setFilters({...filters, vesselType: value === "all" ? "" : value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="lng">LNG Tanker</SelectItem>
                  <SelectItem value="coal">Coal Carrier</SelectItem>
                  <SelectItem value="alumina">Alumina Carrier</SelectItem>
                  <SelectItem value="bulk">Bulk Carrier</SelectItem>
                  <SelectItem value="tanker">Chemical Tanker</SelectItem>
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
                onClick={() => fetchGladstoneData()}
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
            <TabsTrigger value="history">Port Calls ({processedData.portCallHistory})</TabsTrigger>
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
                          <span className="truncate flex items-center gap-2">
                            {getCargoTypeIcon(type)}
                            {type}
                          </span>
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

              {/* LNG Export Hub */}
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center text-white">
                    <Fuel className="mr-2 h-5 w-5" />
                    LNG Export Hub
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100 text-sm">LNG Tankers Active</span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {processedData.lngTankers?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100 text-sm">Export Capacity</span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        {processedData.inPortCount > 40 ? 'High' : processedData.inPortCount > 20 ? 'Moderate' : 'Normal'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-blue-100 text-sm">LNG Trains</span>
                      <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                        3 Facilities
                      </Badge>
                    </div>
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
                      <div key={idx} className="flex items-center justify-between text-sm border-l-2 border-blue-500 pl-3">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {getCargoTypeIcon(call.vesselType || '')}
                            {call.vessel}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {formatDate(call.timestamp)}
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

              {/* Largest Vessels */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Ship className="mr-2 h-5 w-5" />
                    Largest Vessels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {processedData.largestVessels.slice(0, 5).map((vessel, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {getCargoTypeIcon(vessel.vesselType || '')}
                            {vessel.vessel}
                          </div>
                          <div className="text-xs text-muted-foreground">{vessel.dwt}</div>
                        </div>
                        <Badge className={getVesselSizeCategory(vessel.size).color}>
                          {vessel.size}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Multi-Commodity Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Gauge className="mr-2 h-5 w-5" />
                    Commodity Port Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Vessels Tracked</span>
                      <span className="font-medium">{processedData.totalVessels}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">LNG Export Share</span>
                      <span className="font-medium">
                        {Math.round(((processedData.lngTankers?.length || 0) / processedData.inPortCount) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Coal Export Share</span>
                      <span className="font-medium">
                        {Math.round(((processedData.coalCarriers?.length || 0) / processedData.inPortCount) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Commodity Diversity</span>
                      <span className="font-medium">{Object.keys(processedData.vesselTypes).length} Types</span>
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
                              <div className="text-sm" onClick={() => console.log(vessel.arrived)}>
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
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {getCargoTypeIcon(arrival.vesselType || '')}
                              {arrival.vessel}
                            </div>
                          </TableCell>
                          <TableCell>
                            {arrival.vesselType ? (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getCommodityColor(arrival.vesselType)} text-white border-none`}
                              >
                                {arrival.vesselType}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Unknown</span>
                            )}
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
                        <TableHead>Flag</TableHead>
                        <TableHead className="hidden md:table-cell">MMSI</TableHead>
                        <TableHead className="hidden lg:table-cell">IMO</TableHead>
                        <TableHead>Vessel Type</TableHead>
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
                          <TableCell>
                            {call.vesselType ? (
                              <Badge variant="secondary">{call.vesselType}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Unknown</span>
                            )}
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
        </Tabs>

        {/* Analytics Tab - Hidden but available if analysis data exists */}
        {processedData.analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <BarChart3 className="mr-2 h-5 w-5" />
                AI Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Multi-Commodity Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Activity className="mr-2 h-5 w-5" />
                      Multi-Commodity Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Commodity Balance</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.commodity_balance || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">LNG Export Performance</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.lng_export_performance || 'No data available'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Coal Export Performance</h4>
                        <p className="text-sm text-muted-foreground">
                          {processedData.analysis.port_activity_analysis?.coal_export_performance || 'No data available'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Gladstone Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Factory className="mr-2 h-5 w-5" />
                      Gladstone Port Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Multi-Commodity Strengths</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.gladstone_insights?.multi_commodity_strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-500 mt-1">✓</span>
                              {strength}
                            </li>
                          )) || <li>No strengths data available</li>}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">LNG Hub Advantages</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {processedData.analysis.gladstone_insights?.lng_hub_advantages?.map((advantage: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-1">→</span>
                              {advantage}
                            </li>
                          )) || <li>No LNG data available</li>}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

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