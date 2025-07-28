import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Ship, 
  Anchor, 
  MapPin, 
  TrendingUp, 
  Navigation,
  Container,
  Palmtree,
  Crown,
  Building,
  Waves,
  ArrowRight,
  Activity
} from 'lucide-react'
import Link from 'next/link'

type Props = {}

const page = (props: Props) => {
  const ports = [
    {
      name: 'Sydney',
      route: '/sydney',
      description: 'Australia\'s premier cruise destination and iconic harbour',
      specialties: ['Cruise Ships', 'Ferry Services', 'Naval Operations', 'Tourism'],
      icon: <Navigation className="h-8 w-8" />,
      gradient: 'from-cyan-500 to-blue-600',
      stats: {
        vessels: '~45',
        traffic: 'High',
        specialty: 'Cruise Tourism'
      },
      features: [
        'Circular Quay Terminal',
        'Sydney Harbour Bridge',
        'Fleet Base East (Navy)',
        'Passenger Ferry Network'
      ]
    },
    {
      name: 'Melbourne',
      route: '/melbourne',
      description: 'Australia\'s largest container port and gateway to Victoria',
      specialties: ['Container Ships', 'Automotive', 'General Cargo', 'Multi-modal'],
      icon: <Container className="h-8 w-8" />,
      gradient: 'from-blue-500 to-slate-600',
      stats: {
        vessels: '~65',
        traffic: 'Very High',
        specialty: 'Container Hub'
      },
      features: [
        'Largest Container Terminal',
        'Automotive Import Hub',
        'VicPorts Operations',
        'Rail/Road Connectivity'
      ]
    },
    {
      name: 'Brisbane',
      route: '/brisbane',
      description: 'Queensland\'s major trade gateway and bulk commodity port',
      specialties: ['Bulk Commodities', 'Coal Export', 'General Cargo', 'Cruise'],
      icon: <Building className="h-8 w-8" />,
      gradient: 'from-orange-500 to-red-600',
      stats: {
        vessels: '~35',
        traffic: 'High',
        specialty: 'Bulk Cargo'
      },
      features: [
        'Coal Export Terminals',
        'Brisbane River Access',
        'Port of Brisbane Corp',
        'Cruise Ship Terminal'
      ]
    },
    {
      name: 'Newcastle',
      route: '/newcastle',
      description: 'World\'s largest coal export port and bulk commodity hub',
      specialties: ['Coal Export', 'Bulk Carriers', 'Grain Export', 'Steel'],
      icon: <Waves className="h-8 w-8" />,
      gradient: 'from-slate-500 to-gray-700',
      stats: {
        vessels: '~25',
        traffic: 'Moderate',
        specialty: 'Coal Export'
      },
      features: [
        'Coal Export Facilities',
        'Grain Terminal',
        'Steel Works Access',
        'Hunter River'
      ]
    },
    {
      name: 'Gladstone',
      route: '/gladstone',
      description: 'Major industrial port specializing in LNG and bulk exports',
      specialties: ['LNG Export', 'Coal Export', 'Alumina', 'Industrial'],
      icon: <Crown className="h-8 w-8" />,
      gradient: 'from-purple-500 to-indigo-600',
      stats: {
        vessels: '~20',
        traffic: 'Moderate',
        specialty: 'LNG Export'
      },
      features: [
        'LNG Export Facilities',
        'Curtis Island',
        'Alumina Refineries',
        'Coal Terminals'
      ]
    }
  ]

  const getSpecialtyIcon = (specialty: string) => {
    if (specialty.includes('Cruise')) return <Palmtree className="h-4 w-4" />
    if (specialty.includes('Container')) return <Container className="h-4 w-4" />
    if (specialty.includes('Naval') || specialty.includes('Steel')) return <Crown className="h-4 w-4" />
    if (specialty.includes('Ferry')) return <Navigation className="h-4 w-4" />
    if (specialty.includes('Bulk') || specialty.includes('Coal')) return <Building className="h-4 w-4" />
    if (specialty.includes('LNG') || specialty.includes('Industrial')) return <Activity className="h-4 w-4" />
    return <Ship className="h-4 w-4" />
  }

  const getTrafficColor = (traffic: string) => {
    switch (traffic) {
      case 'Very High': return 'bg-red-100 text-red-800'
      case 'High': return 'bg-orange-100 text-orange-800'
      case 'Moderate': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center items-center space-x-3 mb-4">
            <Ship className="h-12 w-12 text-blue-600" />
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Australian Port Dashboard
              </h1>
              <p className="text-xl text-gray-600 mt-2">
                Real-time vessel tracking across Australia's major ports
              </p>
            </div>
          </div>
          
          <div className="flex justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Live Data</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>AI Analysis</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Multi-Source</span>
            </div>
          </div>
        </div>

        {/* Port Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ports.map((port) => (
            <Card key={port.name} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className={`w-full h-32 bg-gradient-to-r ${port.gradient} rounded-t-lg  -mt-6 mb-4 flex items-center justify-center text-white relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative z-10 text-center">
                    {port.icon}
                    <h2 className="text-2xl font-bold mt-2">Port {port.name}</h2>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      {port.stats.traffic}
                    </Badge>
                  </div>
                </div>
                
                <CardTitle className="flex items-center justify-between">
                  <span>{port.name}</span>
                  <Badge className={getTrafficColor(port.stats.traffic)}>
                    {port.stats.vessels} vessels
                  </Badge>
                </CardTitle>
                <CardDescription className="text-sm">
                  {port.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Specialties */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Port Specialties</h4>
                  <div className="flex flex-wrap gap-2">
                    {port.specialties.map((specialty) => (
                      <Badge key={specialty} variant="outline" className="text-xs">
                        <div className="flex items-center gap-1">
                          {getSpecialtyIcon(specialty)}
                          {specialty}
                        </div>
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Key Features */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Key Features</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {port.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Traffic Level</p>
                    <p className="font-medium text-sm">{port.stats.traffic}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Specialty</p>
                    <p className="font-medium text-sm">{port.stats.specialty}</p>
                  </div>
                </div>

                {/* Action Button */}
                <Link href={port.route} className="w-full">
                  <Button className={`w-full bg-gradient-to-r ${port.gradient} hover:opacity-90 transition-all duration-200 group-hover:shadow-lg`}>
                    <span className="flex items-center justify-center space-x-2">
                      <span>View {port.name} Dashboard</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Stats Overview */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-700 text-white border-0">
          <CardContent className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
              <div>
                <h3 className="text-3xl font-bold">5</h3>
                <p className="text-blue-100 text-sm">Major Ports</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold">190+</h3>
                <p className="text-blue-100 text-sm">Active Vessels</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold">24/7</h3>
                <p className="text-blue-100 text-sm">Live Monitoring</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold">AI</h3>
                <p className="text-blue-100 text-sm">Powered Analysis</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold">Multi</h3>
                <p className="text-blue-100 text-sm">Data Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <MapPin className="mr-2 h-6 w-6" />
              About Australian Port Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Real-Time Vessel Tracking</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Monitor vessel movements across Australia's major ports with live data from multiple sources including 
                  MyShipTracking, VicPorts, and port authorities. Get real-time updates on arrivals, departures, and port calls.
                </p>
                
                <h4 className="font-medium mb-2">AI-Powered Analysis</h4>
                <p className="text-sm text-gray-600">
                  Advanced AI analysis provides strategic insights into port operations, traffic patterns, vessel compositions, 
                  and trade flows to support maritime intelligence and decision-making.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Port Specializations</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Container className="h-4 w-4 text-blue-600" />
                    <strong>Melbourne:</strong> Container hub & automotive imports
                  </li>
                  <li className="flex items-center gap-2">
                    <Palmtree className="h-4 w-4 text-green-600" />
                    <strong>Sydney:</strong> Cruise tourism & ferry operations
                  </li>
                  <li className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-orange-600" />
                    <strong>Brisbane:</strong> Bulk commodities & coal export
                  </li>
                  <li className="flex items-center gap-2">
                    <Waves className="h-4 w-4 text-gray-600" />
                    <strong>Newcastle:</strong> World's largest coal export port
                  </li>
                  <li className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-purple-600" />
                    <strong>Gladstone:</strong> LNG export & industrial operations
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default page