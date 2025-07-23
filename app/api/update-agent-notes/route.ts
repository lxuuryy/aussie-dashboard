import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId, agentNotes } = body;

    // Validate required fields
    if (!requestId || agentNotes === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Update agent notes
    await updateDoc(doc(db, 'humanRequests', requestId), {
      agentNotes: agentNotes,
      lastUpdated: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Agent notes updated successfully'
    });

  } catch (error) {
    console.error('Error updating agent notes:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update agent notes'
    }, { status: 500 });
  }
}