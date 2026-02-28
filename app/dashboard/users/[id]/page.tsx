'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatWeight } from '@/lib/unit-utils';

type User = {
  id: string;
  name: string;
  email: string;
  customerName?: string | null;
  status: string;
  lastLogin: string;
  weight: string;
  initialWeight: string;
  goal: string;
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
  nextDate?: string | null;
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

type UserDevice = {
  id: string;
  deviceId: string;
  platform: string;
  deviceName: string | null;
  appVersion: string | null;
  lastActiveAt: string;
  createdAt: string;
};

export default function UserDetailsPage() {
  useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [checkInDays, setCheckInDays] = useState<CheckInDay[]>([]);
  const [checkInPeriod, setCheckInPeriod] = useState<'days' | 'weeks' | 'months'>('months');
  const [checkInOffset, setCheckInOffset] = useState(0);
  const [checkInStreak, setCheckInStreak] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [userDevices, setUserDevices] = useState<UserDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
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

  // Fetch devices for this user
  useEffect(() => {
    const fetchDevices = async () => {
      if (!user) return;

      try {
        setLoadingDevices(true);
        const response = await fetch(`/api/app-users/${user.id}/devices`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUserDevices(data.devices || []);
        }
      } catch (error) {
        console.error('Error fetching user devices:', error);
      } finally {
        setLoadingDevices(false);
      }
    };

    fetchDevices();
  }, [user]);

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
            {(user.customerName || user.name).split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="flex-1">
            <h4 className="text-3xl font-bold text-[#435970] mb-1">
              {user.customerName || user.name}
            </h4>
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
              {user.customerName && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Customer Name</p>
                  <p className="text-base font-medium text-[#435970]">{user.customerName}</p>
                </div>
              )}
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

      {/* Activity & Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Information */}
        <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
          <h5 className="text-xl font-semibold text-[#435970] mb-4">Activity Information</h5>
          <div className="grid grid-cols-1 gap-4">
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

      {/* Registered Devices */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h5 className="text-xl font-semibold text-[#435970]">Registered Devices</h5>
            <span className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded-full">
              {userDevices.length} device{userDevices.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loadingDevices ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
            <p className="ml-3 text-[#7895b3]">Loading devices...</p>
          </div>
        ) : userDevices.length === 0 ? (
          <p className="text-sm text-[#7895b3] text-center py-8">
            No registered devices found. Devices will appear here when the user logs in from the app.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userDevices.map((device) => {
              const name = (device.deviceName || '').toLowerCase();
              const isIpad = name.includes('ipad');
              const isIphone = device.platform === 'ios' && !isIpad;
              const isAndroidTablet = device.platform === 'android' && (name.includes('tablet') || name.includes('tab') || name.includes('pad') || name.includes('sm-t') || name.includes('sm-x'));

              let deviceLabel = 'Android Phone';
              if (isIphone) deviceLabel = 'iPhone';
              else if (isIpad) deviceLabel = 'iPad';
              else if (isAndroidTablet) deviceLabel = 'Android Tablet';

              return (
                <div key={device.id} className="border border-[#dfedfb] rounded-lg p-4 hover:border-[#7895b3] transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${device.platform === 'ios' ? 'bg-blue-50' : 'bg-green-50'}`}>
                      {device.platform === 'ios' ? (
                        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.523 15.342l1.592 2.756c.186.322.072.735-.25.921-.323.186-.735.072-.921-.25l-1.614-2.795c-1.206.534-2.544.83-3.951.83-1.406 0-2.745-.296-3.95-.83l-1.614 2.795c-.186.322-.599.436-.921.25-.322-.186-.436-.599-.25-.921l1.592-2.756C4.594 13.946 2.75 11.363 2.75 8.332h18.5c0 3.031-1.844 5.614-4.727 7.01zM7.5 11.332c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1zm9 0c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1zM15.607 2.368l1.346-1.346c.195-.195.195-.512 0-.707-.195-.195-.512-.195-.707 0l-1.483 1.483C13.845 1.322 12.836 1.082 12 1.082s-1.845.24-2.763.716L7.754.315c-.195-.195-.512-.195-.707 0-.195.195-.195.512 0 .707l1.346 1.346C6.676 3.55 5.75 5.787 5.75 8.332h12.5c0-2.545-.926-4.782-2.643-5.964z"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#435970] truncate">
                          {device.deviceName || deviceLabel}
                        </p>
                        <span className={`flex-shrink-0 inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          device.platform === 'ios' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {deviceLabel}
                        </span>
                      </div>
                      {device.appVersion && (
                        <p className="text-xs text-[#7895b3] mb-1">App v{device.appVersion}</p>
                      )}
                      <p className="text-xs text-[#7895b3]">
                        Last active: {new Date(device.lastActiveAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-[#7895b3]/60 mt-1">
                        Registered: {new Date(device.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Medication Log Section - Calendar + List View */}
      <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
        {/* Header */}
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
          <div className="text-sm text-[#7895b3]">
            {checkInDays.filter(d => d.hasCheckIn).length} of {checkInDays.length} days logged
          </div>
        </div>

        {loadingCheckIns ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
            <p className="ml-3 text-[#7895b3]">Loading medication logs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar View */}
            <div className="border border-[#dfedfb] rounded-lg p-4">
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCheckInOffset(checkInOffset + 1)}
                  className="p-2 text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-base font-semibold text-[#435970]">
                  {checkInDays.length > 0 && new Date(checkInDays[0]?.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCheckInOffset(Math.max(0, checkInOffset - 1))}
                  disabled={checkInOffset === 0}
                  className="p-2 text-[#7895b3] hover:text-[#435970] hover:bg-[#dfedfb]/30 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day Names Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-[#7895b3] py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  if (checkInDays.length === 0) return null;

                  // Get the first day of the month to calculate offset
                  const firstDate = new Date(checkInDays[0]?.date);
                  const startDayOfWeek = firstDate.getDay();

                  // Create map for quick lookup
                  const checkInMap = new Map(checkInDays.map(d => [d.date, d]));

                  // Generate empty cells for days before the month starts
                  const emptyCells = Array.from({ length: startDayOfWeek }, (_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ));

                  // Generate calendar days
                  const dayCells = checkInDays.map((day) => {
                    const date = new Date(day.date);
                    const dayNum = date.getDate();
                    const isToday = day.date === new Date().toISOString().split('T')[0];
                    const isSelected = day.date === selectedDate;

                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative ${
                          isSelected
                            ? 'bg-[#435970] text-white'
                            : isToday
                            ? 'bg-[#dfedfb] text-[#435970] ring-2 ring-[#435970]'
                            : day.hasCheckIn
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'hover:bg-[#dfedfb]/30 text-[#435970]'
                        }`}
                      >
                        <span className={`font-medium ${isSelected ? 'text-white' : ''}`}>{dayNum}</span>
                        {day.hasCheckIn && (
                          <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isSelected ? 'bg-white' : 'bg-green-500'
                          }`} />
                        )}
                        {day.checkInCount > 1 && (
                          <span className={`absolute top-0.5 right-0.5 text-[9px] font-bold ${
                            isSelected ? 'text-white/80' : 'text-green-600'
                          }`}>
                            {day.checkInCount}
                          </span>
                        )}
                      </button>
                    );
                  });

                  return [...emptyCells, ...dayCells];
                })()}
              </div>

              {/* Calendar Legend */}
              <div className="mt-4 pt-3 border-t border-[#dfedfb] flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span className="text-[#7895b3]">Logged</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-[#dfedfb] ring-2 ring-[#435970]"></div>
                  <span className="text-[#7895b3]">Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-[#435970]"></div>
                  <span className="text-[#7895b3]">Selected</span>
                </div>
              </div>
            </div>

            {/* Detailed List View */}
            <div className="border border-[#dfedfb] rounded-lg p-4">
              <h6 className="text-sm font-semibold text-[#435970] mb-3">
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  : 'Recent Activity'
                }
              </h6>

              {selectedDate ? (
                // Show selected date details
                (() => {
                  const dayData = checkInDays.find(d => d.date === selectedDate);
                  if (!dayData) return <p className="text-sm text-[#7895b3]">No data for this date.</p>;

                  return (
                    <div className="space-y-3">
                      {dayData.hasCheckIn && dayData.medications.length > 0 ? (
                        dayData.medications.map((med) => (
                          <div key={med.id} className="bg-green-50 rounded-lg p-3 border border-green-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-green-700">
                                {med.medicationName === 'default' ? 'Daily Check-in' : med.medicationName}
                              </span>
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                {new Date(med.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {med.nextDate && (
                              <div className="text-xs text-[#7895b3] flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Next: {new Date(med.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <p className="text-sm text-[#7895b3]">No medications logged on this date</p>
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedDate(null)}
                        className="w-full mt-2 text-xs text-[#7895b3] hover:text-[#435970] transition-colors"
                      >
                        Show all recent activity
                      </button>
                    </div>
                  );
                })()
              ) : (
                // Show recent activity list
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {[...checkInDays]
                    .filter(d => d.hasCheckIn)
                    .reverse()
                    .slice(0, 10)
                    .map((day) => {
                      const date = new Date(day.date);
                      const isToday = day.date === new Date().toISOString().split('T')[0];

                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDate(day.date)}
                          className="w-full flex items-center justify-between py-2 px-3 rounded-lg bg-green-50 hover:bg-green-100 transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-700">
                                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {isToday && <span className="ml-1 text-xs text-[#435970]">(Today)</span>}
                              </p>
                              <p className="text-xs text-[#7895b3]">
                                {day.checkInCount} medication{day.checkInCount > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}

                  {checkInDays.filter(d => d.hasCheckIn).length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-sm text-[#7895b3]">No medication logs this month</p>
                      <p className="text-xs text-[#7895b3] mt-1">Logs will appear when the user checks in from the app</p>
                    </div>
                  )}
                </div>
              )}
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

