'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { getImageUrl } from '@/lib/image-utils';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';

type Notification = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  url: string | null;
  isActive: boolean;
  receiverCount: number;
  viewCount: number;
  sendStatus: string;
  sendProgress: number;
  sendTotal: number;
  successCount: number;
  failureCount: number;
  batchSize: number | null;
  batchDelayMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: '',
    url: '',
    isActive: true,
    batchSize: 100,
    batchDelayMs: 2000,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Target user search state
  const [targetUser, setTargetUser] = useState<{ id: string; email: string; name: string | null; displayName: string | null; wpUserId: string } | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; email: string; name: string | null; displayName: string | null; wpUserId: string; status: string }[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/notifications', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll progress for notifications that are currently sending
  useEffect(() => {
    const sendingIds = notifications
      .filter(n => n.sendStatus === 'queued' || n.sendStatus === 'sending')
      .map(n => n.id);

    if (sendingIds.length === 0) return;

    const interval = setInterval(async () => {
      let anyStillSending = false;

      for (const id of sendingIds) {
        try {
          const res = await fetch(`/api/notifications/${id}/progress`, {
            credentials: 'include',
          });
          if (res.ok) {
            const progress = await res.json();
            setNotifications(prev => prev.map(n =>
              n.id === id
                ? {
                    ...n,
                    sendStatus: progress.sendStatus,
                    sendProgress: progress.sendProgress,
                    sendTotal: progress.sendTotal,
                    successCount: progress.successCount,
                    failureCount: progress.failureCount,
                    receiverCount: progress.successCount,
                  }
                : n
            ));
            if (progress.sendStatus === 'queued' || progress.sendStatus === 'sending') {
              anyStillSending = true;
            }
          }
        } catch {
          // Ignore polling errors
        }
      }

      if (!anyStillSending) {
        clearInterval(interval);
        fetchNotifications();
      }
    }, 1500);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.filter(n => n.sendStatus === 'queued' || n.sendStatus === 'sending').map(n => n.id).join(',')]);

  // Debounced user search
  useEffect(() => {
    if (userSearchQuery.trim().length < 2) {
      setUserSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await fetch(`/api/app-users/search?q=${encodeURIComponent(userSearchQuery.trim())}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUserSearchResults(data);
          setShowUserDropdown(true);
        }
      } catch {
        // Ignore search errors
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  const handleRetrySend = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n =>
          n.id === id ? { ...n, sendStatus: 'queued', sendProgress: 0, sendTotal: 0 } : n
        ));
        setNotification({
          title: 'Sending',
          message: 'Push notification resend started in background',
          type: 'info',
        });
        setShowNotification(true);
      } else {
        const data = await response.json();
        setNotification({
          title: 'Error',
          message: data.message || data.error || 'Failed to start resend',
          type: 'error',
        });
        setShowNotification(true);
      }
    } catch {
      setNotification({
        title: 'Error',
        message: 'Failed to start resend',
        type: 'error',
      });
      setShowNotification(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    setNotificationToDelete(id);
    setShowDeleteModal(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(new Set(notifications.map(n => n.id)));
    } else {
      setSelectedNotifications(new Set());
    }
  };

  const handleSelectNotification = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedNotifications);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedNotifications(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedNotifications.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedNotifications.size} notification(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/notifications/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedNotifications) }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedNotifications(new Set());
        setNotification({
          title: 'Success',
          message: data.message || `Successfully deleted ${selectedNotifications.size} notification(s)`,
          type: 'success',
        });
        setShowNotification(true);
        await fetchNotifications();
      } else {
        const error = await response.json();
        setNotification({
          title: 'Error',
          message: error.error || 'Failed to delete notifications',
          type: 'error',
        });
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      setNotification({
        title: 'Error',
        message: 'An error occurred while deleting notifications',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!notificationToDelete) return;

    try {
      setDeletingId(notificationToDelete);
      setShowDeleteModal(false);
      const response = await fetch(`/api/notifications/${notificationToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Refresh notifications list
      await fetchNotifications();
      setNotification({
        title: 'Success',
        message: 'Notification deleted successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete notification',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setDeletingId(null);
      setNotificationToDelete(null);
    }
  };

  const openCreateModal = () => {
    setEditingNotification(null);
    setFormData({
      title: '',
      description: '',
      image: '',
      url: '',
      isActive: true,
      batchSize: 100,
      batchDelayMs: 2000,
    });
    setImageFile(null);
    setImagePreview(null);
    setTargetUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setShowUserDropdown(false);
    setIsModalOpen(true);
  };

  const openEditModal = (notification: Notification) => {
    setEditingNotification(notification);
    setFormData({
      title: notification.title,
      description: notification.description,
      image: notification.image || '',
      url: notification.url || '',
      isActive: notification.isActive,
      batchSize: notification.batchSize || 100,
      batchDelayMs: notification.batchDelayMs ?? 2000,
    });
    setImageFile(null);
    setImagePreview(notification.image ? getImageUrl(notification.image) : null);
    setTargetUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setShowUserDropdown(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNotification(null);
    setFormData({
      title: '',
      description: '',
      image: '',
      url: '',
      isActive: true,
      batchSize: 100,
      batchDelayMs: 2000,
    });
    setImageFile(null);
    setImagePreview(null);
    setTargetUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setShowUserDropdown(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setNotification({
        title: 'Validation Error',
        message: 'Title and description are required',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl = formData.image;

      // Upload image if a new file is selected
      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('image', imageFile);

        const uploadResponse = await fetch('/api/notifications/upload-image', {
          method: 'POST',
          body: uploadFormData,
          credentials: 'include',
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.imageUrl;
      }

      // Create or update notification
      const url = editingNotification 
        ? `/api/notifications/${editingNotification.id}`
        : '/api/notifications';
      
      const method = editingNotification ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          image: imageUrl,
          url: formData.url.trim() || null,
          isActive: formData.isActive,
          batchSize: formData.batchSize,
          batchDelayMs: formData.batchDelayMs,
          targetAppUserId: targetUser?.id || null,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save notification');
      }

      const responseData = await response.json();

      let notificationMessage = editingNotification
        ? 'Notification updated successfully'
        : 'Notification created successfully';

      if (!editingNotification && formData.isActive) {
        notificationMessage += '. Push notifications are being sent in the background.';
      } else if (responseData.notification?.sendStatus === 'queued') {
        notificationMessage += '. Push notifications are being sent in the background.';
      }

      // Refresh notifications list
      await fetchNotifications();
      closeModal();
      setNotification({
        title: 'Success',
        message: notificationMessage,
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save notification',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActiveStatus = async (id: string, currentStatus: boolean) => {
    try {
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;

      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: notification.title,
          description: notification.description,
          image: notification.image,
          url: notification.url,
          isActive: !currentStatus,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update notification status');
      }

      const responseData = await response.json();

      let notificationMessage = `Notification ${!currentStatus ? 'activated' : 'deactivated'} successfully`;

      if (responseData.notification?.sendStatus === 'queued' && !currentStatus) {
        notificationMessage += '. Push notifications are being sent in the background.';
      }

      await fetchNotifications();
      setNotification({
        title: 'Success',
        message: notificationMessage,
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to update notification status',
        type: 'error',
      });
      setShowNotification(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Push Notifications</h3>
          <p className="text-[#7895b3]">Manage push notifications for Android app</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Notification
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedNotifications.size > 0 && (
        <div className="bg-[#435970] text-white rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedNotifications.size} notification(s) selected</span>
          </div>
          <button
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isBulkDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </>
            )}
          </button>
        </div>
      )}

      {/* Notifications Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={notifications.length > 0 && selectedNotifications.size === notifications.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Receivers
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#dfedfb]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                    </div>
                  </td>
                </tr>
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="text-[#7895b3]">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p>No notifications found</p>
                      <p className="text-xs mt-1">Create your first notification to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr key={notification.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.has(notification.id)}
                        onChange={(e) => handleSelectNotification(notification.id, e.target.checked)}
                        className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-16 h-16 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {notification.image ? (
                          <Image
                            src={getImageUrl(notification.image)}
                            alt={notification.title}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                target.parentElement.innerHTML = `
                                  <svg class="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#435970]">
                        {notification.title}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#7895b3] max-w-md truncate">
                        {notification.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActiveStatus(notification.id, notification.isActive)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          notification.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {notification.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {(notification.sendStatus === 'queued' || notification.sendStatus === 'sending') ? (
                        <div className="min-w-[130px]">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#435970]"></div>
                            <span className="text-xs font-medium text-[#435970]">
                              {notification.sendStatus === 'queued' ? 'Queued...' : `Sending ${notification.sendProgress}/${notification.sendTotal}`}
                            </span>
                          </div>
                          <div className="w-full bg-[#dfedfb] rounded-full h-2">
                            <div
                              className="bg-[#435970] h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${notification.sendTotal > 0
                                  ? Math.round((notification.sendProgress / notification.sendTotal) * 100)
                                  : 0}%`
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#7895b3] mt-0.5">
                            <span>{notification.successCount} sent</span>
                            {notification.failureCount > 0 && (
                              <span className="text-red-500">{notification.failureCount} failed</span>
                            )}
                          </div>
                        </div>
                      ) : notification.sendStatus === 'failed' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-red-600">Failed</span>
                          {notification.sendTotal > 0 && (
                            <span className="text-xs text-[#7895b3]">
                              ({notification.successCount}/{notification.sendTotal})
                            </span>
                          )}
                        </div>
                      ) : notification.sendStatus === 'partial' ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-amber-600">
                            {notification.successCount}
                          </span>
                          <span className="text-xs text-red-500">
                            ({notification.failureCount} failed)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-[#435970]">
                            {notification.receiverCount || 0}
                          </div>
                          <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-[#435970]">
                          {notification.viewCount || 0}
                        </div>
                        <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#7895b3]">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {(notification.sendStatus === 'failed' || notification.sendStatus === 'partial') && (
                          <button
                            onClick={() => handleRetrySend(notification.id)}
                            className="text-amber-600 hover:text-amber-800 transition-colors p-1"
                            aria-label="Retry sending"
                            title="Retry sending push notification"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(notification)}
                          className="text-[#435970] hover:text-[#7895b3] transition-colors p-1"
                          aria-label="Edit notification"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(notification.id)}
                          disabled={deletingId === notification.id}
                          className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 p-1"
                          aria-label="Delete notification"
                        >
                          {deletingId === notification.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-2xl font-bold text-[#435970]">
                {editingNotification ? 'Edit Notification' : 'Create New Notification'}
              </h3>
              <button
                onClick={closeModal}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[#435970] mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="Enter notification title"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[#435970] mb-2">
                  Short Description *
                </label>
                <textarea
                  id="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3] resize-none"
                  placeholder="Enter short description for the notification"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-[#435970] mb-2">
                  Notification Image
                </label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
                />
                {editingNotification && formData.image && !imagePreview && (
                  <p className="text-xs text-[#7895b3] mt-1">
                    Current image will be kept if no new image is selected
                  </p>
                )}
                {(imagePreview || (editingNotification && formData.image)) && (
                  <div className="mt-2 w-48 h-48 bg-[#dfedfb] rounded-lg overflow-hidden border border-[#dfedfb]">
                    <Image
                      src={imagePreview ? getImageUrl(imagePreview) : getImageUrl(formData.image) || ''}
                      alt="Preview"
                      width={192}
                      height={192}
                      className="object-cover w-full h-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Navigation URL */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-[#435970] mb-2">
                  Navigation URL (Optional)
                </label>
                <input
                  type="text"
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="e.g., /medicines, /blogs/123, /profile"
                />
                <p className="text-xs text-[#7895b3] mt-1">
                  Mobile app route to navigate when notification is tapped (leave empty for no navigation)
                </p>
              </div>

              {/* Target User (for testing) */}
              <div className="relative">
                <label className="block text-sm font-medium text-[#435970] mb-2">
                  Send to Specific User (Optional)
                </label>
                {targetUser ? (
                  <div className="flex items-center gap-2 px-4 py-2 border border-[#dfedfb] rounded-lg bg-[#dfedfb]/30">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-[#435970]">{targetUser.displayName || targetUser.name || 'Unknown'}</span>
                      <span className="text-xs text-[#7895b3] ml-2">{targetUser.email}</span>
                      <span className="text-xs text-[#7895b3] ml-2">({targetUser.id})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetUser(null);
                        setUserSearchQuery('');
                      }}
                      className="text-red-400 hover:text-red-600 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      onFocus={() => { if (userSearchResults.length > 0) setShowUserDropdown(true); }}
                      className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                      placeholder="Search by email, name, user ID, or WP ID..."
                    />
                    {userSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#435970]"></div>
                      </div>
                    )}
                    {showUserDropdown && userSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-[#dfedfb] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setTargetUser(user);
                              setUserSearchQuery('');
                              setShowUserDropdown(false);
                              setUserSearchResults([]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#dfedfb]/50 transition-colors border-b border-[#dfedfb] last:border-b-0"
                          >
                            <div className="text-sm font-medium text-[#435970]">
                              {user.displayName || user.name || 'Unknown'}
                              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {user.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#7895b3]">
                              {user.email} | ID: {user.id} | WP: {user.wpUserId}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showUserDropdown && userSearchResults.length === 0 && userSearchQuery.trim().length >= 2 && !userSearchLoading && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-[#dfedfb] rounded-lg shadow-lg px-4 py-3 text-sm text-[#7895b3]">
                        No users found
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-[#7895b3] mt-1">
                  Leave empty to send to all users. Select a user to test the notification first.
                </p>
              </div>

              {/* Batch Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="batchSize" className="block text-sm font-medium text-[#435970] mb-2">
                    Batch Size
                  </label>
                  <input
                    type="number"
                    id="batchSize"
                    min={1}
                    max={500}
                    value={formData.batchSize}
                    onChange={(e) => setFormData({ ...formData, batchSize: Math.max(1, Math.min(500, parseInt(e.target.value) || 100)) })}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  />
                  <p className="text-xs text-[#7895b3] mt-1">Tokens per multicast batch (1-500, recommended: 100)</p>
                </div>
                <div>
                  <label htmlFor="batchDelayMs" className="block text-sm font-medium text-[#435970] mb-2">
                    Delay Between Batches (ms)
                  </label>
                  <input
                    type="number"
                    id="batchDelayMs"
                    min={0}
                    max={10000}
                    step={100}
                    value={formData.batchDelayMs}
                    onChange={(e) => setFormData({ ...formData, batchDelayMs: Math.max(0, Math.min(10000, parseInt(e.target.value) || 2000)) })}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                  />
                  <p className="text-xs text-[#7895b3] mt-1">Pause in ms between batches (0-10000)</p>
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="isActive" className="text-sm font-medium text-[#435970]">
                    Active Status
                  </label>
                  <p className="text-xs text-[#7895b3]">Only active notifications are sent to the app</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#7895b3] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#435970]"></div>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingNotification ? 'Update Notification' : 'Create Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setNotificationToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? This action cannot be undone."
        type="danger"
        isLoading={deletingId !== null}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={showNotification}
        onClose={() => setShowNotification(false)}
        title={notification?.title || ''}
        message={notification?.message || ''}
        type={notification?.type || 'info'}
      />
    </div>
  );
}

