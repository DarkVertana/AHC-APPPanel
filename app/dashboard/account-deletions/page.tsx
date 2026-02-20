'use client';

import { useState, useEffect, useCallback } from 'react';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';

type DeletionRequest = {
  id: string;
  appUserId: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  autoDeleteAt: string;
  appUser: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    wpUserId: string;
  };
};

type Stats = {
  total: number;
  pending: number;
  onHold: number;
  deleted: number;
};

function getTimeRemaining(autoDeleteAt: string, status: string): string {
  if (status === 'deleted') return 'Deleted';
  if (status === 'on_hold') return 'Paused';

  const now = Date.now();
  const target = new Date(autoDeleteAt).getTime();
  const diff = target - now;

  if (diff <= 0) return 'Overdue';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AccountDeletionsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, onHold: 0, deleted: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [, setTick] = useState(0); // for countdown refresh

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState<DeletionRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Notification modal
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('page', page.toString());
      params.append('limit', '20');

      const response = await fetch(`/api/account-deletion-requests?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests);
        setStats(data.stats);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Auto-refresh countdown every 60s
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (req: DeletionRequest, action: 'hold' | 'resume' | 'delete') => {
    if (action === 'delete') {
      setDeletingRequest(req);
      setDeleteModalOpen(true);
      return;
    }

    try {
      const response = await fetch(`/api/account-deletion-requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        setNotification({
          isOpen: true,
          title: 'Updated',
          message: action === 'hold' ? 'Request put on hold' : 'Request resumed with new 24h timer',
          type: 'success',
        });
        fetchRequests();
      } else {
        const data = await response.json();
        setNotification({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to update request',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error updating request:', error);
      setNotification({ isOpen: true, title: 'Error', message: 'Failed to update request', type: 'error' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRequest) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/account-deletion-requests/${deletingRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete' }),
      });

      if (response.ok) {
        setDeleteModalOpen(false);
        setDeletingRequest(null);
        setNotification({
          isOpen: true,
          title: 'Deleted',
          message: 'User account deleted successfully',
          type: 'success',
        });
        fetchRequests();
      } else {
        const data = await response.json();
        setNotification({
          isOpen: true,
          title: 'Error',
          message: data.error || 'Failed to delete user',
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setNotification({ isOpen: true, title: 'Error', message: 'Failed to delete user', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            Pending
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            On Hold
          </span>
        );
      case 'deleted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Deleted
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#435970]">Account Deletions</h1>
        <p className="text-[#7895b3] text-sm">Manage account deletion requests from app users</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#435970]/10 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#435970]">{stats.total}</p>
              <p className="text-xs text-[#7895b3]">Total Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              <p className="text-xs text-[#7895b3]">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.onHold}</p>
              <p className="text-xs text-[#7895b3]">On Hold</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.deleted}</p>
              <p className="text-xs text-[#7895b3]">Deleted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by user name, email, or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'pending', 'on_hold', 'deleted'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-[#435970] text-white shadow-lg shadow-[#435970]/20'
                    : 'bg-gray-100 text-[#435970] hover:bg-gray-200'
                }`}
              >
                {s === 'on_hold' ? 'On Hold' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#435970]"></div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-[#435970]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#435970] mb-2">No deletion requests found</h3>
          <p className="text-[#7895b3]">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No account deletion requests have been submitted yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">User</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">User ID</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Requested</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Time Remaining</th>
                  <th className="text-left px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold text-[#7895b3] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* User */}
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-[#435970]">
                        {req.appUser?.displayName || req.appUser?.name || '-'}
                      </div>
                      <div className="text-xs text-[#7895b3]">{req.appUser?.email || '-'}</div>
                      {req.reason && (
                        <div className="text-xs text-gray-400 mt-1 italic">Reason: {req.reason}</div>
                      )}
                    </td>
                    {/* User ID */}
                    <td className="px-5 py-4">
                      <div className="text-sm text-[#435970] font-mono">{req.appUser?.id || req.appUserId}</div>
                    </td>
                    {/* Requested Date */}
                    <td className="px-5 py-4">
                      <div className="text-sm text-[#435970]">
                        {new Date(req.requestedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-[#7895b3]">
                        {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    {/* Time Remaining */}
                    <td className="px-5 py-4">
                      <div className={`text-sm font-medium ${
                        req.status === 'deleted' ? 'text-red-500' :
                        req.status === 'on_hold' ? 'text-blue-500' :
                        getTimeRemaining(req.autoDeleteAt, req.status) === 'Overdue' ? 'text-red-600' :
                        'text-orange-600'
                      }`}>
                        {getTimeRemaining(req.autoDeleteAt, req.status)}
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      {getStatusBadge(req.status)}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      {req.status !== 'deleted' && (
                        <div className="flex items-center justify-end gap-1">
                          {/* Hold / Resume toggle */}
                          {req.status === 'pending' ? (
                            <button
                              onClick={() => handleAction(req, 'hold')}
                              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Put on hold"
                            >
                              Hold
                            </button>
                          ) : req.status === 'on_hold' ? (
                            <button
                              onClick={() => handleAction(req, 'resume')}
                              className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                              title="Resume (reset 24h timer)"
                            >
                              Resume
                            </button>
                          ) : null}
                          {/* Delete Now */}
                          <button
                            onClick={() => handleAction(req, 'delete')}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete user now"
                          >
                            Delete Now
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-[#7895b3]">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm font-medium text-[#435970] bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-[#435970] bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete the account for "${deletingRequest?.appUser?.displayName || deletingRequest?.appUser?.name || deletingRequest?.appUser?.email}"? This will delete all their data and cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingRequest(null);
        }}
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
