'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import RichTextEditor from '@/app/components/RichTextEditor';
import { getImageUrl } from '@/lib/image-utils';
import NotificationModal from '@/app/components/NotificationModal';
import TranslationEditor from '@/app/components/TranslationEditor';

interface MedicineOption {
  id: string;
  title: string;
  tagline?: string | null;
  image?: string | null;
  category?: { title: string } | null;
}

export default function AddBlogPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    description: '',
    tags: [] as string[],
    featuredImage: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [showNotification, setShowNotification] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [pendingTranslations, setPendingTranslations] = useState<{locale: string; field: string; value: string}[]>([]);

  // Related medicines state
  const [relatedMedicinesHeading, setRelatedMedicinesHeading] = useState('');
  const [selectedMedicines, setSelectedMedicines] = useState<MedicineOption[]>([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [medicineResults, setMedicineResults] = useState<MedicineOption[]>([]);
  const [medicineSearchLoading, setMedicineSearchLoading] = useState(false);
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const medicineSearchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (medicineSearchRef.current && !medicineSearchRef.current.contains(e.target as Node)) {
        setShowMedicineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced medicine search
  useEffect(() => {
    if (!medicineSearch.trim()) {
      setMedicineResults([]);
      setShowMedicineDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setMedicineSearchLoading(true);
      try {
        const res = await fetch(`/api/medicines?search=${encodeURIComponent(medicineSearch)}&limit=10`, { credentials: 'include' });
        const data = await res.json();
        setMedicineResults((data.medicines || []).filter((m: MedicineOption) => !selectedMedicines.find(s => s.id === m.id)));
        setShowMedicineDropdown(true);
      } catch {
        setMedicineResults([]);
      } finally {
        setMedicineSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [medicineSearch, selectedMedicines]);

  const handleSelectMedicine = (medicine: MedicineOption) => {
    setSelectedMedicines(prev => [...prev, medicine]);
    setMedicineSearch('');
    setMedicineResults([]);
    setShowMedicineDropdown(false);
  };

  const handleRemoveMedicine = (id: string) => {
    setSelectedMedicines(prev => prev.filter(m => m.id !== id));
  };

  const handleAddTag = () => {
    if (newTagName.trim() && !formData.tags.includes(newTagName.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTagName.trim()] });
      setNewTagName('');
    }
  };

  const handleDeleteTag = (tagToDelete: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToDelete) });
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.tagline || !formData.description || formData.tags.length === 0 || !imageFile) {
      setNotification({
        title: 'Validation Error',
        message: 'Please fill in all required fields, add at least one tag, and select an image',
        type: 'warning',
      });
      setShowNotification(true);
      return;
    }

    try {
      setSubmitting(true);

      // First, upload the image
      const imageFormData = new FormData();
      imageFormData.append('image', imageFile);

      const uploadResponse = await fetch('/api/blogs/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: imageFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.imageUrl;

      // Then, create the blog with the image URL
      const response = await fetch('/api/blogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          featuredImage: imageUrl,
          relatedMedicinesHeading: relatedMedicinesHeading.trim() || null,
          relatedMedicineIds: selectedMedicines.map(m => m.id),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create blog');
      }

      // Save pending translations for new blog
      if (pendingTranslations.length > 0) {
        try {
          const blogData = await response.json();
          await fetch('/api/translations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              entityType: 'blog',
              entityId: blogData.blog?.id || blogData.id,
              translations: pendingTranslations,
            }),
          });
        } catch (err) {
          console.error('Failed to save translations:', err);
        }
      }

      router.push('/dashboard/blogs');
    } catch (error) {
      setNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create blog',
        type: 'error',
      });
      setShowNotification(true);
      console.error('Error creating blog:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Create New Featured Content</h3>
          <p className="text-[#7895b3]">Add a new featured content item</p>
        </div>
        <Link
          href="/dashboard/blogs"
          className="px-4 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-[#dfedfb] p-6 space-y-6">
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
            placeholder="Enter title"
          />
        </div>

        {/* Tagline */}
        <div>
          <label htmlFor="tagline" className="block text-sm font-medium text-[#435970] mb-2">
            Tagline *
          </label>
          <input
            type="text"
            id="tagline"
            required
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            placeholder="Enter tagline"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-[#435970] mb-2">
            Description *
          </label>
          <RichTextEditor
            content={formData.description}
            onChange={(content) => setFormData({ ...formData, description: content })}
            placeholder="Enter description. Use the toolbar above to format your text, add links, lists, and more."
          />
          {!formData.description && (
            <p className="text-xs text-red-500 mt-1">Please enter a description</p>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-[#435970] mb-2">
            Tags * (Add at least one tag)
          </label>
          
          {/* Tags Display */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 border border-[#dfedfb] rounded-lg bg-gray-50">
            {formData.tags.map(tag => (
              <div
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#dfedfb] text-[#435970] transition-colors"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag)}
                  className="hover:opacity-80 transition-opacity text-[#435970]"
                  title="Remove tag"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {formData.tags.length === 0 && (
              <span className="text-sm text-[#7895b3]">No tags yet. Add one below.</span>
            )}
          </div>

          {/* Add New Tag Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Type to add new tag..."
              className="flex-1 px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
              className="px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
          
          {formData.tags.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Please add at least one tag</p>
          )}
        </div>

        {/* Featured Image Upload */}
        <div>
          <label htmlFor="featuredImage" className="block text-sm font-medium text-[#435970] mb-2">
            Featured Image *
          </label>
          <input
            type="file"
            id="featuredImage"
            accept="image/*"
            required
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
              }
            }}
            className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white file:cursor-pointer"
          />
          {imagePreview && (
            <div className="mt-2 w-32 h-32 bg-[#dfedfb] rounded-lg overflow-hidden">
              <Image
                src={getImageUrl(imagePreview)}
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
        </div>

        {/* Related Medicines */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-base font-semibold text-[#435970] mb-1">Related Medicines</h4>
          <p className="text-sm text-[#7895b3] mb-4">These medicines will be shown below this post in the app.</p>

          {/* Custom heading */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#435970] mb-2">
              Section Heading
            </label>
            <input
              type="text"
              value={relatedMedicinesHeading}
              onChange={(e) => setRelatedMedicinesHeading(e.target.value)}
              placeholder="e.g. Recommended Medicines, Shop Now..."
              className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
            />
          </div>

          {/* Medicine search */}
          <div className="mb-3" ref={medicineSearchRef}>
            <label className="block text-sm font-medium text-[#435970] mb-2">
              Search & Add Medicines
            </label>
            <div className="relative">
              <input
                type="text"
                value={medicineSearch}
                onChange={(e) => setMedicineSearch(e.target.value)}
                placeholder="Type to search medicines..."
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
              />
              {medicineSearchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-[#7895b3] animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              )}
              {showMedicineDropdown && medicineResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dfedfb] rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {medicineResults.map(medicine => (
                    <button
                      key={medicine.id}
                      type="button"
                      onClick={() => handleSelectMedicine(medicine)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#dfedfb] transition-colors text-left"
                    >
                      {medicine.image ? (
                        <Image src={getImageUrl(medicine.image)} alt={medicine.title} width={32} height={32} className="rounded object-cover flex-shrink-0" unoptimized />
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#dfedfb] flex-shrink-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#435970] truncate">{medicine.title}</p>
                        {medicine.category && <p className="text-xs text-[#7895b3] truncate">{medicine.category.title}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showMedicineDropdown && !medicineSearchLoading && medicineResults.length === 0 && medicineSearch.trim() && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dfedfb] rounded-lg shadow-lg px-4 py-3">
                  <p className="text-sm text-[#7895b3]">No medicines found</p>
                </div>
              )}
            </div>
          </div>

          {/* Selected medicines list */}
          {selectedMedicines.length > 0 && (
            <div className="space-y-2">
              {selectedMedicines.map((medicine, index) => (
                <div key={medicine.id} className="flex items-center gap-3 p-2.5 bg-[#dfedfb] rounded-lg">
                  <span className="text-xs text-[#7895b3] w-5 text-center font-medium">{index + 1}</span>
                  {medicine.image ? (
                    <Image src={getImageUrl(medicine.image)} alt={medicine.title} width={32} height={32} className="rounded object-cover flex-shrink-0" unoptimized />
                  ) : (
                    <div className="w-8 h-8 rounded bg-white flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#435970] truncate">{medicine.title}</p>
                    {medicine.category && <p className="text-xs text-[#7895b3]">{medicine.category.title}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedicine(medicine.id)}
                    className="text-[#7895b3] hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {selectedMedicines.length === 0 && (
            <p className="text-sm text-[#7895b3]">No medicines selected yet.</p>
          )}
        </div>

        {/* Translations */}
        <TranslationEditor
          entityType="blog"
          entityId={null}
          translatableFields={[
            { field: 'title', label: 'Title', type: 'text' },
            { field: 'tagline', label: 'Tagline', type: 'text' },
            { field: 'description', label: 'Description', type: 'richtext' },
          ]}
          onTranslationsChange={setPendingTranslations}
        />

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Link
            href="/dashboard/blogs"
            className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create Content'}
          </button>
        </div>
      </form>

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

