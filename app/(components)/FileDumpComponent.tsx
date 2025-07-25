import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode,
  FileVideo,
  FileAudio,
  Archive,
  Trash2,
  Download,
  Eye,
  Search,
  Filter,
  Calendar,
  User,
  HardDrive,
  Cloud,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  FolderOpen,
  Tag,
  Clock,
  MoreVertical,
  Copy,
  Share,
  Star,
  Grid3X3,
  List,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { 
  
  db 
} from '@/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';

interface FileMetadata {
  id?: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  downloadURL: string;
  storagePath: string;
  uploadedAt: any;
  uploadedBy: string;
  tags: string[];
  description: string;
  category: string;
  isStarred: boolean;
  lastAccessed?: any;
  accessCount: number;
  companyId: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface FileDumpComponentProps {
  companyId: string;
}

const FileDumpComponent = ({ companyId }: FileDumpComponentProps) => {
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // UI States
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showUploadZone, setShowUploadZone] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const storage = getStorage();

  // Categories for organization
  const categories = [
    { id: 'all', name: 'All Files', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'documents', name: 'Documents', icon: <FileText className="w-4 h-4" /> },
    { id: 'spreadsheets', name: 'Spreadsheets', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'images', name: 'Images', icon: <FileImage className="w-4 h-4" /> },
    { id: 'pdfs', name: 'PDFs', icon: <FileCode className="w-4 h-4" /> },
    { id: 'media', name: 'Media', icon: <FileVideo className="w-4 h-4" /> },
    { id: 'archives', name: 'Archives', icon: <Archive className="w-4 h-4" /> },
    { id: 'others', name: 'Others', icon: <File className="w-4 h-4" /> }
  ];

  // Real-time Firebase listener (company-specific)
  useEffect(() => {
    if (!companyId) return;
    
    const filesRef = collection(db, 'uploadedFiles');
    const q = query(
      filesRef, 
      where('companyId', '==', companyId),
      orderBy('uploadedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const filesData: FileMetadata[] = [];
        snapshot.forEach((doc) => {
          filesData.push({
            id: doc.id,
            ...doc.data()
          } as FileMetadata);
        });
        setFiles(filesData);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError('Failed to load files: ' + (err as Error).message);
        setLoading(false);
      }
    }, (error) => {
      setError('Real-time sync error: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId]);

  // File type detection
  const getFileCategory = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.includes('pdf')) return 'pdfs';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheets';
    if (mimeType.includes('document') || mimeType.includes('text')) return 'documents';
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) return 'media';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return 'archives';
    return 'others';
  };

  const getFileIcon = (mimeType: string) => {
    const category = getFileCategory(mimeType);
    switch (category) {
      case 'images': return <FileImage className="w-8 h-8 text-green-500" />;
      case 'pdfs': return <FileCode className="w-8 h-8 text-red-500" />;
      case 'spreadsheets': return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case 'documents': return <FileText className="w-8 h-8 text-blue-500" />;
      case 'media': return <FileVideo className="w-8 h-8 text-purple-500" />;
      case 'archives': return <Archive className="w-8 h-8 text-yellow-500" />;
      default: return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle file upload
  const handleFileUpload = async (fileList: FileList) => {
    if (!fileList || fileList.length === 0) return;
    
    setUploading(true);
    const uploadProgressArray: UploadProgress[] = Array.from(fileList).map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));
    setUploadProgress(uploadProgressArray);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Update progress
        setUploadProgress(prev => 
          prev.map((item, index) => 
            index === i ? { ...item, status: 'uploading' } : item
          )
        );

        // Generate unique filename with company prefix
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;
        const storagePath = `company-files/${companyId}/${fileName}`;

        // Upload to Firebase Storage
        const storageRef = ref(storage, storagePath);
        const uploadResult = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // Update progress
        setUploadProgress(prev => 
          prev.map((item, index) => 
            index === i ? { ...item, progress: 75, status: 'processing' } : item
          )
        );

        // Save metadata to Firestore (company-specific)
        const fileMetadata: Omit<FileMetadata, 'id'> = {
          fileName: sanitizedName,
          originalName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          downloadURL,
          storagePath,
          uploadedAt: new Date(),
          uploadedBy: 'current-user', // Replace with actual user ID
          tags: [],
          description: '',
          category: getFileCategory(file.type || ''),
          isStarred: false,
          accessCount: 0,
          companyId
        };

        await addDoc(collection(db, 'uploadedFiles'), fileMetadata);

        // Complete upload
        setUploadProgress(prev => 
          prev.map((item, index) => 
            index === i ? { ...item, progress: 100, status: 'complete' } : item
          )
        );
      }

      setSuccess(`Successfully uploaded ${fileList.length} file(s)`);
      setTimeout(() => setSuccess(null), 3000);
      setShowUploadZone(false);
    } catch (err) {
      setError('Upload failed: ' + (err as Error).message);
      setUploadProgress(prev => 
        prev.map(item => ({ ...item, status: 'error', error: (err as Error).message }))
      );
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress([]), 2000);
    }
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Delete file
  const deleteFile = async (file: FileMetadata) => {
    if (!file.id) return;
    
    try {
      // Delete from Storage
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'uploadedFiles', file.id));
      
      setSuccess('File deleted successfully');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to delete file: ' + (err as Error).message);
    }
  };

  // Download file
  const downloadFile = async (file: FileMetadata) => {
    try {
      // Update access count
      if (file.id) {
        await updateDoc(doc(db, 'uploadedFiles', file.id), {
          lastAccessed: new Date(),
          accessCount: file.accessCount + 1
        });
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = file.downloadURL;
      link.download = file.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to download file: ' + (err as Error).message);
    }
  };

  // Toggle star
  const toggleStar = async (file: FileMetadata) => {
    if (!file.id) return;
    
    try {
      await updateDoc(doc(db, 'uploadedFiles', file.id), {
        isStarred: !file.isStarred
      });
    } catch (err) {
      setError('Failed to update file: ' + (err as Error).message);
    }
  };

  // Filter and sort files
  const filteredFiles = files
    .filter(file => {
      const matchesSearch = file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           file.originalName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'date':
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
        case 'size':
          comparison = a.fileSize - b.fileSize;
          break;
        case 'type':
          comparison = a.fileType.localeCompare(b.fileType);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get storage stats
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
  const categoryStats = files.reduce((stats, file) => {
    stats[file.category] = (stats[file.category] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Company File Storage</h1>
                <p className="text-gray-600">Upload, organize, and manage files for Company: {companyId}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Files: <span className="font-semibold">{totalFiles}</span></p>
                <p className="text-sm text-gray-600">Storage Used: <span className="font-semibold">{formatFileSize(totalSize)}</span></p>
              </div>
              <button
                onClick={() => setShowUploadZone(true)}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
            </div>
          </div>
        </div>

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

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-800">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Upload Progress</h3>
            <div className="space-y-3">
              {uploadProgress.map((progress, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{progress.fileName}</span>
                      <span className="text-sm text-gray-500">{progress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progress.status === 'error' ? 'bg-red-500' : 
                          progress.status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {progress.status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    <span className="text-sm capitalize">{progress.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Zone Modal */}
        {showUploadZone && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Upload Files</h3>
                <button onClick={() => setShowUploadZone(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to browse</h4>
                <p className="text-gray-600 mb-4">Supports all file types • Max 10MB per file</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
                
                <button
                  type="button"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Select Files
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Controls */}
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
                  placeholder="Search files..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="size">Sort by Size</option>
              <option value="type">Sort by Type</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>

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

        {/* Category Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          {categories.slice(1).map(category => (
            <div key={category.id} className="bg-white p-4 rounded-lg shadow-sm text-center">
              <div className="flex justify-center mb-2">{category.icon}</div>
              <p className="text-sm font-medium text-gray-900">{categoryStats[category.id] || 0}</p>
              <p className="text-xs text-gray-600">{category.name}</p>
            </div>
          ))}
        </div>

        {/* Files Display */}
        {filteredFiles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <HardDrive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters' 
                : `Upload your first file for company ${companyId} to get started`
              }
            </p>
            <button
              onClick={() => setShowUploadZone(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Files
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
            : 'bg-white rounded-lg shadow-sm overflow-hidden'
          }>
            {viewMode === 'grid' ? (
              // Grid View
              filteredFiles.map((file) => (
                <div key={file.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file.mimeType)}
                        {file.isStarred && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleStar(file)}
                          className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                        >
                          <Star className={`w-4 h-4 ${file.isStarred ? 'text-yellow-500 fill-current' : ''}`} />
                        </button>
                        <div className="relative group">
                          <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <button
                              onClick={() => downloadFile(file)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                            <button
                              onClick={() => deleteFile(file)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="font-medium text-gray-900 text-sm mb-2 truncate" title={file.originalName}>
                      {file.originalName}
                    </h3>
                    
                    <div className="space-y-1 text-xs text-gray-500">
                      <p>Size: {formatFileSize(file.fileSize)}</p>
                      <p>Type: {file.fileType}</p>
                      <p>Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</p>
                      {file.accessCount > 0 && <p>Downloads: {file.accessCount}</p>}
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-100 p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadFile(file)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(file.downloadURL)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // List View
              <div>
                <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Size</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Actions</div>
                </div>
                {filteredFiles.map((file) => (
<div key={file.id} className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors items-center">
                   <div className="col-span-4 flex items-center gap-3">
                     {getFileIcon(file.mimeType)}
                     <div className="min-w-0 flex-1">
                       <p className="text-sm font-medium text-gray-900 truncate" title={file.originalName}>
                         {file.originalName}
                       </p>
                       {file.isStarred && (
                         <div className="flex items-center gap-1 mt-1">
                           <Star className="w-3 h-3 text-yellow-500 fill-current" />
                           <span className="text-xs text-yellow-600">Starred</span>
                         </div>
                       )}
                     </div>
                   </div>
                   
                   <div className="col-span-2 text-sm text-gray-600">
                     {formatFileSize(file.fileSize)}
                   </div>
                   
                   <div className="col-span-2 text-sm text-gray-600">
                     {file.fileType}
                   </div>
                   
                   <div className="col-span-2 text-sm text-gray-600">
                     {new Date(file.uploadedAt).toLocaleDateString()}
                   </div>
                   
                   <div className="col-span-2 flex items-center gap-2">
                     <button
                       onClick={() => toggleStar(file)}
                       className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                       title={file.isStarred ? "Remove from favorites" : "Add to favorites"}
                     >
                       <Star className={`w-4 h-4 ${file.isStarred ? 'text-yellow-500 fill-current' : ''}`} />
                     </button>
                     
                     <button
                       onClick={() => downloadFile(file)}
                       className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                       title="Download file"
                     >
                       <Download className="w-4 h-4" />
                     </button>
                     
                     <button
                       onClick={() => navigator.clipboard.writeText(file.downloadURL)}
                       className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                       title="Copy download URL"
                     >
                       <Copy className="w-4 h-4" />
                     </button>
                     
                     <button
                       onClick={() => deleteFile(file)}
                       className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                       title="Delete file"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
       )}

       {/* Bulk Actions */}
       {selectedFiles.size > 0 && (
         <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
           <div className="flex items-center gap-4">
             <span className="text-sm font-medium text-gray-700">
               {selectedFiles.size} file(s) selected
             </span>
             <div className="flex gap-2">
               <button
                 onClick={() => {
                   // Bulk download logic here
                   selectedFiles.forEach(fileId => {
                     const file = files.find(f => f.id === fileId);
                     if (file) downloadFile(file);
                   });
                 }}
                 className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
               >
                 Download All
               </button>
               <button
                 onClick={() => {
                   // Bulk delete logic here
                   if (confirm(`Delete ${selectedFiles.size} file(s)?`)) {
                     selectedFiles.forEach(fileId => {
                       const file = files.find(f => f.id === fileId);
                       if (file) deleteFile(file);
                     });
                     setSelectedFiles(new Set());
                   }
                 }}
                 className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
               >
                 Delete All
               </button>
               <button
                 onClick={() => setSelectedFiles(new Set())}
                 className="px-3 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
               >
                 Clear Selection
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Footer Stats */}
       <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="text-center">
             <div className="text-2xl font-bold text-blue-600">{totalFiles}</div>
             <div className="text-sm text-gray-600">Total Files</div>
           </div>
           <div className="text-center">
             <div className="text-2xl font-bold text-green-600">{formatFileSize(totalSize)}</div>
             <div className="text-sm text-gray-600">Storage Used</div>
           </div>
           <div className="text-center">
             <div className="text-2xl font-bold text-purple-600">
               {files.filter(f => f.isStarred).length}
             </div>
             <div className="text-sm text-gray-600">Starred Files</div>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
};

export default FileDumpComponent;