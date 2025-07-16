'use client'
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Package, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Truck, 
  Factory, 
  FileText, 
  ArrowLeft,
  AlertCircle,
  Calendar,
  Building,
  DollarSign,
  Weight,
  Loader,
  Navigation,
  Info,
  Zap,
  Ship,
  Plus,
  Save,
  Eye,
  Edit,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc 
} from 'firebase/firestore';

const OrderTrackingDashboard = () => {
  const router = useRouter();
  const params = useParams();
  const poNumber = params?.poNumber;

  const [order, setOrder] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  
  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    status: 'pending',
    location: '',
    note: '',
   
  });

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'yellow' },
    { value: 'confirmed', label: 'Confirmed', color: 'blue' },
    { value: 'processing', label: 'Processing', color: 'purple' },
    { value: 'shipped', label: 'Shipped', color: 'orange' },
    { value: 'delivered', label: 'Delivered', color: 'green' },
    { value: 'completed', label: 'Completed', color: 'teal' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' }
  ];

  useEffect(() => {
    if (poNumber) {
      fetchOrderAndTracking();
    }
  }, [poNumber]);

  const fetchOrderAndTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the order details
      const ordersQuery = query(
        collection(db, 'orders'),
        where('poNumber', '==', poNumber)
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      
      if (ordersSnapshot.empty) {
        setError('Order not found');
        return;
      }

      const orderDoc = ordersSnapshot.docs[0];
      const orderData = {
        id: orderDoc.id,
        ...orderDoc.data()
      };

      setOrder(orderData);

      // Fetch tracking history
      const trackingQuery = query(
        collection(db, 'orderTracker'),
        where('poNumber', '==', poNumber),
        orderBy('timestamp', 'desc')
      );

      const trackingSnapshot = await getDocs(trackingQuery);
      const trackingData = trackingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : new Date(doc.data().timestamp)
      }));

      setTrackingHistory(trackingData);

    } catch (error) {
      console.error('Error fetching order tracking:', error);
      setError('Failed to load order tracking information');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.status || !formData.location) {
      setError('Status and location are required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const trackingData = {
        poNumber,
        status: formData.status,
        location: formData.location,
        note: formData.note,
        timestamp: serverTimestamp(),
      };

      if (editingId) {
        // Update existing tracking entry
        await updateDoc(doc(db, 'orderTracker', editingId), {
          ...trackingData,
          timestamp: new Date() // Keep original timestamp for updates
        });
        setSuccess('Tracking update modified successfully!');
      } else {
        // Add new tracking entry
        await addDoc(collection(db, 'orderTracker'), trackingData);
        setSuccess('Tracking update added successfully!');
      }

      // Update order status and estimated delivery if provided
      const orderUpdateData = {
        orderStatus: formData.status,
        lastUpdated: serverTimestamp()
      };

      

      await updateDoc(doc(db, 'orders', order.id), orderUpdateData);

      // Reset form and refresh data
      resetForm();
      await fetchOrderAndTracking();

    } catch (error) {
      console.error('Error saving tracking update:', error);
      setError('Failed to save tracking update');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tracking) => {
    setEditingId(tracking.id);
    setFormData({
      status: tracking.status,
      location: tracking.location,
      note: tracking.note || '',
    
    });
    setShowAddForm(true);
  };

  const handleDelete = async (trackingId) => {
    if (!window.confirm('Are you sure you want to delete this tracking update?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'orderTracker', trackingId));
      setSuccess('Tracking update deleted successfully!');
      await fetchOrderAndTracking();
    } catch (error) {
      console.error('Error deleting tracking update:', error);
      setError('Failed to delete tracking update');
    }
  };

  const resetForm = () => {
    setFormData({
      status: 'pending',
      location: '',
      note: '',
    
    });
    setShowAddForm(false);
    setEditingId(null);
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'processing': return <Factory className="w-4 h-4 text-purple-600" />;
      case 'shipped': return <Ship className="w-4 h-4 text-orange-600" />;
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-teal-600" />;
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    const option = statusOptions.find(opt => opt.value === status?.toLowerCase());
    return option ? `bg-${option.color}-100 text-${option.color}-800 border-${option.color}-200` : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount || 0);
  };

  if ( loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-sm border">
          <div className="flex flex-col items-center gap-4">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-gray-700 font-medium">Loading order dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-[70px]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-3 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Order Tracking Dashboard - {poNumber}
              </h1>
              <p className="text-gray-600">Manage and update order tracking information</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/tracking/${poNumber}`)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Customer View
              </button>
              <button
                onClick={fetchOrderAndTracking}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="text-green-500 w-5 h-5" />
              <span className="text-green-700">{success}</span>
              <button onClick={() => setSuccess('')} className="ml-auto text-green-500 hover:text-green-700">
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="text-red-500 w-5 h-5" />
              <span className="text-red-700">{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
                ×
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border mb-6">
              <div className="bg-blue-50 border-b border-blue-100 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Company</p>
                    <p className="font-medium">{order?.customerInfo?.companyName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Product</p>
                    <p className="font-medium">
                      {order?.items?.[0]?.barType} × {order?.items?.[0]?.length}m
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Weight className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Quantity</p>
                    <p className="font-medium">
                      {order?.items?.[0]?.totalWeight || order?.items?.[0]?.quantity} tonnes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Total Amount</p>
                    <p className="font-medium text-blue-600">
                      {formatCurrency(order?.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Order Date</p>
                    <p className="font-medium">{formatDate(order?.orderDate)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(order?.orderStatus)}`}>
                    {getStatusIcon(order?.orderStatus)}
                    <span className="ml-2 capitalize">{order?.orderStatus || 'Pending'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Add/Edit Form */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? 'Edit Tracking Update' : 'Add Tracking Update'}
                  </h3>
                  {!showAddForm && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Update
                    </button>
                  )}
                </div>
              </div>

              {showAddForm && (
                <div className="p-4">
                  <div onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status *
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {statusOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        placeholder="e.g., Sydney Warehouse, In Transit to Melbourne"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={formData.note}
                        onChange={(e) => setFormData({...formData, note: e.target.value})}
                        placeholder="Additional information about this update..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    

                    <div className="flex gap-3">
                      <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {saving ? 'Saving...' : (editingId ? 'Update' : 'Add Update')}
                      </button>
                      <button
                        onClick={resetForm}
                        type="button"
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tracking History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="border-b border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900">Tracking History</h3>
                <p className="text-gray-600 text-sm">
                  {trackingHistory.length} updates • Most recent first
                </p>
              </div>

              <div className="p-4">
                {trackingHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Tracking Updates</h4>
                    <p className="text-gray-600">Add the first tracking update to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trackingHistory.map((tracking, index) => (
                      <div key={tracking.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                            index === 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'
                          }`}>
                            {getStatusIcon(tracking.status)}
                          </div>
                          {index < trackingHistory.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-300 mt-2"></div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(tracking.status)}`}>
                              <span className="capitalize">{tracking.status}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                {formatDate(tracking.timestamp)}
                              </span>
                              <button
                                onClick={() => handleEdit(tracking)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tracking.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="font-medium text-gray-900">{tracking.location}</span>
                          </div>
                          
                          {tracking.note && (
                            <p className="text-sm text-gray-600 bg-white p-3 rounded border-l-2 border-blue-200">
                              {tracking.note}
                            </p>
                          )}

                          {tracking.updatedBy && (
                            <p className="text-xs text-gray-500 mt-2">
                              Updated by: {tracking.updatedBy}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingDashboard;