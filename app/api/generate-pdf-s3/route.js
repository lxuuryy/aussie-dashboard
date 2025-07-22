// app/api/generate-pdf-s3/route.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from 'next/server';

// Initialize S3 client
const client = new S3Client({ 
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

export async function POST(request) {
  try {
    const { imageUrl, title, description, metadata } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    console.log('Starting PDF generation with image:', imageUrl);

    // Import React PDF components
    const { default: React } = await import('react');
    const { Document, Page, Text, View, StyleSheet, Image, pdf } = await import('@react-pdf/renderer');

    // Define styles
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
        maxWidth: 400,
        maxHeight: 300,
      },
      textContent: {
        fontSize: 12,
        lineHeight: 1.5,
        marginVertical: 10,
        color: '#333333',
        textAlign: 'justify',
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
        marginTop: 15,
      },
      metadataItem: {
        marginBottom: 3,
      }
    });

    // Create simple PDF document without complex JSX
    const pdfDoc = pdf(
      React.createElement(Document, {},
        React.createElement(Page, { size: "A4", style: styles.page },
          // Header
          React.createElement(Text, { style: styles.header }, 
            title || 'Document with Image'
          ),
          
          // Sub header
          React.createElement(Text, { style: styles.subHeader }, 
            description || 'Generated PDF with embedded image'
          ),
          
          // Image container
          React.createElement(View, { style: styles.imageContainer },
            React.createElement(Image, { 
              src: imageUrl, 
              style: styles.image 
            })
          ),
          
          // Content text
          React.createElement(Text, { style: styles.textContent },
            'This PDF document contains an embedded image and is stored on Amazon S3. The image is sourced from Cloudinary and embedded directly into this PDF document. S3 provides reliable, scalable storage with global CDN access.'
          ),
          
          // Metadata section
          metadata && React.createElement(View, { style: styles.metadata },
            React.createElement(Text, { style: styles.metadataItem },
              `Document generated on: ${new Date().toLocaleString()}`
            ),
            metadata.imageName && React.createElement(Text, { style: styles.metadataItem },
              `Image name: ${metadata.imageName}`
            ),
            metadata.imageSize && React.createElement(Text, { style: styles.metadataItem },
              `Image size: ${metadata.imageSize}`
            ),
            metadata.imageDimensions && React.createElement(Text, { style: styles.metadataItem },
              `Image dimensions: ${metadata.imageDimensions}`
            )
          ),
          
          // Footer
          React.createElement(Text, { style: styles.footer },
            `Generated with React PDF • Stored on AWS S3 • ${new Date().getFullYear()}`
          )
        )
      )
    );

    console.log('Converting PDF to buffer...');
    
    // Generate PDF buffer using stream approach
    const chunks = [];
    
    const pdfBuffer = await new Promise((resolve, reject) => {
      pdfDoc.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      pdfDoc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log('PDF buffer created, size:', buffer.length, 'bytes');
        resolve(buffer);
      });
      
      pdfDoc.on('error', (error) => {
        console.error('PDF generation error:', error);
        reject(error);
      });
    });

    // Validate buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Failed to generate PDF buffer');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const cleanTitle = title ? title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 'document';
    const fileName = `pdfs/${timestamp}-${cleanTitle}.pdf`;
    
    console.log('Generated filename:', fileName);

    // Upload to S3
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        'original-title': title || 'Generated PDF',
        'description': description || '',
        'image-url': imageUrl || '',
        'created-at': new Date().toISOString(),
        'image-name': metadata?.imageName || '',
        'image-size': metadata?.imageSize || '',
        'image-dimensions': metadata?.imageDimensions || ''
      },
    };

    const command = new PutObjectCommand(params);

    console.log('Uploading to S3 bucket:', process.env.AWS_S3_BUCKET_NAME);
    
    const data = await client.send(command);
    
    console.log('S3 upload successful! ETag:', data.ETag);

    // Construct public URL
    const pdfUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    return NextResponse.json({
      success: true,
      pdfUrl: pdfUrl,
      fileName: fileName,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
      region: process.env.AWS_REGION,
      size: pdfBuffer.length,
      etag: data.ETag,
      uploadedAt: new Date().toISOString(),
      metadata: {
        title,
        description,
        imageUrl,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('AWS S3 PDF Generation Error:', error);
    
    let errorMessage = 'PDF generation failed';
    let errorDetails = error.name || 'Unknown error';

    if (error.name === 'CredentialsError' || error.message?.includes('credentials')) {
      errorMessage = 'AWS credentials error. Check your environment variables.';
      errorDetails = 'Invalid AWS credentials';
    } else if (error.name === 'NoSuchBucket' || error.message?.includes('bucket')) {
      errorMessage = 'S3 bucket not found. Check your bucket name and region.';
      errorDetails = 'Bucket configuration error';
    } else if (error.message?.includes('Image') || error.message?.includes('fetch')) {
      errorMessage = 'Failed to load image. Check image URL accessibility.';
      errorDetails = 'Image loading error';
    } else if (error.message?.includes('buffer') || error.message?.includes('PDF')) {
      errorMessage = 'PDF generation failed.';
      errorDetails = 'PDF rendering error';
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}