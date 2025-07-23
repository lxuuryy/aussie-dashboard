'use client'
import React, { useState, useCallback, useRef } from 'react';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  Database, 
  Trash2, 
  Plus, 
  Edit,
  Save,
  X,
  Copy,
 
  Search,
  Filter,
  SortAsc,
  SortDesc,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Move,
  Settings,
  Grid,
  Table as TableIcon,
  PlusCircle,
  Layers
} from 'lucide-react';

interface DataRow {
  [key: string]: any;
}

interface TableData {
  id: string;
  name: string;
  data: DataRow[];
  headers: string[];
  hiddenColumns: Set<string>;
  filters: Record<string, string>;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
}

interface DragState {
  isDragging: boolean;
  draggedColumn: string | null;
  dragOverColumn: string | null;
}

const EnhancedExcelExporter: React.FC = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [activeTableId, setActiveTableId] = useState<string>('');
  const [fileName, setFileName] = useState('exported_data');
  const [editingCell, setEditingCell] = useState<{tableId: string, row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [copiedData, setCopiedData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedColumn: null,
    dragOverColumn: null
  });
  const [showTableSettings, setShowTableSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create new table
  const createNewTable = (name?: string) => {
    const tableName = name || `Table ${tables.length + 1}`;
    const newTable: TableData = {
      id: `table_${Date.now()}`,
      name: tableName,
      data: [],
      headers: [],
      hiddenColumns: new Set(),
      filters: {},
      sortConfig: null
    };
    
    setTables([...tables, newTable]);
    setActiveTableId(newTable.id);
  };

  // Get active table
  const getActiveTable = (): TableData | null => {
    return tables.find(table => table.id === activeTableId) || null;
  };

  // Update active table
  const updateActiveTable = (updates: Partial<TableData>) => {
    setTables(tables.map(table => 
      table.id === activeTableId ? { ...table, ...updates } : table
    ));
  };

  // Sample data generators
  const sampleDataSets = {
    employees: [
      { id: 1, name: 'John Doe', email: 'john@company.com', age: 30, department: 'Engineering', salary: 75000, startDate: '2020-01-15' },
      { id: 2, name: 'Jane Smith', email: 'jane@company.com', age: 28, department: 'Marketing', salary: 65000, startDate: '2021-03-10' },
      { id: 3, name: 'Mike Johnson', email: 'mike@company.com', age: 35, department: 'Sales', salary: 70000, startDate: '2019-07-22' },
      { id: 4, name: 'Sarah Wilson', email: 'sarah@company.com', age: 32, department: 'HR', salary: 60000, startDate: '2020-11-05' },
      { id: 5, name: 'Tom Brown', email: 'tom@company.com', age: 29, department: 'Engineering', salary: 80000, startDate: '2022-02-14' }
    ],
    products: [
      { id: 'P001', name: 'Laptop Pro', category: 'Electronics', price: 1299.99, stock: 45, supplier: 'TechCorp' },
      { id: 'P002', name: 'Wireless Mouse', category: 'Accessories', price: 29.99, stock: 120, supplier: 'Gadgets Inc' },
      { id: 'P003', name: 'Monitor 27"', category: 'Electronics', price: 399.99, stock: 23, supplier: 'DisplayTech' },
      { id: 'P004', name: 'Keyboard Mechanical', category: 'Accessories', price: 89.99, stock: 67, supplier: 'KeyMaster' },
      { id: 'P005', name: 'Webcam HD', category: 'Electronics', price: 79.99, stock: 34, supplier: 'VideoTech' }
    ],
    sales: [
      { orderId: 'ORD001', date: '2024-01-15', customer: 'ABC Corp', product: 'Laptop Pro', quantity: 2, total: 2599.98 },
      { orderId: 'ORD002', date: '2024-01-16', customer: 'XYZ Ltd', product: 'Monitor 27"', quantity: 5, total: 1999.95 },
      { orderId: 'ORD003', date: '2024-01-17', customer: 'Tech Solutions', product: 'Wireless Mouse', quantity: 10, total: 299.90 },
      { orderId: 'ORD004', date: '2024-01-18', customer: 'StartupCo', product: 'Keyboard Mechanical', quantity: 3, total: 269.97 },
      { orderId: 'ORD005', date: '2024-01-19', customer: 'BigBusiness', product: 'Webcam HD', quantity: 8, total: 639.92 }
    ]
  };

  const loadSampleData = (datasetName: keyof typeof sampleDataSets) => {
    const sampleData = sampleDataSets[datasetName];
    const tableName = datasetName.charAt(0).toUpperCase() + datasetName.slice(1);
    
    if (getActiveTable()?.data.length === 0) {
      updateActiveTable({
        name: tableName,
        data: sampleData,
        headers: Object.keys(sampleData[0])
      });
    } else {
      createNewTable(tableName);
      setTimeout(() => {
        updateActiveTable({
          data: sampleData,
          headers: Object.keys(sampleData[0])
        });
      }, 50);
    }
  };

  // File operations
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // For demo purposes, we'll simulate Excel reading
        // In a real app, you'd use SheetJS (xlsx library)
        const text = e.target?.result as string;
        if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const data = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: DataRow = { id: index + 1 };
            headers.forEach((header, i) => {
              row[header] = values[i] || '';
            });
            return row;
          });

          const tableName = file.name.replace(/\.[^/.]+$/, '');
          createNewTable(tableName);
          setTimeout(() => {
            updateActiveTable({ data, headers });
          }, 50);
        }
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
      }
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Export functionality
  const exportToExcel = () => {
    const activeTable = getActiveTable();
    if (!activeTable || activeTable.data.length === 0) {
      alert('No data to export!');
      return;
    }

    // For demo purposes, we'll export as CSV
    const headers = activeTable.headers.filter(h => !activeTable.hiddenColumns.has(h));
    const csvContent = [
      headers.join(','),
      ...activeTable.data.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllTables = () => {
    tables.forEach((table, index) => {
      const headers = table.headers.filter(h => !table.hiddenColumns.has(h));
      const csvContent = [
        headers.join(','),
        ...table.data.map(row => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_${table.name}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Table operations
  const deleteTable = (tableId: string) => {
    const newTables = tables.filter(t => t.id !== tableId);
    setTables(newTables);
    
    if (activeTableId === tableId) {
      setActiveTableId(newTables.length > 0 ? newTables[0].id : '');
    }
  };

  const duplicateTable = (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      const newTable: TableData = {
        ...table,
        id: `table_${Date.now()}`,
        name: `${table.name} (Copy)`
      };
      setTables([...tables, newTable]);
    }
  };

  // Data operations
  const addNewRow = () => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const newRow: DataRow = { id: Date.now() };
    activeTable.headers.forEach(header => {
      newRow[header] = '';
    });
    
    updateActiveTable({
      data: [...activeTable.data, newRow]
    });
  };

  const deleteRow = (index: number) => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const newData = activeTable.data.filter((_, i) => i !== index);
    updateActiveTable({ data: newData });
  };

  const addNewColumn = () => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const columnName = prompt('Enter column name:');
    if (columnName && !activeTable.headers.includes(columnName)) {
      const newHeaders = [...activeTable.headers, columnName];
      const newData = activeTable.data.map(row => ({ ...row, [columnName]: '' }));
      
      updateActiveTable({
        headers: newHeaders,
        data: newData
      });
    }
  };

  const deleteColumn = (columnName: string) => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const newHeaders = activeTable.headers.filter(h => h !== columnName);
    const newData = activeTable.data.map(row => {
      const newRow = { ...row };
      delete newRow[columnName];
      return newRow;
    });

    updateActiveTable({
      headers: newHeaders,
      data: newData
    });
  };

  // Column operations
  const toggleColumnVisibility = (columnName: string) => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const newHiddenColumns = new Set(activeTable.hiddenColumns);
    if (newHiddenColumns.has(columnName)) {
      newHiddenColumns.delete(columnName);
    } else {
      newHiddenColumns.add(columnName);
    }

    updateActiveTable({ hiddenColumns: newHiddenColumns });
  };

  // Drag and drop for columns
  const handleColumnDragStart = (columnName: string) => {
    setDragState({
      isDragging: true,
      draggedColumn: columnName,
      dragOverColumn: null
    });
  };

  const handleColumnDragOver = (columnName: string) => {
    if (dragState.isDragging && dragState.draggedColumn !== columnName) {
      setDragState(prev => ({ ...prev, dragOverColumn: columnName }));
    }
  };

  const handleColumnDrop = (targetColumn: string) => {
    const activeTable = getActiveTable();
    if (!activeTable || !dragState.draggedColumn || dragState.draggedColumn === targetColumn) {
      setDragState({ isDragging: false, draggedColumn: null, dragOverColumn: null });
      return;
    }

    const draggedIndex = activeTable.headers.indexOf(dragState.draggedColumn);
    const targetIndex = activeTable.headers.indexOf(targetColumn);
    
    const newHeaders = [...activeTable.headers];
    const [draggedColumn] = newHeaders.splice(draggedIndex, 1);
    newHeaders.splice(targetIndex, 0, draggedColumn);

    updateActiveTable({ headers: newHeaders });
    setDragState({ isDragging: false, draggedColumn: null, dragOverColumn: null });
  };

  // Cell editing
  const startEdit = (tableId: string, rowIndex: number, column: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setEditingCell({ tableId, row: rowIndex, col: column });
    setEditValue(String(table.data[rowIndex][column] || ''));
  };

  const saveEdit = () => {
    if (!editingCell) return;

    const table = tables.find(t => t.id === editingCell.tableId);
    if (!table) return;

    const newData = [...table.data];
    newData[editingCell.row][editingCell.col] = editValue;
    
    setTables(tables.map(t => 
      t.id === editingCell.tableId ? { ...t, data: newData } : t
    ));
    
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Filtering and sorting
  const updateFilter = (column: string, value: string) => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const newFilters = { ...activeTable.filters };
    if (value) {
      newFilters[column] = value;
    } else {
      delete newFilters[column];
    }

    updateActiveTable({ filters: newFilters });
  };

  const sortByColumn = (column: string) => {
    const activeTable = getActiveTable();
    if (!activeTable) return;

    const direction = activeTable.sortConfig?.key === column && activeTable.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    
    const sortedData = [...activeTable.data].sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    updateActiveTable({
      data: sortedData,
      sortConfig: { key: column, direction }
    });
  };

  // Filter data based on current filters and search
  const getFilteredData = (table: TableData) => {
    let filteredData = table.data;

    // Apply column filters
    Object.entries(table.filters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filteredData = filteredData.filter(row =>
          String(row[column] || '').toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Apply global search
    if (searchTerm) {
      filteredData = filteredData.filter(row =>
        table.headers.some(header =>
          String(row[header] || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filteredData;
  };

  // Initialize with first table if none exist
  React.useEffect(() => {
    if (tables.length === 0) {
      createNewTable('Main Table');
    }
  }, []);

  const activeTable = getActiveTable();
  const filteredData = activeTable ? getFilteredData(activeTable) : [];
  const visibleHeaders = activeTable ? activeTable.headers.filter(h => !activeTable.hiddenColumns.has(h)) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                Enhanced Excel Manager
              </h1>
              <p className="text-gray-600">Multi-table data management with advanced features</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTableSettings(!showTableSettings)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={exportAllTables}
                disabled={tables.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            </div>
          </div>
        </div>

        {/* Table Tabs */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex items-center gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Layers className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Tables:</span>
            </div>
            
            {tables.map((table) => (
              <div
                key={table.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors flex-shrink-0 ${
                  activeTableId === table.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setActiveTableId(table.id)}
              >
                <TableIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{table.name}</span>
                <span className="text-xs text-gray-500">({table.data.length})</span>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateTable(table.id);
                    }}
                    className="text-gray-500 hover:text-blue-600 transition-colors"
                    title="Duplicate table"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  {tables.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTable(table.id);
                      }}
                      className="text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete table"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            <button
              onClick={() => createNewTable()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              New Table
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* File Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter file name"
              />
            </div>

            {/* Global Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Global Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search all data..."
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="flex items-end">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
            </div>

            {/* Add Column Button */}
            <div className="flex items-end">
              <button
                onClick={addNewColumn}
                disabled={!activeTable}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Column
              </button>
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <button
                onClick={exportToExcel}
                disabled={!activeTable || activeTable.data.length === 0}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Table
              </button>
            </div>
          </div>
        </div>

        {/* Sample Data Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Load Sample Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.keys(sampleDataSets).map((datasetName) => (
              <button
                key={datasetName}
                onClick={() => loadSampleData(datasetName as keyof typeof sampleDataSets)}
                className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4" />
                Load {datasetName.charAt(0).toUpperCase() + datasetName.slice(1)} Data
              </button>
            ))}
          </div>
        </div>

        {/* Column Settings Panel */}
        {showTableSettings && activeTable && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Column Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeTable.headers.map((header) => (
                <div key={header} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleColumnVisibility(header)}
                      className={`transition-colors ${
                        activeTable.hiddenColumns.has(header) ? 'text-gray-400' : 'text-blue-600'
                      }`}
                    >
                      {activeTable.hiddenColumns.has(header) ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <span className={`text-sm ${
                      activeTable.hiddenColumns.has(header) ? 'text-gray-400 line-through' : 'text-gray-700'
                    }`}>
                      {header}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteColumn(header)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Table */}
        {activeTable && activeTable.data.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {activeTable.name} ({filteredData.length} of {activeTable.data.length} rows)
                </h2>
                {Object.keys(activeTable.filters).length > 0 && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {Object.keys(activeTable.filters).length} filter(s) active
                  </span>
                )}
              </div>
              <button
                onClick={addNewRow}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 border-b border-gray-200 text-left text-sm font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">
                      Actions
                    </th>
                    {visibleHeaders.map((header) => (
                      <th
                        key={header}
                        draggable
                        onDragStart={() => handleColumnDragStart(header)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          handleColumnDragOver(header);
                        }}
                        onDrop={() => handleColumnDrop(header)}
                        className={`px-4 py-2 border-b border-gray-200 text-left text-sm font-medium text-gray-700 cursor-move relative ${
                          dragState.dragOverColumn === header && dragState.draggedColumn !== header
                            ? 'bg-blue-100'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Move className="w-3 h-3 text-gray-400" />
                            <span>{header}</span>
                            <button
                              onClick={() => sortByColumn(header)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {activeTable.sortConfig?.key === header ? (
                               activeTable.sortConfig.direction === 'asc' ? (
                                 <SortAsc className="w-3 h-3" />
                               ) : (
                                 <SortDesc className="w-3 h-3" />
                               )
                             ) : (
                               <SortAsc className="w-3 h-3 opacity-50" />
                             )}
                           </button>
                         </div>
                         <div className="flex items-center gap-1">
                           <button
                             onClick={() => toggleColumnVisibility(header)}
                             className="text-gray-400 hover:text-gray-600"
                             title="Hide column"
                           >
                             <EyeOff className="w-3 h-3" />
                           </button>
                           <button
                             onClick={() => deleteColumn(header)}
                             className="text-gray-400 hover:text-red-600"
                             title="Delete column"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                       </div>
                       {/* Column filter */}
                       <div className="mt-2">
                         <input
                           type="text"
                           value={activeTable.filters[header] || ''}
                           onChange={(e) => updateFilter(header, e.target.value)}
                           className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                           placeholder={`Filter ${header}...`}
                         />
                       </div>
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {filteredData.map((row, rowIndex) => (
                   <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                     <td className="px-4 py-2 border-b border-gray-200 sticky left-0 bg-white z-10">
                       <div className="flex items-center gap-2">
                         <button
                           onClick={() => deleteRow(rowIndex)}
                           className="text-red-600 hover:text-red-800 transition-colors"
                           title="Delete row"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <button
                           onClick={() => {
                             const newRow = { ...row, id: Date.now() };
                             const newData = [...activeTable.data];
                             newData.splice(rowIndex + 1, 0, newRow);
                             updateActiveTable({ data: newData });
                           }}
                           className="text-blue-600 hover:text-blue-800 transition-colors"
                           title="Duplicate row"
                         >
                           <Copy className="w-4 h-4" />
                         </button>
                       </div>
                     </td>
                     {visibleHeaders.map((header) => (
                       <td
                         key={`${rowIndex}-${header}`}
                         className="px-4 py-2 border-b border-gray-200"
                       >
                         {editingCell?.tableId === activeTable.id && 
                          editingCell?.row === rowIndex && 
                          editingCell?.col === header ? (
                           <div className="flex items-center gap-2">
                             <input
                               type="text"
                               value={editValue}
                               onChange={(e) => setEditValue(e.target.value)}
                               className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                               onKeyPress={(e) => {
                                 if (e.key === 'Enter') saveEdit();
                                 if (e.key === 'Escape') cancelEdit();
                               }}
                               onBlur={saveEdit}
                               autoFocus
                             />
                             <button
                               onClick={saveEdit}
                               className="text-green-600 hover:text-green-800"
                             >
                               <Save className="w-4 h-4" />
                             </button>
                             <button
                               onClick={cancelEdit}
                               className="text-red-600 hover:text-red-800"
                             >
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                         ) : (
                           <div
                             className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded flex items-center justify-between group min-h-[24px]"
                             onClick={() => startEdit(activeTable.id, rowIndex, header)}
                           >
                             <span className="text-sm truncate flex-1">
                               {String(row[header] || '')}
                             </span>
                             <Edit className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                           </div>
                         )}
                       </td>
                     ))}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>

           {/* Bulk operations footer */}
           <div className="mt-4 flex items-center justify-between border-t pt-4">
             <div className="flex items-center gap-4">
               <button
                 onClick={() => {
                   const csvData = [
                     visibleHeaders.join(','),
                     ...filteredData.map(row => 
                       visibleHeaders.map(header => `"${row[header] || ''}"`).join(',')
                     )
                   ].join('\n');
                   navigator.clipboard.writeText(csvData);
                   alert('Table data copied to clipboard!');
                 }}
                 className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
               >
                 <Copy className="w-3 h-3" />
                 Copy All
               </button>
               
               <button
                 onClick={() => {
                   if (confirm('Clear all filters?')) {
                     updateActiveTable({ filters: {} });
                   }
                 }}
                 className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors flex items-center gap-2"
                 disabled={Object.keys(activeTable.filters).length === 0}
               >
                 <Filter className="w-3 h-3" />
                 Clear Filters
               </button>
               
               <button
                 onClick={() => {
                   updateActiveTable({ sortConfig: null });
                 }}
                 className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors"
                 disabled={!activeTable.sortConfig}
               >
                 Clear Sort
               </button>
             </div>
             
             <div className="text-sm text-gray-600">
               {activeTable.hiddenColumns.size > 0 && (
                 <span className="mr-4">
                   {activeTable.hiddenColumns.size} column(s) hidden
                 </span>
               )}
               <span>
                 Showing {filteredData.length} of {activeTable.data.length} rows
               </span>
             </div>
           </div>
         </div>
       )}

       {/* Empty State */}
       {activeTable && activeTable.data.length === 0 && (
         <div className="bg-white rounded-lg shadow-lg p-12 text-center">
           <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
           <h3 className="text-lg font-medium text-gray-900 mb-2">No Data in {activeTable.name}</h3>
           <p className="text-gray-600 mb-6">
             Upload a file, load sample data, or add rows manually to get started
           </p>
           <div className="flex justify-center gap-4">
             <button
               onClick={() => loadSampleData('employees')}
               className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
             >
               Load Sample Data
             </button>
             <button
               onClick={addNewRow}
               className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
             >
               Add First Row
             </button>
           </div>
         </div>
       )}

       {/* No Tables State */}
       {tables.length === 0 && (
         <div className="bg-white rounded-lg shadow-lg p-12 text-center">
           <Grid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
           <h3 className="text-lg font-medium text-gray-900 mb-2">No Tables Available</h3>
           <p className="text-gray-600 mb-6">
             Create your first table to start managing data
           </p>
           <button
             onClick={() => createNewTable()}
             className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
           >
             Create First Table
           </button>
         </div>
       )}

       {/* Keyboard Shortcuts Help */}
       <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
         <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Pro Tips & Shortcuts</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
           <div className="space-y-2">
             <h4 className="font-medium text-gray-800">Editing</h4>
             <p>• Click any cell to edit</p>
             <p>• Press Enter to save</p>
             <p>• Press Escape to cancel</p>
           </div>
           <div className="space-y-2">
             <h4 className="font-medium text-gray-800">Columns</h4>
             <p>• Drag column headers to reorder</p>
             <p>• Use eye icon to hide/show</p>
             <p>• Click sort icons to sort data</p>
           </div>
           <div className="space-y-2">
             <h4 className="font-medium text-gray-800">Tables</h4>
             <p>• Create unlimited tables</p>
             <p>• Copy/duplicate tables easily</p>
             <p>• Export individual or all tables</p>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
};

export default EnhancedExcelExporter;