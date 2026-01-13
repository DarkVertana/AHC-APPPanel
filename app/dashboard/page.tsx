'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
  weight: string;
  goal: string;
  tasksToday?: number;
};

type DashboardStats = {
  activeUsersToday: number;
  totalUsers: number;
  dailyTasksCompleted: number;
  usersWithWeightGoals: number;
  weightGoalsPercentage: number;
};

type WeightTrackingUser = {
  user: string;
  current: string;
  goal: string;
  progress: number;
  trend: 'down' | 'up';
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeUsersToday: 0,
    totalUsers: 0,
    dailyTasksCompleted: 0,
    usersWithWeightGoals: 0,
    weightGoalsPercentage: 0,
  });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [weightTrackingUsers, setWeightTrackingUsers] = useState<WeightTrackingUser[]>([]);
  const [weightLogStats, setWeightLogStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    uniqueUsers: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch users data
        const usersResponse = await fetch('/api/app-users?limit=1000', {
          credentials: 'include',
        });
        const usersData = await usersResponse.json();

        // Fetch weight logs stats
        const weightLogsResponse = await fetch('/api/weight-logs?limit=1', {
          credentials: 'include',
        });
        const weightLogsData = await weightLogsResponse.json();

        // Calculate active users today (logged in last 24 hours)
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const activeUsersToday = usersData.users.filter((user: User) => {
          if (!user.lastLogin || user.lastLogin === 'Never') return false;
          // Parse "X minutes/hours/days ago" format
          const loginTime = parseTimeAgo(user.lastLogin);
          return loginTime && loginTime > yesterday;
        }).length;

        // Calculate users with weight goals
        const usersWithGoals = usersData.users.filter((user: User) => 
          user.weight !== 'N/A' && user.goal !== 'N/A' && user.weight && user.goal
        ).length;

        // Calculate daily tasks completed (sum of all users' tasksToday)
        const dailyTasksCompleted = usersData.users.reduce(
          (sum: number, user: User) => sum + (user.tasksToday || 0),
          0
        );

        // Calculate weight goals percentage
        const weightGoalsPercentage = usersData.stats.total > 0
          ? Math.round((usersWithGoals / usersData.stats.total) * 100)
          : 0;

        setStats({
          activeUsersToday,
          totalUsers: usersData.stats.total,
          dailyTasksCompleted,
          usersWithWeightGoals: usersWithGoals,
          weightGoalsPercentage,
        });

        // Get recent users (last 5 who logged in)
        const sortedUsers = [...usersData.users]
          .filter((user: User) => user.lastLogin !== 'Never')
          .sort((a: User, b: User) => {
            const timeA = parseTimeAgo(a.lastLogin);
            const timeB = parseTimeAgo(b.lastLogin);
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeB.getTime() - timeA.getTime();
          })
          .slice(0, 5);

        setRecentUsers(sortedUsers);

        // Get weight tracking users (users with weight and goal set)
        const weightUsers = usersData.users
          .filter((user: User) => 
            user.weight !== 'N/A' && 
            user.goal !== 'N/A' && 
            user.weight && 
            user.goal
          )
          .slice(0, 4)
          .map((user: User) => {
            const currentWeight = parseFloat(user.weight);
            const goalWeight = parseFloat(user.goal);
            const progress = goalWeight < currentWeight
              ? Math.max(0, Math.min(100, ((currentWeight - goalWeight) / (currentWeight - goalWeight + 10)) * 100))
              : Math.max(0, Math.min(100, ((goalWeight - currentWeight) / (goalWeight - currentWeight + 10)) * 100));
            
            return {
              user: user.name,
              current: `${user.weight} lbs`,
              goal: `${user.goal} lbs`,
              progress: Math.round(progress),
              trend: currentWeight > goalWeight ? 'down' : 'up',
            };
          });

        setWeightTrackingUsers(weightUsers);

        // Set weight log stats
        setWeightLogStats({
          totalLogs: weightLogsData.stats?.total || 0,
          todayLogs: weightLogsData.stats?.todayLogs || 0,
          uniqueUsers: weightLogsData.stats?.uniqueUsers || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Helper function to parse "time ago" format
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Users Today */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Today</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.activeUsersToday.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Active Users Today</p>
          <p className="text-xs text-[#7895b3] mt-1">Logged in last 24h</p>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Total</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.totalUsers.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Total Registered Users</p>
          <p className="text-xs text-[#7895b3] mt-1">All time</p>
        </div>

        {/* Daily Tasks Completed */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Today</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.dailyTasksCompleted.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Daily Tasks Completed</p>
          <div className="mt-3 w-full bg-[#dfedfb] rounded-full h-2">
            <div 
              className="bg-[#7895b3] h-2 rounded-full transition-all" 
              style={{ width: `${Math.min(100, (stats.dailyTasksCompleted / (stats.totalUsers || 1)) * 10)}%` }}
            ></div>
          </div>
        </div>

        {/* Weight Goals Tracking */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb] hover:border-[#7895b3] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#dfedfb] rounded-lg">
              <svg className="w-6 h-6 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#435970] bg-[#dfedfb] px-2 py-1 rounded">Active</span>
          </div>
          <h4 className="text-4xl font-bold text-[#435970] mb-1">{stats.usersWithWeightGoals.toLocaleString()}</h4>
          <p className="text-sm text-[#7895b3]">Users with Weight Goals</p>
          <p className="text-xs text-[#7895b3] mt-1">{stats.weightGoalsPercentage}% of total users</p>
        </div>
      </div>

      {/* User Monitoring Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent User Logins */}
        <div className="lg:col-span-2 bg-white rounded-lg p-6 border border-[#dfedfb]">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-[#435970]">Recent User Logins</h4>
            <Link 
              href="/dashboard/users"
              className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors font-medium"
            >
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-[#7895b3] text-center py-4">No recent logins</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-4 p-4 bg-[#dfedfb]/20 rounded-lg hover:bg-[#dfedfb]/40 transition-colors border border-[#dfedfb]">
                  <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#435970]">{user.name}</p>
                    <p className="text-xs text-[#7895b3] mt-0.5">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#7895b3]">{user.lastLogin}</p>
                    <span className="inline-block mt-1 w-2 h-2 bg-[#7895b3] rounded-full"></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Weight Goals Overview */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Weight Goals Overview</h4>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#435970]">Users with Goals</span>
                <span className="text-xs text-[#7895b3]">
                  {stats.usersWithWeightGoals.toLocaleString()} / {stats.totalUsers.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div
                  className="bg-[#7895b3] h-2 rounded-full transition-all"
                  style={{ width: `${stats.weightGoalsPercentage}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#435970]">Weight Logs Today</span>
                <span className="text-xs text-[#7895b3]">{weightLogStats.todayLogs} logs</span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div
                  className="bg-[#7895b3] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (weightLogStats.todayLogs / (stats.totalUsers || 1)) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#435970]">Total Weight Logs</span>
                <span className="text-xs text-[#7895b3]">{weightLogStats.totalLogs.toLocaleString()} entries</span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2">
                <div
                  className="bg-[#7895b3] h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (weightLogStats.totalLogs / (stats.totalUsers || 1) / 10) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Tasks & User Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Tasks Completion */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">Daily Tasks Completion</h4>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#435970]">Total Tasks Today</span>
                <span className="text-xs text-[#7895b3]">
                  {stats.dailyTasksCompleted.toLocaleString()} / {stats.totalUsers.toLocaleString()} users
                </span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2.5">
                <div
                  className="bg-[#7895b3] h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (stats.dailyTasksCompleted / (stats.totalUsers || 1)) * 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-[#7895b3] mt-1">
                {stats.totalUsers > 0 
                  ? `${Math.round((stats.dailyTasksCompleted / stats.totalUsers) * 100)}%` 
                  : '0%'} average per user
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#435970]">Weight Logs Today</span>
                <span className="text-xs text-[#7895b3]">
                  {weightLogStats.todayLogs} / {stats.totalUsers.toLocaleString()} users
                </span>
              </div>
              <div className="w-full bg-[#dfedfb] rounded-full h-2.5">
                <div
                  className="bg-[#7895b3] h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (weightLogStats.todayLogs / (stats.totalUsers || 1)) * 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-[#7895b3] mt-1">
                {stats.totalUsers > 0 
                  ? `${Math.round((weightLogStats.todayLogs / stats.totalUsers) * 100)}%` 
                  : '0%'} of users logged weight today
              </p>
            </div>
          </div>
        </div>

        {/* User Weight Tracking */}
        <div className="bg-white rounded-lg p-6 border border-[#dfedfb]">
          <h4 className="text-xl font-bold text-[#435970] mb-6">User Weight Tracking</h4>
          <div className="space-y-4">
            {weightTrackingUsers.length === 0 ? (
              <p className="text-sm text-[#7895b3] text-center py-4">No weight tracking data available</p>
            ) : (
              weightTrackingUsers.map((user, index) => (
                <div key={index} className="p-4 bg-[#dfedfb]/20 rounded-lg border border-[#dfedfb]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#435970]">{user.user}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      user.trend === 'down' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.trend === 'down' ? '↓' : '↑'} {user.trend === 'down' ? 'Losing' : 'Gaining'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#7895b3] mb-2">
                    <span>Current: {user.current}</span>
                    <span>Goal: {user.goal}</span>
                  </div>
                  <div className="w-full bg-[#dfedfb] rounded-full h-2">
                    <div
                      className="bg-[#7895b3] h-2 rounded-full transition-all"
                      style={{ width: `${user.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
