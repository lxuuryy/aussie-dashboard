// app/api/customer-message/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      requestId,
      senderId,
      senderName,
      content,
      senderType = 'customer'
    } = body;

    // Validate required fields
    if (!requestId || !content || !senderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: requestId, content, and senderId are required' 
      }, { status: 400 });
    }

    // Validate content length
    if (content.trim().length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Message content cannot be empty' 
      }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ 
        success: false, 
        error: 'Message content too long (max 2000 characters)' 
      }, { status: 400 });
    }

    // Add message to Firebase chatMessages collection
    const messageData = {
      requestId,
      senderId,
      senderType,
      senderName: senderName || 'Customer',
      content: content.trim(),
      timestamp: serverTimestamp(),
      read: false,
      // Additional metadata
      ipAddress: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown',
      userAgent: request.headers.get('user-agent') || ''
    };

    const docRef = await addDoc(collection(db, 'chatMessages'), messageData);

    // Update the human request's last updated time
    await updateDoc(doc(db, 'humanRequests', requestId), {
      lastUpdated: serverTimestamp()
    });

    // Log for monitoring
    console.log('Customer message saved:', {
      messageId: docRef.id,
      requestId,
      senderName,
      contentLength: content.length,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      messageId: docRef.id,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending customer message:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to send message. Please try again.',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    }, { status: 500 });
  }
}

// Optional: Handle GET requests to retrieve messages for a specific request
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json({ 
        success: false, 
        error: 'requestId parameter is required' 
      }, { status: 400 });
    }

    // In a real implementation, you would query Firebase here
    // For now, return a placeholder response
    return NextResponse.json({
      success: true,
      message: 'Use Firebase real-time listeners on the client side instead of GET requests',
      note: 'Real-time messaging works better with onSnapshot listeners'
    });

  } catch (error) {
    console.error('Error retrieving messages:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve messages'
    }, { status: 500 });
  }
}