import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, agentId } = body;

    // Validate required fields
    if (!requestId || !agentId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Update request status to resolved
    await updateDoc(doc(db, 'humanRequests', requestId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });

    // Add closing system message
    await addDoc(collection(db, 'chatMessages'), {
      requestId: requestId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: 'This chat has been resolved. Thank you for contacting Aussie Steel Direct!',
      timestamp: serverTimestamp(),
      read: false
    });

    return NextResponse.json({
      success: true,
      message: 'Request closed successfully'
    });

  } catch (error) {
    console.error('Error closing request:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to close request'
    }, { status: 500 });
  }
}
