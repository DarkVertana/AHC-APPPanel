'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type DashboardData = {
  users: {
    total: number;
    active: number;
    inactive: number;
    activeToday: number;
    recentUsers: Array<{
      id: string;
      name: string;
      email: string;
      lastLogin: string;
    }>;
  };
  content: {
    medicines: number;
    medicineCategories: number;
    blogs: number;
    faqs: number;
    activeFaqs: number;
  };
  notifications: {
    total: number;
    active: number;
    inactive: number;
    totalReceivers: number;
    totalViews: number;
  };
  weightLogs: {
    total: number;
    today: number;
    uniqueUsers: number;
    avgWeightLoss: number;
  };
};

type DeviceTypeEntry = {
  type: string;
  count: number;
  platform: string;
};

type AppVersionEntry = {
  version: string;
  count: number;
};

type DeviceAnalytics = {
  totalDevices: number;
  totalUsersWithDevices: number;
  byDeviceType: DeviceTypeEntry[];
  byPlatform: {
    ios: { devices: number; users: number };
    android: { devices: number; users: number };
  };
  byAppVersion: {
    ios: AppVersionEntry[];
    android: AppVersionEntry[];
  };
};

type EngagementData = {
  totalUsers: number;
  medicine: {
    usersWithAtLeastOne: number;
    usersWithNone: number;
    totalShots: number;
  };
  weight: {
    usersWithAdditionalLog: number;
    usersWithNoAdditionalLog: number;
    totalAdditionalLogs: number;
  };
};

type NotificationAnalytics = {
  pushLogs: {
    total: number;
    sent: number;
    failed: number;
    today: number;
    successRate: number;
    bySource: { admin: number; webhook: number; system: number };
  };
  adminNotifications: {
    total: number;
    totalReceivers: number;
    totalViews: number;
    totalSuccess: number;
    totalFailures: number;
  };
  webhooks: {
    total: number;
    byEvent: { orderStatus: number; subscriptionStatus: number };
    orderStatuses: Record<string, number>;
    subscriptionStatuses: Record<string, number>;
  };
  scheduled: {
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
};

const COLORS = ['#435970', '#7895b3', '#dfedfb', '#93b7d8'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceAnalytics | null>(null);
  const [notifData, setNotifData] = useState<NotificationAnalytics | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch all data in parallel
        const [
          usersRes,
          medicinesRes,
          categoriesRes,
          blogsRes,
          faqsRes,
          notificationsRes,
          weightLogsRes,
        ] = await Promise.all([
          fetch('/api/app-users?limit=1000', { credentials: 'include' }),
          fetch('/api/medicines?limit=1', { credentials: 'include' }),
          fetch('/api/medicine-categories?limit=1', { credentials: 'include' }),
          fetch('/api/blogs?limit=1', { credentials: 'include' }),
          fetch('/api/faqs', { credentials: 'include' }),
          fetch('/api/notifications', { credentials: 'include' }),
          fetch('/api/weight-logs?limit=10', { credentials: 'include' }),
        ]);

        const usersData = await usersRes.json();
        const medicinesData = await medicinesRes.json();
        const categoriesData = await categoriesRes.json();
        const blogsData = await blogsRes.json();
        const faqsData = await faqsRes.json();
        const notificationsData = await notificationsRes.json();
        const weightLogsData = await weightLogsRes.json();

        // Calculate active users today
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const activeToday = usersData.users.filter((user: any) => {
          if (!user.lastLogin || user.lastLogin === 'Never') return false;
          const loginTime = parseTimeAgo(user.lastLogin);
          return loginTime && loginTime > yesterday;
        }).length;

        // Get recent users
        const recentUsers = usersData.users
          .filter((user: any) => user.lastLogin !== 'Never')
          .sort((a: any, b: any) => {
            const timeA = parseTimeAgo(a.lastLogin);
            const timeB = parseTimeAgo(b.lastLogin);
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeB.getTime() - timeA.getTime();
          })
          .slice(0, 5);

        // Count notifications by status
        const activeNotifications = notificationsData.filter((n: any) => n.isActive).length;
        const totalReceivers = notificationsData.reduce((sum: number, n: any) => sum + (n.receiverCount || 0), 0);
        const totalViews = notificationsData.reduce((sum: number, n: any) => sum + (n.viewCount || 0), 0);

        // Count active FAQs
        const activeFaqs = faqsData.faqs.filter((f: any) => f.isActive).length;

        setData({
          users: {
            total: usersData.stats.total,
            active: usersData.stats.active,
            inactive: usersData.stats.inactive,
            activeToday,
            recentUsers,
          },
          content: {
            medicines: medicinesData.pagination.total,
            medicineCategories: categoriesData.pagination.total,
            blogs: blogsData.pagination.total,
            faqs: faqsData.total,
            activeFaqs,
          },
          notifications: {
            total: notificationsData.length,
            active: activeNotifications,
            inactive: notificationsData.length - activeNotifications,
            totalReceivers,
            totalViews,
          },
          weightLogs: {
            total: weightLogsData.stats.total,
            today: weightLogsData.stats.todayLogs,
            uniqueUsers: weightLogsData.stats.uniqueUsers,
            avgWeightLoss: weightLogsData.stats.avgWeightLoss,
          },
        });

        // Prepare chart data
        setChartData([
          { name: 'Users', value: usersData.stats.total, fill: COLORS[0] },
          { name: 'Medicines', value: medicinesData.pagination.total, fill: COLORS[1] },
          { name: 'Blogs', value: blogsData.pagination.total, fill: COLORS[2] },
          { name: 'FAQs', value: faqsData.total, fill: COLORS[3] },
        ]);

        // Fetch analytics separately (non-blocking)
        fetch('/api/analytics/devices', { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(deviceAnalytics => {
            if (deviceAnalytics) setDeviceData(deviceAnalytics);
          })
          .catch(err => console.error('Error fetching device analytics:', err));

        fetch('/api/analytics/notifications', { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(notifAnalytics => {
            if (notifAnalytics) setNotifData(notifAnalytics);
          })
          .catch(err => console.error('Error fetching notification analytics:', err));

        fetch('/api/analytics/engagement', { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(engagement => {
            if (engagement) setEngagementData(engagement);
          })
          .catch(err => console.error('Error fetching engagement analytics:', err));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const parseTimeAgo = (timeStr: string): Date | null => {
    if (timeStr === 'Never') return null;
    
    const now = new Date();
    const match = timeStr.match(/(\d+)\s*(second|minute|hour|day|week|month)s?\s*ago/);
    
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    const timeMap: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    
    const milliseconds = value * (timeMap[unit] || 0);
    return new Date(now.getTime() - milliseconds);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto mb-4"></div>
          <p className="text-[#7895b3]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const userStatusData = [
    { name: 'Active', value: data.users.active, fill: '#435970' },
    { name: 'Inactive', value: data.users.inactive, fill: '#7895b3' },
  ];

  const contentData = [
    { name: 'Medicines', count: data.content.medicines },
    { name: 'Categories', count: data.content.medicineCategories },
    { name: 'Blogs', count: data.content.blogs },
    { name: 'FAQs', count: data.content.faqs },
    { name: 'Notifications', count: data.notifications.total },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#435970] mb-2">Dashboard Overview</h1>
        <p className="text-[#7895b3]">Monitor your platform&apos;s performance and user activity</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <Link href="/dashboard/users" className="block">
          <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#435970] to-[#7895b3] rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-2xl">👥</span>
            </div>
            <h4 className="text-3xl font-bold text-[#435970] mb-1">{data.users.total.toLocaleString()}</h4>
            <p className="text-sm text-[#7895b3] mb-2">Total Users</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                {data.users.activeToday} active today
              </span>
            </div>
          </div>
        </Link>

        {/* Content Items */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-[#7895b3] to-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="text-2xl">📦</span>
          </div>
          <h4 className="text-3xl font-bold text-[#435970] mb-1">
            {(data.content.medicines + data.content.blogs + data.content.faqs).toLocaleString()}
          </h4>
          <p className="text-sm text-[#7895b3] mb-2">Content Items</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-[#dfedfb] text-[#435970] rounded-full font-medium">
              {data.content.medicines} medicines
            </span>
          </div>
        </div>

        {/* Notifications */}
        <Link href="/dashboard/notifications" className="block">
          <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-[#435970] to-[#7895b3] rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-2xl">🔔</span>
            </div>
            <h4 className="text-3xl font-bold text-[#435970] mb-1">{data.notifications.total.toLocaleString()}</h4>
            <p className="text-sm text-[#7895b3] mb-2">Notifications Sent</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                {data.notifications.totalReceivers.toLocaleString()} receivers
              </span>
            </div>
          </div>
        </Link>

      </div>

      {/* Device Statistics */}
      {deviceData && (
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-[#435970] to-[#7895b3] rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#435970]">User Devices</h3>
                <p className="text-sm text-[#7895b3]">{deviceData.totalDevices} registered devices from {deviceData.totalUsersWithDevices} users</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-[#dfedfb]/50 rounded-lg">
                <p className="text-lg font-bold text-[#435970]">{deviceData.byPlatform.ios.users}</p>
                <p className="text-xs text-[#7895b3]">iOS Users</p>
              </div>
              <div className="text-center px-4 py-2 bg-[#dfedfb]/50 rounded-lg">
                <p className="text-lg font-bold text-[#435970]">{deviceData.byPlatform.android.users}</p>
                <p className="text-xs text-[#7895b3]">Android Users</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#dfedfb]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Device Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Count</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfedfb]">
                {deviceData.byDeviceType.map((entry) => (
                  <tr key={entry.type} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${entry.platform === 'ios' ? 'bg-blue-50' : 'bg-green-50'}`}>
                          {entry.platform === 'ios' ? (
                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.523 15.342l1.592 2.756c.186.322.072.735-.25.921-.323.186-.735.072-.921-.25l-1.614-2.795c-1.206.534-2.544.83-3.951.83-1.406 0-2.745-.296-3.95-.83l-1.614 2.795c-.186.322-.599.436-.921.25-.322-.186-.436-.599-.25-.921l1.592-2.756C4.594 13.946 2.75 11.363 2.75 8.332h18.5c0 3.031-1.844 5.614-4.727 7.01zM7.5 11.332c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1zm9 0c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1zM15.607 2.368l1.346-1.346c.195-.195.195-.512 0-.707-.195-.195-.512-.195-.707 0l-1.483 1.483C13.845 1.322 12.836 1.082 12 1.082s-1.845.24-2.763.716L7.754.315c-.195-.195-.512-.195-.707 0-.195.195-.195.512 0 .707l1.346 1.346C6.676 3.55 5.75 5.787 5.75 8.332h12.5c0-2.545-.926-4.782-2.643-5.964z"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[#435970]">{entry.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        entry.platform === 'ios' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {entry.platform === 'ios' ? 'iOS' : 'Android'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-[#435970]">{entry.count}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-[#dfedfb] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${entry.platform === 'ios' ? 'bg-blue-500' : 'bg-green-500'}`}
                            style={{ width: `${deviceData.totalDevices > 0 ? (entry.count / deviceData.totalDevices) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-[#7895b3]">
                          {deviceData.totalDevices > 0 ? ((entry.count / deviceData.totalDevices) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* App Version Breakdown */}
          {deviceData.byAppVersion && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* iOS Versions */}
              <div>
                <h4 className="text-sm font-semibold text-[#435970] mb-3 flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">iOS</span>
                  App Version Distribution
                </h4>
                {deviceData.byAppVersion.ios.length === 0 ? (
                  <p className="text-sm text-[#7895b3]">No iOS version data</p>
                ) : (
                  <div className="space-y-2">
                    {deviceData.byAppVersion.ios.map((entry) => (
                      <div key={entry.version} className="flex items-center justify-between p-2 bg-blue-50/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#435970]">v{entry.version}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 bg-blue-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-blue-500"
                              style={{ width: `${deviceData.byPlatform.ios.devices > 0 ? (entry.count / deviceData.byPlatform.ios.devices) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-[#435970] w-8 text-right">{entry.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Android Versions */}
              <div>
                <h4 className="text-sm font-semibold text-[#435970] mb-3 flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Android</span>
                  App Version Distribution
                </h4>
                {deviceData.byAppVersion.android.length === 0 ? (
                  <p className="text-sm text-[#7895b3]">No Android version data</p>
                ) : (
                  <div className="space-y-2">
                    {deviceData.byAppVersion.android.map((entry) => (
                      <div key={entry.version} className="flex items-center justify-between p-2 bg-green-50/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#435970]">v{entry.version}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 bg-green-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-green-500"
                              style={{ width: `${deviceData.byPlatform.android.devices > 0 ? (entry.count / deviceData.byPlatform.android.devices) * 100 : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-[#435970] w-8 text-right">{entry.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Engagement Summary */}
      {engagementData && (
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-[#435970] to-[#7895b3] rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#435970]">User Engagement Summary</h3>
              <p className="text-sm text-[#7895b3]">Medicine shots & weight logging activity across {engagementData.totalUsers} users</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Medicine Shots */}
            <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-100">
              <h4 className="text-sm font-semibold text-purple-800 mb-3">Medicine Shots</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-700">Logged at least 1 shot</span>
                  <span className="text-lg font-bold text-purple-800">{engagementData.medicine.usersWithAtLeastOne.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-purple-700">Never logged any shot</span>
                  <span className="text-lg font-bold text-purple-800">{engagementData.medicine.usersWithNone.toLocaleString()}</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${engagementData.totalUsers > 0 ? (engagementData.medicine.usersWithAtLeastOne / engagementData.totalUsers) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-purple-600">
                  {engagementData.totalUsers > 0 ? ((engagementData.medicine.usersWithAtLeastOne / engagementData.totalUsers) * 100).toFixed(1) : 0}% of users have logged at least 1 shot
                </p>
                <div className="pt-2 border-t border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">Total shots logged</span>
                    <span className="text-lg font-bold text-purple-800">{engagementData.medicine.totalShots.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weight Logs */}
            <div className="p-4 bg-teal-50/50 rounded-lg border border-teal-100">
              <h4 className="text-sm font-semibold text-teal-800 mb-3">Weight Logs</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-teal-700">Logged at least 1 weight</span>
                  <span className="text-lg font-bold text-teal-800">{engagementData.weight.usersWithAdditionalLog.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-teal-700">Never logged a weight</span>
                  <span className="text-lg font-bold text-teal-800">{engagementData.weight.usersWithNoAdditionalLog.toLocaleString()}</span>
                </div>
                <div className="w-full bg-teal-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-teal-500"
                    style={{ width: `${engagementData.totalUsers > 0 ? (engagementData.weight.usersWithAdditionalLog / engagementData.totalUsers) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-teal-600">
                  {engagementData.totalUsers > 0 ? ((engagementData.weight.usersWithAdditionalLog / engagementData.totalUsers) * 100).toFixed(1) : 0}% of users have logged at least 1 weight (excludes initial weight)
                </p>
                <div className="pt-2 border-t border-teal-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-teal-700">Total additional weight logs</span>
                    <span className="text-lg font-bold text-teal-800">{engagementData.weight.totalAdditionalLogs.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Status Pie Chart */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h3 className="text-lg font-bold text-[#435970] mb-4">User Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={userStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {userStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-3 bg-[#435970]/10 rounded-lg">
              <p className="text-2xl font-bold text-[#435970]">{data.users.active}</p>
              <p className="text-xs text-[#7895b3]">Active Users</p>
            </div>
            <div className="text-center p-3 bg-[#7895b3]/10 rounded-lg">
              <p className="text-2xl font-bold text-[#435970]">{data.users.inactive}</p>
              <p className="text-xs text-[#7895b3]">Inactive Users</p>
            </div>
          </div>
        </div>

        {/* Content Distribution Bar Chart */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h3 className="text-lg font-bold text-[#435970] mb-4">Content Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={contentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfedfb" />
              <XAxis dataKey="name" stroke="#7895b3" />
              <YAxis stroke="#7895b3" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #dfedfb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#435970" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Push Notifications Summary */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#435970]">Push Notifications Summary</h3>
            <Link href="/dashboard/push-logs" className="text-sm text-[#7895b3] hover:text-[#435970] font-medium">
              View Logs →
            </Link>
          </div>
          {notifData ? (
            <div className="space-y-4">
              {/* Total & Today */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-[#dfedfb]/40 rounded-lg">
                  <p className="text-2xl font-bold text-[#435970]">{notifData.pushLogs.total.toLocaleString()}</p>
                  <p className="text-xs text-[#7895b3]">Total Push Logs</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{notifData.pushLogs.today}</p>
                  <p className="text-xs text-blue-600">Sent Today</p>
                </div>
              </div>

              {/* Success Rate */}
              <div className="p-3 bg-[#dfedfb]/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#7895b3]">Success Rate</span>
                  <span className="text-sm font-bold text-[#435970]">{notifData.pushLogs.successRate}%</span>
                </div>
                <div className="w-full bg-[#dfedfb] rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${notifData.pushLogs.successRate}%` }}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#7895b3]">
                  <span>{notifData.pushLogs.sent.toLocaleString()} sent</span>
                  <span>{notifData.pushLogs.failed.toLocaleString()} failed</span>
                </div>
              </div>

              {/* By Source */}
              <div>
                <p className="text-sm font-medium text-[#435970] mb-2">By Source</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                      <span className="text-sm text-purple-700">Admin</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-700">{notifData.pushLogs.bySource.admin.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                      <span className="text-sm text-orange-700">Webhook</span>
                    </div>
                    <span className="text-sm font-semibold text-orange-700">{notifData.pushLogs.bySource.webhook.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-teal-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
                      <span className="text-sm text-teal-700">System</span>
                    </div>
                    <span className="text-sm font-semibold text-teal-700">{notifData.pushLogs.bySource.system.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-700">{data.notifications.totalViews}</p>
                  <p className="text-xs text-green-600">Total Views</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{data.notifications.totalReceivers.toLocaleString()}</p>
                  <p className="text-xs text-blue-600">Total Receivers</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Webhook Notifications Breakdown */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h3 className="text-lg font-bold text-[#435970] mb-4">Webhook Notifications</h3>
          {notifData ? (
            <div className="space-y-4">
              {/* Webhook Event Types */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-700">{notifData.webhooks.byEvent.orderStatus}</p>
                  <p className="text-xs text-blue-600">Order Status</p>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-lg">
                  <p className="text-2xl font-bold text-indigo-700">{notifData.webhooks.byEvent.subscriptionStatus}</p>
                  <p className="text-xs text-indigo-600">Subscription Status</p>
                </div>
              </div>

              {/* Order Status Breakdown */}
              {Object.keys(notifData.webhooks.orderStatuses).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#435970] mb-2">Order Statuses</p>
                  <div className="space-y-1.5">
                    {Object.entries(notifData.webhooks.orderStatuses).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between p-2 bg-[#dfedfb]/30 rounded-lg">
                        <span className="text-sm text-[#435970] capitalize">{status.replace(/-/g, ' ')}</span>
                        <span className="text-sm font-semibold text-[#435970]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subscription Status Breakdown */}
              {Object.keys(notifData.webhooks.subscriptionStatuses).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#435970] mb-2">Subscription Statuses</p>
                  <div className="space-y-1.5">
                    {Object.entries(notifData.webhooks.subscriptionStatuses).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between p-2 bg-[#dfedfb]/30 rounded-lg">
                        <span className="text-sm text-[#435970] capitalize">{status.replace(/-/g, ' ')}</span>
                        <span className="text-sm font-semibold text-[#435970]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notifData.webhooks.total === 0 && (
                <p className="text-sm text-[#7895b3] text-center py-4">No webhook notifications yet</p>
              )}

              {/* Scheduled Notifications */}
              {notifData.scheduled.total > 0 && (
                <div className="pt-3 border-t border-[#dfedfb]">
                  <p className="text-sm font-medium text-[#435970] mb-2">Scheduled Notifications</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-yellow-50 rounded-lg">
                      <p className="text-lg font-bold text-yellow-700">{notifData.scheduled.pending}</p>
                      <p className="text-xs text-yellow-600">Pending</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 rounded-lg">
                      <p className="text-lg font-bold text-green-700">{notifData.scheduled.sent}</p>
                      <p className="text-xs text-green-600">Sent</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded-lg">
                      <p className="text-lg font-bold text-red-700">{notifData.scheduled.failed}</p>
                      <p className="text-xs text-red-600">Failed</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-3 bg-[#dfedfb]/40 rounded-lg">
              <p className="text-2xl font-bold text-[#435970]">{data.notifications.total}</p>
              <p className="text-xs text-[#7895b3]">Total Notifications</p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medicines & Categories */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#435970]">Medicines</h3>
            <Link href="/dashboard/medicines" className="text-sm text-[#7895b3] hover:text-[#435970] font-medium">
              View →
            </Link>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#7895b3]">Total Medicines</span>
                <span className="text-lg font-bold text-[#435970]">{data.content.medicines}</span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div className="bg-[#435970] h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#7895b3]">Categories</span>
                <span className="text-lg font-bold text-[#435970]">{data.content.medicineCategories}</span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div className="bg-[#7895b3] h-2 rounded-full" style={{ width: `${Math.min(100, (data.content.medicineCategories / 10) * 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#7895b3]">Avg per Category</span>
                <span className="text-lg font-bold text-[#435970]">
                  {data.content.medicineCategories > 0 
                    ? (data.content.medicines / data.content.medicineCategories).toFixed(1) 
                    : '0'}
                </span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div className="bg-[#7895b3] h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Stats */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h3 className="text-lg font-bold text-[#435970] mb-4">Content Stats</h3>
          <div className="space-y-4">
            <Link href="/dashboard/blogs" className="block p-3 bg-[#dfedfb]/30 rounded-lg hover:bg-[#dfedfb]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#435970] rounded-lg">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-[#435970]">Blogs</span>
                </div>
                <span className="text-xl font-bold text-[#435970]">{data.content.blogs}</span>
              </div>
            </Link>
            <Link href="/dashboard/faqs" className="block p-3 bg-[#dfedfb]/30 rounded-lg hover:bg-[#dfedfb]/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#7895b3] rounded-lg">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-[#435970]">FAQs</span>
                </div>
                <span className="text-xl font-bold text-[#435970]">{data.content.faqs}</span>
              </div>
            </Link>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">Active FAQs</span>
                <span className="text-xl font-bold text-green-700">{data.content.activeFaqs}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h3 className="text-lg font-bold text-[#435970] mb-4">Today&apos;s Activity</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Weight Logs Today</p>
              <p className="text-3xl font-bold text-blue-700">{data.weightLogs.today}</p>
              <p className="text-xs text-blue-600 mt-1">{data.weightLogs.uniqueUsers} unique users</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700 mb-1">Avg Weight Loss</p>
              <p className="text-3xl font-bold text-purple-700">{data.weightLogs.avgWeightLoss} lbs</p>
              <p className="text-xs text-purple-600 mt-1">Per log entry</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#435970]">Recent User Activity</h3>
          <Link href="/dashboard/users" className="text-sm text-[#7895b3] hover:text-[#435970] font-medium">
            View All Users →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.users.recentUsers.length === 0 ? (
            <p className="col-span-5 text-center text-[#7895b3] py-8">No recent user activity</p>
          ) : (
            data.users.recentUsers.map((user) => (
              <div key={user.id} className="p-4 bg-[#dfedfb]/20 rounded-lg border border-[#dfedfb] hover:border-[#7895b3] transition-all">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#435970] to-[#7895b3] rounded-full flex items-center justify-center text-white font-bold text-lg mb-3">
                    {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <p className="text-sm font-semibold text-[#435970] mb-1 truncate w-full" title={user.name}>
                    {user.name}
                  </p>
                  <p className="text-xs text-[#7895b3] mb-2 truncate w-full" title={user.email}>
                    {user.email}
                  </p>
                  <span className="text-xs px-2 py-1 bg-[#435970] text-white rounded-full">
                    {user.lastLogin}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
