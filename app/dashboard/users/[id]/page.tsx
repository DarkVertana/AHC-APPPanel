'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatWeight } from '@/lib/unit-utils';

type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
  weight: string;
  initialWeight: string;
  goal: string;
  tasksToday: number;
  joinDate: string;
  phone?: string;
  age?: number;
  height?: string;
  feet?: string;
  totalWorkouts?: number;
  totalCalories?: number;
  streak?: number;
  taskStatus?: {
    date: string;
    tasks: boolean[];
  };
  woocommerceCustomerId?: number;
};

type MedicationEntry = {
  id: string;
  medicationName: string;
  time: string;
};

type CheckInDay = {
  date: string;
  hasCheckIn: boolean;
  checkInCount: number;
  medications: MedicationEntry[];
};

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

export default function UserDetailsPage() {
  useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [checkInDays, setCheckInDays] = useState<CheckInDay[]>([]);
  const [checkInPeriod, setCheckInPeriod] = useState<'days' | 'weeks' | 'months'>('days');
  const [checkInOffset, setCheckInOffset] = useState(0);
  const [checkInStreak, setCheckInStreak] = useState(0);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [loadingWeightLogs, setLoadingWeightLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightLogsPagination, setWeightLogsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch user details from the admin API
        const response = await fetch(`/api/app-users?limit=1000`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user details');
        }

        const data = await response.json();
        const foundUser = data.users?.find((u: User) => u.id === userId);

        if (!foundUser) {
          setError('User not found');
          setLoading(false);
          return;
        }

        setUser(foundUser);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching user details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserDetails();
    }
  }, [userId]);

  // Fetch daily check-ins for this user
  useEffect(() => {
    const fetchCheckIns = async () => {
      if (!user) return;

      try {
        setLoadingCheckIns(true);

        // Map period to view parameter
        const viewMap = { days: 'days', weeks: 'weeks', months: 'month' };
        const view = viewMap[checkInPeriod];

        const response = await fetch(
          `/api/app-users/daily-checkin?userId=${user.id}&view=${view}&offset=${checkInOffset}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setCheckInDays(data.data || []);
          setCheckInStreak(data.statistics?.currentStreak || 0);
        }
      } catch (error) {
        console.error('Error fetching daily check-ins:', error);
      } finally {
        setLoadingCheckIns(false);
      }
    };

    fetchCheckIns();
  }, [user, checkInPeriod, checkInOffset]);

  // Reset offset when period changes
  useEffect(() => {
    setCheckInOffset(0);
  }, [checkInPeriod]);

  // Fetch weight logs for this user
  useEffect(() => {
    const fetchWeightLogs = async () => {
      if (!user) return;

      try {
        setLoadingWeightLogs(true);
        const params = new URLSearchParams({
          page: weightLogsPagination.page.toString(),
          limit: weightLogsPagination.limit.toString(),
          search: user.email, // Filter by user email
        });

        const response = await fetch(`/api/weight-logs?${params.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch weight logs');
        }

        const data = await response.json();
        setWeightLogs(data.logs || []);
        setWeightLogsPagination(data.pagination);
      } catch (error) {
        console.error('Error fetching weight logs:', error);
      } finally {
        setLoadingWeightLogs(false);
      }
    };

    fetchWeightLogs();
  }, [user, weightLogsPagination.page, weightLogsPagination.limit]);

  const handleWeightLogsPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= weightLogsPagination.totalPages) {
      setWeightLogsPagination({ ...weightLogsPagination, page: newPage });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
          <p className="mt-4 text-[#7895b3]">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'User not found'}</p>
          <Link
            href="/dashboard/users"
            className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors inline-block"
          >
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/users"
            className="text-[#7895b3] hover:text-[#435970] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h3 className="text-2xl font-bold text-[#435970] mb-1">User Details</h3>
            <p className="text-[#7895b3]">Comprehensive user information and activity</p>
          </div>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        <div className="flex items-center gap-6 pb-6 border-b border-[#dfedfb]">
          <div className="w-24 h-24 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-3xl">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1">
            <h4 className="text-3xl font-bold text-[#435970] mb-2">{user.name}</h4>
            <p className="text-[#7895b3] text-lg mb-3">{user.email}</p>
            <span
              className={`inline-flex px-4 py-2 text-sm font-medium rounded-full ${
                user.status === 'Active'
                  ? 'bg-[#dfedfb] text-[#435970]'
                  : 'bg-[#dfedfb]/50 text-[#7895b3]'
              }`}
            >
              {user.status}
            </span>
          </div>
        </div>

        {/* User Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h5 className="text-xl font-semibold text-[#435970] mb-4">Basic Information</h5>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Username</p>
                <p className="text-base font-medium text-[#435970]">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Email Address</p>
                <p className="text-base font-medium text-[#435970]">{user.email}</p>
              </div>
              {user.phone && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Phone Number</p>
                  <p className="text-base font-medium text-[#435970]">{user.phone}</p>
                </div>
              )}
              {user.age && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Age</p>
                  <p className="text-base font-medium text-[#435970]">{user.age} years</p>
                </div>
              )}
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Join Date</p>
                <p className="text-base font-medium text-[#435970]">
                  {new Date(user.joinDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {user.woocommerceCustomerId && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">WooCommerce Customer ID</p>
                  <p className="text-base font-medium text-[#435970]">
                    #{user.woocommerceCustomerId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Fitness Information */}
          <div className="space-y-4">
            <h5 className="text-xl font-semibold text-[#435970] mb-4">Fitness Information</h5>
            <div className="space-y-4">
              {(user.height || user.feet) && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Height</p>
                  <p className="text-base font-medium text-[#435970]">
                    {user.feet || user.height || 'N/A'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Starting Weight</p>
                <p className="text-base font-medium text-[#435970]">
                  {formatWeight(user.initialWeight)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Current Weight</p>
                <p className="text-base font-medium text-[#435970]">
                  {formatWeight(user.weight)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Goal Weight</p>
                <p className="text-base font-medium text-[#435970]">
                  {formatWeight(user.goal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Task Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Information */}
        <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
          <h5 className="text-xl font-semibold text-[#435970] mb-4">Activity Information</h5>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-[#dfedfb]/20 rounded-lg p-4 border border-[#dfedfb]">
              <p className="text-sm text-[#7895b3] mb-1">Tasks Today</p>
              <p className="text-3xl font-bold text-[#435970]">{user.tasksToday}</p>
              {user.taskStatus && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-[#7895b3]">Task Status ({user.taskStatus.date}):</p>
                  <div className="flex gap-2">
                    {user.taskStatus.tasks.map((completed, index) => (
                      <div
                        key={index}
                        className={`flex-1 h-2 rounded-full ${
                          completed ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={`Task ${index + 1}: ${completed ? 'Completed' : 'Pending'}`}
                      ></div>
                    ))}
                  </div>
                  <p className="text-xs text-[#7895b3] mt-1">
                    {user.taskStatus.tasks.filter(Boolean).length} of 3 tasks completed
                  </p>
                </div>
              )}
            </div>
            <div className="bg-[#dfedfb]/20 rounded-lg p-4 border border-[#dfedfb]">
              <p className="text-sm text-[#7895b3] mb-1">Last Login</p>
              <p className="text-base font-medium text-[#435970]">{user.lastLogin}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
          <h5 className="text-xl font-semibold text-[#435970] mb-4">Quick Stats</h5>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#dfedfb]">
              <span className="text-sm text-[#7895b3]">Status</span>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  user.status === 'Active'
                    ? 'bg-[#dfedfb] text-[#435970]'
                    : 'bg-[#dfedfb]/50 text-[#7895b3]'
                }`}
              >
                {user.status}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-[#dfedfb]">
              <span className="text-sm text-[#7895b3]">Weight Progress</span>
              <span className="text-sm font-medium text-[#435970]">
                {user.weight !== 'N/A' && user.goal !== 'N/A'
                  ? `${formatWeight(user.weight)} / ${formatWeight(user.goal)}`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#7895b3]">Member Since</span>
              <span className="text-sm font-medium text-[#435970]">
                {new Date(user.joinDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Medication Log Section */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        {/* Header with View Toggle and Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h5 className="text-xl font-semibold text-[#435970]">Medication Log</h5>
            {checkInStreak > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                {checkInStreak} day streak
              </span>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-[#dfedfb]/50 rounded-lg p-0.5">
              {(['days', 'weeks', 'months'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setCheckInPeriod(period)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    checkInPeriod === period
                      ? 'bg-white text-[#435970] shadow-sm'
                      : 'text-[#7895b3] hover:text-[#435970]'
                  }`}
                >
                  {period === 'days' ? 'Week' : period === 'weeks' ? '4 Weeks' : 'Month'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#dfedfb]">
          <button
            onClick={() => setCheckInOffset(checkInOffset + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Older
          </button>
          <span className="text-sm font-medium text-[#435970]">
            {checkInDays.length > 0 && (
              checkInPeriod === 'months' ? (
                // Month view - show month name
                new Date(checkInDays[0]?.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              ) : (
                // Days/Weeks view - show date range
                <>
                  {new Date(checkInDays[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' - '}
                  {new Date(checkInDays[checkInDays.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </>
              )
            )}
          </span>
          <button
            onClick={() => setCheckInOffset(Math.max(0, checkInOffset - 1))}
            disabled={checkInOffset === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Newer
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loadingCheckIns ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#435970]"></div>
            <p className="ml-2 text-sm text-[#7895b3]">Loading...</p>
          </div>
        ) : checkInDays.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-[#7895b3]">No medication logs found.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {[...checkInDays].reverse().map((day) => {
              const date = new Date(day.date);
              const isToday = day.date === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={day.date}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-all ${
                    day.hasCheckIn ? 'bg-green-50' : 'hover:bg-[#dfedfb]/20'
                  } ${isToday ? 'ring-1 ring-[#435970]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      day.hasCheckIn ? 'bg-green-500' : 'bg-gray-200'
                    }`}>
                      {day.hasCheckIn ? (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${day.hasCheckIn ? 'text-green-700' : 'text-[#7895b3]'}`}>
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {isToday && <span className="ml-2 text-xs text-[#435970]">(Today)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {day.hasCheckIn && day.medications.length > 0 ? (
                      day.medications.map((med) => (
                        <div key={med.id} className="flex items-center gap-2">
                          <span className="text-xs text-[#435970] font-medium bg-[#dfedfb] px-2 py-0.5 rounded">
                            {med.medicationName === 'default' ? 'Check-in' : med.medicationName}
                          </span>
                          <span className="text-xs text-green-600 font-medium">
                            {new Date(med.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-[#7895b3]">-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Summary Footer */}
        {checkInDays.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#dfedfb] flex items-center justify-between">
            <span className="text-xs text-[#7895b3]">
              {checkInDays.filter(d => d.hasCheckIn).length} of {checkInDays.length} days logged
            </span>
            <div className="flex gap-0.5">
              {checkInDays.map((day, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${day.hasCheckIn ? 'bg-green-500' : 'bg-gray-200'}`}
                  title={day.date}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Weight Log Data Section */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        <h5 className="text-xl font-semibold text-[#435970] mb-6">Weight Log Data</h5>
        {loadingWeightLogs ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
            <p className="ml-3 text-[#7895b3]">Loading weight logs...</p>
          </div>
        ) : weightLogs.length === 0 ? (
          <p className="text-sm text-[#7895b3] text-center py-8">
            No weight logs found. Weight logs will appear here when the user submits data from the app.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#dfedfb]">
                  <tr>
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
                  {weightLogs
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-[#dfedfb]/20 transition-colors">
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
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {weightLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#dfedfb] flex items-center justify-between">
                <div className="text-sm text-[#7895b3]">
                  Showing <span className="font-semibold text-[#435970]">
                    {((weightLogsPagination.page - 1) * weightLogsPagination.limit) + 1}
                  </span> to{' '}
                  <span className="font-semibold text-[#435970]">
                    {Math.min(weightLogsPagination.page * weightLogsPagination.limit, weightLogsPagination.total)}
                  </span> of{' '}
                  <span className="font-semibold text-[#435970]">{weightLogsPagination.total}</span> logs
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleWeightLogsPageChange(weightLogsPagination.page - 1)}
                    disabled={weightLogsPagination.page === 1}
                    className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-[#7895b3]">
                    Page {weightLogsPagination.page} of {weightLogsPagination.totalPages}
                  </span>
                  <button
                    onClick={() => handleWeightLogsPageChange(weightLogsPagination.page + 1)}
                    disabled={weightLogsPagination.page >= weightLogsPagination.totalPages}
                    className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

