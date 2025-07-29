'use client'
import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { 
  Edit3, Save, X, RefreshCw, Plus, Trash2, Package, Ship, Calendar,
  Container, Loader, CheckCircle, Clock, AlertTriangle, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ShippingContainer {
  id: string;
  containerNumber: string;
  shippingLine: string;
  trackingMethod: string;
  status: 'pending' | 'in-transit' | 'delivered' | 'delayed';
}

interface Order {
  id: string;
  poNumber: string;
  salesContract?: string;
  status: string;
  createdAt: any; // Can be Firestore Timestamp or string
  orderDate?: any;
  shippingDetailNumber?: string;
  shippingLine?: string;
  trackingMethod?: string;
  shippingContainers: ShippingContainer[];
  authorizedEmails: string[];
  customerInfo?: any;
  totalAmount?: number;
}

export default function ShippingContainerManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);

  // Shipping lines options
  const shippingLines = [
    'MAERSK', 'MSC', 'CMA CGM', 'COSCO', 'HAPAG-LLOYD', 'ONE', 'EVERGREEN', 
    'YANG MING', 'HMM', 'PIL', 'ZEEM', 'OOCL', 'APL', 'MOL', 'WANHAI'
  ];

  // Tracking methods options
  const trackingMethods = [
    { value: 'BL_TRACKING', label: 'Bill of Lading' },
    { value: 'CONTAINER_TRACKING', label: 'Container Tracking' },
    { value: 'BOOKING_TRACKING', label: 'Booking Reference' },
    { value: 'MASTER_BL', label: 'Master Bill of Lading' },
    { value: 'HOUSE_BL', label: 'House Bill of Lading' },
    { value: 'VESSEL_TRACKING', label: 'Vessel Tracking' }
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'in-transit', label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
    { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800' },
    { value: 'delayed', label: 'Delayed', color: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm]);

  // Helper function to parse dates (same as invoice management)
  const parseCustomDate = (dateValue: any) => {
    if (!dateValue) return null;
    
    try {
      // If it's a Firestore Timestamp, convert it to Date
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        return dateValue.toDate();
      }
      
      // If it's already a Date object, return it
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      // If it's a string, try to parse your custom format
      if (typeof dateValue === 'string') {
        // Handle your format: "June 27, 2025 at 10:00:00 AM UTC+10"
        const cleanedDate = dateValue
          .replace(' at ', ' ')
          .replace(' UTC+10', '')
          .replace(' AM', ' AM')
          .replace(' PM', ' PM');
        
        const parsed = new Date(cleanedDate);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      
      // Last resort: try to create a Date from whatever we got
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
      
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return null;
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the same query pattern as invoice management
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          poNumber: data.poNumber || '',
          salesContract: data.salesContract,
          status: data.status || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : parseCustomDate(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : parseCustomDate(data.updatedAt),
          orderDate: parseCustomDate(data.orderDate),
          shippingDetailNumber: data.shippingDetailNumber,
          shippingLine: data.shippingLine,
          trackingMethod: data.trackingMethod,
          shippingContainers: data.shippingContainers || [],
          authorizedEmails: data.authorizedEmails || [],
          customerInfo: data.customerInfo,
          totalAmount: data.totalAmount,
        } as Order;
      });

      console.log('📦 Loaded orders:', ordersData.length);
      setOrders(ordersData);
      
    } catch (err) {
      console.error('Error loading orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.salesContract?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shippingLine?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.shippingDetailNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order.id);
    setEditFormData({
      shippingDetailNumber: order.shippingDetailNumber || '',
      shippingLine: order.shippingLine || '',
      trackingMethod: order.trackingMethod || 'CONTAINER_TRACKING',
      shippingContainers: order.shippingContainers || []
    });
  };

  const handleCancelEdit = () => {
    setEditingOrder(null);
    setEditFormData({});
  };

  const updateContainer = (index: number, field: string, value: string) => {
    const updatedContainers = [...editFormData.shippingContainers];
    updatedContainers[index] = { ...updatedContainers[index], [field]: value };
    setEditFormData({ ...editFormData, shippingContainers: updatedContainers });
  };

  const addContainer = () => {
    const newContainer = {
      id: `container_${Date.now()}`,
      containerNumber: '',
      shippingLine: editFormData.shippingLine || 'MAERSK',
      trackingMethod: editFormData.trackingMethod || 'CONTAINER_TRACKING',
      status: 'pending' as const
    };
    setEditFormData({
      ...editFormData,
      shippingContainers: [...editFormData.shippingContainers, newContainer]
    });
  };

  const removeContainer = (index: number) => {
    const updatedContainers = editFormData.shippingContainers.filter((_: any, i: number) => i !== index);
    setEditFormData({ ...editFormData, shippingContainers: updatedContainers });
  };

  const handleSaveOrder = async () => {
    if (!editingOrder) return;

    setSaving(true);
    try {
      const orderRef = doc(db, 'orders', editingOrder);
      
      await updateDoc(orderRef, {
        shippingDetailNumber: editFormData.shippingDetailNumber,
        shippingLine: editFormData.shippingLine,
        trackingMethod: editFormData.trackingMethod,
        shippingContainers: editFormData.shippingContainers,
        updatedAt: new Date()
      });

      await fetchOrders();
      setEditingOrder(null);
      setEditFormData({});

    } catch (err) {
      console.error('Error saving order:', err);
      setError(err instanceof Error ? err.message : 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount || 0);
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return (
      <Badge className={statusOption?.color || 'bg-gray-100 text-gray-800'}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const getTrackingMethodLabel = (method: string) => {
    const found = trackingMethods.find(tm => tm.value === method);
    return found ? found.label : method;
  };

  const getCustomerDisplayName = (customerInfo: any) => {
    if (!customerInfo) return 'Unknown Company';
    
    if (typeof customerInfo === 'string') return customerInfo;
    
    if (customerInfo.companyName) {
      if (typeof customerInfo.companyName === 'string') {
        return customerInfo.companyName;
      }
      if (typeof customerInfo.companyName === 'object' && customerInfo.companyName.companyName) {
        return customerInfo.companyName.companyName;
      }
    }
    
    return 'Unknown Company';
  };

  // Calculate stats
  const totalContainers = orders.reduce((sum, order) => sum + (order.shippingContainers?.length || 0), 0);
  const ordersWithShipping = orders.filter(order => order.shippingDetailNumber || order.shippingContainers?.length > 0).length;
  const pendingContainers = orders.reduce((sum, order) => 
    sum + (order.shippingContainers?.filter(c => c.status === 'pending').length || 0), 0);
  const inTransitContainers = orders.reduce((sum, order) => 
    sum + (order.shippingContainers?.filter(c => c.status === 'in-transit').length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="max-w-md mx-auto mt-20">
            <CardContent className="text-center py-8">
              <div className="text-red-600 mb-4">Error: {error}</div>
              <Button onClick={fetchOrders}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Shipping Container Manager</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage and track shipping containers across all orders</p>
            </div>
            <Button onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Orders</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{orders.length}</p>
                  </div>
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Containers</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalContainers}</p>
                  </div>
                  <Container className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">In Transit</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{inTransitContainers}</p>
                  </div>
                  <Ship className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">With Shipping</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{ordersWithShipping}</p>
                  </div>
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search orders, containers, shipping lines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4"
              />
            </div>
            <div className="mt-2 text-xs sm:text-sm text-gray-600">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          {filteredOrders.length === 0 ? (
            <CardContent className="p-8 sm:p-12 text-center">
              <Ship className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600">Try adjusting your search criteria.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Details</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Containers</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{order.poNumber}</div>
                          <div className="text-sm text-gray-600">
                            {formatDate(order.createdAt || order.orderDate)}
                          </div>
                          {order.salesContract && (
                            <div className="text-sm text-gray-500">SC: {order.salesContract}</div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">
                            {getCustomerDisplayName(order.customerInfo)}
                          </div>
                          {order.totalAmount && (
                            <div className="text-sm text-gray-600">
                              {formatCurrency(order.totalAmount)}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      

                      <TableCell>
                        {editingOrder === order.id ? (
                          <div className="space-y-2 min-w-[250px]">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Containers ({editFormData.shippingContainers?.length || 0})</span>
                              <Button onClick={addContainer} size="sm" variant="outline">
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            {editFormData.shippingContainers?.map((container: ShippingContainer, index: number) => (
                              <div key={`edit-container-${index}`} className="border p-2 rounded bg-gray-50">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    value={container.containerNumber || ''}
                                    onChange={(e) => updateContainer(index, 'containerNumber', e.target.value)}
                                    placeholder="Container #"
                                    className="text-xs font-mono"
                                  />
                                  <Select
                                    value={container.shippingLine || ''}
                                    onValueChange={(value) => updateContainer(index, 'shippingLine', value)}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {shippingLines.map(line => (
                                        <SelectItem key={line} value={line}>{line}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={container.trackingMethod || ''}
                                    onValueChange={(value) => updateContainer(index, 'trackingMethod', value)}
                                  >
                                    <SelectTrigger className="text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {trackingMethods.map(method => (
                                        <SelectItem key={method.value} value={method.value}>
                                          {method.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    onClick={() => removeContainer(index)}
                                    size="sm"
                                    variant="destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )) || []}
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900 mb-2">
                              {order.shippingContainers?.length || 0} containers
                            </div>
                            {order.shippingContainers?.slice(0, 2).map((container, index) => (
                              <div key={`view-container-${index}`} className="text-sm text-gray-600 mb-1">
                                <div className="font-mono">{container.containerNumber}</div>
                                <div className="flex gap-2 items-center">
                                  <span>{container.shippingLine}</span>
                                  {getStatusBadge(container.status)}
                                </div>
                              </div>
                            ))}
                            {order.shippingContainers && order.shippingContainers.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{order.shippingContainers.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {editingOrder === order.id ? (
                          <div className="flex gap-2">
                            <Button 
                              onClick={handleSaveOrder} 
                              disabled={saving}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {saving ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button 
                              onClick={handleCancelEdit} 
                              disabled={saving}
                              size="sm"
                              variant="outline"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            onClick={() => handleEditOrder(order)}
                            size="sm"
                            variant="outline"
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <div className="text-red-600">Error: {error}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}