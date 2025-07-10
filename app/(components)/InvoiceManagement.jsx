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
      // Calculate total revenue - with proper number parsing
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
        invoice.customerInfo?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          return (a.customerInfo?.companyName || '').localeCompare(b.customerInfo?.companyName || '');
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
        icon: CheckCircle,
        className: 'text-green-600 bg-green-100'
      };
    } else {
      return {
        status: 'pending',
        label: 'Pending PDF',
        icon: Clock,
        className: 'text-amber-600 bg-amber-100'
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
            <button
              onClick={fetchInvoices}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Invoices</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{invoices.length}</p>
                </div>
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Revenue</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
                </div>
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {invoices.filter(inv => inv.pdfUrl).length}
                  </p>
                </div>
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Pending PDF</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">
                    {invoices.filter(inv => !inv.pdfUrl).length}
                  </p>
                </div>
                <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg p-4 sm:p-6 border shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending PDF</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="date-desc">Latest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="company">Company Name</option>
            </select>

            {/* Results Count */}
            <div className="flex items-center text-xs sm:text-sm text-gray-600 sm:col-span-2 lg:col-span-1">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </div>
          </div>
        </div>

        {/* Responsive Invoices Table/Cards */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Details
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => {
                      const statusInfo = getStatusInfo(invoice);
                      const StatusIcon = statusInfo.icon;

                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
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
                          </td>

                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">
                                {invoice.customerInfo?.companyName || 'Unknown Company'}
                              </div>
                              <div className="text-sm text-gray-600">
                                {invoice.customerInfo?.contactPerson}
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.customerInfo?.email}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">
                                {invoice.items?.[0]?.barType} × {invoice.items?.[0]?.length}m
                              </div>
                              <div className="text-sm text-gray-600">
                                {invoice.items?.[0]?.totalWeight || invoice.items?.[0]?.quantity}t @ {formatCurrency(invoice.items?.[0]?.pricePerTonne || 0)}/t
                              </div>
                              <div className="text-sm text-gray-500">
                                {invoice.salesContract}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">
                              {formatCurrency(invoice.totalAmount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              GST: {formatCurrency(invoice.gst)}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {invoice.orderStatus && (
                              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                {invoice.orderStatus}
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {invoice.pdfUrl ? (
                                <button
                                  onClick={() => openInvoicePDF(invoice)}
                                  className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="View PDF"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 px-2 py-1">No PDF</span>
                              )}
                              <button
                                onClick={() => openPerformaInvoice(invoice)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Create Performa Invoice"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {/* Contract Editor Button */}
                              <button
                                onClick={() => openContractEditor(invoice)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Edit Contract Details"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              
                              
                              {/* Update Tracking Button */}
                              <button
                                onClick={() => router.push(`/orders/tracker/${invoice.poNumber}`)}
                                className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg transition-colors"
                                title="Update Order Tracking"
                              >
                                <Truck className="w-4 h-4" />
                              </button>
                              
                              {/* Show contract status */}
                              {invoice.contractUrl && (
                                <button
                                  onClick={() => window.open(invoice.contractUrl, '_blank')}
                                  className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                                  title="Open Sales Contract"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                {invoice.orderStatus}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mb-1">
                            {invoice.customerInfo?.companyName || 'Unknown Company'}
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
                              <div>Contact: {invoice.customerInfo?.contactPerson}</div>
                              <div>Email: {invoice.customerInfo?.email}</div>
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
                                <button
                                  onClick={() => openInvoicePDF(invoice)}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                  View PDF
                                </button>
                              ) : (
                                <span className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-500 rounded-lg">
                                  No PDF Available
                                </span>
                              )}

                              <button
                                onClick={() => openPerformaInvoice(invoice)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                title="Edit Open Performa Invoice"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => openContractEditor(invoice)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Contract
                              </button>
                              
                              <button
                                onClick={() => router.push(`/orders/tracker/${invoice.poNumber}`)}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
                              >
                                <Truck className="w-4 h-4" />
                                Track Order
                              </button>
                              
                              {invoice.contractUrl && (
                                <button
                                  onClick={() => window.open(invoice.contractUrl, '_blank')}
                                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  View Contract
                                </button>
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
        </div>
        
        {/* Sales Contract Generator Modal */}
        {showContractGenerator && selectedOrderForContract && (
          <SalesContractGenerator 
            order={selectedOrderForContract}
            onClose={closeSalesContractGenerator}
          />
        )}

        {/* Order Tracking Modal */}
        {showTrackingModal && selectedOrderForTracking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">Update Order Tracking</h2>
                  <button
                    onClick={closeTrackingModal}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Order: <span className="font-medium">{selectedOrderForTracking.poNumber}</span></p>
                  <p className="text-sm text-gray-600">Customer: <span className="font-medium">{selectedOrderForTracking.customerInfo?.companyName}</span></p>
                </div>

                <form onSubmit={handleTrackingSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Status *
                    </label>
                    <select
                      value={trackingData.status}
                      onChange={(e) => setTrackingData(prev => ({...prev, status: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select status...</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      value={trackingData.location}
                      onChange={(e) => setTrackingData(prev => ({...prev, location: e.target.value}))}
                      placeholder="e.g., Sydney Warehouse, Melbourne Distribution Center"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timestamp *
                    </label>
                    <input
                      type="datetime-local"
                      value={trackingData.timestamp}
                      onChange={(e) => setTrackingData(prev => ({...prev, timestamp: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note (Optional)
                    </label>
                    <textarea
                      value={trackingData.note}
                      onChange={(e) => setTrackingData(prev => ({...prev, note: e.target.value}))}
                      placeholder="Additional tracking information..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeTrackingModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingTracking}
                      className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {submittingTracking ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Add Tracking
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Show existing tracking points */}
                {selectedOrderForTracking.trackingPoints && selectedOrderForTracking.trackingPoints.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Tracking History</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedOrderForTracking.trackingPoints.slice(-3).reverse().map((point, index) => (
                        <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{point.status}</span>
                            <span className="text-gray-500">•</span>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceManagement;