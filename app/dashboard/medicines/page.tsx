'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import ConfirmModal from '@/app/components/ConfirmModal';
import NotificationModal from '@/app/components/NotificationModal';
import RichTextEditor from '@/app/components/RichTextEditor';

type Category = {
  id: number;
  title: string;
  tagline: string | null;
};

type Medicine = {
  id: string;
  categoryId: number;
  category: {
    id: number;
    title: string;
    tagline: string | null;
  };
  title: string;
  tagline: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  price: number | null;
  status: string;
};

export default function MedicinesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [medicineToDelete, setMedicineToDelete] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Fetch categories and medicines
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch categories
        const categoriesResponse = await fetch('/api/medicine-categories', {
          credentials: 'include',
        });
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }

        // Fetch medicines
        const medicinesResponse = await fetch('/api/medicines', {
          credentials: 'include',
        });
        if (medicinesResponse.ok) {
          const medicinesData = await medicinesResponse.json();
          setMedicines(medicinesData.medicines || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setNotification({
          title: 'Error',
          message: 'Failed to load data',
          type: 'error',
        });
        setShowNotification(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Read category from URL params on mount and when params change
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      const categoryId = parseInt(categoryParam);
      if (!isNaN(categoryId)) {
        setSelectedCategory(categoryId);
      } else {
        setSelectedCategory('All');
      }
    } else {
      setSelectedCategory('All');
    }
  }, [searchParams]);

  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [formData, setFormData] = useState({
    categoryId: '',
    title: '',
    tagline: '',
    description: '',
    image: '',
    url: '',
    price: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const filteredMedicines = medicines.filter(medicine => {
    const matchesSearch = medicine.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (medicine.tagline && medicine.tagline.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (medicine.description && medicine.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || medicine.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    setEditingMedicine(null);
    setFormData({
      categoryId: '',
      title: '',
      tagline: '',
      description: '',
      image: '',
      url: '',
      price: ''
    });
    setImagePreview(null);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    const existingImage = medicine.image || '';
    setFormData({
      categoryId: medicine.categoryId.toString(),
      title: medicine.title,
      tagline: medicine.tagline || '',
      description: medicine.description || '',
      image: existingImage,
      url: medicine.url || '',
      price: medicine.price?.toString() || ''
    });
    setImagePreview(existingImage || null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setMedicineToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!medicineToDelete) return;

    try {
      setDeletingId(medicineToDelete);
      setShowDeleteModal(false);
      const response = await fetch(`/api/medicines/${medicineToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete medicine');
      }

      // Remove from local state
      setMedicines(medicines.filter(m => m.id !== medicineToDelete));
      setNotification({
        title: 'Success',
        message: 'Medicine deleted successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (error) {
      console.error('Error deleting medicine:', error);
      setNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete medicine',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setDeletingId(null);
      setMedicineToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.categoryId || !formData.title.trim()) {
      setNotification({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    // If creating new medicine, image is required
    if (!editingMedicine && !imageFile) {
      setNotification({
        title: 'Validation Error',
        message: 'Please select an image',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    // If editing and no image file selected, keep existing image
    if (editingMedicine && !imageFile && !formData.image) {
      setNotification({
        title: 'Validation Error',
        message: 'Please select an image or keep the existing one',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    try {
      setSubmitting(true);

      let imageUrl = formData.image;

      // If a new image file is selected, upload it first
      if (imageFile) {
        const imageFormData = new FormData();
        imageFormData.append('image', imageFile);

        const uploadResponse = await fetch('/api/medicines/upload-image', {
          method: 'POST',
          credentials: 'include',
          body: imageFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.imageUrl;
      }

      const url = editingMedicine 
        ? `/api/medicines/${editingMedicine.id}`
        : '/api/medicines';
      
      const method = editingMedicine ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: parseInt(formData.categoryId),
          title: formData.title.trim(),
          tagline: formData.tagline.trim() || null,
          description: formData.description.trim() || null,
          image: imageUrl || null,
          url: formData.url.trim() || null,
          price: formData.price.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save medicine');
      }

      const data = await response.json();
      
      if (editingMedicine) {
        // Update in local state
        setMedicines(medicines.map(m =>
          m.id === editingMedicine.id
            ? data.medicine
            : m
        ));
      } else {
        // Add to local state
        setMedicines([data.medicine, ...medicines]);
      }

      setIsModalOpen(false);
      setEditingMedicine(null);
      setFormData({
        categoryId: '',
        title: '',
        tagline: '',
        description: '',
        image: '',
        url: '',
        price: ''
      });
      setImagePreview(null);
      setImageFile(null);
      setNotification({
        title: 'Success',
        message: editingMedicine ? 'Medicine updated successfully' : 'Medicine created successfully',
        type: 'success',
      });
      setShowNotification(true);
    } catch (error) {
      console.error('Error saving medicine:', error);
      setNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save medicine',
        type: 'error',
      });
      setShowNotification(true);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMedicine(null);
    setImagePreview(null);
    setImageFile(null);
    setFormData({
      categoryId: '',
      title: '',
      tagline: '',
      description: '',
      image: '',
      url: '',
      price: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Medicine Products</h3>
          <p className="text-[#7895b3]">Manage and monitor all medicine products in the app</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => {
              const category = e.target.value;
              if (category === 'All') {
                setSelectedCategory('All');
                router.push('/dashboard/medicines');
              } else {
                const categoryId = parseInt(category);
                setSelectedCategory(categoryId);
                router.push(`/dashboard/medicines?category=${categoryId}`);
              }
            }}
            className="px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
          >
            <option value="All">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.title}</option>
            ))}
          </select>
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
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
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Medicine
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Total Products</p>
          <p className="text-2xl font-bold text-[#435970]">{medicines.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Categories</p>
          <p className="text-2xl font-bold text-[#435970]">{categories.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Filtered Results</p>
          <p className="text-2xl font-bold text-[#435970]">{filteredMedicines.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dfedfb]">
          <p className="text-sm text-[#7895b3] mb-1">Active Products</p>
          <p className="text-2xl font-bold text-[#435970]">
            {medicines.filter(m => m.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#dfedfb]">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Image
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  Category
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-28">
                  Title
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-32">
                  URL
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-24">
                  Price (USD)
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-[#435970] uppercase tracking-wider w-20">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfedfb]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#435970]"></div>
                      <span className="ml-3 text-[#7895b3]">Loading medicines...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMedicines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-[#7895b3]">
                      {searchTerm || selectedCategory !== 'All' 
                        ? 'No medicines found matching your criteria. Try adjusting your search or filter.'
                        : 'No medicines found. Create your first medicine to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMedicines.map((medicine) => (
                  <tr key={medicine.id} className="hover:bg-[#dfedfb]/20 transition-colors">
                    <td className="px-3 py-3">
                      <div className="w-12 h-12 bg-[#dfedfb] rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {medicine.image ? (
                          <Image
                            src={getImageUrl(medicine.image)}
                            alt={medicine.title}
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
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                  </svg>
                                `;
                              }
                            }}
                          />
                        ) : (
                          <svg className="w-6 h-6 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 text-xs font-medium bg-[#dfedfb] text-[#435970] rounded whitespace-nowrap">
                        {medicine.category.title}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-[#435970] truncate" title={medicine.title}>
                        {medicine.title}
                      </div>
                      {medicine.tagline && (
                        <div className="text-xs text-[#7895b3] truncate" title={medicine.tagline}>
                          {medicine.tagline}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div 
                        className="text-sm text-[#435970] truncate max-w-[96px]" 
                        title={medicine.description ? medicine.description.replace(/<[^>]*>/g, '').substring(0, 100) : ''}
                      >
                        {medicine.description 
                          ? (medicine.description.replace(/<[^>]*>/g, '').substring(0, 50) + (medicine.description.replace(/<[^>]*>/g, '').length > 50 ? '...' : ''))
                          : '-'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {medicine.url ? (
                        <a
                          href={medicine.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#7895b3] hover:text-[#435970] transition-colors flex items-center gap-1"
                          title={medicine.url}
                        >
                          <span className="truncate max-w-[120px]" title={medicine.url}>
                            {medicine.url.length > 30 ? `${medicine.url.substring(0, 30)}...` : medicine.url}
                          </span>
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-sm text-[#7895b3]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-medium text-[#435970]">
                        {medicine.price !== null && medicine.price !== undefined 
                          ? `$${parseFloat(medicine.price.toString()).toFixed(2)}`
                          : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(medicine)}
                          className="text-[#7895b3] hover:text-[#435970] transition-colors"
                          aria-label="Edit medicine"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(medicine.id)}
                          disabled={deletingId === medicine.id}
                          className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                          aria-label="Delete medicine"
                        >
                          {deletingId === medicine.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
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
        {!loading && filteredMedicines.length > 0 && (
          <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-between">
            <div className="text-sm text-[#7895b3]">
              Showing <span className="font-semibold text-[#435970]">1</span> to{' '}
              <span className="font-semibold text-[#435970]">{filteredMedicines.length}</span> of{' '}
              <span className="font-semibold text-[#435970]">{medicines.length}</span> products
            </div>
          </div>
        )}
      </div>


      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#435970]">
                {editingMedicine ? 'Edit Medicine' : 'Create New Medicine'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-[#435970] mb-2">
                    Category *
                  </label>
                  <select
                    id="categoryId"
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.title}
                      </option>
                    ))}
                  </select>
                  {!formData.categoryId && (
                    <p className="text-xs text-red-500 mt-1">Please select a category</p>
                  )}
                  {categories.length === 0 && (
                    <p className="text-xs text-[#7895b3] mt-1">
                      No categories available. <Link href="/dashboard/medicines/category" className="text-[#435970] hover:underline">Create one here</Link>.
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-[#435970] mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                    placeholder="Enter product title"
                  />
                </div>
              </div>

              {/* Tagline */}
              <div>
                <label htmlFor="tagline" className="block text-sm font-medium text-[#435970] mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  id="tagline"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="Enter product tagline"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[#435970] mb-2">
                  Description
                </label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(content) => setFormData({ ...formData, description: content })}
                  placeholder="Enter product description. Use the toolbar above to format your text, add links, lists, and more."
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-[#435970] mb-2">
                  Product Image {!editingMedicine && '*'}
                </label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  required={!editingMedicine}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const result = reader.result as string;
                        setImagePreview(result);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      // If no file selected, keep existing image if editing
                      setImageFile(null);
                      if (editingMedicine && formData.image) {
                        setImagePreview(formData.image);
                      } else {
                        setImagePreview(null);
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
                />
                {editingMedicine && formData.image && !imagePreview && (
                  <p className="text-xs text-[#7895b3] mt-1">
                    Current image will be kept if no new image is selected
                  </p>
                )}
                {(imagePreview || (editingMedicine && formData.image)) && (
                  <div className="mt-2 w-32 h-32 bg-[#dfedfb] rounded-lg overflow-hidden">
                    <Image
                      src={imagePreview ? getImageUrl(imagePreview) : getImageUrl(formData.image) || ''}
                      alt="Preview"
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {!formData.image && !editingMedicine && (
                  <p className="text-xs text-red-500 mt-1">Please upload a product image</p>
                )}
              </div>

              {/* Product URL */}
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-[#435970] mb-2">
                  Product URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="https://example.com/product"
                />
              </div>

              {/* Price */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-[#435970] mb-2">
                  Price (USD)
                </label>
                <input
                  type="number"
                  id="price"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="0.00"
                />
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
                  {submitting ? 'Saving...' : editingMedicine ? 'Update Medicine' : 'Create Medicine'}
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
          setMedicineToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Medicine"
        message="Are you sure you want to delete this medicine? This action cannot be undone."
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

