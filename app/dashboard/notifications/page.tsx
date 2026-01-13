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
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    });
    setImageFile(null);
    setImagePreview(null);
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
    });
    setImageFile(null);
    setImagePreview(notification.image ? getImageUrl(notification.image) : null);
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
    });
    setImageFile(null);
    setImagePreview(null);
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
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save notification');
      }

      const responseData = await response.json();
      
      // Check push notification results
      let notificationMessage = editingNotification 
        ? 'Notification updated successfully' 
        : 'Notification created successfully';
      
      if (responseData.pushNotification) {
        const push = responseData.pushNotification;
        // Only show errors if all notifications failed (successCount === 0)
        // If some succeeded, don't show error details to avoid confusion
        if (push.totalUsers === 0) {
          notificationMessage += '\n\n⚠️ No active users with FCM tokens found';
        } else if (push.sent && push.successCount > 0) {
          // Successfully sent to at least one user - show success message
          notificationMessage += `\n\n✅ Push notification sent to ${push.successCount} user(s)`;
          // Only show failure count if there were failures, but don't show error details
          if (push.failureCount > 0) {
            notificationMessage += ` (${push.failureCount} failed - invalid tokens removed)`;
          }
        } else if (push.successCount === 0 && push.failureCount > 0) {
          // All failed - show error message
          notificationMessage += `\n\n⚠️ Push notification failed to send (${push.failureCount} failures)`;
          if (push.error) {
            notificationMessage += `\n\nError: ${push.error}`;
          }
        }
      }

      // Refresh notifications list
      await fetchNotifications();
      closeModal();
      setNotification({
        title: 'Success',
        message: notificationMessage,
        // Only show as warning if all notifications failed, otherwise show as success
        type: (responseData.pushNotification?.successCount ?? 0) > 0 ? 'success' : 'warning',
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
      
      // Check push notification results if notification was activated
      let notificationMessage = `Notification ${!currentStatus ? 'activated' : 'deactivated'} successfully`;
      
      if (responseData.pushNotification && !currentStatus) {
        // Notification was just activated, show push notification results
        const push = responseData.pushNotification;
        if (push.totalUsers === 0) {
          notificationMessage += '\n\n⚠️ No active users with FCM tokens found';
        } else if (push.sent && push.successCount > 0) {
          notificationMessage += `\n\n✅ Push notification sent to ${push.successCount} user(s)`;
          if (push.failureCount > 0) {
            notificationMessage += ` (${push.failureCount} failed - invalid tokens removed)`;
          }
        } else if (push.successCount === 0 && push.failureCount > 0) {
          notificationMessage += `\n\n⚠️ Push notification failed to send (${push.failureCount} failures)`;
          if (push.error) {
            notificationMessage += `\n\nError: ${push.error}`;
          }
        }
      }

      await fetchNotifications();
      setNotification({
        title: 'Success',
        message: notificationMessage,
        type: (responseData.pushNotification?.successCount ?? 0) > 0 ? 'success' : 'success',
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
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-[#435970]">
                          {notification.receiverCount || 0}
                        </div>
                        <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
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

