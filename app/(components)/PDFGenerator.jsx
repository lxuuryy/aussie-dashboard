'use client'
import React, { useState, useEffect } from 'react';

const EnhancedCombinedApp = () => {
  const [activeTab, setActiveTab] = useState('upload');
  
  // Upload tab states
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Create tab states
  const [fileType, setFileType] = useState('text');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  
  // Image upload states for file creation
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);

  // File templates for the create tab
  const fileTemplates = {
    text: 'Hello World!\n\nThis is a basic text file created in the browser.\nYou can edit this content and upload it as a PDF to AWS S3.\n\n[Images can be uploaded and referenced here]',
    json: JSON.stringify({
      "name": "Sample JSON File",
      "version": "1.0.0",
      "description": "This is a sample JSON file created in the browser",
      "images": [],
      "data": {
        "items": ["item1", "item2", "item3"],
        "timestamp": new Date().toISOString()
      }
    }, null, 2),
    markdown: `# Sample Markdown File

## Introduction
This is a **sample markdown file** created in the browser.

### Features
- Easy to write
- *Formatted text*
- Lists and more
- **Image support**

### Code Example
\`\`\`javascript
console.log("Hello from markdown!");
\`\`\`

### Images
<!-- Upload images using the button below and they'll be inserted here -->

> This will be converted to PDF and uploaded to AWS S3.`,
    csv: `Name,Age,City,Email,Image_URL
John Doe,30,New York,john@example.com,
Jane Smith,25,Los Angeles,jane@example.com,
Bob Johnson,35,Chicago,bob@example.com,
Alice Brown,28,Houston,alice@example.com,`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample HTML Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .highlight { background-color: yellow; }
        .image-container { text-align: center; margin: 20px 0; }
        .image-container img { max-width: 100%; height: auto; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Sample HTML File</h1>
    <p>This is a <span class="highlight">sample HTML file</span> created in the browser.</p>
    
    <div class="image-container">
        <!-- Images will be inserted here -->
    </div>
    
    <ul>
        <li>List item 1</li>
        <li>List item 2</li>
        <li>List item 3</li>
    </ul>
    <p>This will be converted to PDF and uploaded to AWS S3.</p>
</body>
</html>`
  };

  // Initialize create tab with default values
  useEffect(() => {
    setFileContent(fileTemplates.text);
    setFileName('sample-text-file');
  }, []);

  // Clean up file preview URL
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // Upload tab handlers
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadMessage('');

      if (file.type.startsWith('image/')) {
        setFilePreviewUrl(URL.createObjectURL(file));
      } else {
        setFilePreviewUrl('');
      }
    } else {
      setSelectedFile(null);
      setFilePreviewUrl('');
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setUploadMessage('Please select a file first.');
      return;
    }

    setUploadLoading(true);
    setUploadMessage('Converting to PDF and uploading...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/process-pdf-with-images', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setUploadMessage(`Success: ${data.message || 'File converted and PDF uploaded!'}`);
      } else {
        setUploadMessage(`Error: ${data.error || 'Failed to process file.'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage('An unexpected error occurred during upload.');
    } finally {
      setUploadLoading(false);
      setSelectedFile(null);
      setFilePreviewUrl('');
    }
  };

  // Image upload for file creation
  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;

    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setCreateMessage('Please select only image files.');
      return;
    }

    setImageUploading(true);
    setCreateMessage('Uploading images to Cloudinary...');

    try {
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'file-creator-images');

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          const newImage = {
            id: Date.now() + Math.random(),
            url: result.url,
            filename: file.name,
            size: result.bytes,
            dimensions: `${result.width}x${result.height}`,
            format: result.format
          };

          setUploadedImages(prev => [...prev, newImage]);
          
          // Auto-insert image into content based on file type
          insertImageIntoContent(newImage);
        } else {
          setCreateMessage(`Error uploading ${file.name}: ${result.error}`);
        }
      }
      
      setCreateMessage('Images uploaded successfully!');
    } catch (error) {
      console.error('Image upload error:', error);
      setCreateMessage('Failed to upload images.');
    } finally {
      setImageUploading(false);
    }
  };

  // Insert image into file content based on file type
  const insertImageIntoContent = (image) => {
    let insertText = '';
    
    switch (fileType) {
      case 'markdown':
        insertText = `\n![${image.filename}](${image.url})\n`;
        break;
      case 'html':
        insertText = `\n    <div class="image-container">\n        <img src="${image.url}" alt="${image.filename}" />\n        <p><em>${image.filename}</em></p>\n    </div>\n`;
        break;
      case 'json':
        try {
          const jsonContent = JSON.parse(fileContent);
          if (!jsonContent.images) jsonContent.images = [];
          jsonContent.images.push({
            filename: image.filename,
            url: image.url,
            dimensions: image.dimensions,
            size: image.size
          });
          setFileContent(JSON.stringify(jsonContent, null, 2));
          return;
        } catch (e) {
          insertText = `\n"image_url": "${image.url}",`;
        }
        break;
      case 'csv':
        insertText = `\nImage Upload,${image.filename},${image.dimensions},${image.url}`;
        break;
      case 'text':
      default:
        insertText = `\nImage: ${image.filename}\nURL: ${image.url}\nSize: ${image.size} bytes\nDimensions: ${image.dimensions}\n`;
        break;
    }
    
    if (insertText) {
      setFileContent(prev => prev + insertText);
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Create tab handlers
  const handleFileTypeChange = (type) => {
    setFileType(type);
    setFileContent(fileTemplates[type]);
    setFileName(`sample-${type}-file`);
    setCreateMessage('');
    // Clear uploaded images when switching file types
    setUploadedImages([]);
  };

  const handleCreateAndUpload = async () => {
    if (!fileName.trim() || !fileContent.trim()) {
      setCreateMessage('Please provide both file name and content.');
      return;
    }

    setCreateLoading(true);
    setCreateMessage('Creating file and uploading...');

    try {
      let mimeType = 'text/plain';
      let fileExtension = '.txt';

      switch (fileType) {
        case 'json':
          mimeType = 'application/json';
          fileExtension = '.json';
          break;
        case 'markdown':
          mimeType = 'text/markdown';
          fileExtension = '.md';
          break;
        case 'csv':
          mimeType = 'text/csv';
          fileExtension = '.csv';
          break;
        case 'html':
          mimeType = 'text/html';
          fileExtension = '.html';
          break;
      }

      const fileBlob = new Blob([fileContent], { type: mimeType });
      const file = new File([fileBlob], `${fileName}${fileExtension}`, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/process-pdf-with-images', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setCreateMessage(`Success: File created and uploaded! PDF available at: ${data.pdfUrl}`);
      } else {
        setCreateMessage(`Error: ${data.error || 'Failed to process file.'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setCreateMessage('An unexpected error occurred during upload.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownloadFile = () => {
    if (!fileName.trim() || !fileContent.trim()) {
      setCreateMessage('Please provide both file name and content.');
      return;
    }

    let mimeType = 'text/plain';
    let fileExtension = '.txt';

    switch (fileType) {
      case 'json':
        mimeType = 'application/json';
        fileExtension = '.json';
        break;
      case 'markdown':
        mimeType = 'text/markdown';
        fileExtension = '.md';
        break;
      case 'csv':
        mimeType = 'text/csv';
        fileExtension = '.csv';
        break;
      case 'html':
        mimeType = 'text/html';
        fileExtension = '.html';
        break;
    }

    const fileBlob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-inter">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            📄 File to PDF Converter & AWS Uploader
          </h1>
          <p className="text-lg text-gray-600">
            Upload existing files or create new ones with images, convert to PDF, and upload to AWS S3
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📤 Upload Existing File
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              📝 Create New File with Images
            </button>
          </div>

          <div className="p-8">
            {/* Upload Tab */}
            {activeTab === 'upload' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Existing File</h2>
                
                <div className="mb-6">
                  <label htmlFor="file-upload" className="block text-gray-700 text-sm font-medium mb-2">
                    Select File:
                  </label>
                  <input
                    type="file"
                    id="file-upload"
                    accept="*/*"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {filePreviewUrl && (
                  <div className="mb-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">File Preview:</h3>
                    <img
                      src={filePreviewUrl}
                      alt="File Preview"
                      className="max-w-full h-auto rounded-md shadow-md mx-auto"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}

                <button
                  onClick={handleUploadSubmit}
                  disabled={uploadLoading || !selectedFile}
                  className={`w-full py-3 px-4 rounded-md text-white font-semibold transition duration-300 ease-in-out ${
                    uploadLoading || !selectedFile
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
                >
                  {uploadLoading ? 'Processing...' : 'Convert to PDF & Upload'}
                </button>

                {uploadMessage && (
                  <div
                    className={`mt-4 p-3 rounded-md text-sm text-center ${
                      uploadMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {uploadMessage}
                  </div>
                )}
              </div>
            )}

            {/* Create Tab */}
            {activeTab === 'create' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New File with Images</h2>
                
                {/* File Type Selection */}
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-medium mb-3">
                    Choose File Type:
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Object.keys(fileTemplates).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleFileTypeChange(type)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          fileType === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">📸 Add Images to Your File</h3>
                  
                  <div className="mb-4">
                    <label htmlFor="image-upload" className="block text-gray-700 text-sm font-medium mb-2">
                      Upload Images (will be embedded in your file):
                    </label>
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Images will be uploaded to Cloudinary and automatically inserted into your file content
                    </p>
                  </div>

                  {/* Uploaded Images Preview */}
                  {uploadedImages.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Images:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {uploadedImages.map((image) => (
                          <div key={image.id} className="relative group">
                            <img
                              src={image.url}
                              alt={image.filename}
                              className="w-full h-20 object-cover rounded-md border"
                            />
                            <button
                              onClick={() => removeUploadedImage(image.id)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                            <p className="text-xs text-gray-600 mt-1 truncate">{image.filename}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {imageUploading && (
                    <div className="flex items-center text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm">Uploading images...</span>
                    </div>
                  )}
                </div>

                {/* File Name Input */}
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    File Name (without extension):
                  </label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder={`my-${fileType}-file`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* File Content Editor */}
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    File Content:
                  </label>
                  <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    rows={fileType === 'html' ? 15 : 12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder={`Enter your ${fileType} content here...`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    File will be saved as: <strong>{fileName}.{fileType === 'markdown' ? 'md' : fileType}</strong>
                    {uploadedImages.length > 0 && ` • ${uploadedImages.length} image(s) included`}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <button
                    onClick={handleCreateAndUpload}
                    disabled={createLoading || !fileName.trim() || !fileContent.trim()}
                    className={`flex-1 py-3 px-4 rounded-md text-white font-semibold transition duration-300 ease-in-out ${
                      createLoading || !fileName.trim() || !fileContent.trim()
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    }`}
                  >
                    {createLoading ? '🔄 Processing...' : '📤 Create & Upload as PDF'}
                  </button>

                  <button
                    onClick={handleDownloadFile}
                    disabled={!fileName.trim() || !fileContent.trim()}
                    className={`flex-1 py-3 px-4 rounded-md font-semibold transition duration-300 ease-in-out ${
                      !fileName.trim() || !fileContent.trim()
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
                    }`}
                  >
                    💾 Download Locally
                  </button>
                </div>

                {/* Message Display */}
                {createMessage && (
                  <div
                    className={`p-4 rounded-md text-sm ${
                      createMessage.startsWith('Error') 
                        ? 'bg-red-100 text-red-700 border border-red-300' 
                        : 'bg-green-100 text-green-700 border border-green-300'
                    }`}
                  >
                    {createMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 How to Use Image Upload</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Image Integration:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Upload images using the image upload section</li>
                <li>• Images are automatically uploaded to Cloudinary</li>
                <li>• Image URLs are inserted into your file content</li>
                <li>• Different file types handle images differently</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">File Type Support:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• <strong>Markdown:</strong> ![alt](url) syntax</li>
                <li>• <strong>HTML:</strong> &lt;img&gt; tags with styling</li>
                <li>• <strong>JSON:</strong> Added to images array</li>
                <li>• <strong>CSV:</strong> URLs in dedicated column</li>
                <li>• <strong>Text:</strong> Plain image information</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCombinedApp;