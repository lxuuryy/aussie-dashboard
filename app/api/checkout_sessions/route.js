import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'

export async function POST(request) {
  try {
    const headersList = await headers()
    const origin = headersList.get('origin')
    
    // Get the request body
    const body = await request.json()
    const { 
      amount, 
      currency = 'aud', 
      productName = 'Custom Payment',
      description = 'Payment',
      quantity = 1 
    } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Please provide a valid amount greater than 0' },
        { status: 400 }
      )
    }

    // Create Checkout Sessions with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: productName,
              description: description,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=true`,
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: err.statusCode || 500 }
    )
  }
}