'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck, 
  DollarSign, 
  Loader, 
  User, 
  Building, 
  Mail, 
  Phone,
  Search,
  Filter,
  Calendar,
  MapPin,
  FileText,
  Eye
} from 'lucide-react';

// shadcn/ui imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MyOrdersPage = () => {
  // Mock data for demonstration
  const [orders, setOrders] = useState([
    {
      id: '1',
      poNumber: 'PO-12345',
      status: 'delivered',
      orderDate: new Date('2024-01-15'),
      estimatedDelivery: new Date('2024-01-20'),
      totalAmount: 2500.00,
      subtotal: 2272.73,
      gst: 227.27,
      items: [
        {
          itemCode: 'ST001',
          barType: 'Round Bar 20mm',
          productName: 'Steel Round Bar',
          category: 'Round Bars',
          material: 'Mild Steel',
          length: '6m',
          quantity: 10,
          pricePerTonne: 1200,
          unitPrice: 1200,
          dimensions: '20mm diameter'
        }
      ],
      customerInfo: {
        companyName: 'ABC Construction',
        contactPerson: 'John Smith',
        email: 'john@abc.com',
        phone: '+61 2 1234 5678'
      },
      deliveryAddress: '123 Industrial St, Sydney NSW 2000',
      reference: 'Project Alpha',
      notes: 'Urgent delivery required',
      authorizedEmails: ['john@abc.com', 'manager@abc.com']
    },
    {
      id: '2',
      poNumber: 'PO-12346',
      status: 'in-transit',
      orderDate: new Date('2024-01-18'),
      estimatedDelivery: new Date('2024-01-25'),
      totalAmount: 1800.00,
      subtotal: 1636.36,
      gst: 163.64,
      items: [
        {
          itemCode: 'ST002',
          barType: 'Flat Bar 50x10mm',
          productName: 'Steel Flat Bar',
          category: 'Flat Bars',
          material: 'Stainless Steel',
          length: '3m',
          quantity: 8,
          pricePerTonne: 1500,
          unitPrice: 1500,
          dimensions: '50x10mm'
        }
      ],
      customerInfo: {
        companyName: 'XYZ Manufacturing',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@xyz.com',
        phone: '+61 3 5678 9012'
      },
      deliveryAddress: '456 Factory Rd, Melbourne VIC 3000',
      reference: 'Order #789',
      notes: 'Handle with care'
    }
  ]);

  const [steelProducts] = useState([
    {
      id: 'p1',
      itemCode: 'ST003',
      productName: 'Angle Bar 25x25mm',
      category: 'Angle Bars',
      material: 'Galvanized Steel',
      pricePerTonne: 1300,
      currency: 'AUD',
      length: '6m',
      imageUrl: null,
      isActive: true,
      tags: ['structural', 'galvanized']
    },
    {
      id: 'p2',
      itemCode: 'ST004',
      productName: 'Square Tube 40x40mm',
      category: 'Square Tubes',
      material: 'Mild Steel',
      pricePerTonne: 1100,
      currency: 'AUD',
      length: '6m',
      imageUrl: null,
      isActive: true,
      tags: ['hollow', 'structural']
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [showPDFGenerator, setShowPDFGenerator] = useState(false);

  // Mock user data
  const user = {
    firstName: 'John',
    primaryEmailAddress: { emailAddress: 'john@example.com' }
  };

  const companyData = {
    companyName: 'Steel Solutions Ltd',
    abn: '12 345 678 901'
  };

  // Filter orders based on category and material
  const filteredOrders = useMemo(() => {
    if (!selectedCategory && !selectedMaterial) return orders;
    
    return orders.filter(order => {
      const categoryMatch = !selectedCategory || 
        order.items?.some(item => item.category === selectedCategory);
      
      const materialMatch = !selectedMaterial || 
        order.items?.some(item => item.material === selectedMaterial);
      
      return categoryMatch && materialMatch;
    });
  }, [orders, selectedCategory, selectedMaterial]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in-transit':
        return <Truck className="w-4 h-4 text-blue-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'delivered':
        return 'default';
      case 'in-transit':
        return 'secondary';
      case 'pending':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedMaterial('');
  };

  // Get unique categories and materials for filters
  const categories = [...new Set(orders.flatMap(order => 
    order.items?.map(item => item.category) || []
  ))];
  
  const materials = [...new Set(orders.flatMap(order => 
    order.items?.map(item => item.material) || []
  ))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full p-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="space-y-6"
      >
        <Card className="border-none shadow-lg bg-gradient-to-br from-background to-muted/20">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {user?.firstName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-3xl font-bold mb-2">
                  Welcome back, {user?.firstName || 'User'}
                </h1>
                <p className="text-muted-foreground">
                  {companyData ? `${companyData.companyName} • ` : ''}
                  Ready to manage your steel orders with excellence
                </p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-8 h-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-bold">{orders.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Delivered</p>
                      <p className="text-2xl font-bold text-green-600">
                        {orders.filter(o => o.status === 'delivered').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Truck className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">In Transit</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {orders.filter(o => o.status === 'in-transit').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-8 h-8 text-emerald-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Package className="w-6 h-6" />
                  My Orders
                </CardTitle>
                <CardDescription>
                  Manage and track your steel orders
                </CardDescription>
              </div>
              
              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select value={selectedCategory || "all"} onValueChange={(value) => setSelectedCategory(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedMaterial || "all"} onValueChange={(value) => setSelectedMaterial(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Materials</SelectItem>
                    {materials.map(material => (
                      <SelectItem key={material} value={material}>
                        {material}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {(selectedCategory || selectedMaterial) && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6" />
                          </div>
                          
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{order.poNumber}</h3>
                              <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-1">
                                {getStatusIcon(order.status)}
                                {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Ordered on {formatDate(order.orderDate)}
                            </p>
                            {order.estimatedDelivery && (
                              <p className="text-sm text-muted-foreground">
                                Delivery: {formatDate(order.estimatedDelivery)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(order.totalAmount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.items?.length || 0} item(s)
                          </p>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="mt-2">
                                <Eye className="w-4 h-4 mr-1" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Order Details - {order.poNumber}</DialogTitle>
                                <DialogDescription>
                                  Complete information about your order
                                </DialogDescription>
                              </DialogHeader>
                              
                              <Tabs defaultValue="overview" className="space-y-4">
                                <TabsList>
                                  <TabsTrigger value="overview">Overview</TabsTrigger>
                                  <TabsTrigger value="items">Items</TabsTrigger>
                                  <TabsTrigger value="customer">Customer Info</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="overview" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <Card>
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Calendar className="w-4 h-4" />
                                          <Label>Order Date</Label>
                                        </div>
                                        <p className="font-medium">{formatDate(order.orderDate)}</p>
                                      </CardContent>
                                    </Card>
                                    
                                    <Card>
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Truck className="w-4 h-4" />
                                          <Label>Status</Label>
                                        </div>
                                        <Badge variant={getStatusVariant(order.status)} className="flex items-center gap-1 w-fit">
                                          {getStatusIcon(order.status)}
                                          {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                                        </Badge>
                                      </CardContent>
                                    </Card>
                                  </div>
                                  
                                  {order.estimatedDelivery && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <MapPin className="w-4 h-4" />
                                          <Label>Estimated Delivery</Label>
                                        </div>
                                        <p className="font-medium">{formatDate(order.estimatedDelivery)}</p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  
                                  <Card>
                                    <CardContent className="p-4">
                                      <div className="flex justify-between items-center mb-2">
                                        <Label>Order Total</Label>
                                        <span className="text-2xl font-bold text-primary">
                                          {formatCurrency(order.totalAmount)}
                                        </span>
                                      </div>
                                      <div className="text-sm text-muted-foreground space-y-1">
                                        <div className="flex justify-between">
                                          <span>Subtotal:</span>
                                          <span>{formatCurrency(order.subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>GST:</span>
                                          <span>{formatCurrency(order.gst)}</span>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  
                                  {order.reference && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <Label>Reference</Label>
                                        <p className="mt-1">{order.reference}</p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  
                                  {order.notes && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <Label>Notes</Label>
                                        <p className="mt-1">{order.notes}</p>
                                      </CardContent>
                                    </Card>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="items" className="space-y-4">
                                  {order.items?.map((item, index) => (
                                    <Card key={index}>
                                      <CardContent className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                          <div>
                                            <Label>Product</Label>
                                            <p className="font-medium">{item.barType || item.productName}</p>
                                            <p className="text-sm text-muted-foreground">{item.itemCode}</p>
                                          </div>
                                          <div>
                                            <Label>Category</Label>
                                            <p>{item.category}</p>
                                            <p className="text-sm text-muted-foreground">{item.material}</p>
                                          </div>
                                          <div>
                                            <Label>Specifications</Label>
                                            <p>{item.length}</p>
                                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                          </div>
                                          <div>
                                            <Label>Price</Label>
                                            <p className="font-medium">{formatCurrency(item.pricePerTonne)}/tonne</p>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </TabsContent>
                                
                                <TabsContent value="customer" className="space-y-4">
                                  <Card>
                                    <CardContent className="p-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Building className="w-4 h-4" />
                                            <Label>Company</Label>
                                          </div>
                                          <p className="font-medium">{order.customerInfo?.companyName || 'N/A'}</p>
                                        </div>
                                        
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4" />
                                            <Label>Contact Person</Label>
                                          </div>
                                          <p className="font-medium">{order.customerInfo?.contactPerson || 'N/A'}</p>
                                        </div>
                                        
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Mail className="w-4 h-4" />
                                            <Label>Email</Label>
                                          </div>
                                          <p className="font-medium">{order.customerInfo?.email || 'N/A'}</p>
                                        </div>
                                        
                                        <div>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Phone className="w-4 h-4" />
                                            <Label>Phone</Label>
                                          </div>
                                          <p className="font-medium">{order.customerInfo?.phone || 'N/A'}</p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  
                                  {order.deliveryAddress && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                          <MapPin className="w-4 h-4" />
                                          <Label>Delivery Address</Label>
                                        </div>
                                        <p>{order.deliveryAddress}</p>
                                      </CardContent>
                                    </Card>
                                  )}
                                  
                                  {order.authorizedEmails && order.authorizedEmails.length > 0 && (
                                    <Card>
                                      <CardContent className="p-4">
                                        <Label>Authorized Users</Label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {order.authorizedEmails.map((email, index) => (
                                            <Badge key={index} variant="secondary">
                                              {email}
                                            </Badge>
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Alert>
                  <Package className="w-4 h-4" />
                  <AlertDescription>
                    No orders found matching your current filters.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Available Products</CardTitle>
            <CardDescription>
              Browse our steel product catalog
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {steelProducts.map((product) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold">{product.productName}</h3>
                        <p className="text-sm text-muted-foreground">{product.itemCode}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Badge variant="outline">{product.category}</Badge>
                        <Badge variant="secondary">{product.material}</Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(product.pricePerTonne)}/tonne
                        </span>
                        <Button variant="outline" size="sm">
                          Order Now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default MyOrdersPage;