'use client';

import { useState, useEffect, useCallback } from 'react';

type PushLog = {
  id: string;
  recipientEmail: string | null;
  recipientWpUserId: string | null;
  recipientFcmToken: string | null;
  recipientCount: number;
  title: string;
  body: string;
  imageUrl: string | null;
  dataPayload: Record<string, string> | null;
  source: string;
  type: string;
  sourceId: string | null;
  status: string;
  successCount: number;
  failureCount: number;
  errorMessage: string | null;
  errorCode: string | null;
  fcmMessageId: string | null;
  createdAt: string;
  sentAt: string | null;
};

type PushLogsResponse = {
  logs: PushLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalSent: number;
    totalFailed: number;
    successRate: number;
    todayCount: number;
  };
};

export default function PushLogsPage() {
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({
    totalSent: 0,
    totalFailed: 0,
    successRate: 0,
    todayCount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PushLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch push logs from API
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (typeFilter) params.append('type', typeFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/push-logs?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch push logs');
      }

      const data: PushLogsResponse = await response.json();
      setLogs(data.logs);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching push logs:', error);
      alert('Failed to load push logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, sourceFilter, typeFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination({ ...pagination, page: newPage });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLogs(new Set(logs.map((l) => l.id)));
    } else {
      setSelectedLogs(new Set());
    }
  };

  const handleSelectLog = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedLogs);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedLogs(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedLogs.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedLogs.size} log(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/push-logs/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedLogs) }),
      });

      if (response.ok) {
        setSelectedLogs(new Set());
        await fetchLogs();
        alert('Logs deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete logs');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('An error occurred while deleting logs');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;

    try {
      const response = await fetch(`/api/push-logs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLogs();
        alert('Log deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete log');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('An error occurred while deleting the log');
    }
  };

  const openDetailModal = (log: PushLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setSelectedLog(null);
    setShowDetailModal(false);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'partial':
        return 'bg-yellow-100 text-yellow-700';
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getSourceBadgeClass = (source: string) => {
    switch (source) {
      case 'admin':
        return 'bg-blue-100 text-blue-700';
      case 'webhook':
        return 'bg-purple-100 text-purple-700';
      case 'system':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setSourceFilter('');
    setTypeFilter('');
    setStartDate('');
    setEndDate('');
    setPagination({ ...pagination, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Push Notification Logs</h3>
          <p className="text-[#7895b3]">Monitor all push notification activity</p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#7895b3] mb-1">Total Sent</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalSent}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#7895b3] mb-1">Total Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalFailed}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#7895b3] mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.successRate}%</p>
            </div>
            <div className="w-10 h-10 bg-[#dfedfb] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#7895b3] mb-1">Today&apos;s Count</p>
              <p className="text-2xl font-bold text-[#435970]">{stats.todayCount}</p>
            </div>
            <div className="w-10 h-10 bg-[#dfedfb] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by email, title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
            >
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="partial">Partial</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
            >
              <option value="">All Sources</option>
              <option value="admin">Admin</option>
              <option value="webhook">Webhook</option>
              <option value="system">System</option>
            </select>
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
            >
              <option value="">All Types</option>
              <option value="general">General</option>
              <option value="order">Order</option>
              <option value="subscription">Subscription</option>
              <option value="promotion">Promotion</option>
            </select>
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
            />
          </div>
          <div className="w-[150px]">
            <label className="block text-sm font-medium text-[#435970] mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
            />
          </div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-[#7895b3] hover:text-[#435970] transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedLogs.size > 0 && (
        <div className="bg-[#435970] text-white rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedLogs.size} log(s) selected</span>
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

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={logs.length > 0 && selectedLogs.size === logs.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Success/Fail
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                      <span className="ml-3 text-[#7895b3]">Loading push logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="text-[#7895b3]">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <p>No push notification logs found</p>
                      <p className="text-xs mt-1">Logs will appear here when push notifications are sent</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#dfedfb]/20 transition-colors cursor-pointer" onClick={() => openDetailModal(log)}>
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLogs.has(log.id)}
                        onChange={(e) => handleSelectLog(log.id, e.target.checked)}
                        className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusBadgeClass(log.status)}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-[#435970]">
                        {log.recipientEmail || (log.recipientCount > 1 ? `${log.recipientCount} recipients` : 'Unknown')}
                      </div>
                      {log.recipientWpUserId && (
                        <div className="text-xs text-[#7895b3]">WP ID: {log.recipientWpUserId}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-[#435970] max-w-[200px] truncate">
                        {log.title}
                      </div>
                      <div className="text-xs text-[#7895b3] max-w-[200px] truncate">
                        {log.body}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getSourceBadgeClass(log.source)}`}>
                        {log.source}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-[#435970] capitalize">{log.type}</span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-600">{log.successCount}</span>
                        <span className="text-[#7895b3]">/</span>
                        <span className="text-sm text-red-600">{log.failureCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#435970]">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-[#7895b3]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openDetailModal(log)}
                        className="text-[#435970] hover:text-[#7895b3] transition-colors p-1 mr-2"
                        aria-label="View details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteSingle(log.id)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        aria-label="Delete log"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-between">
            <div className="text-sm text-[#7895b3]">
              Showing <span className="font-semibold text-[#435970]">
                {((pagination.page - 1) * pagination.limit) + 1}
              </span> to{' '}
              <span className="font-semibold text-[#435970]">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span> of{' '}
              <span className="font-semibold text-[#435970]">{pagination.total}</span> logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#7895b3]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeDetailModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-[#435970]">Push Notification Details</h3>
              <button
                onClick={closeDetailModal}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status and Meta */}
              <div className="flex flex-wrap gap-3">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full capitalize ${getStatusBadgeClass(selectedLog.status)}`}>
                  {selectedLog.status}
                </span>
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full capitalize ${getSourceBadgeClass(selectedLog.source)}`}>
                  {selectedLog.source}
                </span>
                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700 capitalize">
                  {selectedLog.type}
                </span>
              </div>

              {/* Recipient Info */}
              <div className="bg-[#dfedfb]/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-[#435970] mb-2">Recipient Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#7895b3]">Email:</span>
                    <p className="text-[#435970] font-medium">{selectedLog.recipientEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[#7895b3]">WP User ID:</span>
                    <p className="text-[#435970] font-medium">{selectedLog.recipientWpUserId || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[#7895b3]">Recipient Count:</span>
                    <p className="text-[#435970] font-medium">{selectedLog.recipientCount}</p>
                  </div>
                  <div>
                    <span className="text-[#7895b3]">FCM Token:</span>
                    <p className="text-[#435970] font-medium truncate">{selectedLog.recipientFcmToken || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Notification Content */}
              <div>
                <h4 className="text-sm font-semibold text-[#435970] mb-2">Notification Content</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-[#7895b3] text-sm">Title:</span>
                    <p className="text-[#435970] font-medium">{selectedLog.title}</p>
                  </div>
                  <div>
                    <span className="text-[#7895b3] text-sm">Body:</span>
                    <p className="text-[#435970]">{selectedLog.body}</p>
                  </div>
                  {selectedLog.imageUrl && (
                    <div>
                      <span className="text-[#7895b3] text-sm">Image URL:</span>
                      <p className="text-[#435970] text-sm break-all">{selectedLog.imageUrl}</p>
                    </div>
                  )}
                  {selectedLog.dataPayload && Object.keys(selectedLog.dataPayload).length > 0 && (
                    <div>
                      <span className="text-[#7895b3] text-sm">Data Payload:</span>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.dataPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Results */}
              <div className="bg-[#dfedfb]/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-[#435970] mb-2">Send Results</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[#7895b3]">Success Count:</span>
                    <p className="text-green-600 font-bold text-lg">{selectedLog.successCount}</p>
                  </div>
                  <div>
                    <span className="text-[#7895b3]">Failure Count:</span>
                    <p className="text-red-600 font-bold text-lg">{selectedLog.failureCount}</p>
                  </div>
                  {selectedLog.fcmMessageId && (
                    <div className="col-span-2">
                      <span className="text-[#7895b3]">FCM Message ID:</span>
                      <p className="text-[#435970] text-xs break-all">{selectedLog.fcmMessageId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Info */}
              {(selectedLog.errorMessage || selectedLog.errorCode) && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-700 mb-2">Error Information</h4>
                  {selectedLog.errorCode && (
                    <div className="mb-2">
                      <span className="text-red-500 text-sm">Error Code:</span>
                      <p className="text-red-700 font-mono text-sm">{selectedLog.errorCode}</p>
                    </div>
                  )}
                  {selectedLog.errorMessage && (
                    <div>
                      <span className="text-red-500 text-sm">Error Message:</span>
                      <p className="text-red-700 text-sm">{selectedLog.errorMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                <div>
                  <span className="text-[#7895b3]">Created At:</span>
                  <p className="text-[#435970]">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[#7895b3]">Sent At:</span>
                  <p className="text-[#435970]">{selectedLog.sentAt ? new Date(selectedLog.sentAt).toLocaleString() : 'N/A'}</p>
                </div>
                {selectedLog.sourceId && (
                  <div className="col-span-2">
                    <span className="text-[#7895b3]">Source ID:</span>
                    <p className="text-[#435970]">{selectedLog.sourceId}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeDetailModal}
                className="px-4 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleDeleteSingle(selectedLog.id);
                  closeDetailModal();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
