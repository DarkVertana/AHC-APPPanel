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

type MedicationLog = {
  id: string;
  medicineName: string;
  dosage: string;
  takenAt: string;
};

type MedicationWeek = {
  week: number;
  startDate: string;
  endDate: string;
  logs: MedicationLog[];
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
  const [medicationLogs, setMedicationLogs] = useState<MedicationWeek[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMedicationLogs, setLoadingMedicationLogs] = useState(false);
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

        // Fetch medication logs
        setLoadingMedicationLogs(true);
        try {
          const medResponse = await fetch(
            `/api/app-users/medication-log?email=${encodeURIComponent(foundUser.email)}`,
            {
              credentials: 'include',
            }
          );

          if (medResponse.ok) {
            const medData = await medResponse.json();
            setMedicationLogs(medData.weeks || []);
          }
        } catch (medError) {
          console.error('Error fetching medication logs:', medError);
        } finally {
          setLoadingMedicationLogs(false);
        }
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
        <h5 className="text-xl font-semibold text-[#435970] mb-6">Medication Log (Last 4 Weeks)</h5>
        {loadingMedicationLogs ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#435970]"></div>
            <p className="ml-3 text-[#7895b3]">Loading medication logs...</p>
          </div>
        ) : medicationLogs.length === 0 ? (
          <p className="text-sm text-[#7895b3] text-center py-8">
            No medication logs found for the last 4 weeks.
          </p>
        ) : (
          <div className="space-y-6">
            {medicationLogs.map((week) => (
              <div key={week.week} className="bg-[#dfedfb]/20 rounded-lg p-5 border border-[#dfedfb]">
                <div className="flex items-center justify-between mb-4">
                  <h6 className="text-base font-semibold text-[#435970]">
                    Week {week.week} (
                    {new Date(week.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    -{' '}
                    {new Date(week.endDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    )
                  </h6>
                  <span className="text-xs text-[#7895b3] bg-[#dfedfb] px-3 py-1 rounded-full">
                    {week.logs.length} {week.logs.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                {week.logs.length === 0 ? (
                  <p className="text-sm text-[#7895b3] italic text-center py-4">
                    No medication logged this week
                  </p>
                ) : (
                  <div className="space-y-3">
                    {week.logs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-white rounded-lg p-4 border border-[#dfedfb] hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-base font-semibold text-[#435970] mb-1">
                              {log.medicineName}
                            </p>
                            <p className="text-sm text-[#7895b3]">Dosage: {log.dosage}</p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-medium text-[#435970]">
                              {new Date(log.takenAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-[#7895b3] mt-1">
                              {new Date(log.takenAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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

