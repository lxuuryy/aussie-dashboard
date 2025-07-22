import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'; // Import PDF-lib for PDF creation/manipulation

// This is the API route handler for POST requests.
// It receives any file, attempts to convert it to PDF, and uploads the PDF to AWS S3.
export async function POST(req) {
  try {
    // 1. Parse incoming form data to get the file.
    const formData = await req.formData();
    const file = formData.get('file'); // Assuming the frontend sends the file with the key 'file'

    // Validate if a file was provided and if it's a Blob.
    if (!file || !(file instanceof Blob)) {
      console.error('No file provided or invalid type.');
      return NextResponse.json({ error: 'No file provided or invalid type.' }, { status: 400 });
    }

    // Convert the file Blob to an ArrayBuffer, then to a Node.js Buffer.
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let pdfBytes; // This will hold the bytes of the generated PDF

    // 2. Conceptual File Conversion to PDF
    // This section demonstrates how you might convert different file types to PDF.
    // A truly universal converter is complex and often requires external libraries or services.
    // This example provides a basic image-to-PDF conversion.

    const doc = await PDFDocument.create(); // Create a new PDF document
    const page = doc.addPage(); // Add a page to the new PDF

    if (file.type.startsWith('image/')) {
      // Handle image conversion to PDF
      let embeddedImage;
      if (file.type.includes('jpeg')) {
        embeddedImage = await doc.embedJpg(fileBuffer);
      } else if (file.type.includes('png')) {
        embeddedImage = await doc.embedPng(fileBuffer);
      } else {
        console.error('Unsupported image format for PDF conversion:', file.type);
        return NextResponse.json({ error: 'Unsupported image format for PDF conversion. Only JPEG and PNG images are supported for direct conversion.' }, { status: 400 });
      }

      // Draw the image onto the PDF page, scaled to fit the page or a specific area
      const { width, height } = embeddedImage.scale(0.75); // Scale image to fit page
      page.drawImage(embeddedImage, {
        x: page.getWidth() / 2 - width / 2,
        y: page.getHeight() / 2 - height / 2,
        width,
        height,
      });

      pdfBytes = await doc.save(); // Save the PDF with the embedded image
    } else if (file.type.startsWith('text/')) {
        // Handle text file conversion to PDF
        const textContent = fileBuffer.toString('utf-8');
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText(textContent, {
          x: 50,
          y: page.getHeight() - 50,
          font,
          size: 12,
          color: rgb(0, 0, 0),
          maxWidth: page.getWidth() - 100,
          lineHeight: 14,
        });
        pdfBytes = await doc.save();
    } else if (file.type === 'application/pdf') {
        // Handle direct PDF upload - no conversion needed
        console.log('Direct PDF upload detected, no conversion required');
        pdfBytes = fileBuffer; // Use the original PDF file buffer
    }
    // else if (file.type.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    //   // For Word (docx) files, you would typically use a library like 'mammoth.js'
    //   // to convert docx to HTML, then use a headless browser (e.g., Puppeteer)
    //   // or another library to convert HTML to PDF. This is significantly more complex.
    //   // Example (conceptual):
    //   // const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    //   // const browser = await puppeteer.launch();
    //   // const page = await browser.newPage();
    //   // await page.setContent(result.value);
    //   // pdfBytes = await page.pdf({ format: 'A4' });
    //   // await browser.close();
    //   console.error('DOCX conversion is complex and requires additional libraries/setup.');
    //   return NextResponse.json({ error: 'DOCX conversion is not supported in this simple example.' }, { status: 400 });
    // }
    else {
      // If the file type is not explicitly handled for conversion.
      console.error('File type not supported:', file.type);
      return NextResponse.json({ 
        error: `File type "${file.type}" is not supported. Supported formats: Images (JPEG, PNG), Text files, and PDF files.` 
      }, { status: 400 });
    }

    // Ensure pdfBytes is generated. If not, something went wrong in conversion.
    if (!pdfBytes) {
      throw new Error('PDF conversion failed: No PDF bytes generated.');
    }

    // 3. AWS S3 Upload
    // Initialize the S3 client using environment variables for credentials and region.
    const s3Client = new S3Client({
      region: process.env.AWS_REGION, // e.g., 'ap-southeast-2'
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Create a unique file name for the PDF in S3.
    // The prefix 'pdfs/' matches your provided S3 bucket policy.
    const originalFileName = file.name || 'uploaded-file';
    // Ensure the uploaded file always has a .pdf extension
    const uniqueFileName = `pdfs/${Date.now()}-${originalFileName.replace(/\s+/g, '-')}.pdf`;

    // Define the S3 upload command.
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME, // e.g., 'aussiesteeldirect'
      Key: uniqueFileName, // The path and filename in your S3 bucket
      Body: pdfBytes, // The content of the PDF as a Buffer
      ContentType: 'application/pdf', // Specify the content type
      // ACL removed - bucket has ACLs disabled, use bucket policy for public access instead
    });

    // Send the upload command to S3.
    await s3Client.send(uploadCommand);

    // Construct the public URL of the uploaded PDF.
    const pdfUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    // 4. Respond to the client with success message and PDF URL.
    return NextResponse.json({ message: 'File converted and PDF uploaded successfully!', pdfUrl }, { status: 200 });

  } catch (error) {
    // Handle any errors that occur during the process.
    console.error('Detailed error during file conversion or S3 upload:', error);
    // Return a 500 Internal Server Error response.
    return NextResponse.json({ error: `Failed to process file and upload to AWS S3: ${error.message}` }, { status: 500 });
  }
}
