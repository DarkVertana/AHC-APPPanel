'use client';

import { useState, useEffect } from 'react';

type WeightLog = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  date: string;
  weight: number;
  previousWeight: number | null;
  change: number | null;
  changeType: 'increase' | 'decrease' | 'no-change' | null;
};

type WeightLogsResponse = {
  logs: WeightLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    uniqueUsers: number;
    avgWeightLoss: number;
    todayLogs: number;
  };
};

export default function LogDataPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    uniqueUsers: 0,
    avgWeightLoss: 0,
    todayLogs: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  // Fetch weight logs from API
  useEffect(() => {
    const fetchWeightLogs = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
        });

        if (searchTerm) {
          params.append('search', searchTerm);
        }

        if (selectedDate) {
          params.append('date', selectedDate);
        }

        const response = await fetch(`/api/weight-logs?${params.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch weight logs');
        }

        const data: WeightLogsResponse = await response.json();
        setWeightLogs(data.logs);
        setStats(data.stats);
        setPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching weight logs:', error);
        alert('Failed to load weight logs');
      } finally {
        setLoading(false);
      }
    };

    fetchWeightLogs();
  }, [searchTerm, selectedDate, pagination.page, pagination.limit]);

  const filteredLogs = weightLogs.filter(log =>
    (log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group logs by user for better visualization
  const logsByUser = filteredLogs.reduce((acc, log) => {
    if (!acc[log.userId]) {
      acc[log.userId] = [];
    }
    acc[log.userId].push(log);
    return acc;
  }, {} as Record<string, WeightLog[]>);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination({ ...pagination, page: newPage });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Weight Log Data</h3>
          <p className="text-[#7895b3]">Monitor daily weight updates from users</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
          />
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 pl-10 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
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
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Logs</p>
          <p className="text-2xl font-bold text-[#435970]">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Users Logging</p>
          <p className="text-2xl font-bold text-[#435970]">{stats.uniqueUsers}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Avg Weight Loss</p>
          <p className="text-2xl font-bold text-[#435970]">
            {stats.avgWeightLoss.toFixed(1)} lbs
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Today&apos;s Logs</p>
          <p className="text-2xl font-bold text-[#435970]">
            {stats.todayLogs}
          </p>
        </div>
      </div>

      {/* Weight Logs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Weight (lbs)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Previous Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Change
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                      <span className="ml-3 text-[#7895b3]">Loading weight logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-[#7895b3]">
                      {searchTerm || selectedDate
                        ? 'No weight logs found matching your criteria.'
                        : 'No weight logs found. Weight logs will appear here when users submit data from the app.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                            {log.userName
                              ? log.userName.split(' ').map(n => n[0]).join('').toUpperCase()
                              : log.userEmail[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#435970]">
                              {log.userName || log.userEmail.split('@')[0]}
                            </div>
                            <div className="text-sm text-[#7895b3]">{log.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#435970]">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-[#435970]">{log.weight} lbs</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7895b3]">
                        {log.previousWeight ? `${log.previousWeight} lbs` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.change !== null && log.change !== 0 ? (
                          <div className="flex items-center gap-2">
                            {log.changeType === 'decrease' ? (
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7 7V3" />
                              </svg>
                            )}
                            <span className={`text-sm font-semibold ${
                              log.changeType === 'decrease' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {log.changeType === 'decrease' ? '-' : '+'}{Math.abs(log.change)} lbs
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#7895b3]">No change</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.changeType ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            log.changeType === 'decrease'
                              ? 'bg-green-100 text-green-700'
                              : log.changeType === 'increase'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-[#dfedfb] text-[#7895b3]'
                          }`}>
                            {log.changeType === 'decrease' ? 'Decreased' : log.changeType === 'increase' ? 'Increased' : 'No Change'}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-[#dfedfb] text-[#7895b3]">
                            N/A
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredLogs.length > 0 && (
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
    </div>
  );
}
