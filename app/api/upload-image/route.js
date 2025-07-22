// app/api/upload-image/route.js
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dklpobzus',
  api_key: '717382917144585',
  api_secret: '585BgVdmWr5bXaRWDmSjFahhqIo',
});

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');
    const folder = data.get('folder') || 'uploads'; // Optional folder organization

    if (!file) {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: folder,
          transformation: [
            { quality: 'auto' }, // Automatic quality optimization
            { fetch_format: 'auto' } // Automatic format optimization
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    return Response.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      created_at: result.created_at
    });

  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { 
        success: false, 
        error: error.message || 'Upload failed'
      },
      { status: 500 }
    );
  }
}