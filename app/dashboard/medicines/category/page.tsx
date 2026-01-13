'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';
import { getImageUrl } from '@/lib/image-utils';

type Category = {
  id: number;
  title: string;
  tagline: string | null;
  icon: string | null;
  medicineCount?: number;
};

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    icon: ''
  });
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/medicine-categories', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }

        const data = await response.json();
        setCategories(data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setNotification({
          title: 'Error',
          message: 'Failed to load categories',
          type: 'error',
        });
        setShowNotification(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({
      title: '',
      tagline: '',
      icon: ''
    });
    setIconPreview(null);
    setIconFile(null);
    setIsModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      title: category.title,
      tagline: category.tagline || '',
      icon: category.icon || ''
    });
    setIconPreview(category.icon || null);
    setIconFile(null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: number) => {
    setCategoryToDelete(id);
    setShowDeleteModal(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCategories(new Set(categories.map(c => c.id)));
    } else {
      setSelectedCategories(new Set());
    }
  };

  const handleSelectCategory = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedCategories);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedCategories(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCategories.size} category(ies)? Categories with medicines cannot be deleted. This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const response = await fetch('/api/medicine-categories/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedCategories) }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedCategories(new Set());
        setNotification({
          title: 'Success',
          message: data.message || `Successfully deleted ${selectedCategories.size} category(ies)`,
          type: 'success',
        });
        setShowNotification(true);
        // Refresh categories list
        const categoriesResponse = await fetch('/api/medicine-categories', {
          credentials: 'include',
        });
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }
      } else {
        const error = await response.json();
        let errorMessage = error.error || 'Failed to delete categories';
        if (error.cannotDelete && error.cannotDelete.length > 0) {
          errorMessage += `. Categories with medicines: ${error.cannotDelete.map((c: any) => c.title).join(', ')}`;
        }
        setNotification({
          title: 'Error',
          message: errorMessage,
          type: 'error',
        });
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      setNotification({
        title: 'Error',
        message: 'An error occurred while deleting categories',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    try {
      setDeletingId(categoryToDelete);
      setShowDeleteModal(false);
      const response = await fetch(`/api/medicine-categories/${categoryToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
      }

      // Remove from local state
      setCategories(categories.filter(cat => cat.id !== categoryToDelete));
      setNotification({
        title: 'Success',
        message: 'Category deleted successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (error) {
      console.error('Error deleting category:', error);
      setNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete category',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setDeletingId(null);
      setCategoryToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setNotification({
        title: 'Validation Error',
        message: 'Title is required',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    try {
      setSubmitting(true);

      let iconUrl = formData.icon;

      // If a new icon file is selected, upload it first
      if (iconFile) {
        const iconFormData = new FormData();
        iconFormData.append('icon', iconFile);

        const uploadResponse = await fetch('/api/medicine-categories/upload-icon', {
          method: 'POST',
          credentials: 'include',
          body: iconFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload icon');
        }

        const uploadData = await uploadResponse.json();
        iconUrl = uploadData.iconUrl;
      }

      const url = editingCategory 
        ? `/api/medicine-categories/${editingCategory.id}`
        : '/api/medicine-categories';
      
      const method = editingCategory ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title.trim(),
          tagline: formData.tagline.trim() || null,
          icon: iconUrl || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save category');
      }

      const data = await response.json();
      
      if (editingCategory) {
        // Update in local state
        setCategories(categories.map(cat =>
          cat.id === editingCategory.id
            ? { ...cat, title: data.category.title, tagline: data.category.tagline, icon: data.category.icon }
            : cat
        ));
      } else {
        // Add to local state
        setCategories([...categories, {
          id: data.category.id,
          title: data.category.title,
          tagline: data.category.tagline,
          icon: data.category.icon,
        }]);
      }

      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({
        title: '',
        tagline: '',
        icon: ''
      });
      setIconPreview(null);
      setIconFile(null);
      setNotification({
        title: 'Success',
        message: editingCategory ? 'Category updated successfully' : 'Category created successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (error) {
      console.error('Error saving category:', error);
      setNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save category',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({
      title: '',
      tagline: '',
      icon: ''
    });
    setIconPreview(null);
    setIconFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Medicine Categories</h3>
          <p className="text-[#7895b3]">Manage medicine categories with title and tagline</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Category
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Categories</p>
          <p className="text-2xl font-bold text-[#435970]">{categories.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Medicines</p>
          <p className="text-2xl font-bold text-[#435970]">
            {categories.reduce((sum, cat) => sum + (cat.medicineCount || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Recently Added</p>
          <p className="text-2xl font-bold text-[#435970] truncate">
            {categories.length > 0 ? categories[categories.length - 1].title : 'N/A'}
          </p>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCategories.size > 0 && (
        <div className="bg-[#435970] text-white rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedCategories.size} category(ies) selected</span>
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

      {/* Categories Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={categories.length > 0 && selectedCategories.size === categories.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Icon
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Tagline
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-[#435970] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                      <span className="ml-3 text-[#7895b3]">Loading categories...</span>
                    </div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-[#7895b3]">No categories found. Create your first category to get started.</p>
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedCategories.has(category.id)}
                        onChange={(e) => handleSelectCategory(category.id, e.target.checked)}
                        className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {category.icon ? (
                          <Image
                            src={getImageUrl(category.icon)}
                            alt={category.title}
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
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                  </svg>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-[#435970]">#{category.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#435970]">
                        {category.title}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#7895b3]">
                        {category.tagline || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <span className="text-sm text-[#435970]">
                          {category.medicineCount || 0} {category.medicineCount === 1 ? 'medicine' : 'medicines'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="text-[#7895b3] hover:text-[#435970] transition-colors p-1"
                            aria-label="Edit category"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(category.id)}
                            disabled={deletingId === category.id}
                            className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 p-1"
                            aria-label="Delete category"
                          >
                            {deletingId === category.id ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#435970]">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={closeModal}
                className="text-[#7895b3] hover:text-[#435970] transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-[#435970] mb-2">
                  Category Title *
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="Enter category title (e.g., Weight Loss)"
                />
              </div>

              {/* Tagline */}
              <div>
                <label htmlFor="tagline" className="block text-sm font-medium text-[#435970] mb-2">
                  Category Tagline
                </label>
                <input
                  type="text"
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="Enter category tagline (e.g., Achieve your weight loss goals)"
                />
              </div>

              {/* Category Icon Upload */}
              <div>
                <label htmlFor="icon" className="block text-sm font-medium text-[#435970] mb-2">
                  Category Icon
                </label>
                <input
                  type="file"
                  id="icon"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setIconFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const result = reader.result as string;
                        setIconPreview(result);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      // If no file selected, keep existing icon if editing
                      setIconFile(null);
                      if (editingCategory && formData.icon) {
                        setIconPreview(formData.icon);
                      } else {
                        setIconPreview(null);
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
                />
                {editingCategory && formData.icon && !iconPreview && (
                  <p className="text-xs text-[#7895b3] mt-1">
                    Current icon will be kept if no new icon is selected
                  </p>
                )}
                {(iconPreview || (editingCategory && formData.icon)) && (
                  <div className="mt-2 w-24 h-24 bg-[#dfedfb] rounded-lg overflow-hidden border border-[#dfedfb]">
                    <Image
                      src={iconPreview ? getImageUrl(iconPreview) : getImageUrl(formData.icon) || ''}
                      alt="Icon Preview"
                      width={96}
                      height={96}
                      className="object-cover w-full h-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setCategoryToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message="Are you sure you want to delete this category? This action cannot be undone."
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

