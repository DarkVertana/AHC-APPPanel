'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getImageUrl } from '@/lib/image-utils';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';

type Blog = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  featuredImage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function BlogsPage() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [selectedBlogs, setSelectedBlogs] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Fetch blogs from API
  const fetchBlogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/blogs', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch blogs');
      }
      
      const data = await response.json();
      setBlogs(data.blogs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching blogs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  const allTags = Array.from(new Set(blogs.flatMap(b => b.tags || [])));

  const filteredBlogs = blogs.filter(blog => {
    const matchesSearch = blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.tagline.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         blog.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (blog.tags && blog.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesSearch;
  });

  const handleDeleteClick = (id: string) => {
    setBlogToDelete(id);
    setShowDeleteModal(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBlogs(new Set(filteredBlogs.map(b => b.id)));
    } else {
      setSelectedBlogs(new Set());
    }
  };

  const handleSelectBlog = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedBlogs);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedBlogs(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedBlogs.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedBlogs.size} blog(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/blogs/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedBlogs) }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedBlogs(new Set());
        setNotification({
          title: 'Success',
          message: data.message || `Successfully deleted ${selectedBlogs.size} blog(s)`,
          type: 'success',
        });
        setShowNotification(true);
        await fetchBlogs();
      } else {
        const error = await response.json();
        setNotification({
          title: 'Error',
          message: error.error || 'Failed to delete blogs',
          type: 'error',
        });
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      setNotification({
        title: 'Error',
        message: 'An error occurred while deleting blogs',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!blogToDelete) return;

    try {
      setDeletingId(blogToDelete);
      setShowDeleteModal(false);
      const response = await fetch(`/api/blogs/${blogToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete blog');
      }

      // Refresh blogs list
      await fetchBlogs();
      setNotification({
        title: 'Success',
        message: 'Blog deleted successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (err) {
      setNotification({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to delete blog',
        type: 'error',
      });
      setShowNotification(true);
      console.error('Error deleting blog:', err);
    } finally {
      setDeletingId(null);
      setBlogToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg className="w-12 h-12 text-[#7895b3] animate-spin mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-[#7895b3]">Loading blogs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchBlogs}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Blog Posts</h3>
          <p className="text-[#7895b3]">Manage and monitor all blog posts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search blogs..."
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
          <Link
            href="/dashboard/blogs/add"
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Blog
          </Link>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Blogs</p>
          <p className="text-2xl font-bold text-[#435970]">{blogs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Tags</p>
          <p className="text-2xl font-bold text-[#435970]">{allTags.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Filtered Results</p>
          <p className="text-2xl font-bold text-[#435970]">{filteredBlogs.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Published</p>
          <p className="text-2xl font-bold text-[#435970]">{blogs.length}</p>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedBlogs.size > 0 && (
        <div className="bg-[#435970] text-white rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedBlogs.size} blog(s) selected</span>
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

      {/* Blogs Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={filteredBlogs.length > 0 && selectedBlogs.size === filteredBlogs.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Image
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  Title
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-28">
                  Tagline
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Tag
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {filteredBlogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-16 h-16 text-[#7895b3] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                      <p className="text-lg font-medium text-[#435970] mb-2">No blogs found</p>
                      <p className="text-sm text-[#7895b3] mb-4">
                        {searchTerm ? 'Try adjusting your search criteria' : 'Get started by creating your first blog post'}
                      </p>
                      {!searchTerm && (
                        <Link
                          href="/dashboard/blogs/add"
                          className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors inline-block"
                        >
                          Add First Blog
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBlogs.map((blog) => (
                  <tr key={blog.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedBlogs.has(blog.id)}
                        onChange={(e) => handleSelectBlog(blog.id, e.target.checked)}
                        className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-12 h-12 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {blog.featuredImage ? (
                          <Image
                            src={getImageUrl(blog.featuredImage)}
                            alt={blog.title}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                target.parentElement.innerHTML = `
                                  <svg class="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                  </svg>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-[#435970] truncate" title={blog.title}>
                        {blog.title}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-[#435970] truncate max-w-[112px]" title={blog.tagline}>
                        {blog.tagline}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div 
                        className="text-sm text-[#435970] truncate max-w-[96px]" 
                        title={blog.description.replace(/<[^>]*>/g, '').substring(0, 100)}
                      >
                        {blog.description.replace(/<[^>]*>/g, '').substring(0, 50)}
                        {blog.description.replace(/<[^>]*>/g, '').length > 50 && '...'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {blog.tags && blog.tags.length > 0 ? (
                          blog.tags.slice(0, 2).map((tag: string) => (
                            <span key={tag} className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded whitespace-nowrap">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[#7895b3]">No tags</span>
                        )}
                        {blog.tags && blog.tags.length > 2 && (
                          <span className="px-2 py-1 text-xs font-medium text-[#7895b3]">
                            +{blog.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-[#7895b3]">
                        {new Date(blog.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/blogs/edit/${blog.id}`}
                          className="text-[#7895b3] hover:text-[#435970] transition-colors"
                          aria-label="Edit blog"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(blog.id)}
                          disabled={deletingId === blog.id}
                          className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          aria-label="Delete blog"
                        >
                          {deletingId === blog.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
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
            Showing <span className="font-semibold text-[#435970]">1</span> to{' '}
            <span className="font-semibold text-[#435970]">{filteredBlogs.length}</span> of{' '}
            <span className="font-semibold text-[#435970]">{blogs.length}</span> blogs
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Previous
            </button>
            <button className="px-3 py-1 text-sm border border-[#dfedfb] rounded-lg text-[#435970] hover:bg-[#dfedfb] transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setBlogToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Blog"
        message="Are you sure you want to delete this blog? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={deletingId !== null}
      />

      {/* Notification Modal */}
      {notification && (
        <NotificationModal
          isOpen={showNotification}
          onClose={() => {
            setShowNotification(false);
            setNotification(null);
          }}
          title={notification.title}
          message={notification.message}
          type={notification.type}
          duration={3000}
        />
      )}
    </div>
  );
}

