'use client';

import React, { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle, XCircle, Bell, Play, Pause, Square, Clock, BarChart3 } from 'lucide-react';

const RecurringNotificationController = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(30);
  const [maxCount, setMaxCount] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Load active jobs on component mount
  useEffect(() => {
    loadActiveJobs();
    
    // Refresh jobs every 10 seconds
    const interval = setInterval(loadActiveJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveJobs = async () => {
    setIsLoadingJobs(true);
    try {
      const response = await fetch('/api/notifications/send');
      const data = await response.json();
      setActiveJobs(data.jobs || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  };

  const startRecurring = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      alert('Please enter both title and message');
      return;
    }

    setIsStarting(true);

    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          body: message.trim(),
          targetUrl: targetUrl.trim() || '/',
          intervalSeconds: intervalSeconds,
          maxCount: maxCount ? parseInt(maxCount) : null
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Recurring notifications started! Job ID: ${data.jobId}`);
        setTitle('');
        setMessage('');
        setTargetUrl('');
        loadActiveJobs(); // Refresh the job list
      } else {
        alert('Failed to start: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsStarting(false);
    }
  };

  const stopJob = async (jobId) => {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Job stopped! Total sent: ${data.finalCount}`);
        loadActiveJobs(); // Refresh the job list
      } else {
        alert('Failed to stop: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error stopping job: ' + error.message);
    }
  };

  const formatUptime = (uptime) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getNextSendCountdown = (nextSend) => {
    if (!nextSend) return '';
    const remaining = Math.max(0, nextSend - Date.now());
    return Math.ceil(remaining / 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Start New Recurring Notification */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Start Recurring Notifications</h2>
            <p className="text-sm text-gray-600">Send notifications automatically every 30 seconds</p>
          </div>
        </div>

        <form onSubmit={startRecurring} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="Steel Order Update"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="Your order status has been updated!"
              rows={3}
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Click URL (optional)
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="https://yoursite.com/orders"
            />
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interval (seconds)
              </label>
              <input
                type="number"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Math.max(10, parseInt(e.target.value) || 30))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="10"
                placeholder="30"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Count (optional)
              </label>
              <input
                type="number"
                value={maxCount}
                onChange={(e) => setMaxCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                min="1"
                placeholder="Unlimited"
              />
            </div>
          </div>

          {/* Start Button */}
          <button
            type="submit"
            disabled={isStarting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Start Recurring Notifications
              </>
            )}
          </button>
        </form>
      </div>

      {/* Active Jobs */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Active Jobs</h2>
              <p className="text-sm text-gray-600">{activeJobs.length} running</p>
            </div>
          </div>
          
          <button
            onClick={loadActiveJobs}
            disabled={isLoadingJobs}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isLoadingJobs ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {activeJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No active recurring notifications</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeJobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{job.body}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : job.status === 'completed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {job.status === 'active' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                      {job.status}
                    </span>
                    
                    {job.status === 'active' && (
                      <button
                        onClick={() => stopJob(job.id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Sent:</span>
                    <div className="font-medium">{job.sendCount}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Delivered:</span>
                    <div className="font-medium">{job.totalDelivered}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Uptime:</span>
                    <div className="font-medium">{formatUptime(job.uptime)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Next in:</span>
                    <div className="font-medium">
                      {job.status === 'active' ? `${getNextSendCountdown(job.nextSend)}s` : '-'}
                    </div>
                  </div>
                </div>
                
                {job.errorCount > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    ⚠️ {job.errorCount} errors occurred
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurringNotificationController;