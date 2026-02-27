'use client';

import { useState, useEffect } from 'react';
import ConfirmModal from '@/app/components/ConfirmModal';
import TranslationEditor from '@/app/components/TranslationEditor';

type FAQ = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    order: 0,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  
  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingFaq, setDeletingFaq] = useState<FAQ | null>(null);
  
  // Expanded FAQ for viewing full content
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [pendingTranslations, setPendingTranslations] = useState<{locale: string; field: string; value: string}[]>([]);

  // Fetch FAQs
  const fetchFaqs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (showActiveOnly) params.append('activeOnly', 'true');

      const response = await fetch(`/api/faqs?${params.toString()}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setFaqs(data.faqs);
      } else {
        console.error('Failed to fetch FAQs');
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, [searchTerm, showActiveOnly]);

  // Open create modal
  const handleCreate = () => {
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      order: faqs.length + 1,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
      isActive: faq.isActive,
    });
    setIsModalOpen(true);
  };

  // Save FAQ (create or update)
  const handleSave = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      alert('Question and answer are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingFaq ? `/api/faqs/${editingFaq.id}` : '/api/faqs';
      const method = editingFaq ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        // Save pending translations for new FAQ
        if (!editingFaq && pendingTranslations.length > 0) {
          try {
            const faqData = await response.json();
            await fetch('/api/translations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                entityType: 'faq',
                entityId: faqData.faq?.id || faqData.id,
                translations: pendingTranslations,
              }),
            });
          } catch (err) {
            console.error('Failed to save translations:', err);
          }
        }
        setPendingTranslations([]);
        setIsModalOpen(false);
        fetchFaqs();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save FAQ');
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
      alert('Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  // Toggle FAQ status
  const handleToggleStatus = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/faqs/${faq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !faq.isActive }),
      });

      if (response.ok) {
        fetchFaqs();
      }
    } catch (error) {
      console.error('Error toggling FAQ status:', error);
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (faq: FAQ) => {
    setDeletingFaq(faq);
    setDeleteModalOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingFaq) return;

    try {
      const response = await fetch(`/api/faqs/${deletingFaq.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setDeleteModalOpen(false);
        setDeletingFaq(null);
        fetchFaqs();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete FAQ');
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      alert('Failed to delete FAQ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#435970]">FAQs</h1>
          <p className="text-[#7895b3] text-sm">Manage frequently asked questions</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#435970] text-white rounded-xl hover:bg-[#374a5e] transition-all duration-300 font-semibold text-sm shadow-lg shadow-[#435970]/20 hover:shadow-xl hover:shadow-[#435970]/30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add FAQ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7895b3]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#435970] focus:ring-[#435970]/20"
              />
              <span className="text-sm text-[#435970]">Active only</span>
            </label>
            <span className="text-sm text-[#7895b3]">
              {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* FAQ List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#435970]"></div>
        </div>
      ) : faqs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-[#435970]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#435970]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#435970] mb-2">No FAQs found</h3>
          <p className="text-[#7895b3] mb-4">Get started by creating your first FAQ</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#435970] text-white rounded-lg hover:bg-[#374a5e] transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add FAQ
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 ${
                !faq.isActive ? 'opacity-60' : ''
              }`}
            >
              {/* FAQ Header */}
              <div
                className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#435970]/10 rounded-lg flex items-center justify-center text-[#435970] font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold text-[#435970] text-base">{faq.question}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            faq.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {faq.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <svg
                          className={`w-5 h-5 text-[#7895b3] transition-transform duration-300 ${
                            expandedFaq === faq.id ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm text-[#7895b3] mt-1 line-clamp-2">{faq.answer}</p>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedFaq === faq.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="pt-4">
                    <p className="text-[#435970] whitespace-pre-wrap">{faq.answer}</p>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs text-[#7895b3]">
                        Order: {faq.order} • Created: {new Date(faq.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(faq);
                          }}
                          className={`p-2 rounded-lg transition-colors ${
                            faq.isActive
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={faq.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {faq.isActive ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(faq);
                          }}
                          className="p-2 text-[#435970] hover:bg-[#435970]/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(faq);
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#435970]">
                  {editingFaq ? 'Edit FAQ' : 'Create FAQ'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-[#7895b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Question */}
              <div>
                <label className="block text-sm font-semibold text-[#435970] mb-2">
                  Question <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Enter the question..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all"
                />
              </div>

              {/* Answer */}
              <div>
                <label className="block text-sm font-semibold text-[#435970] mb-2">
                  Answer <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="Enter the answer..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all resize-none"
                />
              </div>

              {/* Translations */}
              <TranslationEditor
                entityType="faq"
                entityId={editingFaq?.id || null}
                translatableFields={[
                  { field: 'question', label: 'Question', type: 'text' },
                  { field: 'answer', label: 'Answer', type: 'textarea' },
                ]}
                onTranslationsChange={!editingFaq ? setPendingTranslations : undefined}
              />

              {/* Order & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#435970] mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#435970]/20 focus:border-[#435970] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#435970] mb-2">
                    Status
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-[#435970] focus:ring-[#435970]/20"
                    />
                    <span className="text-sm text-[#435970]">Active</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-[#435970] hover:bg-gray-100 rounded-xl transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-[#435970] text-white rounded-xl hover:bg-[#374a5e] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingFaq ? 'Update FAQ' : 'Create FAQ'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete FAQ"
        message={`Are you sure you want to delete this FAQ? This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingFaq(null);
        }}
      />
    </div>
  );
}

