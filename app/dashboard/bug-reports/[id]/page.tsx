'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';
import ImageLightbox from '@/app/components/ImageLightbox';

type BugReport = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  status: string;
  platform: string | null;
  osVersion: string | null;
  deviceName: string | null;
  appVersion: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  appUserId: string | null;
  appUser: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    phone: string | null;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export default function BugReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [bugReport, setBugReport] = useState<BugReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Image modal
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Notification
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchBugReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bug-reports/${id}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBugReport(data.bugReport);
      } else if (response.status === 404) {
        router.push('/dashboard/bug-reports');
      }
    } catch (error) {
      console.error('Error fetching bug report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugReport();
  }, [id]);

  const handleStatusToggle = async () => {
    if (!bugReport) return;
    const newStatus = bugReport.status === 'open' ? 'resolved' : 'open';
    setUpdating(true);

    try {
      const response = await fetch(`/api/bug-reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setBugReport({ ...bugReport, status: newStatus });
        setNotification({
          isOpen: true,
          title: 'Status Updated',
          message: `Bug report marked as ${newStatus}`,
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setNotification({
        isOpen: true,
        title: 'Error',
        message: 'Failed to update status',
        type: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/bug-reports/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/dashboard/bug-reports');
      } else {
        const data = await response.json();
        setNotification({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to delete bug report',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting bug report:', error);
      setNotification({
        isOpen: true,
        title: 'Error',
        message: 'Failed to delete bug report',
        type: 'error',
      });
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#435970]"></div>
      </div>
    );
  }

  if (!bugReport) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-[#435970]">Bug report not found</h2>
        <Link href="/dashboard/bug-reports" className="text-[#7895b3] hover:underline mt-2 inline-block">
          Back to Bug Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/bug-reports"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-[#435970] truncate">{bugReport.title}</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                  bugReport.status === 'open'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  bugReport.status === 'open' ? 'bg-orange-500' : 'bg-green-500'
                }`}></span>
                {bugReport.status === 'open' ? 'Open' : 'Resolved'}
              </span>
            </div>
            <p className="text-[#7895b3] text-sm mt-0.5">
              Submitted on {new Date(bugReport.createdAt).toLocaleDateString()} at{' '}
              {new Date(bugReport.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {bugReport.updatedAt !== bugReport.createdAt && (
                <span className="ml-2 text-xs">
                  · Updated {new Date(bugReport.updatedAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleStatusToggle}
            disabled={updating}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg disabled:opacity-50 ${
              bugReport.status === 'open'
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20'
            }`}
          >
            {updating ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : bugReport.status === 'open' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {bugReport.status === 'open' ? 'Mark as Resolved' : 'Reopen'}
          </button>
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-300 font-semibold text-sm shadow-lg shadow-red-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Info Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reporter Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#435970]/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#435970]">Reporter</h3>
          </div>
          <p className="text-sm font-medium text-[#435970] truncate">
            {bugReport.reporterName || bugReport.appUser?.displayName || bugReport.appUser?.name || '-'}
          </p>
          <p className="text-xs text-[#7895b3] truncate mt-0.5">
            {bugReport.reporterEmail || bugReport.appUser?.email || '-'}
          </p>
          {bugReport.appUser && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                bugReport.appUser.status === 'Active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {bugReport.appUser.status}
              </span>
              <Link
                href={`/dashboard/users?search=${encodeURIComponent(bugReport.appUser.email)}`}
                className="text-xs text-[#7895b3] hover:text-[#435970] font-medium transition-colors"
              >
                View Profile
              </Link>
            </div>
          )}
        </div>

        {/* Device Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#435970]/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#435970]">Device</h3>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-[#435970]">
            {bugReport.platform ? (
              <>
                {bugReport.platform === 'ios' ? (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.44-.59-3.03-.94-4.73-.94s-3.29.35-4.73.94L5.19 5.67c-.18-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L5.94 9.48C3.6 10.8 2 13.16 2 16h20c0-2.84-1.6-5.2-3.94-6.52zM7 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                )}
                <span>{bugReport.platform === 'ios' ? 'iOS' : 'Android'}{bugReport.osVersion ? ` ${bugReport.osVersion}` : ''}</span>
              </>
            ) : (
              <span className="text-[#7895b3]">-</span>
            )}
          </div>
          <p className="text-xs text-[#7895b3] mt-0.5">{bugReport.deviceName || 'Unknown device'}</p>
          {bugReport.appVersion && (
            <p className="text-xs text-[#7895b3] mt-0.5">App v{bugReport.appVersion}</p>
          )}
        </div>

        {/* Timestamps */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-[#435970]/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-[#435970]">Timeline</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-[#7895b3]">Created</p>
              <p className="text-sm font-medium text-[#435970]">
                {new Date(bugReport.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#7895b3]">Last Updated</p>
              <p className="text-sm font-medium text-[#435970]">
                {new Date(bugReport.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Description - Full Width */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#435970] mb-4">Description</h2>
        <p className="text-[#435970] whitespace-pre-wrap leading-relaxed">{bugReport.description}</p>
      </div>

      {/* Screenshot - Full Width */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#435970] mb-4">Screenshot</h2>
        {bugReport.image ? (
          <div
            className="group relative cursor-pointer rounded-xl overflow-hidden border border-gray-200 inline-block"
            onClick={() => setImageModalOpen(true)}
          >
            <img
              src={bugReport.image}
              alt="Bug report screenshot"
              className="max-w-full max-h-[500px] object-contain"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 rounded-full p-3">
                <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-[#7895b3] bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <svg className="w-16 h-16 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium">No screenshot attached</p>
            <p className="text-xs mt-1">The reporter did not include an image with this bug report</p>
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={imageModalOpen}
        src={bugReport.image || ''}
        alt="Bug report screenshot"
        onClose={() => setImageModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Bug Report"
        message={`Are you sure you want to delete "${bugReport.title}"? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteModalOpen(false)}
        isLoading={deleting}
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isOpen: false })}
      />
    </div>
  );
}
