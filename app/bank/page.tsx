'use client'

import React, { useState } from 'react'

type Props = {}

const CheckoutPage = (props: Props) => {
  const [amount, setAmount] = useState<string>('')
  const [productName, setProductName] = useState<string>('Custom Payment')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate amount
    const numAmount = parseFloat(amount)
    if (!amount || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/checkout_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: numAmount,
          currency: 'aud',
          productName: productName,
          description: `Payment for ${productName}`,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else {
        setError(data.error || 'Checkout failed')
      }
    } catch (err) {
      setError('Network error occurred')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-6 text-center">Custom Payment</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">
            Product/Service Name
          </label>
          <input
            type="text"
            id="productName"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What are you paying for?"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Amount (AUD)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0.01"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-800">Total Amount:</span>
            <span className="text-lg font-bold text-blue-900">
              ${amount || '0.00'} AUD
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !amount || parseFloat(amount) <= 0}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Processing...' : 'Proceed to Checkout'}
        </button>
      </form>

      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>✓ Secure payment with Stripe</p>
        <p>✓ All major credit cards accepted</p>
        <p>✓ Your payment information is encrypted</p>
      </div>
    </div>
  )
}

export default CheckoutPage