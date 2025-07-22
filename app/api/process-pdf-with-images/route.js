// app/api/process-pdf-with-images/route.js
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      console.error('No file provided or invalid type.');
      return NextResponse.json({ error: 'No file provided or invalid type.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileContent = fileBuffer.toString('utf-8');

    let pdfBytes;

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    if (file.type.startsWith('image/')) {
      // Handle direct image upload (existing logic)
      const doc = await PDFDocument.create();
      const page = doc.addPage();

      let embeddedImage;
      if (file.type.includes('jpeg') || file.type.includes('jpg')) {
        embeddedImage = await doc.embedJpg(fileBuffer);
      } else if (file.type.includes('png')) {
        embeddedImage = await doc.embedPng(fileBuffer);
      } else {
        return NextResponse.json({ error: 'Unsupported image format.' }, { status: 400 });
      }

      const { width, height } = embeddedImage.scale(0.75);
      page.drawImage(embeddedImage, {
        x: page.getWidth() / 2 - width / 2,
        y: page.getHeight() / 2 - height / 2,
        width,
        height,
      });

      pdfBytes = await doc.save();
    } else if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('csv') || file.type.includes('html') || file.type.includes('markdown')) {
      // Handle text files with embedded images
      console.log('Processing text file with potential images...');
      
      // Extract image URLs from content
      const imageUrls = extractImageUrls(fileContent, file.type);
      console.log('Found image URLs:', imageUrls);

      // Create PDF with text and images
      const doc = await PDFDocument.create();
      let page = doc.addPage();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

      let currentY = page.getHeight() - 50;
      const margin = 50;
      const pageWidth = page.getWidth();
      const contentWidth = pageWidth - (margin * 2);

      // Add title
      const title = file.name || 'Generated Document';
      page.drawText(title, {
        x: margin,
        y: currentY,
        font: boldFont,
        size: 16,
        color: rgb(0, 0, 0),
      });
      currentY -= 40;

      // Process content based on file type
      if (file.type.includes('html')) {
        // For HTML, extract text content and handle images separately
        const textContent = stripHtmlTags(fileContent);
        currentY = await addTextToPDF(page, doc, textContent, currentY, margin, contentWidth, font);
      } else if (file.type.includes('markdown')) {
        // For Markdown, process it to plain text
        const textContent = stripMarkdownSyntax(fileContent);
        currentY = await addTextToPDF(page, doc, textContent, currentY, margin, contentWidth, font);
      } else if (file.type.includes('json')) {
        // For JSON, format it nicely
        try {
          const formatted = JSON.stringify(JSON.parse(fileContent), null, 2);
          currentY = await addTextToPDF(page, doc, formatted, currentY, margin, contentWidth, font);
        } catch (e) {
          currentY = await addTextToPDF(page, doc, fileContent, currentY, margin, contentWidth, font);
        }
      } else {
        // For plain text and CSV
        currentY = await addTextToPDF(page, doc, fileContent, currentY, margin, contentWidth, font);
      }

      // Add images to PDF
      for (const imageUrl of imageUrls) {
        try {
          console.log('Fetching image:', imageUrl);
          const imageResponse = await fetch(imageUrl);
          
          if (!imageResponse.ok) {
            console.log('Failed to fetch image:', imageUrl);
            continue;
          }

          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBytes = new Uint8Array(imageBuffer);

          let embeddedImage;
          const contentType = imageResponse.headers.get('content-type');
          
          if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
            embeddedImage = await doc.embedJpg(imageBytes);
          } else if (contentType?.includes('png')) {
            embeddedImage = await doc.embedPng(imageBytes);
          } else {
            console.log('Unsupported image type:', contentType);
            continue;
          }

          // Calculate image dimensions to fit page
          const maxImageWidth = contentWidth * 0.8;
          const maxImageHeight = 200;
          
          const imageAspectRatio = embeddedImage.width / embeddedImage.height;
          let imageWidth = Math.min(maxImageWidth, embeddedImage.width);
          let imageHeight = imageWidth / imageAspectRatio;
          
          if (imageHeight > maxImageHeight) {
            imageHeight = maxImageHeight;
            imageWidth = imageHeight * imageAspectRatio;
          }

          // Check if we need a new page
          if (currentY - imageHeight - 40 < 50) {
            page = doc.addPage();
            currentY = page.getHeight() - 50;
          }

          // Add some space before image
          currentY -= 20;

          // Center the image
          const imageX = (pageWidth - imageWidth) / 2;

          page.drawImage(embeddedImage, {
            x: imageX,
            y: currentY - imageHeight,
            width: imageWidth,
            height: imageHeight,
          });

          currentY -= imageHeight + 20;

        } catch (error) {
          console.error('Error processing image:', imageUrl, error);
          // Continue processing other images
        }
      }

      pdfBytes = await doc.save();
    } else if (file.type === 'application/pdf') {
      // Direct PDF upload
      pdfBytes = fileBuffer;
    } else {
      return NextResponse.json({ 
        error: `File type "${file.type}" is not supported.` 
      }, { status: 400 });
    }

    if (!pdfBytes) {
      throw new Error('PDF conversion failed: No PDF bytes generated.');
    }

    // Upload to S3
    const originalFileName = file.name || 'uploaded-file';
    const uniqueFileName = `pdfs/${Date.now()}-${originalFileName.replace(/\s+/g, '-')}.pdf`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: uniqueFileName,
      Body: pdfBytes,
      ContentType: 'application/pdf',
    });

    await s3Client.send(uploadCommand);

    const pdfUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    return NextResponse.json({ 
      message: 'File converted and PDF uploaded successfully!', 
      pdfUrl 
    }, { status: 200 });

  } catch (error) {
    console.error('Detailed error during file conversion or S3 upload:', error);
    return NextResponse.json({ 
      error: `Failed to process file and upload to AWS S3: ${error.message}` 
    }, { status: 500 });
  }
}

// Helper function to extract image URLs from content
function extractImageUrls(content, fileType) {
  const urls = [];
  
  if (fileType.includes('html')) {
    // Extract from HTML img src attributes
    const imgRegex = /<img[^>]+src="([^"]+)"/gi;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
  } else if (fileType.includes('markdown')) {
    // Extract from Markdown image syntax ![alt](url)
    const markdownImgRegex = /!\[.*?\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImgRegex.exec(content)) !== null) {
      urls.push(match[1]);
    }
  } else if (fileType.includes('json')) {
    // Extract from JSON structure
    try {
      const jsonData = JSON.parse(content);
      if (jsonData.images && Array.isArray(jsonData.images)) {
        jsonData.images.forEach(img => {
          if (img.url) urls.push(img.url);
        });
      }
    } catch (e) {
      // If JSON parsing fails, look for URLs in text
      const urlRegex = /https?:\/\/[^\s,'"]+\.(jpg|jpeg|png|gif)/gi;
      const matches = content.match(urlRegex);
      if (matches) urls.push(...matches);
    }
  } else {
    // For text/csv files, look for any image URLs
    const urlRegex = /https?:\/\/[^\s,'"]+\.(jpg|jpeg|png|gif)/gi;
    const matches = content.match(urlRegex);
    if (matches) urls.push(...matches);
  }
  
  return [...new Set(urls)]; // Remove duplicates
}

// Helper function to add text to PDF with word wrapping
async function addTextToPDF(page, doc, text, startY, margin, contentWidth, font) {
  let currentY = startY;
  const lineHeight = 14;
  const fontSize = 10;
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') {
      currentY -= lineHeight / 2;
      continue;
    }
    
    // Word wrap long lines
    const words = line.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth > contentWidth && currentLine) {
        // Draw the current line and start a new one
        if (currentY < 50) {
          page = doc.addPage();
          currentY = page.getHeight() - 50;
        }
        
        page.drawText(currentLine, {
          x: margin,
          y: currentY,
          font: font,
          size: fontSize,
          color: rgb(0, 0, 0),
        });
        
        currentY -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw the remaining text
    if (currentLine) {
      if (currentY < 50) {
        page = doc.addPage();
        currentY = page.getHeight() - 50;
      }
      
      page.drawText(currentLine, {
        x: margin,
        y: currentY,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
      
      currentY -= lineHeight;
    }
  }
  
  return currentY;
}

// Helper function to strip HTML tags
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
}

// Helper function to strip Markdown syntax
function stripMarkdownSyntax(markdown) {
  return markdown
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
    .replace(/!\[.*?\]\([^)]+\)/g, '[Image]') // Replace image syntax
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links but keep text
}