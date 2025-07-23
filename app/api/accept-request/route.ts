import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, agentId, agentName } = body;

    // Validate required fields
    if (!requestId || !agentId || !agentName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Update request status
    await updateDoc(doc(db, 'humanRequests', requestId), {
      status: 'assigned',
      assignedAgentId: agentId,
      assignedAgentName: agentName,
      lastUpdated: serverTimestamp()
    });

    // Add initial system message
    await addDoc(collection(db, 'chatMessages'), {
      requestId: requestId,
      senderId: 'system',
      senderType: 'system',
      senderName: 'System',
      content: `${agentName} has joined the chat. How can I help you today?`,
      timestamp: serverTimestamp(),
      read: false
    });

    return NextResponse.json({
      success: true,
      message: 'Request accepted successfully'
    });

  } catch (error) {
    console.error('Error accepting request:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to accept request'
    }, { status: 500 });
  }
}
