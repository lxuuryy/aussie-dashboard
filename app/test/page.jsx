'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Trash2, Check, X, PenTool, Loader } from 'lucide-react';
import { storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const SignatureUpload = ({ onSignatureUploaded, onClose }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // 'idle', 'uploading', 'success', 'error'
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureMode, setSignatureMode] = useState('draw'); // 'draw' or 'type'
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState('Dancing Script');

  const cursiveFonts = [
    'Dancing Script',
    'Great Vibes',
    'Allura',
    'Pacifico',
    'Satisfy',
    'Kaushan Script'
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; // High DPI
    canvas.height = rect.height * 2;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Fill with white background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // If in type mode and there's text, render it
    if (signatureMode === 'type' && typedName.trim()) {
      drawTypedSignature();
    }
  }, [signatureMode, typedName, selectedFont]);

  const drawTypedSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (!typedName.trim()) {
      setHasSignature(false);
      return;
    }
    
    // Set font and style
    ctx.fillStyle = '#000';
    ctx.font = `36px "${selectedFont}", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text in center of canvas
    const centerX = canvas.width / 4; // Accounting for 2x scale
    const centerY = canvas.height / 4;
    ctx.fillText(typedName, centerX, centerY);
    
    setHasSignature(true);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getTouchPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (signatureMode !== 'draw') return;
    
    setIsDrawing(true);
    const pos = e.type.includes('mouse') ? getMousePos(e) : getTouchPos(e);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing || signatureMode !== 'draw') return;
    
    e.preventDefault();
    const pos = e.type.includes('mouse') ? getMousePos(e) : getTouchPos(e);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (signatureMode !== 'draw') return;
    
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureUrl(null);
    setUploadStatus('idle');
    setTypedName('');
  };

  const handleModeChange = (mode) => {
    setSignatureMode(mode);
    clearSignature();
  };

  const handleTypedNameChange = (e) => {
    setTypedName(e.target.value);
  };

  const handleFontChange = (e) => {
    setSelectedFont(e.target.value);
  };

  const uploadSignature = async () => {
    if (!hasSignature) return;
    
    try {
      setIsUploading(true);
      setUploadStatus('uploading');
      setUploadProgress(0);

      const canvas = canvasRef.current;
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png', 0.9);
      });
      
      setUploadProgress(30);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `signatures/signature_${timestamp}.png`;
      
      setUploadProgress(50);

      // Upload to Firebase
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/png',
        customMetadata: {
          'uploadDate': new Date().toISOString(),
          'type': 'signature'
        }
      });
      
      setUploadProgress(80);

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      setUploadProgress(100);
      setSignatureUrl(downloadURL);
      setUploadStatus('success');
      
      // Callback to parent component
      if (onSignatureUploaded) {
        onSignatureUploaded(downloadURL, filename);
      }
      
    } catch (error) {
      console.error('Error uploading signature:', error);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 border border-white/30 shadow-2xl">
        
        {/* Google Fonts Link */}
        <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Allura&family=Pacifico&family=Satisfy&family=Kaushan+Script&display=swap" rel="stylesheet" />
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {uploadStatus === 'uploading' ? (
              <Loader className="w-8 h-8 text-white animate-spin" />
            ) : uploadStatus === 'success' ? (
              <Check className="w-8 h-8 text-white" />
            ) : (
              <PenTool className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {uploadStatus === 'success' ? 'Signature Uploaded!' : 'Create Your Signature'}
          </h2>
          <p className="text-gray-600 text-sm">
            {uploadStatus === 'success' 
              ? 'Your signature has been saved successfully'
              : 'Draw your signature or type your name below'
            }
          </p>
        </div>

        {/* Mode Selection */}
        <div className="mb-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleModeChange('draw')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                signatureMode === 'draw' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ✏️ Draw
            </button>
            <button
              onClick={() => handleModeChange('type')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                signatureMode === 'type' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ✒️ Type
            </button>
          </div>
        </div>

        {/* Type Mode Controls */}
        {signatureMode === 'type' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your name:
              </label>
              <input
                type="text"
                value={typedName}
                onChange={handleTypedNameChange}
                placeholder="Type your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose signature style:
              </label>
              <select
                value={selectedFont}
                onChange={handleFontChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {cursiveFonts.map(font => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white">
            <canvas
              ref={canvasRef}
              className={`w-full h-32 ${signatureMode === 'draw' ? 'cursor-crosshair' : 'cursor-default'} touch-none`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {signatureMode === 'draw' 
              ? 'Draw your signature above using mouse or touch'
              : 'Your typed signature will appear above'
            }
          </p>
        </div>

        {/* Upload Progress */}
        {uploadStatus === 'uploading' && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">{uploadProgress}% uploaded</p>
          </div>
        )}

        {/* Success Message */}
        {uploadStatus === 'success' && signatureUrl && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700 text-center">
              ✅ Signature uploaded successfully!
            </p>
            <img 
              src={signatureUrl} 
              alt="Uploaded signature" 
              className="mt-2 mx-auto max-h-16 border rounded"
            />
          </div>
        )}

        {/* Error Message */}
        {uploadStatus === 'error' && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700 text-center">
              ❌ Upload failed. Please try again.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {uploadStatus !== 'success' && (
            <>
              {/* Clear Button */}
              <button
                onClick={clearSignature}
                disabled={!hasSignature || isUploading}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Clear Signature
              </button>

              {/* Upload Button */}
              <button
                onClick={uploadSignature}
                disabled={!hasSignature || isUploading}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? 'Uploading...' : 'Upload Signature'}
              </button>
            </>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            {uploadStatus === 'success' ? 'Done' : 'Cancel'}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            {uploadStatus === 'success' 
              ? 'You can now use this signature in your documents'
              : 'Your signature will be saved securely in the cloud'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignatureUpload;