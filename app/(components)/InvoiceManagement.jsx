'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText, 
  Eye, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign,
  Building2,
  Package,
  ExternalLink,
  RefreshCw,
  Printer,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  FileSignature,
  Edit,
  Truck,
  X,
  Save,
  MapPin,
  ChevronDown,
  ChevronRight,
  Ship,
  Container,
  Award,
  ShoppingCart,
  Users,
  TrendingUp
} from 'lucide-react';
import { db } from '@/firebase';
import { collection, query, orderBy, getDocs, where, addDoc, updateDoc, doc } from 'firebase/firestore';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Import only the Sales Contract Generator (Editor will be a separate page)
import SalesContractGenerator from './SalesContractGenerator'; // Adjust path as needed

const InvoiceManagement = () => {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalWeight: 0,
    totalQuantity: 0,
    avgOrderValue: 0,
    topProducts: []
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [selectedOrderForContract, setSelectedOrderForContract] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Tracking modal states
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [trackingData, setTrackingData] = useState({
    status: '',
    location: '',
    note: '',
    timestamp: new Date().toISOString().slice(0, 16)
  });
  const [submittingTracking, setSubmittingTracking] = useState(false);

  // Helper function to safely get company name
  const getCompanyName = (order) => {
    if (order.companyData?.companyName) return order.companyData.companyName;
    if (order.customerInfo?.companyName) return order.customerInfo.companyName;
    if (order.customerCompanyData?.companyName) return order.customerCompanyData.companyName;
    return 'Unknown Company';
  };

  // Helper function to get contact person
  const getContactPerson = (order) => {
    if (order.companyData?.contactPerson) return order.companyData.contactPerson;
    if (order.customerInfo?.contactPerson) return order.customerInfo.contactPerson;
    if (order.signature?.signerName) return order.signature.signerName;
    return '';
  };

  // Helper function to get email
  const getEmail = (order) => {
    if (order.companyData?.email) return order.companyData.email;
    if (order.customerInfo?.email) return order.customerInfo.email;
    if (order.userEmail) return order.userEmail;
    return '';
  };

  // Helper function to get phone
  const getPhone = (order) => {
    if (order.companyData?.phone) return order.companyData.phone;
    if (order.customerInfo?.phone) return order.customerInfo.phone;
    return '';
  };

  // Helper function to get address
  const getAddress = (order) => {
    const address = order.companyData?.address || order.customerInfo?.address;
    if (address?.fullAddress) return address.fullAddress;
    if (address) {
      const parts = [address.street, address.city, address.state, address.postcode].filter(Boolean);
      return parts.join(', ');
    }
    return '';
  };

  // Helper function to get delivery address
  const getDeliveryAddress = (order) => {
    const address = order.deliveryAddress;
    if (address?.fullAddress) return address.fullAddress;
    if (address) {
      const parts = [address.street, address.city, address.state, address.postcode].filter(Boolean);
      return parts.join(', ');
    }
    return '';
  };

  // Helper function to parse dates
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        return dateValue.toDate();
      }
      
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
      }
      
      const parsed = new Date(dateValue);
      return isNaN(parsed.getTime()) ? null : parsed;
      
    } catch (error) {
      console.error('Error parsing date:', dateValue, error);
      return null;
    }
  };

  // Toggle expanded row for mobile view
  const toggleRowExpansion = (orderId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
  };

  // Fetch orders from Firebase
  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter and sort orders when filters change
  useEffect(() => {
    filterAndSortOrders();
  }, [orders, searchTerm, statusFilter, dateFilter, categoryFilter, sortBy]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : parseDate(doc.data().createdAt),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : parseDate(doc.data().updatedAt),
        orderDate: parseDate(doc.data().orderDate),
        estimatedDelivery: parseDate(doc.data().estimatedDelivery),
        contractUploadedAt: parseDate(doc.data().contractUploadedAt),
        signedAt: parseDate(doc.data().signedAt)
      }));

      setOrders(ordersData);
      calculateStats(ordersData);

    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (ordersData) => {
    const totalRevenue = ordersData.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = ordersData.length;
    const completedOrders = ordersData.filter(order => order.status === 'completed' || order.contractStatus === 'signed').length;
    const pendingOrders = ordersData.filter(order => order.status === 'pending' || !order.contractStatus).length;
    
    // Calculate total weight and quantity
    let totalWeight = 0;
    let totalQuantity = 0;
    const productCount = {};

    ordersData.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          totalWeight += item.totalWeight || item.weight || 0;
          totalQuantity += item.quantity || 0;
          
          // Count products for top products
          const productKey = item.productName || item.barType || 'Unknown Product';
          productCount[productKey] = (productCount[productKey] || 0) + (item.quantity || 0);
        });
      }
    });

    // Get top 5 products
    const topProducts = Object.entries(productCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([product, quantity]) => ({ product, quantity }));

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    setStats({
      totalRevenue,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalWeight,
      totalQuantity,
      avgOrderValue,
      topProducts
    });
  };

  const filterAndSortOrders = () => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCompanyName(order)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEmail(order)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.salesContract?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items?.some(item => 
          item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.barType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.itemCode?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => {
        switch (statusFilter) {
          case 'completed':
            return order.contractStatus === 'signed' || order.status === 'completed';
          case 'pending':
            return order.status === 'pending' || !order.contractStatus;
          case 'shipped':
            return order.shippingContainers && order.shippingContainers.length > 0;
          case 'contract-signed':
            return order.contractStatus === 'signed';
          case 'pdf-available':
            return !!order.pdfUrl;
          default:
            return true;
        }
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.category === categoryFilter);
      });
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(order => {
        const orderDate = order.createdAt || order.orderDate;
        if (!orderDate) return false;

        switch (dateFilter) {
          case 'today':
            return orderDate >= startOfDay;
          case 'week':
            const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
            return orderDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
            return orderDate >= monthAgo;
          case 'quarter':
            const quarterAgo = new Date(startOfDay.getTime() - 90 * 24 * 60 * 60 * 1000);
            return orderDate >= quarterAgo;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.createdAt || b.orderDate || 0) - (a.createdAt || a.orderDate || 0);
        case 'date-asc':
          return (a.createdAt || a.orderDate || 0) - (b.createdAt || b.orderDate || 0);
        case 'amount-desc':
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case 'amount-asc':
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case 'company':
          return getCompanyName(a).localeCompare(getCompanyName(b));
        case 'po-number':
          return (a.poNumber || '').localeCompare(b.poNumber || '');
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const getOrderStatus = (order) => {
    if (order.contractStatus === 'signed') {
      return { status: 'completed', label: 'Contract Signed', variant: 'default', color: 'bg-green-100 text-green-800' };
    }
    if (order.shippingContainers && order.shippingContainers.length > 0) {
      return { status: 'shipped', label: 'Shipped', variant: 'default', color: 'bg-blue-100 text-blue-800' };
    }
    if (order.pdfUrl) {
      return { status: 'processed', label: 'PDF Generated', variant: 'secondary', color: 'bg-purple-100 text-purple-800' };
    }
    if (order.status === 'pending') {
      return { status: 'pending', label: 'Pending', variant: 'secondary', color: 'bg-yellow-100 text-yellow-800' };
    }
    return { status: 'draft', label: 'Draft', variant: 'outline', color: 'bg-gray-100 text-gray-800' };
  };

  const openOrderPDF = (order) => {
    if (order.pdfUrl) {
      window.open(order.pdfUrl, '_blank');
    }
  };

  const openContractEditor = (order) => {
    router.push(`/orders/${order.id}`);
  };

  const openPerformaInvoice = (order) => {
    router.push(`/performa-invoice/${order.id}`);
  };

  const openShippingTracker = (order) => {
    if (order.shippingContainers && order.shippingContainers.length > 0) {
      const container = order.shippingContainers[0];
      const params = new URLSearchParams({
        containerNumber: container.containerNumber,
        shippingLine: container.shippingLine,
        trackingMethod: container.trackingMethod,
        containerIndex: '0'
      });
      router.push(`/orders/tracker/${order.id}?${params.toString()}`);
    } else {
      router.push(`/orders/tracker/${order.id}`);
    }
  };

  const closeSalesContractGenerator = () => {
    setShowContractGenerator(false);
    setSelectedOrderForContract(null);
    fetchOrders();
  };

  // Tracking modal functions
  const openTrackingModal = (order) => {
    setSelectedOrderForTracking(order);
    setTrackingData({
      status: order.status || '',
      location: '',
      note: '',
      timestamp: new Date().toISOString().slice(0, 16)
    });
    setShowTrackingModal(true);
  };

  const closeTrackingModal = () => {
    setShowTrackingModal(false);
    setSelectedOrderForTracking(null);
    setTrackingData({
      status: '',
      location: '',
      note: '',
      timestamp: new Date().toISOString().slice(0, 16)
    });
  };

  const handleTrackingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrderForTracking || !trackingData.status || !trackingData.location) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmittingTracking(true);

      const trackingEntry = {
        poNumber: selectedOrderForTracking.poNumber,
        orderId: selectedOrderForTracking.id,
        status: trackingData.status,
        location: trackingData.location,
        note: trackingData.note,
        timestamp: new Date(trackingData.timestamp),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'orderTracker'), trackingEntry);

      const orderRef = doc(db, 'orders', selectedOrderForTracking.id);
      const existingTrackingPoints = selectedOrderForTracking.trackingPoints || [];
      
      await updateDoc(orderRef, {
        status: trackingData.status,
        trackingPoints: [...existingTrackingPoints, {
          status: trackingData.status,
          location: trackingData.location,
          note: trackingData.note,
          timestamp: new Date(trackingData.timestamp)
        }],
        updatedAt: new Date()
      });

      await fetchOrders();
      closeTrackingModal();
      alert('Tracking information added successfully!');

    } catch (error) {
      console.error('Error adding tracking information:', error);
      alert('Failed to add tracking information. Please try again.');
    } finally {
      setSubmittingTracking(false);
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
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const formatWeight = (weight) => {
    if (!weight) return 'N/A';
    return `${weight.toLocaleString()} kg`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className=" mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Steel Orders Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage steel orders, contracts, and shipping for reinforcement products</p>
            </div>
            <Button onClick={fetchOrders} className="self-start sm:self-auto">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Orders</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalOrders}</p>
                  </div>
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Revenue</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Completed</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.completedOrders}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Pending</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.pendingOrders}</p>
                  </div>
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total Weight</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{formatWeight(stats.totalWeight)}</p>
                  </div>
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Avg Order</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrency(stats.avgOrderValue)}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="contract-signed">Contract Signed</SelectItem>
                  <SelectItem value="pdf-available">PDF Available</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Reinforcement">Reinforcement</SelectItem>
                  <SelectItem value="Steel Products">Steel Products</SelectItem>
                  <SelectItem value="Accessories">Accessories</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Latest First</SelectItem>
                  <SelectItem value="date-asc">Oldest First</SelectItem>
                  <SelectItem value="amount-desc">Highest Amount</SelectItem>
                  <SelectItem value="amount-asc">Lowest Amount</SelectItem>
                  <SelectItem value="company">Company Name</SelectItem>
                  <SelectItem value="po-number">PO Number</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-xs sm:text-sm text-gray-600">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responsive Orders Table/Cards */}
        <Card>
          {filteredOrders.length === 0 ? (
            <CardContent className="p-8 sm:p-12 text-center">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </CardContent>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Details</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Shipping</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const statusInfo = getOrderStatus(order);

                      return (
                        <TableRow key={order.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{order.poNumber}</div>
                              <div className="text-sm text-gray-600">
                                {formatDate(order.createdAt || order.orderDate)}
                              </div>
                              {order.salesContract && (
                                <div className="text-sm text-blue-600">
                                  {order.salesContract}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">
                                {getCompanyName(order)}
                              </div>
                              <div className="text-sm text-gray-600">
                                {getContactPerson(order)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {getEmail(order)}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              {order.items && order.items.length > 0 ? (
                                order.items.map((item, index) => (
                                  <div key={index} className="text-sm">
                                    <div className="font-medium text-gray-900">
                                     {item.productName || item.barType}
                                   </div>
                                   <div className="text-xs text-gray-500">
                                     {item.itemCode} • {item.quantity} units • {formatWeight(item.totalWeight || item.weight)}
                                   </div>
                                   {item.dimensions && (
                                     <div className="text-xs text-gray-400">
                                       {item.dimensions.diameter}mm × {item.dimensions.length}m
                                     </div>
                                   )}
                                 </div>
                               ))
                             ) : (
                               <div className="text-sm text-gray-500">No product data</div>
                             )}
                           </div>
                         </TableCell>

                         <TableCell>
                           <div>
                             <div className="font-bold text-gray-900">
                               {formatCurrency(order.totalAmount)}
                             </div>
                             <div className="text-sm text-gray-600">
                               Subtotal: {formatCurrency(order.subtotal)}
                             </div>
                             <div className="text-sm text-gray-500">
                               GST: {formatCurrency(order.gst)}
                             </div>
                           </div>
                         </TableCell>

                         <TableCell>
                           <div className="space-y-1">
                             {order.shippingContainers && order.shippingContainers.length > 0 ? (
                               order.shippingContainers.map((container, index) => (
                                 <div key={index} className="text-sm">
                                   <div className="flex items-center gap-1">
                                     <Container className="w-3 h-3 text-blue-600" />
                                     <span className="font-medium">{container.containerNumber}</span>
                                   </div>
                                   <div className="text-xs text-gray-500">
                                     {container.shippingLine} • {container.trackingMethod}
                                   </div>
                                 </div>
                               ))
                             ) : (
                               <div className="text-sm text-gray-500">
                                 {order.estimatedDelivery ? `ETA: ${formatDate(order.estimatedDelivery)}` : 'No shipping info'}
                               </div>
                             )}
                           </div>
                         </TableCell>

                         <TableCell>
                           <Badge className={statusInfo.color}>
                             {statusInfo.label}
                           </Badge>
                           {order.signature?.contractSigned && (
                             <div className="flex items-center gap-1 mt-1">
                               <Award className="w-3 h-3 text-green-600" />
                               <span className="text-xs text-green-600">Signed</span>
                             </div>
                           )}
                         </TableCell>

                         <TableCell>
                           <div className="flex items-center gap-1 flex-wrap">
                             {order.pdfUrl && (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => openOrderPDF(order)}
                                 title="View PDF"
                               >
                                 <Eye className="w-4 h-4" />
                               </Button>
                             )}
                             
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => router.push(`/edit-order-details/${order.poNumber}`)}
                               title="Edit Order"
                             >
                               <Edit className="w-4 h-4" />
                             </Button>

                             {order.proformaInvoiceUrl ? (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => window.open(order.proformaInvoiceUrl, '_blank')}
                                 title="View Proforma"
                                 className="text-green-600"
                               >
                                 <Eye className="w-4 h-4" />
                               </Button>
                             ) : (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => openPerformaInvoice(order)}
                                 title="Generate Proforma"
                                 className="text-amber-600"
                               >
                                 <FileText className="w-4 h-4" />
                               </Button>
                             )}

                             {order.contractUrl ? (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => window.open(order.contractUrl, '_blank')}
                                 title="View Contract"
                                 className="text-green-600"
                               >
                                 <FileSignature className="w-4 h-4" />
                               </Button>
                             ) : (
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => openContractEditor(order)}
                                 title="Generate Contract"
                                 className="text-amber-600"
                               >
                                 <AlertCircle className="w-4 h-4" />
                               </Button>
                             )}

                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => openShippingTracker(order)}
                               title="Track Shipment"
                             >
                               <Ship className="w-4 h-4" />
                             </Button>
                           </div>
                         </TableCell>
                       </TableRow>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>

             {/* Mobile/Tablet Card View */}
             <div className="lg:hidden divide-y divide-gray-200">
               {filteredOrders.map((order) => {
                 const statusInfo = getOrderStatus(order);
                 const isExpanded = expandedRows.has(order.id);

                 return (
                   <div key={order.id} className="p-4 sm:p-6">
                     {/* Card Header - Always Visible */}
                     <div 
                       className="flex items-center justify-between cursor-pointer"
                       onClick={() => toggleRowExpansion(order.id)}
                     >
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-3 mb-2">
                           <h3 className="font-semibold text-gray-900 truncate">{order.poNumber}</h3>
                           <Badge className={statusInfo.color}>
                             {statusInfo.label}
                           </Badge>
                           {order.signature?.contractSigned && (
                             <div className="flex items-center gap-1">
                               <Award className="w-3 h-3 text-green-600" />
                             </div>
                           )}
                         </div>
                         <div className="text-sm text-gray-600 mb-1">
                           {getCompanyName(order)}
                         </div>
                         <div className="text-lg font-bold text-gray-900">
                           {formatCurrency(order.totalAmount)}
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="text-sm text-gray-500">
                           {formatDate(order.createdAt || order.orderDate)}
                         </div>
                         {isExpanded ? (
                           <ChevronDown className="w-5 h-5 text-gray-400" />
                         ) : (
                           <ChevronRight className="w-5 h-5 text-gray-400" />
                         )}
                       </div>
                     </div>

                     {/* Expanded Details */}
                     {isExpanded && (
                       <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                         {/* Customer Details */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Customer Details</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                             <div>Contact: {getContactPerson(order)}</div>
                             <div>Email: {getEmail(order)}</div>
                             <div>Phone: {getPhone(order)}</div>
                             {order.companyData?.abn && (
                               <div>ABN: {order.companyData.abn}</div>
                             )}
                           </div>
                         </div>

                         {/* Product Details */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Product Details</h4>
                           <div className="space-y-2">
                             {order.items && order.items.length > 0 ? (
                               order.items.map((item, index) => (
                                 <div key={index} className="bg-gray-50 p-3 rounded-lg">
                                   <div className="font-medium text-sm">{item.productName || item.barType}</div>
                                   <div className="text-xs text-gray-600 mt-1">
                                     <div>Code: {item.itemCode}</div>
                                     <div>Quantity: {item.quantity} {item.pricePerUnit}</div>
                                     <div>Weight: {formatWeight(item.totalWeight || item.weight)}</div>
                                     {item.dimensions && (
                                       <div>Size: {item.dimensions.diameter}mm × {item.dimensions.length}m</div>
                                     )}
                                     <div>Material: {item.material}</div>
                                     {item.isACRSCertified && (
                                       <div className="flex items-center gap-1 mt-1">
                                         <Award className="w-3 h-3 text-green-600" />
                                         <span className="text-green-600">ACRS Certified</span>
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               ))
                             ) : (
                               <div className="text-sm text-gray-500">No product data</div>
                             )}
                           </div>
                         </div>

                         {/* Amount Details */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Amount Breakdown</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                             <div>Subtotal: {formatCurrency(order.subtotal)}</div>
                             <div>GST: {formatCurrency(order.gst)}</div>
                             <div className="font-semibold text-gray-900">Total: {formatCurrency(order.totalAmount)}</div>
                           </div>
                         </div>

                         {/* Shipping Details */}
                         {order.shippingContainers && order.shippingContainers.length > 0 && (
                           <div>
                             <h4 className="text-sm font-medium text-gray-900 mb-2">Shipping Details</h4>
                             <div className="space-y-2">
                               {order.shippingContainers.map((container, index) => (
                                 <div key={index} className="bg-blue-50 p-3 rounded-lg">
                                   <div className="flex items-center gap-2 font-medium text-sm">
                                     <Container className="w-4 h-4 text-blue-600" />
                                     {container.containerNumber}
                                   </div>
                                   <div className="text-xs text-gray-600 mt-1">
                                     <div>Shipping Line: {container.shippingLine}</div>
                                     <div>Tracking Method: {container.trackingMethod}</div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}

                         {/* Delivery Info */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Information</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                             {order.estimatedDelivery && (
                               <div>Estimated Delivery: {formatDate(order.estimatedDelivery)}</div>
                             )}
                             {order.deliveryTerms && (
                               <div>Terms: {order.deliveryTerms}</div>
                             )}
                             {getDeliveryAddress(order) && (
                               <div>Address: {getDeliveryAddress(order)}</div>
                             )}
                           </div>
                         </div>

                         {/* Contract & Payment Info */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Contract & Payment</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                             {order.salesContract && (
                               <div>Sales Contract: {order.salesContract}</div>
                             )}
                             {order.paymentTerms && (
                               <div>Payment Terms: {order.paymentTerms}</div>
                             )}
                             {order.signature?.contractSigned && (
                               <div className="flex items-center gap-1 text-green-600">
                                 <Award className="w-3 h-3" />
                                 Contract Signed by {order.signature.signerName}
                               </div>
                             )}
                           </div>
                         </div>

                         {/* Actions */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Actions</h4>
                           <div className="flex flex-wrap gap-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => router.push(`/edit-order-details/${order.poNumber}`)}
                             >
                               <Edit className="w-4 h-4 mr-2" />
                               Edit Order
                             </Button>

                             {order.pdfUrl && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => openOrderPDF(order)}
                               >
                                 <Eye className="w-4 h-4 mr-2" />
                                 View PDF
                               </Button>
                             )}

                             {order.proformaInvoiceUrl ? (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => window.open(order.proformaInvoiceUrl, '_blank')}
                                 className="text-green-600 border-green-200 hover:bg-green-50"
                               >
                                 <Eye className="w-4 h-4 mr-2" />
                                 View Proforma
                               </Button>
                             ) : (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => openPerformaInvoice(order)}
                                 className="text-amber-600 border-amber-200 hover:bg-amber-50"
                               >
                                 <FileText className="w-4 h-4 mr-2" />
                                 Generate Proforma
                               </Button>
                             )}

                             {order.contractUrl ? (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => window.open(order.contractUrl, '_blank')}
                                 className="text-green-600 border-green-200 hover:bg-green-50"
                               >
                                 <FileSignature className="w-4 h-4 mr-2" />
                                 View Contract
                               </Button>
                             ) : (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => openContractEditor(order)}
                                 className="text-amber-600 border-amber-200 hover:bg-amber-50"
                               >
                                 <AlertCircle className="w-4 h-4 mr-2" />
                                 Generate Contract
                               </Button>
                             )}

                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => openShippingTracker(order)}
                             >
                               <Ship className="w-4 h-4 mr-2" />
                               Track Shipment
                             </Button>
                           </div>
                         </div>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           </>
         )}
       </Card>
       
       {/* Sales Contract Generator Modal */}
       {showContractGenerator && selectedOrderForContract && (
         <SalesContractGenerator 
           order={selectedOrderForContract}
           onClose={closeSalesContractGenerator}
         />
       )}

       {/* Order Tracking Modal */}
       <Dialog open={showTrackingModal} onOpenChange={setShowTrackingModal}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Update Order Tracking</DialogTitle>
           </DialogHeader>

           {selectedOrderForTracking && (
             <div className="space-y-4">
               <Alert>
                 <AlertDescription>
                   <div className="space-y-1">
                     <div>Order: <span className="font-medium">{selectedOrderForTracking.poNumber}</span></div>
                     <div>Customer: <span className="font-medium">{getCompanyName(selectedOrderForTracking)}</span></div>
                   </div>
                 </AlertDescription>
               </Alert>

               <form onSubmit={handleTrackingSubmit} className="space-y-4">
                 <div>
                   <Label htmlFor="status">Order Status *</Label>
                   <Select 
                     value={trackingData.status} 
                     onValueChange={(value) => setTrackingData(prev => ({...prev, status: value}))}
                     required
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select status..." />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="pending">Pending</SelectItem>
                       <SelectItem value="confirmed">Confirmed</SelectItem>
                       <SelectItem value="processing">Processing</SelectItem>
                       <SelectItem value="manufactured">Manufactured</SelectItem>
                       <SelectItem value="shipped">Shipped</SelectItem>
                       <SelectItem value="in-transit">In Transit</SelectItem>
                       <SelectItem value="delivered">Delivered</SelectItem>
                       <SelectItem value="completed">Completed</SelectItem>
                       <SelectItem value="cancelled">Cancelled</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <div>
                   <Label htmlFor="location">Location *</Label>
                   <Input
                     id="location"
                     type="text"
                     value={trackingData.location}
                     onChange={(e) => setTrackingData(prev => ({...prev, location: e.target.value}))}
                     placeholder="e.g., Sydney Steel Mill, Brisbane Port, Melbourne Warehouse"
                     required
                   />
                 </div>

                 <div>
                   <Label htmlFor="timestamp">Timestamp *</Label>
                   <Input
                     id="timestamp"
                     type="datetime-local"
                     value={trackingData.timestamp}
                     onChange={(e) => setTrackingData(prev => ({...prev, timestamp: e.target.value}))}
                     required
                   />
                 </div>

                 <div>
                   <Label htmlFor="note">Note (Optional)</Label>
                   <Textarea
                     id="note"
                     value={trackingData.note}
                     onChange={(e) => setTrackingData(prev => ({...prev, note: e.target.value}))}
                     placeholder="Additional tracking information..."
                     rows={3}
                   />
                 </div>

                 <div className="flex gap-3 pt-4">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={closeTrackingModal}
                     className="flex-1"
                   >
                     Cancel
                   </Button>
                   <Button
                     type="submit"
                     disabled={submittingTracking}
                     className="flex-1"
                   >
                     {submittingTracking ? (
                       <>
                         <Loader className="w-4 h-4 mr-2 animate-spin" />
                         Adding...
                       </>
                     ) : (
                       <>
                         <Save className="w-4 h-4 mr-2" />
                         Add Tracking
                       </>
                     )}
                   </Button>
                 </div>
               </form>

               {/* Show existing tracking points */}
               {selectedOrderForTracking.trackingPoints && selectedOrderForTracking.trackingPoints.length > 0 && (
                 <div className="pt-4 border-t border-gray-200">
                   <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Tracking History</h3>
                   <div className="space-y-2 max-h-40 overflow-y-auto">
                     {selectedOrderForTracking.trackingPoints.slice(-3).reverse().map((point, index) => (
                       <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                         <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-xs capitalize">{point.status}</Badge>
                           <span className="text-gray-600">{point.location}</span>
                         </div>
                         <div className="text-gray-500 mt-1">
                           {formatDate(point.timestamp?.toDate ? point.timestamp.toDate() : point.timestamp)}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           )}
         </DialogContent>
       </Dialog>
     </div>
   </div>
 );
};

export default InvoiceManagement;