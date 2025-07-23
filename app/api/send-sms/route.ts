import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NextRequest, NextResponse } from 'next/server';

// Configure AWS SNS client
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface SMSRequest {
  phoneNumber: string;
  message: string;
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SMSResponse>> {
  try {
    const body: SMSRequest = await request.json();
    const { phoneNumber, message } = body;

    // Validation
    if (!phoneNumber || !message) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Phone number and message are required' 
        },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Phone number must include country code (e.g., +61)' 
        },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length > 160) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Message too long (max 160 characters)' 
        },
        { status: 400 }
      );
    }

    // Validate phone number format more strictly (optional)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid phone number format' 
        },
        { status: 400 }
      );
    }

    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    };

    const command = new PublishCommand(params);
    const result = await snsClient.send(command);

    console.log('SMS sent successfully:', result.MessageId);

    return NextResponse.json({
      success: true,
      messageId: result.MessageId,
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);
    
    // Handle specific AWS errors
    let errorMessage = 'Failed to send SMS';
    
    if (error.name === 'InvalidParameterException') {
      errorMessage = 'Invalid phone number or message format';
    } else if (error.name === 'OptedOutException') {
      errorMessage = 'Phone number has opted out of receiving SMS';
    } else if (error.name === 'ThrottlingException') {
      errorMessage = 'Rate limit exceeded. Please try again later';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET method for health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: 'SMS API is running' },
    { status: 200 }
  );
}