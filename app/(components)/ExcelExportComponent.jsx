'use client'
import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Save,
  Copy,
  Printer,
  RefreshCw,
  Settings,
  Filter,
  SortAsc,
  Calendar,
  Ship,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle,
  Bot,
  Send,
  Brain,
  ShoppingCart,
  ClipboardList,
  Eye,
  Edit,
  DollarSign,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  Building2,
  Star,
  CheckSquare,
  Square,
  Upload,
  File,
  Paperclip,
  X,
  Grid3X3,
  List,
  Search,
  FileImage,
  FileCode,
  Edit3,
  Check,
  RotateCcw
} from 'lucide-react';
import { db } from '@/firebase';
import { useChat } from '@ai-sdk/react';
import ReactMarkdown from 'react-markdown';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  query,
  where,
  orderBy,
  setDoc,
  getDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage';
import { useParams } from 'next/navigation';

// Order Excel Editor Component
const OrderExcelEditor = ({ orderId, orderNumber, companyId }) => {
  const [sheet, setSheet] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saveMessage, setSaveMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load worksheet from Firebase on component mount
  useEffect(() => {
    loadWorksheet();
  }, [orderId]);

  const loadWorksheet = async () => {
    try {
      const worksheetRef = doc(db, 'orderWorksheets', orderId);
      const worksheetSnap = await getDoc(worksheetRef);
      
      if (worksheetSnap.exists()) {
        setSheet(worksheetSnap.data());
      } else {
        // Create default worksheet
        const defaultSheet = {
          id: `sheet_${orderId}`,
          name: `Order ${orderNumber} Worksheet`,
          orderId,
          companyId,
          columns: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          rows: [
            {
              id: 'row_1',
              cells: [
                { id: 'A1', value: 'Item Code', type: 'text' },
                { id: 'B1', value: 'Product Name', type: 'text' },
                { id: 'C1', value: 'Quantity', type: 'number' },
                { id: 'D1', value: 'Unit Price', type: 'currency' },
                { id: 'E1', value: 'Total', type: 'currency' },
                { id: 'F1', value: 'Material', type: 'text' },
                { id: 'G1', value: 'Finish', type: 'text' },
                { id: 'H1', value: 'Notes', type: 'text' }
              ]
            },
            {
              id: 'row_2',
              cells: [
                { id: 'A2', value: '', type: 'text' },
                { id: 'B2', value: '', type: 'text' },
                { id: 'C2', value: '', type: 'number' },
                { id: 'D2', value: '', type: 'currency' },
                { id: 'E2', value: '', type: 'currency', formula: '=C2*D2' },
                { id: 'F2', value: '', type: 'text' },
                { id: 'G2', value: '', type: 'text' },
                { id: 'H2', value: '', type: 'text' }
              ]
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setSheet(defaultSheet);
      }
    } catch (error) {
      console.error('Error loading worksheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveWorksheet = async () => {
    if (!sheet) return;
    
    setSaving(true);
    try {
      const worksheetRef = doc(db, 'orderWorksheets', orderId);
      const updatedSheet = {
        ...sheet,
        updatedAt: new Date()
      };
      
      await setDoc(worksheetRef, updatedSheet);
      setSheet(updatedSheet);
      
      setSaveMessage('Worksheet saved successfully!');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (error) {
      console.error('Error saving worksheet:', error);
      setSaveMessage('Failed to save worksheet');
    } finally {
      setSaving(false);
    }
  };

  // Cell editing functions
  const startEdit = (cellId, currentValue) => {
    setEditingCell(cellId);
    
    // Handle different value types safely
    if (currentValue === null || currentValue === undefined) {
      setEditValue('');
    } else if (typeof currentValue === 'object') {
      // If it's a Date object, format it for input
      if (currentValue instanceof Date) {
        setEditValue(currentValue.toISOString().slice(0, 16)); // For datetime-local input
      } else {
        // For other objects, convert to JSON string
        setEditValue(JSON.stringify(currentValue));
      }
    } else {
      setEditValue(String(currentValue));
    }
  };

  const saveEdit = () => {
    if (!editingCell || !sheet) return;

    const updatedSheet = {
      ...sheet,
      rows: sheet.rows.map(row => ({
        ...row,
        cells: row.cells.map(cell => 
          cell.id === editingCell 
            ? { ...cell, value: String(editValue || '') }
            : cell
        )
      }))
    };

    setSheet(updatedSheet);
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Row operations
  const addRow = () => {
    if (!sheet) return;
    
    const newRowId = `row_${Date.now()}`;
    const newRow = {
      id: newRowId,
      cells: sheet.columns.map((col, index) => ({
        id: `${col}${sheet.rows.length + 1}`,
        value: '',
        type: index === 2 || index === 3 || index === 4 ? 
          (index === 3 || index === 4 ? 'currency' : 'number') : 'text'
      }))
    };

    setSheet(prev => prev ? {
      ...prev,
      rows: [...prev.rows, newRow]
    } : null);
  };

  const deleteRow = (rowId) => {
    if (!sheet || sheet.rows.length <= 1) return;
    
    setSheet(prev => prev ? {
      ...prev,
      rows: prev.rows.filter(row => row.id !== rowId)
    } : null);
  };

  // Column operations
  const addColumn = () => {
    if (!sheet) return;
    
    const nextCol = String.fromCharCode(65 + sheet.columns.length);
    
    setSheet(prev => prev ? {
      ...prev,
      columns: [...prev.columns, nextCol],
      rows: prev.rows.map((row, rowIndex) => ({
        ...row,
        cells: [
          ...row.cells,
          {
            id: `${nextCol}${rowIndex + 1}`,
            value: '',
            type: 'text'
          }
        ]
      }))
    } : null);
  };

  const deleteColumn = (columnIndex) => {
    if (!sheet || sheet.columns.length <= 1) return;
    
    setSheet(prev => prev ? {
      ...prev,
      columns: prev.columns.filter((_, index) => index !== columnIndex),
      rows: prev.rows.map(row => ({
        ...row,
        cells: row.cells.filter((_, index) => index !== columnIndex)
      }))
    } : null);
  };

  // Export functions
  const exportToCSV = () => {
    if (!sheet) return;
    
    const csvContent = sheet.rows.map(row => 
      row.cells.map(cell => `"${cell.value}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `order_${orderNumber}_worksheet.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cell formatting
  const getCellDisplay = (cell) => {
    // Handle null, undefined, or missing cell
    if (!cell || cell.value === undefined || cell.value === null) {
      return '';
    }

    let displayValue = cell.value;

    // Handle objects by converting to string - PREVENT REACT ERROR
    if (typeof displayValue === 'object' && displayValue !== null) {
      // If it's a Date object, format it properly
      if (displayValue instanceof Date) {
        displayValue = displayValue.toLocaleDateString();
      } else {
        // For other objects, convert to JSON string
        displayValue = JSON.stringify(displayValue);
      }
    }
    
    // Ensure we have a string for further processing
    const stringValue = String(displayValue || '');
    
    if (cell.formula && stringValue) {
      return stringValue;
    }
    
    switch (cell.type) {
      case 'currency':
        const num = parseFloat(stringValue);
        return isNaN(num) ? stringValue : `$${num.toFixed(2)}`;
      case 'number':
        return stringValue;
      default:
        return stringValue;
    }
  };

  const getCellInputType = (type) => {
    switch (type) {
      case 'number':
      case 'currency':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  };

  // Safe date formatting function
  const formatDate = (dateValue) => {
    if (!dateValue) return 'Never';
    
    try {
      let date;
      
      // Handle Firestore Timestamp
      if (dateValue && typeof dateValue === 'object' && dateValue.toDate) {
        date = dateValue.toDate();
      }
      // Handle Date object
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      // Handle string dates
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      }
      // Handle timestamp numbers
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      // Handle other objects
      else if (typeof dateValue === 'object') {
        // Try to extract timestamp or convert to string
        if (dateValue.seconds) {
          // Firestore timestamp format
          date = new Date(dateValue.seconds * 1000);
        } else {
          return 'Invalid date';
        }
      }
      else {
        return 'Invalid date';
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', dateValue, error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span>Loading worksheet...</span>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">Failed to load worksheet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Excel Editor - Order {orderNumber}
              </h3>
              <p className="text-sm text-gray-600">
                Create and edit custom worksheets for this order
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className={`text-sm px-2 py-1 rounded ${
                saveMessage.includes('Failed') 
                  ? 'text-red-600 bg-red-100' 
                  : 'text-green-600 bg-green-100'
              }`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={saveWorksheet}
              disabled={saving}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={addRow}
            className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
          <button
            onClick={addColumn}
            className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Column
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2" />
          <span className="text-xs text-gray-600">
            Click any cell to edit • {sheet.rows.length} rows, {sheet.columns.length} columns
          </span>
        </div>
      </div>

      {/* Excel Grid */}
      <div className="overflow-auto max-h-96">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="w-12 h-8 border border-gray-300 text-xs font-medium text-gray-600 bg-gray-200"></th>
              {sheet.columns.map((col, index) => (
                <th key={col} className="min-w-32 h-8 border border-gray-300 text-xs font-medium text-gray-600 bg-gray-200 relative group">
                  <div className="flex items-center justify-between px-2">
                    <span>{col}</span>
                    <button
                      onClick={() => deleteColumn(index)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                      title="Delete column"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={row.id} className="group">
                <td className="w-12 h-8 border border-gray-300 text-xs font-medium text-gray-600 bg-gray-100 text-center relative">
                  <div className="flex items-center justify-center">
                    <span>{rowIndex + 1}</span>
                    {rowIndex > 0 && (
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="absolute right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                        title="Delete row"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
                {row.cells.map((cell) => (
                  <td 
                    key={cell.id} 
                    className="h-8 border border-gray-300 cursor-pointer hover:bg-blue-50 transition-colors relative"
                    onClick={() => startEdit(cell.id, cell.value)}
                  >
                    {editingCell === cell.id ? (
                      <input
                        type={getCellInputType(cell.type)}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveEdit}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="w-full h-full px-2 border-2 border-blue-500 rounded-sm focus:outline-none text-sm"
                        autoFocus
                      />
                    ) : (
                      <div className="px-2 py-1 text-sm min-h-6 flex items-center">
                        {getCellDisplay(cell) || ''}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
        <div className="flex justify-between items-center">
          <span>Last updated: {sheet.updatedAt ? formatDate(sheet.updatedAt) : 'Never'}</span>
          <span>Auto-saves to Firebase • Press Enter to save cell changes</span>
        </div>
      </div>
    </div>
  );
};

// Main Customer Orders Manager Component
const CustomerOrdersManager = () => {
  const params = useParams();
  const companyId = params.companyId;
  
  const [orders, setOrders] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [completedTasks, setCompletedTasks] = useState(new Set());
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const storage = getStorage();

  // Safe customer info functions
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
      if (typeof customerInfo.companyName === 'object' && customerInfo.companyName !== null && customerInfo.companyName.companyName) {
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
    if (customerInfo.companyName && typeof customerInfo.companyName === 'object' && customerInfo.companyName !== null) {
      return customerInfo.companyName.contactPerson || '';
    }
    
    return '';
  };

  const getCustomerEmail = (customerInfo) => {
    if (!customerInfo || typeof customerInfo === 'string') return '';
    
    // Check direct email field first
    if (customerInfo.email) return customerInfo.email;
    
    // Check nested companyName object
    if (customerInfo.companyName && typeof customerInfo.companyName === 'object' && customerInfo.companyName !== null) {
      return customerInfo.companyName.email || '';
    }
    
    return '';
  };

  // Initialize AI chat
  const { messages, input, handleInputChange, handleSubmit, setInput } = useChat({
    api: '/api/excel-agent',
    body: { companyId },
    initialMessages: [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: `Hi! I'm your **Customer Orders AI Assistant**. I can help you with:

🛒 **Order Management**:
- View and manage customer orders
- Track order status and progress
- Update order details and information
- Manage order fulfillment tasks

📊 **Excel Operations**:
- Export orders to Excel/CSV format
- Generate detailed order reports
- Analyze order data and trends
- Create custom order summaries

📎 **File Management**:
- Attach files to orders (invoices, contracts, specs)
- Manage order documentation
- Upload and organize order-related files
- Download order attachments

📈 **Analytics & Insights**:
- Order status analytics
- Revenue analysis by period
- Customer order patterns
- Product performance metrics

All data is company-specific and secure. What would you like me to help you with today?`
      }
    ],
    async onToolCall({ toolCall }) {
      const typedToolCall = toolCall;
      
      switch (typedToolCall.toolName) {
        case 'updateOrderStatus': {
          const { orderId, status } = typedToolCall.args;
          try {
            await updateOrderStatus(orderId, status);
            return `Successfully updated order status to: ${status}`;
          } catch (error) {
            return `Failed to update order: ${error.message}`;
          }
        }
        
        case 'generateOrderReport': {
          const { reportType, filters } = typedToolCall.args;
          try {
            const report = generateOrderReport(reportType, filters);
            return report;
          } catch (error) {
            return `Failed to generate report: ${error.message}`;
          }
        }
        
        case 'exportOrdersToExcel': {
          try {
            exportOrdersToExcel();
            return `Orders exported to Excel successfully!`;
          } catch (error) {
            return `Failed to export orders: ${error.message}`;
          }
        }
        
        default:
          return null;
      }
    }
  });

  // Real-time Firebase listener for customer orders (company-specific)
  useEffect(() => {
    if (!companyId) return;
    
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('companyId', '==', companyId),
      orderBy('orderDate', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const ordersData = [];
        snapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setOrders(ordersData);
        setLoading(false);
      } catch (err) {
        setError('Failed to load orders: ' + err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [companyId]);

  // Real-time Firebase listener for attachments
  useEffect(() => {
    if (!companyId) return;
    
    const attachmentsRef = collection(db, 'orderAttachments');
    const q = query(
      attachmentsRef,
      where('companyId', '==', companyId),
      orderBy('uploadedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const attachmentsData = [];
        snapshot.forEach((doc) => {
          attachmentsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setAttachments(attachmentsData);
      } catch (err) {
        console.error('Failed to load attachments: ' + err.message);
      }
    });

    return () => unsubscribe();
  }, [companyId]);

  // AI Tool Functions
  const updateOrderStatus = async (orderId, status) => {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      status,
      updatedAt: new Date()
    });
  };

  const generateOrderReport = (reportType, filters) => {
    switch (reportType) {
      case 'summary':
        const totalOrders = orders.length;
        const totalValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const avgOrderValue = totalValue / totalOrders;
        
        return `## 📊 Orders Summary Report

**Company**: ${companyId}
**Total Orders**: ${totalOrders}
**Total Value**: $${totalValue.toFixed(2)}
**Average Order Value**: $${avgOrderValue.toFixed(2)}

**Status Breakdown**:
${getStatusBreakdown().map(s => `- ${s.status}: ${s.count} orders ($${s.value.toFixed(2)})`).join('\n')}

**Top Customers**:
${getTopCustomers().map(c => `- ${c.customer}: ${c.orders} orders`).join('\n')}`;

      case 'revenue':
        return generateRevenueReport();
      
      default:
        return 'Report type not recognized. Available types: summary, revenue';
    }
  };

  const getStatusBreakdown = () => {
    const statuses = ['pending', 'approved', 'processing', 'shipped', 'delivered'];
    return statuses.map(status => {
      const statusOrders = orders.filter(order => order.status.toLowerCase() === status);
      return {
        status,
        count: statusOrders.length,
        value: statusOrders.reduce((sum, order) => sum + order.totalAmount, 0)
      };
    });
  };

  const getTopCustomers = () => {
    const customerCount = {};
    orders.forEach(order => {
      const customerName = getCustomerDisplayName(order.customerInfo);
      customerCount[customerName] = (customerCount[customerName] || 0) + 1;
    });
    
    return Object.entries(customerCount)
      .map(([customer, orders]) => ({ customer, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  };

  const generateRevenueReport = () => {
    const monthlyRevenue = getMonthlyRevenue();
    
    return `## 💰 Revenue Analysis Report

**Total Revenue**: $${orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
**Orders This Month**: ${getOrdersThisMonth()}
**Revenue This Month**: $${getRevenueThisMonth().toFixed(2)}

**Monthly Breakdown**:
${monthlyRevenue.map(m => `- ${m.month}: $${m.revenue.toFixed(2)} (${m.orders} orders)`).join('\n')}`;
  };

  const getMonthlyRevenue = () => {
    const monthlyData = {};
    
    orders.forEach(order => {
      const month = new Date(order.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!monthlyData[month]) {
        monthlyData[month] = { revenue: 0, orders: 0 };
      }
      monthlyData[month].revenue += order.totalAmount;
      monthlyData[month].orders += 1;
    });
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      orders: data.orders
    }));
  };

  const getOrdersThisMonth = () => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    return orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate.getMonth() === thisMonth && orderDate.getFullYear() === thisYear;
   }).length;
 };

 const getRevenueThisMonth = () => {
   const thisMonth = new Date().getMonth();
   const thisYear = new Date().getFullYear();
   return orders.filter(order => {
     const orderDate = new Date(order.orderDate);
     return orderDate.getMonth() === thisMonth && orderDate.getFullYear() === thisYear;
   }).reduce((sum, order) => sum + order.totalAmount, 0);
 };

 // Export to Excel functionality
 const exportOrdersToExcel = () => {
   const headers = ['PO Number', 'Customer', 'Status', 'Order Date', 'Total Amount', 'Items Count', 'Contact Person', 'Email'];
   const csvContent = [
     headers.join(','),
     ...filteredOrders.map(order => [
       `"${order.poNumber}"`,
       `"${getCustomerDisplayName(order.customerInfo)}"`,
       `"${order.status}"`,
       `"${new Date(order.orderDate).toLocaleDateString()}"`,
       `"${order.totalAmount.toFixed(2)}"`,
       `"${order.items.length}"`,
       `"${getCustomerContactPerson(order.customerInfo)}"`,
       `"${getCustomerEmail(order.customerInfo)}"`
     ].join(','))
   ].join('\n');

   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
   const link = document.createElement('a');
   const url = URL.createObjectURL(blob);
   link.setAttribute('href', url);
   link.setAttribute('download', `orders_${companyId}_${new Date().toISOString().split('T')[0]}.csv`);
   link.style.visibility = 'hidden';
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
 };

 // File upload functionality - Save to separate orderAttachments collection
 const handleFileUpload = async (files, orderId) => {
   if (!files || files.length === 0) return;
   
   setUploading(true);
   setUploadProgress(0);

   try {
     for (let i = 0; i < files.length; i++) {
       const file = files[i];
       
       // Update progress
       setUploadProgress(((i + 1) / files.length) * 100);

       // Generate unique filename
       const timestamp = Date.now();
       const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
       const fileName = `${timestamp}_${sanitizedName}`;
       const storagePath = `order-attachments/${companyId}/${orderId}/${fileName}`;

       // Upload to Firebase Storage
       const storageRef = ref(storage, storagePath);
       await uploadBytes(storageRef, file);
       const downloadURL = await getDownloadURL(storageRef);

       // Save attachment metadata to separate collection
       const attachmentData = {
         fileName: sanitizedName,
         originalName: file.name,
         fileSize: file.size,
         mimeType: file.type && file.type.trim() !== '' ? file.type : 'application/octet-stream',
         downloadURL,
         storagePath,
         uploadedAt: new Date(),
         orderId,
         companyId
       };

       await addDoc(collection(db, 'orderAttachments'), attachmentData);
     }

     setSaveMessage(`Successfully uploaded ${files.length} file(s)`);
     setTimeout(() => setSaveMessage(null), 3000);
     setShowUploadModal(false);
   } catch (err) {
     setError('Upload failed: ' + err.message);
   } finally {
     setUploading(false);
     setUploadProgress(0);
   }
 };

 // Delete attachment
 const deleteAttachment = async (attachment) => {
   if (!attachment.id) return;
   
   try {
     // Delete from Storage
     const storageRef = ref(storage, attachment.storagePath);
     await deleteObject(storageRef);
     
     // Delete from Firestore
     await deleteDoc(doc(db, 'orderAttachments', attachment.id));
     
     setSaveMessage('File deleted successfully');
     setTimeout(() => setSaveMessage(null), 2000);
   } catch (err) {
     setError('Failed to delete file: ' + err.message);
   }
 };

 // Get attachments for a specific order
 const getOrderAttachments = (orderId) => {
   return attachments.filter(attachment => attachment.orderId === orderId);
 };

 // Task management for orders
 const generateTasksForOrder = (order) => {
   const tasks = [
     `Process order ${order.poNumber}`,
     `Verify customer details for ${getCustomerDisplayName(order.customerInfo)}`,
     `Check inventory for ${order.items.length} items`,
     `Schedule production for order ${order.poNumber}`,
     `Prepare shipping documentation`,
     `Send order confirmation to ${getCustomerEmail(order.customerInfo)}`
   ];
   return tasks;
 };

 const toggleTask = (taskId) => {
   const newCompletedTasks = new Set(completedTasks);
   if (newCompletedTasks.has(taskId)) {
     newCompletedTasks.delete(taskId);
   } else {
     newCompletedTasks.add(taskId);
   }
   setCompletedTasks(newCompletedTasks);
 };

 const getStatusColor = (status) => {
   switch (status.toLowerCase()) {
     case 'pending': return 'bg-yellow-100 text-yellow-800';
     case 'approved': return 'bg-blue-100 text-blue-800';
     case 'processing': return 'bg-purple-100 text-purple-800';
     case 'shipped': return 'bg-green-100 text-green-800';
     case 'delivered': return 'bg-emerald-100 text-emerald-800';
     case 'cancelled': return 'bg-red-100 text-red-800';
     default: return 'bg-gray-100 text-gray-800';
   }
 };

 // Fixed getFileIcon function - add null/undefined checks
 const getFileIcon = (mimeType) => {
   // Add safety check for undefined/null mimeType
   if (!mimeType || typeof mimeType !== 'string') {
     return <File className="w-4 h-4 text-gray-500" />;
   }
   
   if (mimeType.startsWith('image/')) return <FileImage className="w-4 h-4 text-green-500" />;
   if (mimeType.includes('pdf')) return <FileCode className="w-4 h-4 text-red-500" />;
   return <File className="w-4 h-4 text-gray-500" />;
 };

 // Filter orders
 const filteredOrders = orders.filter(order => {
   const matchesSearch = order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        getCustomerDisplayName(order.customerInfo).toLowerCase().includes(searchTerm.toLowerCase()) ||
                        getCustomerContactPerson(order.customerInfo).toLowerCase().includes(searchTerm.toLowerCase());
   const matchesStatus = statusFilter === 'all' || order.status.toLowerCase() === statusFilter.toLowerCase();
   return matchesSearch && matchesStatus;
 });

 // Auto scroll chat to bottom
 useEffect(() => {
   if (messagesEndRef.current && chatContainerRef.current) {
     chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
   }
 }, [messages]);

 if (loading) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
       <div className="text-center">
         <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
         <p className="text-gray-600">Loading orders...</p>
         <p className="text-sm text-gray-500">Company ID: {companyId}</p>
       </div>
     </div>
   );
 }

 return (
   <div className="min-h-screen bg-gray-50 flex flex-col">
     {/* Header */}
     <div className="bg-white shadow-sm border-b">
       <div className="max-w-7xl mx-auto px-6">
         <div className="flex items-center justify-between py-4">
           <div className="flex items-center gap-3">
             <ShoppingCart className="w-8 h-8 text-blue-600" />
             <div>
               <h1 className="text-2xl font-bold text-gray-900">Customer Orders Management</h1>
               <p className="text-gray-600">Company ID: {companyId}</p>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
            
             <button
               onClick={() => setShowAIChat(!showAIChat)}
               className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
             >
               <Brain className="w-4 h-4" />
               {showAIChat ? 'Hide AI' : 'AI Assistant'}
             </button>
           </div>
         </div>
       </div>
     </div>

     {/* Main Content */}
     <div className={`flex-1 transition-all duration-300 ${showAIChat ? 'mr-96' : ''}`}>
       <div className="p-6">
         {/* Status Messages */}
         {error && (
           <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
             <div className="flex items-center gap-2">
               <AlertCircle className="w-5 h-5 text-red-600" />
               <p className="text-red-800">{error}</p>
               <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
                 <X className="w-4 h-4" />
               </button>
             </div>
           </div>
         )}

         {saveMessage && (
           <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
             <div className="flex items-center gap-2">
               <CheckCircle className="w-5 h-5 text-green-600" />
               <p className="text-green-800">{saveMessage}</p>
               <button onClick={() => setSaveMessage(null)} className="ml-auto text-green-600 hover:text-green-800">
                 <X className="w-4 h-4" />
               </button>
             </div>
           </div>
         )}

         {/* Dashboard Stats */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
           <div className="bg-white p-4 rounded-lg shadow-sm">
             <div className="flex items-center gap-3">
               <ShoppingCart className="w-8 h-8 text-blue-600" />
               <div>
                 <p className="text-sm font-medium text-gray-600">Total Orders</p>
                 <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
               </div>
             </div>
           </div>
           <div className="bg-white p-4 rounded-lg shadow-sm">
             <div className="flex items-center gap-3">
               <DollarSign className="w-8 h-8 text-green-600" />
               <div>
                 <p className="text-sm font-medium text-gray-600">Total Value</p>
                 <p className="text-2xl font-bold text-gray-900">
                   ${orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
                 </p>
               </div>
             </div>
           </div>
        
           <div className="bg-white p-4 rounded-lg shadow-sm">
             <div className="flex items-center gap-3">
               <Paperclip className="w-8 h-8 text-purple-600" />
               <div>
                 <p className="text-sm font-medium text-gray-600">Total Files</p>
                 <p className="text-2xl font-bold text-gray-900">{attachments.length}</p>
               </div>
             </div>
           </div>
         </div>

         {/* Controls */}
         <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
           <div className="flex flex-col lg:flex-row gap-4">
             {/* Search */}
             <div className="flex-1">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input
                   type="text"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search orders by PO number, customer, or contact..."
                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 />
               </div>
             </div>

             {/* Status Filter */}
             <select
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value)}
               className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
             >
               <option value="all">All Status</option>
               <option value="pending">Pending</option>
               <option value="approved">Approved</option>
               <option value="processing">Processing</option>
               <option value="shipped">Shipped</option>
               <option value="delivered">Delivered</option>
               <option value="cancelled">Cancelled</option>
             </select>

             {/* View Mode */}
             <div className="flex border border-gray-300 rounded-lg overflow-hidden">
               <button
                 onClick={() => setViewMode('grid')}
                 className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} transition-colors`}
               >
                 <Grid3X3 className="w-4 h-4" />
               </button>
               <button
                 onClick={() => setViewMode('list')}
                 className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} transition-colors`}
               >
                 <List className="w-4 h-4" />
               </button>
             </div>
           </div>
         </div>

         {/* Order Status Summary */}
         

         {/* Orders Display */}
         {filteredOrders.length === 0 ? (
           <div className="bg-white rounded-lg shadow-sm p-12 text-center">
             <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
             <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
             <p className="text-gray-600">
               {searchTerm || statusFilter !== 'all'
                 ? 'Try adjusting your search or filters'
                 : `No customer orders found for company ${companyId}`
               }
             </p>
           </div>
         ) : (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Orders List */}
             <div className="space-y-4">
               <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                 <ClipboardList className="w-5 h-5" />
                 Orders ({filteredOrders.length})
               </h3>
               
               <div className="space-y-4 max-h-[800px] overflow-y-auto">
                 {filteredOrders.map((order) => (
                   <div 
                     key={order.id} 
                     className={`bg-white rounded-lg shadow-sm border-l-4 p-4 cursor-pointer transition-all hover:shadow-md ${
                       selectedOrder?.id === order.id ? 'border-l-blue-500 bg-blue-50' : 'border-l-gray-300'
                     }`}
                     onClick={() => setSelectedOrder(order)}
                   >
                     <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-3">
                         <h4 className="font-semibold text-gray-900">{order.poNumber}</h4>
                         <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                           {order.status}
                         </span>
                       </div>
                       <div className="text-right">
                         <p className="font-bold text-green-600">${order.totalAmount.toFixed(2)}</p>
                         <p className="text-xs text-gray-500">
                           {new Date(order.orderDate).toLocaleDateString()}
                         </p>
                       </div>
                     </div>
                     
                     <div className="space-y-2">
                       <div className="flex items-center gap-2 text-sm text-gray-600">
                         <Building2 className="w-4 h-4" />
                         <span>{getCustomerDisplayName(order.customerInfo)}</span>
                       </div>
                       <div className="flex items-center gap-2 text-sm text-gray-600">
                         <User className="w-4 h-4" />
                         <span>{getCustomerContactPerson(order.customerInfo)}</span>
                       </div>
                       <div className="flex items-center gap-2 text-sm text-gray-600">
                         <Package className="w-4 h-4" />
                         <span>{order.items.length} item(s)</span>
                       </div>
                       {getOrderAttachments(order.id).length > 0 && (
                         <div className="flex items-center gap-2 text-sm text-blue-600">
                           <Paperclip className="w-4 h-4" />
                           <span>{getOrderAttachments(order.id).length} attachment(s)</span>
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* Order Details */}
             <div className="space-y-4">
               <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                 <CheckCircle className="w-5 h-5" />
                 {selectedOrder ? `Order Details: ${selectedOrder.poNumber}` : 'Select an order to view details'}
               </h3>
               
               {selectedOrder ? (
                 <div className="space-y-6">
                   {/* Order Info Card */}
                   <div className="bg-white rounded-lg shadow-sm p-6">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="font-semibold text-gray-900">Order Information</h4>
                       <div className="flex gap-2">
                         <button
                           onClick={() => setShowUploadModal(true)}
                           className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                         >
                           <Paperclip className="w-4 h-4" />
                           Attach Files
                         </button>
                       </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 mb-4">
                       <div>
                         <p className="text-sm text-gray-600">Customer</p>
                         <p className="font-medium">{getCustomerDisplayName(selectedOrder.customerInfo)}</p>
                       </div>
                       <div>
                         <p className="text-sm text-gray-600">Contact</p>
                         <p className="font-medium">{getCustomerContactPerson(selectedOrder.customerInfo)}</p>
                       </div>
                       <div>
                         <p className="text-sm text-gray-600">Email</p>
                         <p className="font-medium text-blue-600">{getCustomerEmail(selectedOrder.customerInfo)}</p>
                       </div>
                       <div>
                         <p className="text-sm text-gray-600">Phone</p>
                         <p className="font-medium">{selectedOrder.customerInfo.phone}</p>
                       </div>
                     </div>

                     <div className="border-t pt-4">
                       <p className="text-sm text-gray-600 mb-2">Shipping Address</p>
                       <p className="text-sm">
                         {selectedOrder.customerInfo.address.street}<br/>
                         {selectedOrder.customerInfo.address.city}, {selectedOrder.customerInfo.address.state} {selectedOrder.customerInfo.address.postcode}<br/>
                         {selectedOrder.customerInfo.address.country}
                       </p>
                     </div>

                     <div className="border-t pt-4 mt-4">
                       <div className="flex justify-between items-center">
                         <span className="font-semibold">Total Amount:</span>
                         <span className="font-bold text-lg text-green-600">${selectedOrder.totalAmount.toFixed(2)}</span>
                       </div>
                     </div>
                   </div>

                   {/* Order Items */}
                   <div className="bg-white rounded-lg shadow-sm p-6">
                     <h4 className="font-semibold text-gray-900 mb-4">Order Items ({selectedOrder.items.length})</h4>
                     <div className="space-y-3 max-h-64 overflow-y-auto">
                       {selectedOrder.items.map((item, index) => (
                         <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                           <div className="flex-1">
                             <p className="font-medium text-sm">{item.productName}</p>
                             <p className="text-xs text-gray-600">
                               Code: {item.itemCode} | Material: {item.material}
                             </p>
                             <p className="text-xs text-gray-600">
                               Qty: {item.quantity} | Weight: {item.totalWeight}MT | Finish: {item.finish}
                             </p>
                           </div>
                           <div className="text-right">
                             <p className="font-bold text-green-600">${item.unitPrice.toFixed(2)}</p>
                             <p className="text-xs text-gray-600">per unit</p>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Attachments */}
                   {getOrderAttachments(selectedOrder.id).length > 0 && (
                     <div className="bg-white rounded-lg shadow-sm p-6">
                       <h4 className="font-semibold text-gray-900 mb-4">
                         Attachments ({getOrderAttachments(selectedOrder.id).length})
                       </h4>
                       <div className="space-y-2">
                         {getOrderAttachments(selectedOrder.id).map((attachment, index) => (
                           <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                             <div className="flex items-center gap-2">
                               {getFileIcon(attachment.mimeType || 'application/octet-stream')}
                               <span className="text-sm">{attachment.originalName}</span>
                               <span className="text-xs text-gray-500">
                                 ({(attachment.fileSize / 1024).toFixed(1)} KB)
                               </span>
                             </div>
                             <div className="flex gap-2">
                               <button
                                 onClick={() => window.open(attachment.downloadURL, '_blank')}
                                 className="text-blue-600 hover:text-blue-800 text-sm"
                                 title="View file"
                               >
                                 <Eye className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => {
                                   const link = document.createElement('a');
                                   link.href = attachment.downloadURL;
                                   link.download = attachment.originalName;
                                   link.click();
                                 }}
                                 className="text-green-600 hover:text-green-800 text-sm"
                                 title="Download file"
                               >
                                 <Download className="w-4 h-4" />
                               </button>
                               <button
                                 onClick={() => deleteAttachment(attachment)}
                                 className="text-red-600 hover:text-red-800 text-sm"
                                 title="Delete file"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Excel Editor for Selected Order */}
                   <OrderExcelEditor 
                     orderId={selectedOrder.id} 
                     orderNumber={selectedOrder.poNumber}
                     companyId={companyId}
                   />

                   {/* Tasks */}
                   
                 </div>
                 ) : (
                 <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                   <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                   <p className="text-gray-600">Select an order from the left to view details and manage tasks</p>
                 </div>
               )}
             </div>
           </div>
         )}
       </div>
     </div>

     {/* File Upload Modal */}
     {showUploadModal && selectedOrder && (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
         <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-semibold">Upload Files for {selectedOrder.poNumber}</h3>
             <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700">
               <X className="w-5 h-5"/>
               </button>
           </div>
           
           <div
             className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
             onClick={() => fileInputRef.current?.click()}
             onDrop={(e) => {
               e.preventDefault();
               const files = e.dataTransfer.files;
               if (files) handleFileUpload(files, selectedOrder.id);
             }}
             onDragOver={(e) => e.preventDefault()}
           >
             <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
             <p className="text-sm text-gray-600 mb-2">Click to select files or drag and drop</p>
             <p className="text-xs text-gray-500">Supports all file types</p>
             
             <input
               ref={fileInputRef}
               type="file"
               multiple
               className="hidden"
               onChange={(e) => e.target.files && handleFileUpload(e.target.files, selectedOrder.id)}
             />
           </div>

           {uploading && (
             <div className="mt-4">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm">Uploading...</span>
                 <span className="text-sm">{uploadProgress.toFixed(0)}%</span>
               </div>
               <div className="w-full bg-gray-200 rounded-full h-2">
                 <div 
                   className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                   style={{ width: `${uploadProgress}%` }}
                 />
               </div>
             </div>
           )}
         </div>
       </div>
     )}

     {/* AI Chat Sidebar */}
     {showAIChat && (
       <div className="fixed right-0 top-0 w-96 h-full bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
         <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="bg-white/20 p-2 rounded-lg">
                 <Brain className="w-5 h-5" />
               </div>
               <div>
                 <h3 className="font-semibold">Orders AI Assistant</h3>
                 <p className="text-sm text-white/90">Company: {companyId}</p>
               </div>
             </div>
             <button
               onClick={() => setShowAIChat(false)}
               className="text-white/80 hover:text-white"
             >
               ×
             </button>
           </div>
         </div>

         <div 
           ref={chatContainerRef}
           className="flex-1 overflow-y-auto p-4 space-y-4"
         >
           {messages.map((message, index) => (
             <div 
               key={message.id} 
               className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
             >
               <div 
                 className={`max-w-[85%] rounded-lg px-4 py-3 ${
                   message.role === 'user' 
                     ? 'bg-purple-600 text-white' 
                     : 'bg-gray-100 text-gray-800'
                 }`}
               >
                 {message.role === 'user' ? (
                   <p className="text-sm">{message.content}</p>
                 ) : (
                   <div className="text-sm prose prose-sm max-w-none">
                     <ReactMarkdown 
                       components={{
                         p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                         h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-gray-900">{children}</h2>,
                         ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                         li: ({ children }) => <li className="text-sm">{children}</li>,
                         strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                       }}
                     >
                       {message.content}
                     </ReactMarkdown>
                   </div>
                 )}
               </div>
             </div>
           ))}
           <div ref={messagesEndRef} />
         </div>

         <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
           <div className="flex gap-2">
             <input
               type="text"
               value={input}
               onChange={handleInputChange}
               placeholder="Ask about orders, generate reports, export data..."
               className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
             />
             <button
               type="submit"
               className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
             >
               <Send className="w-4 h-4" />
             </button>
           </div>

           <div className="mt-3 flex flex-wrap gap-2">
             {[
               { text: "Generate order summary", color: "bg-blue-100 text-blue-800" },
               { text: "Export orders to Excel", color: "bg-green-100 text-green-800" },
               { text: "Show revenue report", color: "bg-purple-100 text-purple-800" },
               { text: "Update order status", color: "bg-yellow-100 text-yellow-800" }
             ].map((action, index) => (
               <button
                 key={index}
                 type="button"
                 onClick={() => setInput(action.text)}
                 className={`text-xs px-2 py-1 rounded-full ${action.color} hover:opacity-80 transition-opacity`}
               >
                 {action.text}
               </button>
             ))}
           </div>
         </form>
       </div>
     )}
   </div>
 );
};

export default CustomerOrdersManager;