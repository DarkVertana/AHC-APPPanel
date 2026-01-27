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

type DailyCheckIn = {
  id: string;
  date: string;
  buttonType: string;
  time: string;
};

type DayData = {
  date: string;
  dayOfWeek: string;
  checkIns: { id: string; buttonType: string; time: string }[];
  hasCheckIn: boolean;
};

type WeekData = {
  week: number;
  startDate: string;
  endDate: string;
  checkIns: DailyCheckIn[];
  totalDays: number;
};

type MonthData = {
  month: string;
  monthName: string;
  checkIns: DailyCheckIn[];
  totalDays: number;
};

type CheckInStats = {
  totalCheckIns: number;
  currentStreak: number;
  checkedInToday: boolean;
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
  const [checkInData, setCheckInData] = useState<DayData[] | WeekData[] | MonthData[]>([]);
  const [checkInStats, setCheckInStats] = useState<CheckInStats | null>(null);
  const [checkInPeriod, setCheckInPeriod] = useState<'days' | 'weeks' | 'months'>('days');
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
        const response = await fetch(
          `/api/app-users/${user.id}/daily-checkins?period=${checkInPeriod}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          setCheckInData(data.data || []);
          setCheckInStats(data.statistics || null);
        }
      } catch (error) {
        console.error('Error fetching daily check-ins:', error);
      } finally {
        setLoadingCheckIns(false);
      }
    };

    fetchCheckIns();
  }, [user, checkInPeriod]);

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

      {/* Daily Check-In Tracker Section */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h5 className="text-xl font-semibold text-[#435970]">Daily Check-In Tracker</h5>
            <p className="text-sm text-[#7895b3] mt-1">Track medication adherence over time</p>
          </div>

          {/* Period Selector */}
          <div className="flex bg-[#dfedfb]/30 rounded-lg p-1">
            {(['days', 'weeks', 'months'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setCheckInPeriod(period)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  checkInPeriod === period
                    ? 'bg-[#435970] text-white shadow-sm'
                    : 'text-[#7895b3] hover:text-[#435970]'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Statistics Cards */}
        {checkInStats && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#435970] to-[#5a7a96] rounded-lg p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
                <span className="text-xs font-medium opacity-80">Current Streak</span>
              </div>
              <p className="text-3xl font-bold">{checkInStats.currentStreak}</p>
              <p className="text-xs opacity-70 mt-1">consecutive days</p>
            </div>

            <div className="bg-gradient-to-br from-[#7895b3] to-[#96afc9] rounded-lg p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-medium opacity-80">Total Check-Ins</span>
              </div>
              <p className="text-3xl font-bold">{checkInStats.totalCheckIns}</p>
              <p className="text-xs opacity-70 mt-1">in selected period</p>
            </div>

            <div className={`rounded-lg p-4 text-white ${
              checkInStats.checkedInToday
                ? 'bg-gradient-to-br from-green-500 to-green-600'
                : 'bg-gradient-to-br from-orange-400 to-orange-500'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium opacity-80">Today</span>
              </div>
              <p className="text-xl font-bold">
                {checkInStats.checkedInToday ? 'Checked In' : 'Not Yet'}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {checkInStats.checkedInToday ? 'Great job!' : 'Pending check-in'}
              </p>
            </div>
          </div>
        )}

        {/* Check-In Data Display */}
        {loadingCheckIns ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
            <p className="ml-3 text-[#7895b3]">Loading check-in data...</p>
          </div>
        ) : checkInData.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-[#dfedfb] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-[#7895b3]">No check-in data found for this period.</p>
            <p className="text-sm text-[#7895b3]/70 mt-1">Check-ins will appear here when the user logs their medication.</p>
          </div>
        ) : checkInPeriod === 'days' ? (
          /* Calendar Grid View for Days */
          <div className="space-y-4">
            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-xs font-medium text-[#7895b3] py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {(checkInData as DayData[]).slice(0, 28).reverse().map((day, index) => {
                const date = new Date(day.date);
                const isToday = day.date === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={day.date}
                    className={`relative aspect-square rounded-lg border transition-all ${
                      day.hasCheckIn
                        ? 'bg-green-50 border-green-200 hover:border-green-400'
                        : 'bg-[#dfedfb]/10 border-[#dfedfb] hover:border-[#7895b3]'
                    } ${isToday ? 'ring-2 ring-[#435970] ring-offset-1' : ''}`}
                    title={`${day.date}: ${day.hasCheckIn ? `${day.checkIns.length} check-in(s)` : 'No check-in'}`}
                  >
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                      <span className={`text-xs font-medium ${
                        day.hasCheckIn ? 'text-green-700' : 'text-[#7895b3]'
                      }`}>
                        {date.getDate()}
                      </span>
                      {day.hasCheckIn && (
                        <svg className="w-4 h-4 text-green-500 mt-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Check-Ins List */}
            <div className="mt-6 pt-6 border-t border-[#dfedfb]">
              <h6 className="text-sm font-semibold text-[#435970] mb-4">Recent Check-Ins</h6>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(checkInData as DayData[])
                  .filter(d => d.hasCheckIn)
                  .slice(0, 10)
                  .map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between bg-[#dfedfb]/20 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#435970]">
                            {new Date(day.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-[#7895b3]">
                            {day.checkIns.length} check-in{day.checkIns.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#7895b3]">
                          {new Date(day.checkIns[0].time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : checkInPeriod === 'weeks' ? (
          /* Week View */
          <div className="space-y-4">
            {(checkInData as WeekData[]).map((week) => (
              <div
                key={week.week}
                className="bg-[#dfedfb]/20 rounded-lg p-5 border border-[#dfedfb]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h6 className="text-base font-semibold text-[#435970]">
                      Week {week.week}
                    </h6>
                    <p className="text-sm text-[#7895b3]">
                      {new Date(week.startDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })} - {new Date(week.endDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${
                        week.totalDays >= 5 ? 'text-green-600' : week.totalDays >= 3 ? 'text-orange-500' : 'text-[#7895b3]'
                      }`}>
                        {week.totalDays}/7
                      </span>
                      <span className="text-sm text-[#7895b3]">days</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${
                            i < week.totalDays ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      week.totalDays >= 5 ? 'bg-green-500' : week.totalDays >= 3 ? 'bg-orange-400' : 'bg-gray-400'
                    }`}
                    style={{ width: `${(week.totalDays / 7) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Month View */
          <div className="space-y-4">
            {(checkInData as MonthData[]).map((month) => {
              const daysInMonth = new Date(
                parseInt(month.month.split('-')[0]),
                parseInt(month.month.split('-')[1]),
                0
              ).getDate();
              const percentage = Math.round((month.totalDays / daysInMonth) * 100);

              return (
                <div
                  key={month.month}
                  className="bg-[#dfedfb]/20 rounded-lg p-5 border border-[#dfedfb]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h6 className="text-lg font-semibold text-[#435970]">
                        {month.monthName}
                      </h6>
                      <p className="text-sm text-[#7895b3]">
                        {month.checkIns.length} total check-ins
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-bold ${
                          percentage >= 70 ? 'text-green-600' : percentage >= 50 ? 'text-orange-500' : 'text-[#7895b3]'
                        }`}>
                          {month.totalDays}
                        </span>
                        <span className="text-lg text-[#7895b3]">/{daysInMonth}</span>
                      </div>
                      <p className="text-sm text-[#7895b3]">{percentage}% adherence</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-orange-400' : 'bg-gray-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <p className="text-xs text-[#7895b3] mt-2">
                    {percentage >= 70 ? 'Excellent adherence!' : percentage >= 50 ? 'Good progress, keep it up!' : 'Room for improvement'}
                  </p>
                </div>
              );
            })}
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

