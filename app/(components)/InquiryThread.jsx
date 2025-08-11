'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  User,
  Loader,
  Plus,
  X
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const InquiryThread = ({ inquiryId, inquiryNumber }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);
  const [lastViewedTime, setLastViewedTime] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Admin identifier for read status tracking
  const adminId = 'wilson_admin'; // You can make this dynamic based on logged in admin

  // Get last viewed time from Firebase on mount
  useEffect(() => {
    if (!inquiryId) return;

    const fetchLastViewedTime = async () => {
      try {
        const readStatusRef = doc(db, 'adminThreadReadStatus', `${adminId}_${inquiryId}`);
        const readStatusDoc = await getDoc(readStatusRef);
        
        if (readStatusDoc.exists()) {
          const data = readStatusDoc.data();
          const viewedTime = data.lastViewedAt?.toDate ? data.lastViewedAt.toDate() : new Date(data.lastViewedAt);
          setLastViewedTime(viewedTime);
        }
      } catch (error) {
        console.error('Error fetching admin read status:', error);
      }
    };

    fetchLastViewedTime();
  }, [inquiryId, adminId]);

  // Fetch threads for this inquiry
  useEffect(() => {
    if (!inquiryId) return;

    const threadsQuery = query(
      collection(db, 'inquiriesThread'),
      where('inquiryId', '==', inquiryId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(threadsQuery, (snapshot) => {
      const threadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      }));

      // Check for unread updates and count them
      const unreadCustomerMessages = threadsData.filter(thread => {
        // Only consider customer messages as potential unread updates for admin
        if (thread.authorType !== 'customer') return false;
        
        // If we have a last viewed time, check if message is newer
        if (lastViewedTime) {
          return thread.createdAt > lastViewedTime;
        }
        
        // If no last viewed time, consider any customer message as new
        return true;
      });

      const hasNewUpdates = unreadCustomerMessages.length > 0;
      
      setThreads(threadsData);
      setHasUnreadUpdates(hasNewUpdates);
      setUnreadCount(unreadCustomerMessages.length);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching threads:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [inquiryId, lastViewedTime]);

  // Mark as viewed when expanded
  const handleToggleExpansion = async () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    if (newExpanded && inquiryId) {
      try {
        const viewTime = new Date();
        
        // Update read status in Firebase
        const readStatusRef = doc(db, 'adminThreadReadStatus', `${adminId}_${inquiryId}`);
        await setDoc(readStatusRef, {
          adminId: adminId,
          inquiryId: inquiryId,
          inquiryNumber: inquiryNumber,
          lastViewedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        setLastViewedTime(viewTime);
        setHasUnreadUpdates(false);
        setUnreadCount(0);
      } catch (error) {
        console.error('Error updating admin read status:', error);
      }
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);

      const threadData = {
        inquiryId,
        inquiryNumber,
        message: newComment.trim(),
        author: 'Wilson (aussiesteeldirect)',
        authorType: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'inquiriesThread'), threadData);
      
      setNewComment('');
      setShowCommentForm(false);

      // Update read status after sending message
      const readStatusRef = doc(db, 'adminThreadReadStatus', `${adminId}_${inquiryId}`);
      await setDoc(readStatusRef, {
        adminId: adminId,
        inquiryId: inquiryId,
        inquiryNumber: inquiryNumber,
        lastViewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'Just now';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getAuthorBgColor = (authorType) => {
    switch (authorType) {
      case 'admin':
        return 'bg-teal-50 border-teal-200';
      case 'customer':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getAuthorIconBg = (authorType) => {
    switch (authorType) {
      case 'admin':
        return 'bg-teal-600';
      case 'customer':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Thread Header - Clickable to expand/collapse */}
      <button
        onClick={handleToggleExpansion}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <MessageCircle className={`w-5 h-5 ${hasUnreadUpdates ? 'text-red-600' : 'text-blue-600'}`} />
            {hasUnreadUpdates && (
              <>
                {/* Red notification dot */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white flex items-center justify-center">
                  {unreadCount > 0 && unreadCount < 10 && (
                    <span className="text-xs text-white font-bold">{unreadCount}</span>
                  )}
                  {unreadCount >= 10 && (
                    <span className="text-xs text-white font-bold">9+</span>
                  )}
                </div>
                {/* Pulsing animation for attention */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
              </>
            )}
          </div>
          <span className="font-medium text-gray-900">Discussion Thread</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {threads.length} {threads.length === 1 ? 'comment' : 'comments'}
            </Badge>
            {hasUnreadUpdates && (
              <Badge className="text-xs bg-red-500 text-white border-red-600 animate-pulse">
                {unreadCount} New
              </Badge>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Thread Content - Expandable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white border-t border-gray-200">
              
              {/* Add Comment Button */}
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommentForm(!showCommentForm)}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Update
                </Button>
              </div>

              {/* Comment Form Dropdown */}
              <AnimatePresence>
                {showCommentForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                      <form onSubmit={handleSubmitComment} className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">Wilson (aussiesteeldirect)</span>
                          <Badge variant="outline" className="text-xs bg-teal-100 text-teal-700">
                            Admin
                          </Badge>
                        </div>
                        
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add an update or comment about this inquiry..."
                          rows={3}
                          className="resize-none"
                        />
                        
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={submitting || !newComment.trim()}
                          >
                            {submitting ? (
                              <>
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Posting...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Post Update
                              </>
                            )}
                          </Button>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowCommentForm(false);
                              setNewComment('');
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thread Messages */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : threads.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No updates yet</p>
                  </div>
                ) : (
                  threads.map((thread) => {
                    // Check if this message is unread
                    const isUnreadMessage = thread.authorType === 'customer' && 
                      lastViewedTime && thread.createdAt > lastViewedTime;
                    
                    return (
                      <motion.div
                        key={thread.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`border rounded-lg p-4 shadow-sm ${getAuthorBgColor(thread.authorType)} ${
                          isUnreadMessage ? 'ring-2 ring-red-200 border-red-300' : ''
                        }`}
                      >
                        {/* Thread Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center relative ${getAuthorIconBg(thread.authorType)}`}>
                              <User className="w-3 h-3 text-white" />
                              {isUnreadMessage && (
                                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full"></div>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {thread.author}
                            </span>
                            <Badge variant="outline" className={`text-xs ${
                              thread.authorType === 'admin' 
                                ? 'bg-teal-100 text-teal-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {thread.authorType === 'admin' ? 'Admin' : 'Customer'}
                            </Badge>
                            {isUnreadMessage && (
                              <Badge className="text-xs bg-red-500 text-white">
                                New
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeAgo(thread.createdAt)}</span>
                          </div>
                        </div>

                        {/* Thread Message */}
                        <div className="text-sm text-gray-700 leading-relaxed">
                          {thread.message}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Thread Summary */}
              {threads.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {threads.length} {threads.length === 1 ? 'update' : 'updates'} in this thread
                      {hasUnreadUpdates && (
                        <span className="text-red-600 font-medium ml-2">
                          ({unreadCount} unread)
                        </span>
                      )}
                    </span>
                    <span>Last activity: {threads.length > 0 ? formatTimeAgo(threads[0].createdAt) : 'No activity'}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InquiryThread;