import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { NextRequest, NextResponse } from 'next/server';

// Configure AWS SNS client
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'ap-southeast-2', // Australia region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface SMSRequest {
  phoneNumber: string;
  message: string;
  senderId?: string; // Optional sender ID
}

interface SMSResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SMSResponse>> {
  try {
    const body: SMSRequest = await request.json();
    const { phoneNumber, message, senderId } = body;

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

    // Validate phone number format more strictly
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

    // Validate Sender ID if provided
    if (senderId) {
      // Sender ID validation rules:
      // - 3-11 characters long
      // - Can contain letters (A-Z, a-z), numbers (0-9), and spaces
      // - Cannot contain special characters except spaces
      const senderIdRegex = /^[A-Za-z0-9 ]{3,11}$/;
      if (!senderIdRegex.test(senderId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Sender ID must be 3-11 characters, alphanumeric and spaces only'
          },
          { status: 400 }
        );
      }
    }

    // Build message attributes
    const messageAttributes: any = {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
    };

    // Add Sender ID - use provided or default to AUSSIESTEEL
    const finalSenderId = senderId || 'AUSSIESTEEL';
    messageAttributes['AWS.SNS.SMS.SenderID'] = {
      DataType: 'String',
      StringValue: finalSenderId,
    };

    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: messageAttributes,
    };

    const command = new PublishCommand(params);
    const result = await snsClient.send(command);

    console.log('SMS sent successfully:', result.MessageId);
    console.log('Sender ID used:', finalSenderId);
    console.log('Phone number:', phoneNumber);
    console.log('Message attributes:', messageAttributes);

    return NextResponse.json({
      success: true,
      messageId: result.MessageId,
    });

  } catch (error: any) {
    console.error('Error sending SMS:', error);

    // Handle specific AWS errors
    let errorMessage = 'Failed to send SMS';

    if (error.name === 'InvalidParameterException') {
      errorMessage = 'Invalid phone number, message format, or sender ID';
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