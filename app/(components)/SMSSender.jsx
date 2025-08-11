'use client';

import { useState } from 'react';

export default function SMSButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [senderId, setSenderId] = useState('');

  const sendSMS = async () => {
    if (!phoneNumber || !message) {
      alert('Please enter both phone number and message');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          message: message,
          senderId: senderId || undefined, // Only send if provided
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('SMS sent successfully!');
        setMessage('');
        setPhoneNumber('');
        setSenderId('');
      } else {
        alert('Failed to send SMS: ' + data.error);
      }
    } catch (error) {
      alert('Error sending SMS: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number (with country code)
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+61412345678"
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sender ID (Optional)
        </label>
        <input
          type="text"
          value={senderId}
          onChange={(e) => setSenderId(e.target.value)}
          placeholder="MyCompany"
          maxLength={11}
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-gray-500 mt-1">
          3-11 characters, letters and numbers only. Leave blank to use default.
        </div>
      </div>
            
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message"
          maxLength={160}
          className="w-full p-3 border border-gray-300 rounded-md h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-gray-500 mt-1">
          {message.length}/160 characters
        </div>
      </div>

      <button
        onClick={sendSMS}
        disabled={loading}
        className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
        }`}
      >
        {loading ? 'Sending...' : 'Send SMS'}
      </button>
    </div>
  );
}