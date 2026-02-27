import { NextRequest } from 'next/server';
import { prisma } from './prisma';

export const TRANSLATABLE_FIELDS: Record<string, string[]> = {
  medicine: ['title', 'tagline', 'description'],
  medicine_category: ['title', 'tagline'],
  blog: ['title', 'tagline', 'description'],
  faq: ['question', 'answer'],
};

/**
 * Extract locale from request. Checks ?lang= param first, then Accept-Language header.
 * Returns 'en' if no locale specified or locale is English.
 */
export function getLocaleFromRequest(request: NextRequest): string {
  const { searchParams } = new URL(request.url);

  const langParam = searchParams.get('lang');
  if (langParam && langParam !== 'en') {
    return langParam.toLowerCase().split('-')[0];
  }

  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const primary = acceptLanguage.split(',')[0].split('-')[0].trim().toLowerCase();
    if (primary && primary !== 'en') {
      return primary;
    }
  }

  return 'en';
}

/**
 * Apply translations to a single entity.
 * Returns the original object with translatable fields overridden if translation exists.
 * Falls back to English (original values) for any field without a translation.
 */
export async function applyTranslation<T extends Record<string, any>>(
  entity: T,
  entityType: string,
  entityId: string,
  locale: string
): Promise<T> {
  if (locale === 'en') return entity;

  const translations = await prisma.translation.findMany({
    where: { entityType, entityId, locale },
    select: { field: true, value: true },
  });

  if (translations.length === 0) return entity;

  const translated = { ...entity };
  for (const t of translations) {
    if (t.value && t.value.trim() !== '') {
      (translated as any)[t.field] = t.value;
    }
  }

  return translated;
}

/**
 * Batch apply translations to an array of entities.
 * Fetches all translations in a single query for optimal performance.
 */
export async function applyTranslationsBatch<T extends Record<string, any>>(
  entities: T[],
  entityType: string,
  idField: string,
  locale: string
): Promise<T[]> {
  if (locale === 'en' || entities.length === 0) return entities;

  const entityIds = entities.map(e => String(e[idField]));

  const translations = await prisma.translation.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      locale,
    },
    select: { entityId: true, field: true, value: true },
  });

  if (translations.length === 0) return entities;

  const translationMap = new Map<string, Map<string, string>>();
  for (const t of translations) {
    if (!translationMap.has(t.entityId)) {
      translationMap.set(t.entityId, new Map());
    }
    if (t.value && t.value.trim() !== '') {
      translationMap.get(t.entityId)!.set(t.field, t.value);
    }
  }

  return entities.map(entity => {
    const entityTranslations = translationMap.get(String(entity[idField]));
    if (!entityTranslations) return entity;

    const translated = { ...entity };
    for (const [field, value] of entityTranslations) {
      (translated as any)[field] = value;
    }
    return translated;
  });
}

/**
 * Delete all translations for a given entity.
 */
export async function deleteTranslationsForEntity(entityType: string, entityId: string): Promise<void> {
  await prisma.translation.deleteMany({
    where: { entityType, entityId },
  });
}

/**
 * Delete all translations for multiple entities (bulk delete).
 */
export async function deleteTranslationsForEntities(entityType: string, entityIds: string[]): Promise<void> {
  if (entityIds.length === 0) return;
  await prisma.translation.deleteMany({
    where: { entityType, entityId: { in: entityIds } },
  });
}
