
import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for active recurring notifications
// In production, use Redis or a database
const activeJobs = new Map();

// Function to send a single notification
interface NotificationData {
    title: string;
    body: string;
    target_url: string;
}

interface SendNotificationResultSuccess {
    success: true;
    id: number | string;
    scheduled: number;
    delivered: number;
}

interface SendNotificationResultError {
    success: false;
    error: string;
}

type SendNotificationResult = SendNotificationResultSuccess | SendNotificationResultError;

async function sendNotification(notificationData: NotificationData): Promise<SendNotificationResult> {
    try {
        const response = await fetch(`https://pushpad.xyz/api/v1/projects/8999/notifications`, {
            method: 'POST',
            headers: {
                'Authorization': `Token token="Eh8YEBymQJidtnQrVo6yVek65xwrVyPPPuJgqWdj"`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ notification: notificationData }),
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`Pushpad error: ${response.status} - ${responseText}`);
        }

        const result = JSON.parse(responseText);
        return {
            success: true,
            id: result.id,
            scheduled: result.scheduled_count || 0,
            delivered: result.delivered_count || 0
        };
    } catch (error: any) {
        console.error('Notification send error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// POST - Start recurring notifications
export async function POST(request: NextRequest) {
  try {
    const { title, body, targetUrl, intervalSeconds = 30, maxCount = null } = await request.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notificationData = {
      title: title.trim(),
      body: body.trim(),
      target_url: targetUrl?.trim() || '/',
    };

    let sendCount = 0;
    const startTime = Date.now();
    interface NotificationJobResult {
        count: number;
        timestamp: string;
        success: boolean;
        scheduled?: number;
        delivered?: number;
        error?: string | null;
    }

    const results: NotificationJobResult[] = [];

    // Create the recurring job
    const intervalId = setInterval(async () => {
      sendCount++;
      const timestamp = new Date().toISOString();
      
      console.log(`[${jobId}] Sending notification #${sendCount} at ${timestamp}`);
      
      try {
        const result = await sendNotification(notificationData);
        
        const logEntry = {
          count: sendCount,
          timestamp,
          success: result.success,
          scheduled: result.success ? result.scheduled : 0,
          delivered: result.success ? result.delivered : 0,
          error: result.success ? null : result.error || null
        };
        
        results.push(logEntry);
        
        // Update job data
        if (activeJobs.has(jobId)) {
          const jobData = activeJobs.get(jobId);
          jobData.sendCount = sendCount;
          jobData.lastSent = timestamp;
          jobData.results = results.slice(-20); // Keep last 20 results
          jobData.totalDelivered += result.success ? result.delivered : 0;
          jobData.totalScheduled += result.success ? result.scheduled : 0;
        }
        
        console.log(`[${jobId}] Result:`, logEntry);
        
        // Stop if max count reached
        if (maxCount && sendCount >= maxCount) {
          console.log(`[${jobId}] Max count (${maxCount}) reached. Stopping.`);
          clearInterval(intervalId);
          if (activeJobs.has(jobId)) {
            const jobData = activeJobs.get(jobId);
            jobData.status = 'completed';
            jobData.endTime = Date.now();
          }
        }
        
      } catch (error) {
        console.error(`[${jobId}] Error sending notification:`, error);
        
        const logEntry = {
          count: sendCount,
          timestamp,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        results.push(logEntry);
        
        // Update job data with error
        if (activeJobs.has(jobId)) {
          const jobData = activeJobs.get(jobId);
          jobData.sendCount = sendCount;
          jobData.lastSent = timestamp;
          jobData.results = results.slice(-20);
          jobData.errorCount = (jobData.errorCount || 0) + 1;
        }
      }
    }, intervalSeconds * 1000);

    // Store job data
    activeJobs.set(jobId, {
      id: jobId,
      title,
      body,
      targetUrl,
      intervalSeconds,
      maxCount,
      startTime,
      status: 'active',
      intervalId,
      sendCount: 0,
      totalDelivered: 0,
      totalScheduled: 0,
      errorCount: 0,
      results: []
    });

    // Auto-cleanup after 24 hours
    setTimeout(() => {
      if (activeJobs.has(jobId)) {
        const jobData = activeJobs.get(jobId);
        if (jobData.intervalId) {
          clearInterval(jobData.intervalId);
        }
        activeJobs.delete(jobId);
        console.log(`[${jobId}] Auto-cleaned after 24 hours`);
      }
    }, 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      jobId,
      message: `Recurring notifications started. Sending every ${intervalSeconds} seconds.`,
      maxCount: maxCount || 'unlimited',
      intervalSeconds
    });

  } catch (error) {
    console.error('Error starting recurring notifications:', error);
    return NextResponse.json(
      { error: 'Failed to start recurring notifications', details: (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

// GET - Get status of all jobs or specific job
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (jobId) {
    // Get specific job status
    if (!activeJobs.has(jobId)) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = activeJobs.get(jobId);
    const { intervalId, ...safeJobData } = jobData; // Remove intervalId from response
    
    return NextResponse.json({
      job: {
        ...safeJobData,
        uptime: Date.now() - jobData.startTime,
        nextSend: jobData.status === 'active' ? Date.now() + (jobData.intervalSeconds * 1000) : null
      }
    });
  } else {
    // Get all active jobs
    const allJobs = Array.from(activeJobs.values()).map(jobData => {
      const { intervalId, ...safeJobData } = jobData;
      return {
        ...safeJobData,
        uptime: Date.now() - jobData.startTime,
        nextSend: jobData.status === 'active' ? Date.now() + (jobData.intervalSeconds * 1000) : null
      };
    });

    return NextResponse.json({
      activeJobs: allJobs.length,
      jobs: allJobs
    });
  }
}

// DELETE - Stop recurring notifications
export async function DELETE(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    if (!activeJobs.has(jobId)) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobData = activeJobs.get(jobId);
    
    // Stop the interval
    if (jobData.intervalId) {
      clearInterval(jobData.intervalId);
    }
    
    // Update job status
    jobData.status = 'stopped';
    jobData.endTime = Date.now();
    
    // Remove from active jobs after a delay (keep for history)
    setTimeout(() => {
      activeJobs.delete(jobId);
    }, 60000); // Keep for 1 minute for final status check

    return NextResponse.json({
      success: true,
      message: `Recurring notifications stopped for job ${jobId}`,
      finalCount: jobData.sendCount,
      totalDelivered: jobData.totalDelivered
    });

  } catch (error) {
    console.error('Error stopping recurring notifications:', error);
    return NextResponse.json(
      { error: 'Failed to stop recurring notifications', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}