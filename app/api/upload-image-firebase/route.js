// app/api/upload-image-firebase/route.js
import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import {storage } from '@/firebase'


export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');
    const folder = data.get('folder') || 'images';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${folder}/${timestamp}-${randomString}.${fileExtension}`;

    console.log('Uploading to Firebase Storage:', fileName);

    // Create storage reference
    const storageRef = ref(storage, fileName);

    // Upload file to Firebase Storage
    const uploadResult = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size.toString()
      }
    });

    console.log('Upload successful:', uploadResult.metadata.fullPath);

    // Get download URL
    const downloadURL = await getDownloadURL(uploadResult.ref);

    // Get image dimensions (basic calculation)
    let width = 0;
    let height = 0;
    
    try {
      // For better dimension detection, you could use an image processing library
      // For now, we'll use placeholder values
      if (file.type.includes('jpeg') || file.type.includes('jpg')) {
        // Basic JPEG dimension detection would go here
        width = 800; // placeholder
        height = 600; // placeholder
      } else if (file.type.includes('png')) {
        // Basic PNG dimension detection would go here
        width = 800; // placeholder
        height = 600; // placeholder
      }
    } catch (error) {
      console.log('Could not determine image dimensions:', error);
    }

    return NextResponse.json({
      success: true,
      url: downloadURL,
      fileName: fileName,
      originalName: file.name,
      size: file.size,
      width: width,
      height: height,
      format: fileExtension,
      uploadedAt: new Date().toISOString(),
      storage: 'firebase'
    });

  } catch (error) {
    console.error('Firebase upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Upload failed'
      },
      { status: 500 }
    );
  }
}