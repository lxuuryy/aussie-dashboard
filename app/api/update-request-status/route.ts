import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    // Validate required fields
    if (!requestId || !status) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['pending', 'assigned', 'in-progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid status' 
      }, { status: 400 });
    }

    // Update request status
    await updateDoc(doc(db, 'humanRequests', requestId), {
      status: status,
      lastUpdated: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Request status updated successfully'
    });

  } catch (error) {
    console.error('Error updating request status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update request status'
    }, { status: 500 });
  }
}