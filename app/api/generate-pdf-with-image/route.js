// app/api/generate-pdf-with-image/route.js
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Define PDF styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333333',
  },
  subHeader: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    color: '#666666',
  },
  imageContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  image: {
    width: 400,
    height: 300,
    objectFit: 'contain',
  },
  textContent: {
    fontSize: 12,
    lineHeight: 1.5,
    marginVertical: 10,
    color: '#333333',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#888888',
  },
  metadata: {
    fontSize: 10,
    color: '#666666',
    marginTop: 10,
  }
});

// PDF Document Component
const PDFDocument = ({ imageUrl, title, description, metadata }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>{title || 'Document with Image'}</Text>
      <Text style={styles.subHeader}>{description || 'Generated PDF with embedded image'}</Text>
      
      {imageUrl && (
        <View style={styles.imageContainer}>
          <Image 
            src={imageUrl} 
            style={styles.image}
            onError={(error) => console.error('Image loading error:', error)}
          />
        </View>
      )}
      
      <Text style={styles.textContent}>
        This document contains an embedded image that has been processed and included in the PDF.
        The image is sourced from Cloudinary and embedded directly into this PDF document.
      </Text>
      
      {metadata && (
        <View style={styles.metadata}>
          <Text>Document generated on: {new Date().toLocaleString()}</Text>
          {metadata.imageName && <Text>Image name: {metadata.imageName}</Text>}
          {metadata.imageSize && <Text>Image size: {metadata.imageSize}</Text>}
          {metadata.imageDimensions && <Text>Image dimensions: {metadata.imageDimensions}</Text>}
        </View>
      )}
      
      <Text style={styles.footer}>
        Generated with React PDF • {new Date().getFullYear()}
      </Text>
    </Page>
  </Document>
);

export async function POST(request) {
  try {
    const { imageUrl, title, description, metadata } = await request.json();

    if (!imageUrl) {
      return Response.json({ error: 'Image URL is required' }, { status: 400 });
    }

    console.log('Starting PDF generation with image:', imageUrl);

    // Validate image URL is accessible
    try {
      const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
      if (!imageResponse.ok) {
        throw new Error(`Image not accessible: ${imageResponse.status}`);
      }
      console.log('Image validation successful');
    } catch (imageError) {
      console.error('Image validation failed:', imageError);
      return Response.json({ error: 'Image URL is not accessible' }, { status: 400 });
    }

    // Convert to buffer with proper error handling
    let pdfBuffer;
    try {
      // Generate PDF using React PDF - render the component properly
      pdfBuffer = await pdf(
        <PDFDocument 
          imageUrl={imageUrl} 
          title={title}
          description={description}
          metadata={metadata}
        />
      ).toBuffer();
      console.log('PDF buffer generated successfully, size:', pdfBuffer.length);
      
      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      // Convert to Buffer if it's a Uint8Array
      const buffer = Buffer.from(pdfBuffer);
      
      // Check if buffer starts with PDF header
      const header = buffer.subarray(0, 4).toString();
      if (header !== '%PDF') {
        throw new Error('Generated buffer is not a valid PDF');
      }
      
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      return Response.json({ 
        error: `PDF generation failed: ${pdfError.message}` 
      }, { status: 500 });
    }

    // Generate unique filename
    const fileName = `pdf-documents/${Date.now()}-${title ? title.replace(/[^a-zA-Z0-9]/g, '-') : 'document'}.pdf`;
    
    // Upload to Firebase Storage with error handling
    let downloadURL;
    try {
      console.log('Uploading PDF to Firebase Storage...');
      const storageRef = ref(storage, fileName);
      const uploadResult = await uploadBytes(storageRef, pdfBuffer, {
        contentType: 'application/pdf',
        customMetadata: {
          title: title || 'Generated PDF',
          description: description || '',
          createdAt: new Date().toISOString(),
          imageUrl: imageUrl
        }
      });

      // Get download URL
      downloadURL = await getDownloadURL(uploadResult.ref);
      console.log('PDF uploaded successfully to:', downloadURL);
      
    } catch (uploadError) {
      console.error('Firebase upload failed:', uploadError);
      return Response.json({ 
        error: `File upload failed: ${uploadError.message}` 
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      pdfUrl: downloadURL,
      fileName: fileName,
      size: pdfBuffer.length,
      metadata: {
        title,
        description,
        imageUrl,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message || 'PDF generation failed'
      },
      { status: 500 }
    );
  }
}