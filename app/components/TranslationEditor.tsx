'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TranslatableField = {
  field: string;
  label: string;
  type: 'text' | 'textarea' | 'richtext';
};

type TranslationData = {
  locale: string;
  field: string;
  value: string;
};

type TranslationEditorProps = {
  entityType: 'medicine' | 'medicine_category' | 'blog' | 'faq';
  entityId: string | null;
  translatableFields: TranslatableField[];
  onTranslationsChange?: (translations: TranslationData[]) => void;
};

type Language = {
  id: string;
  code: string;
  name: string;
  nativeName: string | null;
  isActive: boolean;
  order: number;
};

// ─── Languages cache (shared across all instances) ───────────────────────────

let languagesCache: Language[] | null = null;
let languagesCachePromise: Promise<Language[]> | null = null;

async function fetchLanguages(): Promise<Language[]> {
  if (languagesCache) return languagesCache;
  if (languagesCachePromise) return languagesCachePromise;

  languagesCachePromise = fetch('/api/languages')
    .then((res) => res.json())
    .then((data) => {
      if (data.success && Array.isArray(data.languages)) {
        const active = data.languages.filter((l: Language) => l.isActive);
        languagesCache = active;
        return active;
      }
      return [];
    })
    .catch(() => {
      languagesCachePromise = null;
      return [];
    });

  return languagesCachePromise;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TranslationEditor({
  entityType,
  entityId,
  translatableFields,
  onTranslationsChange,
}: TranslationEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [translationMap, setTranslationMap] = useState<Record<string, string>>({});
  const [loadingLanguages, setLoadingLanguages] = useState(true);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Track the entityId we last fetched translations for to avoid re-fetching
  const fetchedEntityIdRef = useRef<string | null | undefined>(undefined);

  // ── Fetch languages ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    setLoadingLanguages(true);
    fetchLanguages().then((langs) => {
      if (!cancelled) {
        setLanguages(langs);
        if (langs.length > 0 && !activeTab) {
          setActiveTab(langs[0].code);
        }
        setLoadingLanguages(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch existing translations ──────────────────────────────────────────

  useEffect(() => {
    if (!entityId || fetchedEntityIdRef.current === entityId) return;

    let cancelled = false;
    fetchedEntityIdRef.current = entityId;
    setLoadingTranslations(true);

    fetch(`/api/translations/${entityType}/${entityId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.translations)) {
          const map: Record<string, string> = {};
          for (const t of data.translations) {
            map[`${t.locale}::${t.field}`] = t.value;
          }
          setTranslationMap(map);
        }
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        if (!cancelled) setLoadingTranslations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  // ── Build the TranslationData array from the map ─────────────────────────

  const buildTranslationsArray = useCallback(
    (map: Record<string, string>): TranslationData[] => {
      const result: TranslationData[] = [];
      for (const [key, value] of Object.entries(map)) {
        if (!value) continue;
        const [locale, field] = key.split('::');
        result.push({ locale, field, value });
      }
      return result;
    },
    []
  );

  // ── Handle field change ──────────────────────────────────────────────────

  const handleFieldChange = useCallback(
    (locale: string, field: string, value: string) => {
      setTranslationMap((prev) => {
        const next = { ...prev, [`${locale}::${field}`]: value };
        // Notify parent of all non-empty translations
        if (onTranslationsChange) {
          onTranslationsChange(buildTranslationsArray(next));
        }
        return next;
      });
      // Clear any previous save message when editing
      setSaveMessage(null);
    },
    [onTranslationsChange, buildTranslationsArray]
  );

  // ── Save translations (for existing entities) ────────────────────────────

  const handleSave = async () => {
    if (!entityId) return;

    setSaving(true);
    setSaveMessage(null);

    // Build the full list: include all fields for all languages so empty
    // values get deleted on the server side.
    const translations: TranslationData[] = [];
    for (const lang of languages) {
      for (const tf of translatableFields) {
        const key = `${lang.code}::${tf.field}`;
        translations.push({
          locale: lang.code,
          field: tf.field,
          value: translationMap[key] || '',
        });
      }
    }

    try {
      const res = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, translations }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage({ type: 'success', text: 'Translations saved successfully.' });
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save translations.' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Count translated fields per language ─────────────────────────────────

  const getTranslatedCount = (locale: string): number => {
    let count = 0;
    for (const tf of translatableFields) {
      const key = `${locale}::${tf.field}`;
      if (translationMap[key]) count++;
    }
    return count;
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="border border-[#dfedfb] rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#f8fbfe] hover:bg-[#dfedfb] transition-colors text-left"
      >
        {/* Globe icon */}
        <svg
          className="w-5 h-5 text-[#435970] flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>

        <span className="text-sm font-semibold text-[#435970] flex-1">
          Translations
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-[#7895b3] transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-[#dfedfb]">
          {/* Loading languages */}
          {loadingLanguages && (
            <div className="flex items-center justify-center py-8">
              <svg
                className="animate-spin h-5 w-5 text-[#7895b3] mr-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-[#7895b3]">Loading languages...</span>
            </div>
          )}

          {/* No languages */}
          {!loadingLanguages && languages.length === 0 && (
            <div className="text-center py-6">
              <svg
                className="w-10 h-10 text-[#7895b3] mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-[#7895b3]">
                No languages configured. Go to Settings &gt; Languages to add languages.
              </p>
            </div>
          )}

          {/* Languages loaded */}
          {!loadingLanguages && languages.length > 0 && (
            <>
              {/* Language tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {languages.map((lang) => {
                  const isActive = activeTab === lang.code;
                  const count = getTranslatedCount(lang.code);

                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setActiveTab(lang.code)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#435970] text-white'
                          : 'bg-[#f0f5fa] text-[#435970] hover:bg-[#dfedfb]'
                      }`}
                    >
                      <span>{lang.nativeName || lang.name}</span>
                      <span className="text-xs">({lang.code})</span>
                      {count > 0 && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${
                            isActive
                              ? 'bg-white/25 text-white'
                              : 'bg-[#435970] text-white'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Loading translations overlay */}
              {loadingTranslations && (
                <div className="flex items-center justify-center py-6">
                  <svg
                    className="animate-spin h-5 w-5 text-[#7895b3] mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-sm text-[#7895b3]">Loading translations...</span>
                </div>
              )}

              {/* Translation fields for the active tab */}
              {!loadingTranslations && activeTab && (
                <div className="space-y-4">
                  {translatableFields.map((tf) => {
                    const key = `${activeTab}::${tf.field}`;
                    const value = translationMap[key] || '';

                    return (
                      <div key={tf.field}>
                        <label className="block text-sm font-medium text-[#435970] mb-1">
                          {tf.label}
                        </label>

                        {tf.type === 'text' && (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              handleFieldChange(activeTab, tf.field, e.target.value)
                            }
                            placeholder={`${tf.label} in ${
                              languages.find((l) => l.code === activeTab)?.name || activeTab
                            }`}
                            className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]/50 text-sm"
                          />
                        )}

                        {tf.type === 'textarea' && (
                          <textarea
                            rows={4}
                            value={value}
                            onChange={(e) =>
                              handleFieldChange(activeTab, tf.field, e.target.value)
                            }
                            placeholder={`${tf.label} in ${
                              languages.find((l) => l.code === activeTab)?.name || activeTab
                            }`}
                            className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]/50 text-sm resize-y"
                          />
                        )}

                        {tf.type === 'richtext' && (
                          <div>
                            <textarea
                              rows={6}
                              value={value}
                              onChange={(e) =>
                                handleFieldChange(activeTab, tf.field, e.target.value)
                              }
                              placeholder={`${tf.label} in ${
                                languages.find((l) => l.code === activeTab)?.name || activeTab
                              } (HTML supported)`}
                              className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]/50 text-sm resize-y font-mono"
                            />
                            <p className="text-xs text-[#7895b3] mt-1">
                              Supports HTML markup.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Save button (only for existing entities) */}
                  {entityId && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-[#435970] text-white text-sm font-medium rounded-lg hover:bg-[#374a5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <>
                            <svg
                              className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Saving...
                          </>
                        ) : (
                          'Save Translations'
                        )}
                      </button>

                      {saveMessage && (
                        <span
                          className={`text-sm ${
                            saveMessage.type === 'success'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {saveMessage.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
