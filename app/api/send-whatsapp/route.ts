import twilio from 'twilio';
import { NextRequest, NextResponse } from 'next/server';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { message: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    // Ensure phone number has whatsapp: prefix for recipient
    const whatsappNumber = phoneNumber.startsWith('whatsapp:') 
      ? phoneNumber 
      : `whatsapp:${phoneNumber}`;

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_WHATSAPP_NUMBER, // Twilio WhatsApp sender
      to: whatsappNumber
    });

    return NextResponse.json({
      success: true,
      messageSid: result.sid,
      message: 'WhatsApp message sent successfully!'
    });

  } catch (error) {
    console.error('Twilio WhatsApp Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send WhatsApp message',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}