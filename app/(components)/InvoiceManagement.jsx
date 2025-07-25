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
  ChevronRight
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
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
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

  // Helper function to safely render customer info
  // Helper function to safely render customer info
const getCustomerDisplayName = (customerInfo) => {
  if (!customerInfo) return 'Unknown Company';
  
  // Handle if customerInfo itself is a string
  if (typeof customerInfo === 'string') return customerInfo;
  
  // Handle nested companyName object structure
  if (customerInfo.companyName) {
    if (typeof customerInfo.companyName === 'string') {
      return customerInfo.companyName;
    }
    // If companyName is an object, get the companyName property from it
    if (typeof customerInfo.companyName === 'object' && customerInfo.companyName.companyName) {
      return customerInfo.companyName.companyName;
    }
  }
  
  return 'Unknown Company';
};

const getCustomerContactPerson = (customerInfo) => {
  if (!customerInfo || typeof customerInfo === 'string') return '';
  
  // Check direct contactPerson field first
  if (customerInfo.contactPerson) return customerInfo.contactPerson;
  
  // Check nested companyName object
  if (customerInfo.companyName && typeof customerInfo.companyName === 'object') {
    return customerInfo.companyName.contactPerson || '';
  }
  
  return '';
};

const getCustomerEmail = (customerInfo) => {
  if (!customerInfo || typeof customerInfo === 'string') return '';
  
  // Check direct email field first
  if (customerInfo.email) return customerInfo.email;
  
  // Check nested companyName object
  if (customerInfo.companyName && typeof customerInfo.companyName === 'object') {
    return customerInfo.companyName.email || '';
  }
  
  return '';
};

const getCustomerPhone = (customerInfo) => {
  if (!customerInfo || typeof customerInfo === 'string') return '';
  
  // Check direct phone field first
  if (customerInfo.phone) return customerInfo.phone;
  
  // Check nested companyName object
  if (customerInfo.companyName && typeof customerInfo.companyName === 'object') {
    return customerInfo.companyName.phone || '';
  }
  
  return '';
};

const getCustomerAddress = (customerInfo) => {
  if (!customerInfo || typeof customerInfo === 'string') return '';
  
  // Check direct address field first
  if (customerInfo.address) {
    if (typeof customerInfo.address === 'string') return customerInfo.address;
    if (customerInfo.address.fullAddress) return customerInfo.address.fullAddress;
    // Construct address from parts
    const parts = [
      customerInfo.address.street,
      customerInfo.address.city,
      customerInfo.address.state,
      customerInfo.address.postcode
    ].filter(Boolean);
    return parts.join(', ');
  }
  
  // Check nested companyName object
  if (customerInfo.companyName && typeof customerInfo.companyName === 'object' && customerInfo.companyName.address) {
    const addr = customerInfo.companyName.address;
    if (typeof addr === 'string') return addr;
    if (addr.fullAddress) return addr.fullAddress;
    const parts = [addr.street, addr.city, addr.state, addr.postcode].filter(Boolean);
    return parts.join(', ');
  }
  
  return '';
};

  // Helper function to parse your custom date format or Firestore Timestamps
  const parseCustomDate = (dateValue) => {
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

  // Toggle expanded row for mobile view
  const toggleRowExpansion = (invoiceId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedRows(newExpanded);
  };

  // Fetch invoices from Firebase
  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filter and sort invoices when filters change
  useEffect(() => {
    filterAndSortInvoices();
  }, [invoices, searchTerm, statusFilter, dateFilter, sortBy]);

  const fetchInvoices = async () => {
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
        // Convert Firestore timestamps to JavaScript dates
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : parseCustomDate(doc.data().createdAt),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : parseCustomDate(doc.data().updatedAt),
        pdfUploadedAt: doc.data().pdfUploadedAt?.toDate ? doc.data().pdfUploadedAt.toDate() : parseCustomDate(doc.data().pdfUploadedAt),
        // Parse any date format (Timestamp or custom string)
        orderDate: parseCustomDate(doc.data().orderDate),
        estimatedDelivery: parseCustomDate(doc.data().estimatedDelivery),
        deliveryDate: parseCustomDate(doc.data().deliveryDate) // Keep this for backward compatibility
      }));

      setInvoices(ordersData);
      
      // Calculate total revenue
      const revenue = ordersData.reduce((sum, invoice) => {
        let amount = 0;
        
        // Try different possible amount fields and parse them properly
        if (invoice.totalAmount) {
          amount = parseFloat(String(invoice.totalAmount).replace(/[^0-9.-]/g, ''));
        } else if (invoice.totals?.total) {
          amount = parseFloat(String(invoice.totals.total).replace(/[^0-9.-]/g, ''));
        } else if (invoice.total) {
          amount = parseFloat(String(invoice.total).replace(/[^0-9.-]/g, ''));
        }
        
        // Make sure we have a valid number
        if (isNaN(amount)) amount = 0;
        
        return sum + amount;
      }, 0);
      setTotalRevenue(revenue);

    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortInvoices = () => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.poNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCustomerDisplayName(invoice.customerInfo)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCustomerEmail(invoice.customerInfo)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.salesContract?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const hasPDF = !!invoice.pdfUrl;
        switch (statusFilter) {
          case 'completed':
            return hasPDF;
          case 'pending':
            return !hasPDF;
          default:
            return true;
        }
      });
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(invoice => {
        const invoiceDate = invoice.createdAt || invoice.orderDate;
        if (!invoiceDate) return false;

        switch (dateFilter) {
          case 'today':
            return invoiceDate >= startOfDay;
          case 'week':
            const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
            return invoiceDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
            return invoiceDate >= monthAgo;
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
          return getCustomerDisplayName(a.customerInfo).localeCompare(getCustomerDisplayName(b.customerInfo));
        default:
          return 0;
      }
    });

    setFilteredInvoices(filtered);
  };

  const getStatusInfo = (invoice) => {
    const hasPDF = !!invoice.pdfUrl;
    if (hasPDF) {
      return {
        status: 'completed',
        label: 'Completed',
        variant: 'default'
      };
    } else {
      return {
        status: 'pending',
        label: 'Pending PDF',
        variant: 'secondary'
      };
    }
  };

  const openInvoicePDF = (invoice) => {
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, '_blank');
    }
  };

  // Updated function to navigate to contract editor page
  const openContractEditor = (order) => {
    // Navigate to the contract editor page with the order ID
    router.push(`/orders/${order.id}`);
  };

  const openPerformaInvoice = (order) => {
    router.push(`/performa-invoice/${order.id}`);
  };

  const closeSalesContractGenerator = () => {
    setShowContractGenerator(false);
    setSelectedOrderForContract(null);
    // Refresh data to show updated contract status
    fetchInvoices();
  };

  // Tracking modal functions
  const openTrackingModal = (order) => {
    setSelectedOrderForTracking(order);
    setTrackingData({
      status: order.orderStatus || '',
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

      // Create tracking entry for orderTracker collection
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

      // Add to orderTracker collection
      await addDoc(collection(db, 'orderTracker'), trackingEntry);

      // Update the order's status and add to trackingPoints array
      const orderRef = doc(db, 'orders', selectedOrderForTracking.id);
      const existingTrackingPoints = selectedOrderForTracking.trackingPoints || [];
      
      await updateDoc(orderRef, {
        orderStatus: trackingData.status,
        trackingPoints: [...existingTrackingPoints, {
          status: trackingData.status,
          location: trackingData.location,
          note: trackingData.note,
          timestamp: new Date(trackingData.timestamp)
        }],
        updatedAt: new Date()
      });

      // Refresh the invoices list to show updated data
      await fetchInvoices();
      
      // Close modal
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading invoices...</p>
            </div>
          </div>
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Invoice Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage and track all customer purchase orders and invoices</p>
            </div>
            <Button onClick={fetchInvoices} className="self-start sm:self-auto">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Invoices</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{invoices.length}</p>
                  </div>
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Revenue</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                  </div>
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Completed</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {invoices.filter(inv => inv.pdfUrl).length}
                    </p>
                  </div>
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Pending PDF</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">
                      {invoices.filter(inv => !inv.pdfUrl).length}
                    </p>
                  </div>
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search invoices..."
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
                  <SelectItem value="pending">Pending PDF</SelectItem>
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
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-xs sm:text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
                Showing {filteredInvoices.length} of {invoices.length} invoices
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responsive Invoices Table/Cards */}
        <Card>
          {filteredInvoices.length === 0 ? (
            <CardContent className="p-8 sm:p-12 text-center">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </CardContent>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Details</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const statusInfo = getStatusInfo(invoice);

                      return (
                        <TableRow key={invoice.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{invoice.poNumber}</div>
                              <div className="text-sm text-gray-600">
                                {formatDate(invoice.createdAt || invoice.orderDate)}
                              </div>
                              {invoice.estimatedDelivery && (
                                <div className="text-sm text-gray-500">
                                  Delivery: {formatDate(invoice.estimatedDelivery)}
                                </div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">
                                {getCustomerDisplayName(invoice.customerInfo)}
                              </div>
                              <div className="text-sm text-gray-600">
                                {getCustomerContactPerson(invoice.customerInfo)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {getCustomerEmail(invoice.customerInfo)}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">
                                {invoice.items?.[0]?.productName} 
                              </div>
                              <div className="text-sm text-gray-600">
                                {invoice.items?.[0]?.totalWeight || invoice.items?.[0]?.quantity}t @ {formatCurrency(invoice.items?.[0]?.pricePerTonne || 0)}/t
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.salesContract}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="font-bold text-gray-900">
                              {formatCurrency(invoice.totalAmount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              GST: {formatCurrency(invoice.gst)}
                            </div>
                          </TableCell>

                          <TableCell>
                            {invoice.orderStatus && (
                              <Badge variant="secondary" className="capitalize">
                                {invoice.orderStatus}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              {invoice.pdfUrl ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openInvoicePDF(invoice)}
                                  title="View PDF"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Generate Purchase Order"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/edit-order-details/${invoice.poNumber}`)}
                                title="Edit Order Details"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {invoice.proformaInvoiceUrl ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.proformaInvoiceUrl, '_blank')}
                                  title="View Proforma Invoice"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPerformaInvoice(invoice)}
                                  title="Generate Proforma Invoice"
                                  className="text-amber-600 hover:text-amber-700"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {invoice.contractUrl ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.contractUrl, '_blank')}
                                  title="View Sales Contract"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openContractEditor(invoice)}
                                  title="Generate Sales Contract"
                                  className="text-amber-600 hover:text-amber-700"
                                >
                                  <AlertCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/orders/tracker/${invoice.poNumber}`)}
                                title="Update Order Tracking"
                              >
                                <Truck className="w-4 h-4" />
                              </Button>
                              {invoice.contractUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.contractUrl, '_blank')}
                                  title="Open Sales Contract"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
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
                {filteredInvoices.map((invoice) => {
                  const statusInfo = getStatusInfo(invoice);
                  const isExpanded = expandedRows.has(invoice.id);

                  return (
                    <div key={invoice.id} className="p-4 sm:p-6">
                      {/* Card Header - Always Visible */}
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleRowExpansion(invoice.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{invoice.poNumber}</h3>
                            {invoice.orderStatus && (
                              <Badge variant="secondary" className="capitalize">
                                {invoice.orderStatus}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {getCustomerDisplayName(invoice.customerInfo)}
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                           {formatCurrency(invoice.totalAmount)}
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="text-sm text-gray-500">
                           {formatDate(invoice.createdAt || invoice.orderDate)}
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
                             <div>Contact: {getCustomerContactPerson(invoice.customerInfo)}</div>
                             <div>Email: {getCustomerEmail(invoice.customerInfo)}</div>
                           </div>
                         </div>

                         {/* Product Details */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Product Details</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                             <div>Type: {invoice.items?.[0]?.barType} × {invoice.items?.[0]?.length}m</div>
                             <div>Weight: {invoice.items?.[0]?.totalWeight || invoice.items?.[0]?.quantity}t</div>
                             <div>Price: {formatCurrency(invoice.items?.[0]?.pricePerTonne || 0)}/t</div>
                             {invoice.salesContract && (
                               <div>Contract: {invoice.salesContract}</div>
                             )}
                           </div>
                         </div>

                         {/* Amount Details */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Amount Details</h4>
                           <div className="text-sm text-gray-600 space-y-1">
                            <div>Subtotal: {formatCurrency((invoice.totalAmount || 0) - (invoice.gst || 0))}</div>
                            <div>GST: {formatCurrency(invoice.gst || 0)}</div>
                            <div className="font-semibold text-gray-900">Total: {formatCurrency(invoice.totalAmount || 0)}</div>
                          </div>
                        </div>

                        {/* Delivery Info */}
                        {invoice.estimatedDelivery && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery</h4>
                            <div className="text-sm text-gray-600">
                              Estimated: {formatDate(invoice.estimatedDelivery)}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            {invoice.pdfUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openInvoicePDF(invoice)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View PDF
                              </Button>
                            ) : (
                              <Badge variant="secondary">
                                No PDF Available
                              </Badge>
                            )}

                           {invoice.proformaInvoiceUrl ? (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => window.open(invoice.proformaInvoiceUrl, '_blank')}
                               className="text-green-600 border-green-200 hover:bg-green-50"
                             >
                               <Eye className="w-4 h-4 mr-2" />
                               View Proforma
                             </Button>
                           ) : (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => openPerformaInvoice(invoice)}
                               className="text-amber-600 border-amber-200 hover:bg-amber-50"
                             >
                               <AlertCircle className="w-4 h-4 mr-2" />
                               Generate Proforma
                             </Button>
                           )}
                            
                            {invoice.contractUrl ? (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => window.open(invoice.contractUrl, '_blank')}
                               className="text-green-600 border-green-200 hover:bg-green-50"
                             >
                               <Eye className="w-4 h-4 mr-2" />
                               View Contract
                             </Button>
                           ) : (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => openContractEditor(invoice)}
                               className="text-amber-600 border-amber-200 hover:bg-amber-50"
                             >
                               <AlertCircle className="w-4 h-4 mr-2" />
                               Generate Contract
                             </Button>
                           )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/orders/tracker/${invoice.poNumber}`)}
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Track Order
                            </Button>
                            
                            {invoice.contractUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(invoice.contractUrl, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Contract
                              </Button>
                            )}
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
                    <div>Customer: <span className="font-medium">{getCustomerDisplayName(selectedOrderForTracking.customerInfo)}</span></div>
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
                      <SelectItem value="shipped">Shipped</SelectItem>
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
                    placeholder="e.g., Sydney Warehouse, Melbourne Distribution Center"
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