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

export default function UserDetailsPage() {
  useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [medicationLogs, setMedicationLogs] = useState<MedicationWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMedicationLogs, setLoadingMedicationLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightUnit] = useState('lbs');

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
              {(user.height || user.feet) && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Height</p>
                  <p className="text-base font-medium text-[#435970]">
                    {user.feet ? user.feet : user.height || 'N/A'}
                    {user.feet && user.height && ` (${user.height})`}
                  </p>
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
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Current Weight</p>
                <p className="text-base font-medium text-[#435970]">
                  {formatWeight(user.weight, weightUnit)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#7895b3] mb-1">Goal Weight</p>
                <p className="text-base font-medium text-[#435970]">
                  {formatWeight(user.goal, weightUnit)}
                </p>
              </div>
              {user.totalWorkouts !== undefined && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Total Workouts</p>
                  <p className="text-base font-medium text-[#435970]">{user.totalWorkouts}</p>
                </div>
              )}
              {user.totalCalories !== undefined && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Total Calories Burned</p>
                  <p className="text-base font-medium text-[#435970]">
                    {user.totalCalories.toLocaleString()}
                  </p>
                </div>
              )}
              {user.streak !== undefined && (
                <div>
                  <p className="text-sm text-[#7895b3] mb-1">Current Streak</p>
                  <p className="text-base font-medium text-[#435970]">{user.streak} days</p>
                </div>
              )}
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
                  ? `${formatWeight(user.weight, weightUnit)} / ${formatWeight(user.goal, weightUnit)}`
                  : 'N/A'}
              </span>
            </div>
            {user.streak !== undefined && (
              <div className="flex justify-between items-center pb-3 border-b border-[#dfedfb]">
                <span className="text-sm text-[#7895b3]">Current Streak</span>
                <span className="text-sm font-medium text-[#435970]">{user.streak} days</span>
              </div>
            )}
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
    </div>
  );
}

