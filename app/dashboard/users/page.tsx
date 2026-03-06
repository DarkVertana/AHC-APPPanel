'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/app/components/ConfirmModal';

type User = {
  id: string;
  name: string;
  email: string;
  customerName?: string | null;
  status: string;
  lastLogin: string;
  weight: string;
  goal: string;
  joinDate: string;
  phone?: string;
  age?: number;
  height?: string;
  streak?: number;
};


export default function UsersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [inactiveCount, setInactiveCount] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }

      const response = await fetch(`/api/app-users?${params.toString()}`, {
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to fetch users (${response.status})`);
      }

      const data = await response.json();
      const fetchedUsers = data.users || [];
      setUsers(fetchedUsers);
      setTotalPages(data.pagination?.totalPages || 1);
      
      // Use stats from API if available, otherwise calculate from current page
      if (data.stats) {
        setTotal(data.stats.total || 0);
        setActiveCount(data.stats.active || 0);
        setInactiveCount(data.stats.inactive || 0);
      } else {
        // Fallback to calculating from current page
        setTotal(data.pagination?.total || 0);
        setActiveCount(fetchedUsers.filter((u: User) => u.status === 'Active').length);
        setInactiveCount(fetchedUsers.filter((u: User) => u.status === 'Inactive').length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleViewUser = (user: User) => {
    // Navigate to user details page using Next.js router (client-side navigation)
    router.push(`/dashboard/users/${user.id}`);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/app-users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to delete user (${response.status})`);
      }

      // Remove user from local state
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setTotal(prev => prev - 1);
      if (userToDelete.status === 'Active') {
        setActiveCount(prev => prev - 1);
      } else {
        setInactiveCount(prev => prev - 1);
      }

      // Close modal
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
          <p className="mt-4 text-[#7895b3]">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    const isUnauthorized = error.includes('401') || error.includes('Unauthorized');
    
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          {isUnauthorized && (
            <p className="text-sm text-[#7895b3] mb-4">
              Please make sure you are logged in as an admin.
            </p>
          )}
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">User Management</h3>
          <p className="text-[#7895b3]">Manage and monitor all registered users</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Users</p>
          <p className="text-2xl font-bold text-[#435970]">{total}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Active Now</p>
          <p className="text-2xl font-bold text-[#435970]">{activeCount}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Inactive</p>
          <p className="text-2xl font-bold text-[#435970]">{inactiveCount}</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Weight / Goal
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#7895b3]">
                    {loading ? 'Loading...' : 'No users found'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                <tr key={user.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-[#435970] rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                        {(user.customerName || user.name).split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#435970]">
                          {user.customerName || user.name}
                        </div>
                        <div className="text-sm text-[#7895b3]">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      user.status === 'Active'
                        ? 'bg-[#dfedfb] text-[#435970]'
                        : 'bg-[#dfedfb]/50 text-[#7895b3]'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[#435970]">
                      <span className="font-semibold">
                        {user.weight === 'N/A' ? 'N/A' : `${user.weight} lbs`}
                      </span>
                      <span className="text-[#7895b3]">
                        {user.goal !== 'N/A' ? ` / ${user.goal} lbs` : ' / N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7895b3]">
                    {user.lastLogin}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#7895b3]">
                    {new Date(user.joinDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-[#7895b3] hover:text-[#435970] transition-colors"
                        aria-label="View user"
                        title="View user details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="text-[#7895b3] hover:text-red-600 transition-colors"
                        aria-label="Delete user"
                        title="Delete user"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-between">
          <div className="text-sm text-[#7895b3]">
            Showing <span className="font-semibold text-[#435970]">{users.length > 0 ? (page - 1) * 50 + 1 : 0}</span> to{' '}
            <span className="font-semibold text-[#435970]">{(page - 1) * 50 + users.length}</span> of{' '}
            <span className="font-semibold text-[#435970]">{total}</span> users
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-[#7895b3]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete "${userToDelete?.name}" (${userToDelete?.email})? This will permanently delete all their data including weight logs and medication logs. This action cannot be undone.`}
        confirmText="Delete User"
        cancelText="Cancel"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

