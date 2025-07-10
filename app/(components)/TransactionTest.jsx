// components/TransactionTest.js
'use client'
import { useState } from 'react';

export default function TransactionTest() {
  const [accountId, setAccountId] = useState('');
  const [filters, setFilters] = useState({
    oldestTime: '',
    newestTime: '',
    minAmount: '',
    maxAmount: '',
    page: 1,
    pageSize: 25
  });
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    if (!accountId) {
      setError('Please enter an account ID');
      return;
    }

    setLoading(true);
    setError(null);
    setTransactions(null);

    try {
      const params = new URLSearchParams({
        accountId,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== null)
        )
      });

      const response = await fetch(`/api/test-transactions?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTransactions(data);
      } else {
        setError(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount, currency = 'AUD') => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">CommBank Transaction API Test</h2>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Account ID *
          </label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="Enter your account ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Oldest Time (UTC)
            </label>
            <input
              type="datetime-local"
              value={filters.oldestTime}
              onChange={(e) => setFilters({...filters, oldestTime: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Newest Time (UTC)
            </label>
            <input
              type="datetime-local"
              value={filters.newestTime}
              onChange={(e) => setFilters({...filters, newestTime: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={filters.minAmount}
              onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={filters.maxAmount}
              onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page
            </label>
            <input
              type="number"
              min="1"
              value={filters.page}
              onChange={(e) => setFilters({...filters, page: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Size (1-1000)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={filters.pageSize}
              onChange={(e) => setFilters({...filters, pageSize: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Fetching Transactions...' : 'Test API'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {transactions && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Results Summary</h3>
            <p>Total Records: {transactions.meta.totalRecords}</p>
            <p>Total Pages: {transactions.meta.totalPages}</p>
            <p>Current Page: {transactions.meta.currentPage}</p>
            <p>Transactions Returned: {transactions.data.data?.transactions?.length || 0}</p>
          </div>

          {transactions.data.data?.transactions && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.data.data.transactions.map((transaction, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {formatDate(transaction.effectiveDateTime)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        <span className={transaction.amount.startsWith('-') ? 'text-red-600' : 'text-green-600'}>
                          {formatAmount(parseFloat(transaction.amount), transaction.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {transaction.type}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {transaction.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}