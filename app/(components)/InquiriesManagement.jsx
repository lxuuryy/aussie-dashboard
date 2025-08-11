'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageCircle, 
  Eye, 
  Search, 
  Filter, 
  Calendar, 
  Building2,
  Package,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
  Edit,
  X,
  Save,
  MapPin,
  ChevronDown,
  ChevronRight,
  Container,
  Scale,
  Globe,
  User,
  Mail,
  Phone,
  FileText,
  TrendingUp,
  Users,
  XCircle
} from 'lucide-react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot, 
  where,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import InquiryThread from './InquiryThread';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const InquiriesManagement = () => {
  const router = useRouter();
  const [inquiries, setInquiries] = useState([]);
  const [filteredInquiries, setFilteredInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [stats, setStats] = useState({
    totalInquiries: 0,
    pendingInquiries: 0,
    reviewedInquiries: 0,
    approvedInquiries: 0,
    rejectedInquiries: 0,
    urgentInquiries: 0,
    totalQuantity: 0,
    avgQuantity: 0
  });
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Status update modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedInquiryForUpdate, setSelectedInquiryForUpdate] = useState(null);
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: '',
    adminNotes: '',
    estimatedPrice: '',
    estimatedDelivery: ''
  });
  const [submittingStatusUpdate, setSubmittingStatusUpdate] = useState(false);

  // Thread states - simplified approach
  const [openThreads, setOpenThreads] = useState(new Set());

  // Toggle thread visibility
  const toggleThread = (inquiryId) => {
    const newOpenThreads = new Set(openThreads);
    if (newOpenThreads.has(inquiryId)) {
      newOpenThreads.delete(inquiryId);
    } else {
      newOpenThreads.add(inquiryId);
    }
    setOpenThreads(newOpenThreads);
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
  const toggleRowExpansion = (inquiryId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(inquiryId)) {
      newExpanded.delete(inquiryId);
    } else {
      newExpanded.add(inquiryId);
    }
    setExpandedRows(newExpanded);
  };

  // Fetch inquiries from Firebase with real-time updates
  useEffect(() => {
    const inquiriesQuery = query(
      collection(db, 'steelInquiries'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(inquiriesQuery, (snapshot) => {
      const inquiriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : parseDate(doc.data().createdAt),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : parseDate(doc.data().updatedAt),
        estimatedDelivery: parseDate(doc.data().deliveryDetails?.estimatedDelivery)
      }));

      setInquiries(inquiriesData);
      calculateStats(inquiriesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching inquiries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter and sort inquiries when filters change
  useEffect(() => {
    filterAndSortInquiries();
  }, [inquiries, searchTerm, statusFilter, urgencyFilter, dateFilter, sortBy]);

  const calculateStats = (inquiriesData) => {
    const totalInquiries = inquiriesData.length;
    const pendingInquiries = inquiriesData.filter(inquiry => inquiry.status === 'pending').length;
    const reviewedInquiries = inquiriesData.filter(inquiry => inquiry.status === 'reviewed').length;
    const approvedInquiries = inquiriesData.filter(inquiry => inquiry.status === 'approved').length;
    const rejectedInquiries = inquiriesData.filter(inquiry => inquiry.status === 'rejected').length;
    const urgentInquiries = inquiriesData.filter(inquiry => inquiry.deliveryDetails?.urgency === 'urgent').length;
    
    const totalQuantity = inquiriesData.reduce((sum, inquiry) => sum + (inquiry.quantityDetails?.amount || 0), 0);
    const avgQuantity = totalInquiries > 0 ? totalQuantity / totalInquiries : 0;

    setStats({
      totalInquiries,
      pendingInquiries,
      reviewedInquiries,
      approvedInquiries,
      rejectedInquiries,
      urgentInquiries,
      totalQuantity,
      avgQuantity
    });
  };

  const filterAndSortInquiries = () => {
    let filtered = [...inquiries];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(inquiry =>
        inquiry.inquiryNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.steelSpecifications?.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inquiry.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.status === statusFilter);
    }

    // Urgency filter
    if (urgencyFilter !== 'all') {
      filtered = filtered.filter(inquiry => inquiry.deliveryDetails?.urgency === urgencyFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(inquiry => {
        const inquiryDate = inquiry.createdAt;
        if (!inquiryDate) return false;

        switch (dateFilter) {
          case 'today':
            return inquiryDate >= startOfDay;
          case 'week':
            const weekAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
            return inquiryDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
            return inquiryDate >= monthAgo;
          case 'quarter':
            const quarterAgo = new Date(startOfDay.getTime() - 90 * 24 * 60 * 60 * 1000);
            return inquiryDate >= quarterAgo;
          default:
            return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'date-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'company':
          return (a.companyName || '').localeCompare(b.companyName || '');
        case 'inquiry-number':
          return (a.inquiryNumber || '').localeCompare(b.inquiryNumber || '');
        case 'urgency':
          const urgencyOrder = { urgent: 3, standard: 2, flexible: 1 };
          return (urgencyOrder[b.deliveryDetails?.urgency] || 0) - (urgencyOrder[a.deliveryDetails?.urgency] || 0);
        case 'quantity':
          return (b.quantityDetails?.amount || 0) - (a.quantityDetails?.amount || 0);
        default:
          return 0;
      }
    });

    setFilteredInquiries(filtered);
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'reviewed':
        return { label: 'Under Review', color: 'bg-blue-100 text-blue-800', icon: Eye };
      case 'approved':
        return { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-800', icon: AlertCircle };
    }
  };

  const getUrgencyInfo = (urgency) => {
    switch (urgency) {
      case 'urgent':
        return { label: 'Urgent', color: 'bg-red-100 text-red-800' };
      case 'standard':
        return { label: 'Standard', color: 'bg-blue-100 text-blue-800' };
      case 'flexible':
        return { label: 'Flexible', color: 'bg-green-100 text-green-800' };
      default:
        return { label: 'Standard', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const openStatusUpdateModal = (inquiry) => {
    setSelectedInquiryForUpdate(inquiry);
    setStatusUpdateData({
      status: inquiry.status || 'pending',
      adminNotes: inquiry.adminNotes || '',
      estimatedPrice: inquiry.estimatedPrice || '',
      estimatedDelivery: inquiry.estimatedDelivery ? 
        new Date(inquiry.estimatedDelivery).toISOString().slice(0, 10) : ''
    });
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    setShowStatusModal(false);
    setSelectedInquiryForUpdate(null);
    setStatusUpdateData({
      status: '',
      adminNotes: '',
      estimatedPrice: '',
      estimatedDelivery: ''
    });
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedInquiryForUpdate || !statusUpdateData.status) {
      alert('Please select a status');
      return;
    }

    try {
      setSubmittingStatusUpdate(true);

      const inquiryRef = doc(db, 'steelInquiries', selectedInquiryForUpdate.id);
      const updateData = {
        status: statusUpdateData.status,
        adminNotes: statusUpdateData.adminNotes.trim() || null,
        estimatedPrice: statusUpdateData.estimatedPrice ? Number(statusUpdateData.estimatedPrice) : null,
        estimatedDelivery: statusUpdateData.estimatedDelivery ? new Date(statusUpdateData.estimatedDelivery) : null,
        updatedAt: new Date(),
        lastUpdatedBy: 'admin' // You can replace with actual admin user info
      };

      await updateDoc(inquiryRef, updateData);
      
      closeStatusModal();
      alert('Inquiry status updated successfully!');

    } catch (error) {
      console.error('Error updating inquiry status:', error);
      alert('Failed to update inquiry status. Please try again.');
    } finally {
      setSubmittingStatusUpdate(false);
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

  const formatQuantity = (quantityDetails) => {
    if (!quantityDetails) return 'N/A';
    return `${quantityDetails.amount?.toLocaleString()} ${quantityDetails.unit || quantityDetails.type}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Loading inquiries...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Steel Inquiries Management</h1>
              <p className="text-gray-600 text-sm sm:text-base">Review and manage customer steel procurement inquiries</p>
            </div>
            <Button onClick={() => window.location.reload()} className="self-start sm:self-auto">
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
                    <p className="text-xs text-gray-600 mb-1">Total Inquiries</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalInquiries}</p>
                  </div>
                  <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Pending</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.pendingInquiries}</p>
                  </div>
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Reviewed</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.reviewedInquiries}</p>
                  </div>
                  <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Approved</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.approvedInquiries}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Urgent</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.urgentInquiries}</p>
                  </div>
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Avg Quantity</p>
                    <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.avgQuantity.toFixed(1)}</p>
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
                  placeholder="Search inquiries..."
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {/* Urgency Filter */}
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgency</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
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
                  <SelectItem value="company">Company Name</SelectItem>
                  <SelectItem value="inquiry-number">Inquiry Number</SelectItem>
                  <SelectItem value="urgency">Urgency Level</SelectItem>
                  <SelectItem value="quantity">Quantity</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-xs sm:text-sm text-gray-600">
                Showing {filteredInquiries.length} of {inquiries.length} inquiries
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responsive Inquiries Table/Cards */}
        <Card>
          {filteredInquiries.length === 0 ? (
            <CardContent className="p-8 sm:p-12 text-center">
              <MessageCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No inquiries found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
            </CardContent>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inquiry Details</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Steel Specifications</TableHead>
                      <TableHead>Quantity & Delivery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInquiries.map((inquiry) => {
                      const statusInfo = getStatusInfo(inquiry.status);
                      const urgencyInfo = getUrgencyInfo(inquiry.deliveryDetails?.urgency);
                      const StatusIcon = statusInfo.icon;

                      return (
                        <React.Fragment key={inquiry.id}>
                          <TableRow className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">{inquiry.inquiryNumber}</div>
                                <div className="text-sm text-gray-600">
                                  {formatDate(inquiry.createdAt)}
                                </div>
                                <Badge className={urgencyInfo.color + " mt-1"}>
                                  {urgencyInfo.label}
                                </Badge>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {inquiry.companyName}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {inquiry.contactPerson}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {inquiry.email}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {inquiry.phone}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {inquiry.steelSpecifications?.type}
                                </div>
                                {inquiry.steelSpecifications?.grade && (
                                  <div className="text-sm text-gray-600">
                                    Grade: {inquiry.steelSpecifications.grade}
                                  </div>
                                )}
                                {inquiry.steelSpecifications?.finish && (
                                  <div className="text-sm text-gray-500">
                                    Finish: {inquiry.steelSpecifications.finish}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {formatQuantity(inquiry.quantityDetails)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  Delivery: {formatDate(inquiry.estimatedDelivery)}
                                </div>
                                {inquiry.quantityDetails?.containerSize && (
                                  <div className="text-sm text-gray-500">
                                    {inquiry.quantityDetails.containerSize}
                                  </div>
                                )}
                                {inquiry.deliveryDetails?.incoterms && (
                                  <div className="text-sm text-gray-500">
                                    {inquiry.deliveryDetails.incoterms}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="space-y-2">
                                <Badge className={statusInfo.color}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                                {inquiry.estimatedPrice && (
                                  <div className="text-sm font-medium text-green-600">
                                    Est: {formatCurrency(inquiry.estimatedPrice)}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedInquiry(inquiry)}
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openStatusUpdateModal(inquiry)}
                                  title="Update Status"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>

                                {/* Thread Toggle Button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleThread(inquiry.id)}
                                  title="Discussion Thread"
                                  className={openThreads.has(inquiry.id) ? 'bg-blue-50 text-blue-600' : ''}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          
                          {/* Thread Row - Show when opened */}
                          {openThreads.has(inquiry.id) && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-gray-50 p-0">
                                <div className="p-4">
                                  <InquiryThread 
                                    inquiryId={inquiry.id} 
                                    inquiryNumber={inquiry.inquiryNumber} 
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                            )}
                       </React.Fragment>
                     );
                   })}
                 </TableBody>
               </Table>
             </div>

             {/* Mobile/Tablet Card View */}
             <div className="lg:hidden divide-y divide-gray-200">
               {filteredInquiries.map((inquiry) => {
                 const statusInfo = getStatusInfo(inquiry.status);
                 const urgencyInfo = getUrgencyInfo(inquiry.deliveryDetails?.urgency);
                 const StatusIcon = statusInfo.icon;
                 const isExpanded = expandedRows.has(inquiry.id);

                 return (
                   <div key={inquiry.id} className="p-4 sm:p-6">
                     {/* Card Header - Always Visible */}
                     <div 
                       className="flex items-center justify-between cursor-pointer"
                       onClick={() => toggleRowExpansion(inquiry.id)}
                     >
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-3 mb-2">
                           <h3 className="font-semibold text-gray-900 truncate">{inquiry.inquiryNumber}</h3>
                           <Badge className={statusInfo.color}>
                             <StatusIcon className="w-3 h-3 mr-1" />
                             {statusInfo.label}
                           </Badge>
                           <Badge className={urgencyInfo.color}>
                             {urgencyInfo.label}
                           </Badge>
                         </div>
                         <div className="text-sm text-gray-600 mb-1">
                           {inquiry.companyName}
                         </div>
                         <div className="text-sm font-medium text-gray-900">
                           {inquiry.steelSpecifications?.type} • {formatQuantity(inquiry.quantityDetails)}
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="text-sm text-gray-500">
                           {formatDate(inquiry.createdAt)}
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
                             <div className="flex items-center gap-2">
                               <User className="w-3 h-3" />
                               {inquiry.contactPerson}
                             </div>
                             <div className="flex items-center gap-2">
                               <Mail className="w-3 h-3" />
                               {inquiry.email}
                             </div>
                             <div className="flex items-center gap-2">
                               <Phone className="w-3 h-3" />
                               {inquiry.phone}
                             </div>
                           </div>
                         </div>

                         {/* Steel Specifications */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Steel Specifications</h4>
                           <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                             <div>Type: <span className="font-medium">{inquiry.steelSpecifications?.type}</span></div>
                             {inquiry.steelSpecifications?.grade && (
                               <div>Grade: <span className="font-medium">{inquiry.steelSpecifications.grade}</span></div>
                             )}
                             {inquiry.steelSpecifications?.finish && (
                               <div>Finish: <span className="font-medium">{inquiry.steelSpecifications.finish}</span></div>
                             )}
                             {inquiry.steelSpecifications?.specifications && (
                               <div className="mt-2">
                                 <div className="font-medium">Specifications:</div>
                                 <div className="text-gray-600">{inquiry.steelSpecifications.specifications}</div>
                               </div>
                             )}
                           </div>
                         </div>

                         {/* Quantity & Delivery */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-2">Quantity & Delivery</h4>
                           <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                             <div className="flex items-center gap-2">
                               <Scale className="w-3 h-3" />
                               Quantity: <span className="font-medium">{formatQuantity(inquiry.quantityDetails)}</span>
                             </div>
                             {inquiry.quantityDetails?.containerSize && (
                               <div className="flex items-center gap-2">
                                 <Container className="w-3 h-3" />
                                 Container: <span className="font-medium">{inquiry.quantityDetails.containerSize}</span>
                               </div>
                             )}
                             <div className="flex items-center gap-2">
                               <Calendar className="w-3 h-3" />
                               Est. Delivery: <span className="font-medium">{formatDate(inquiry.estimatedDelivery)}</span>
                             </div>
                             {inquiry.deliveryDetails?.incoterms && (
                               <div className="flex items-center gap-2">
                                 <Globe className="w-3 h-3" />
                                 Incoterms: <span className="font-medium">{inquiry.deliveryDetails.incoterms}</span>
                               </div>
                             )}
                           </div>
                         </div>

                         {/* Delivery Address */}
                         {inquiry.deliveryAddress?.fullAddress && (
                           <div>
                             <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Address</h4>
                             <div className="bg-gray-50 p-3 rounded-lg">
                               <div className="flex items-start gap-2 text-sm">
                                 <MapPin className="w-3 h-3 mt-1" />
                                 <span>{inquiry.deliveryAddress.fullAddress}</span>
                               </div>
                             </div>
                           </div>
                         )}

                         {/* Additional Information */}
                         {(inquiry.additionalInfo?.budgetRange || inquiry.additionalInfo?.projectDetails || inquiry.additionalInfo?.requirements) && (
                           <div>
                             <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Information</h4>
                             <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                               {inquiry.additionalInfo?.budgetRange && (
                                 <div>Budget: <span className="font-medium">{inquiry.additionalInfo.budgetRange}</span></div>
                               )}
                               {inquiry.additionalInfo?.projectDetails && (
                                 <div>
                                   <div className="font-medium">Project Details:</div>
                                   <div className="text-gray-600">{inquiry.additionalInfo.projectDetails}</div>
                                 </div>
                               )}
                               {inquiry.additionalInfo?.requirements && (
                                 <div>
                                   <div className="font-medium">Requirements:</div>
                                   <div className="text-gray-600">{inquiry.additionalInfo.requirements}</div>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}

                         {/* Inquiry Thread */}
                         <div>
                           <h4 className="text-sm font-medium text-gray-900 mb-3">Discussion Thread</h4>
                           <InquiryThread inquiryId={inquiry.id} inquiryNumber={inquiry.inquiryNumber} />
                         </div>

                         {/* Admin Information */}
                         {(inquiry.estimatedPrice || inquiry.adminNotes) && (
                           <div>
                             <h4 className="text-sm font-medium text-gray-900 mb-2">Admin Information</h4>
                             <div className="bg-blue-50 p-3 rounded-lg space-y-1 text-sm">
                               {inquiry.estimatedPrice && (
                                 <div>Estimated Price: <span className="font-medium text-green-600">{formatCurrency(inquiry.estimatedPrice)}</span></div>
                               )}
                               {inquiry.adminNotes && (
                                 <div>
                                   <div className="font-medium">Admin Notes:</div>
                                   <div className="text-gray-600">{inquiry.adminNotes}</div>
                                 </div>
                               )}
                             </div>
                           </div>
                         )}

                         {/* Actions */}
                         <div className="flex flex-wrap gap-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setSelectedInquiry(inquiry)}
                           >
                             <Eye className="w-4 h-4 mr-2" />
                             View Details
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => openStatusUpdateModal(inquiry)}
                           >
                             <Edit className="w-4 h-4 mr-2" />
                             Update Status
                           </Button>
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

       {/* Inquiry Details Modal */}
       <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
         <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Inquiry Details - {selectedInquiry?.inquiryNumber}</DialogTitle>
           </DialogHeader>

           {selectedInquiry && (
             <div className="space-y-6">
               {/* Status and Basic Info */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <h3 className="font-medium text-gray-900 mb-3">Status & Timeline</h3>
                   <div className="space-y-2">
                     <Badge className={getStatusInfo(selectedInquiry.status).color}>
                       {getStatusInfo(selectedInquiry.status).label}
                     </Badge>
                     <Badge className={getUrgencyInfo(selectedInquiry.deliveryDetails?.urgency).color}>
                       {getUrgencyInfo(selectedInquiry.deliveryDetails?.urgency).label}
                     </Badge>
                     <div className="text-sm text-gray-600 space-y-1">
                       <div>Created: {formatDate(selectedInquiry.createdAt)}</div>
                       <div>Updated: {formatDate(selectedInquiry.updatedAt)}</div>
                       <div>Est. Delivery: {formatDate(selectedInquiry.estimatedDelivery)}</div>
                     </div>
                   </div>
                 </div>

                 <div>
                   <h3 className="font-medium text-gray-900 mb-3">Customer Information</h3>
                   <div className="space-y-2 text-sm">
                     <div className="flex items-center gap-2">
                       <Building2 className="w-4 h-4 text-gray-400" />
                       <span>{selectedInquiry.companyName}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <User className="w-4 h-4 text-gray-400" />
                       <span>{selectedInquiry.contactPerson}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Mail className="w-4 h-4 text-gray-400" />
                       <span>{selectedInquiry.email}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <Phone className="w-4 h-4 text-gray-400" />
                       <span>{selectedInquiry.phone}</span>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Steel Specifications */}
               <div>
                 <h3 className="font-medium text-gray-900 mb-3">Steel Specifications</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-gray-50 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <Package className="w-4 h-4 text-gray-500" />
                       <span className="font-medium">Product Details</span>
                     </div>
                     <div className="space-y-1 text-sm">
                       <div>Type: <span className="font-medium">{selectedInquiry.steelSpecifications?.type}</span></div>
                       {selectedInquiry.steelSpecifications?.grade && (
                         <div>Grade: <span className="font-medium">{selectedInquiry.steelSpecifications.grade}</span></div>
                       )}
                       {selectedInquiry.steelSpecifications?.finish && (
                         <div>Finish: <span className="font-medium">{selectedInquiry.steelSpecifications.finish}</span></div>
                       )}
                     </div>
                   </div>

                   <div className="bg-gray-50 rounded-lg p-4">
                     <div className="flex items-center gap-2 mb-2">
                       <Scale className="w-4 h-4 text-gray-500" />
                       <span className="font-medium">Quantity & Shipping</span>
                     </div>
                     <div className="space-y-1 text-sm">
                       <div>Quantity: <span className="font-medium">{formatQuantity(selectedInquiry.quantityDetails)}</span></div>
                       {selectedInquiry.quantityDetails?.containerSize && (
                         <div>Container: <span className="font-medium">{selectedInquiry.quantityDetails.containerSize}</span></div>
                       )}
                       {selectedInquiry.deliveryDetails?.incoterms && (
                         <div>Incoterms: <span className="font-medium">{selectedInquiry.deliveryDetails.incoterms}</span></div>
                       )}
                     </div>
                   </div>
                 </div>
               </div>

               {/* Delivery Address */}
               {selectedInquiry.deliveryAddress?.fullAddress && (
                 <div>
                   <h3 className="font-medium text-gray-900 mb-3">Delivery Address</h3>
                   <div className="bg-gray-50 rounded-lg p-4">
                     <div className="flex items-start gap-2">
                       <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                       <span className="text-sm">{selectedInquiry.deliveryAddress.fullAddress}</span>
                     </div>
                   </div>
                 </div>
               )}

               {/* Additional Information */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {selectedInquiry.additionalInfo?.projectDetails && (
                   <div>
                     <h3 className="font-medium text-gray-900 mb-2">Project Details</h3>
                     <div className="bg-gray-50 rounded-lg p-4">
                       <p className="text-sm">{selectedInquiry.additionalInfo.projectDetails}</p>
                     </div>
                   </div>
                 )}

                 {selectedInquiry.additionalInfo?.requirements && (
                   <div>
                     <h3 className="font-medium text-gray-900 mb-2">Additional Requirements</h3>
                     <div className="bg-gray-50 rounded-lg p-4">
                       <p className="text-sm">{selectedInquiry.additionalInfo.requirements}</p>
                     </div>
                   </div>
                 )}
               </div>

               {selectedInquiry.additionalInfo?.budgetRange && (
                 <div>
                   <h3 className="font-medium text-gray-900 mb-2">Budget Range</h3>
                   <div className="bg-gray-50 rounded-lg p-4">
                     <p className="text-sm font-medium">{selectedInquiry.additionalInfo.budgetRange}</p>
                   </div>
                 </div>
               )}

               {/* Admin Information */}
               {(selectedInquiry.estimatedPrice || selectedInquiry.adminNotes) && (
                 <div>
                   <h3 className="font-medium text-gray-900 mb-2">Admin Information</h3>
                   <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                     {selectedInquiry.estimatedPrice && (
                       <div className="text-sm">
                         Estimated Price: <span className="font-medium text-green-600">{formatCurrency(selectedInquiry.estimatedPrice)}</span>
                       </div>
                     )}
                     {selectedInquiry.adminNotes && (
                       <div className="text-sm">
                         <div className="font-medium">Admin Notes:</div>
                         <div className="text-gray-600 mt-1">{selectedInquiry.adminNotes}</div>
                       </div>
                     )}
                   </div>
                 </div>
               )}

               {/* Inquiry Thread in Modal */}
               <div>
                 <h3 className="font-medium text-gray-900 mb-3">Discussion Thread</h3>
                 <InquiryThread inquiryId={selectedInquiry.id} inquiryNumber={selectedInquiry.inquiryNumber} />
               </div>

               {/* Action Buttons */}
               <div className="flex justify-end gap-2 pt-4 border-t">
                 <Button
                   variant="outline"
                   onClick={() => openStatusUpdateModal(selectedInquiry)}
                 >
                   <Edit className="w-4 h-4 mr-2" />
                   Update Status
                 </Button>
               </div>
             </div>
           )}
         </DialogContent>
       </Dialog>

       {/* Status Update Modal */}
       <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle>Update Inquiry Status</DialogTitle>
           </DialogHeader>

           {selectedInquiryForUpdate && (
             <div className="space-y-4">
               <Alert>
                 <AlertDescription>
                   <div className="space-y-1">
                     <div>Inquiry: <span className="font-medium">{selectedInquiryForUpdate.inquiryNumber}</span></div>
                     <div>Company: <span className="font-medium">{selectedInquiryForUpdate.companyName}</span></div>
                     <div>Steel Type: <span className="font-medium">{selectedInquiryForUpdate.steelSpecifications?.type}</span></div>
                   </div>
                 </AlertDescription>
               </Alert>

               <form onSubmit={handleStatusUpdate} className="space-y-4">
                 <div>
                   <Label htmlFor="status">Status *</Label>
                   <Select 
                     value={statusUpdateData.status} 
                     onValueChange={(value) => setStatusUpdateData(prev => ({...prev, status: value}))}
                     required
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select status..." />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="pending">Pending Review</SelectItem>
                       <SelectItem value="reviewed">Under Review</SelectItem>
                       <SelectItem value="approved">Approved</SelectItem>
                       <SelectItem value="rejected">Rejected</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <div>
                   <Label htmlFor="estimatedPrice">Estimated Price (AUD)</Label>
                   <Input
                     id="estimatedPrice"
                     type="number"
                     min="0"
                     step="0.01"
                     value={statusUpdateData.estimatedPrice}
                     onChange={(e) => setStatusUpdateData(prev => ({...prev, estimatedPrice: e.target.value}))}
                     placeholder="Enter estimated price"
                   />
                 </div>

                 <div>
                   <Label htmlFor="estimatedDelivery">Updated Estimated Delivery</Label>
                   <Input
                     id="estimatedDelivery"
                     type="date"
                     value={statusUpdateData.estimatedDelivery}
                     onChange={(e) => setStatusUpdateData(prev => ({...prev, estimatedDelivery: e.target.value}))}
                     min={new Date().toISOString().split('T')[0]}
                   />
                 </div>

                 <div>
                   <Label htmlFor="adminNotes">Admin Notes</Label>
                   <Textarea
                     id="adminNotes"
                     value={statusUpdateData.adminNotes}
                     onChange={(e) => setStatusUpdateData(prev => ({...prev, adminNotes: e.target.value}))}
                     placeholder="Add notes about pricing, availability, or requirements..."
                     rows={4}
                   />
                 </div>

                 <div className="flex gap-3 pt-4">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={closeStatusModal}
                     className="flex-1"
                   >
                     Cancel
                   </Button>
                   <Button
                     type="submit"
                     disabled={submittingStatusUpdate}
                     className="flex-1"
                   >
                     {submittingStatusUpdate ? (
                       <>
                         <Loader className="w-4 h-4 mr-2 animate-spin" />
                         Updating...
                       </>
                     ) : (
                       <>
                         <Save className="w-4 h-4 mr-2" />
                         Update Status
                       </>
                     )}
                   </Button>
                 </div>
               </form>
             </div>
           )}
         </DialogContent>
       </Dialog>
     </div>
   </div>
 );
};

export default InquiriesManagement;