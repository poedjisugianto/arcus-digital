import { CategoryConfig, CategoryType, TargetType, TournamentSettings } from '../types';
import { CATEGORY_LABELS } from '../constants';

/**
 * Firestore Utilities
 * Utility functions for safe Firestore operations, avoiding "Unsupported field value: undefined" errors.
 */

export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  // Preserve Firebase FieldValue sentinels (serverTimestamp, deleteField, arrayUnion, increment, etc.)
  if (
    typeof data === 'object' &&
    ('_methodName' in (data as any) ||
      (data as any)?.constructor?.name?.includes('FieldValue') ||
      '_delegate' in (data as any))
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}

/**
 * Safely parse JSON strings, returning fallback if invalid or corrupted.
 */
export function tryRecoverJSON<T = any>(text: string, fallback: T | null = null): T | null {
  if (!text || typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Normalize any raw category string or label to standard CategoryType key (e.g., 'ADULT_PUTRA')
 */
export function normalizeCategoryKey(cat?: string): string {
  if (!cat) return '';
  const trimmed = cat.trim();
  if (CATEGORY_LABELS[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_LABELS)) {
    if (k.toLowerCase() === lower || v.toLowerCase() === lower) {
      return k;
    }
  }
  // Common aliases
  if (lower.includes('dewasa') && (lower.includes('putra') || lower.includes('pa'))) return CategoryType.ADULT_PUTRA;
  if (lower.includes('dewasa') && (lower.includes('putri') || lower.includes('pi'))) return CategoryType.ADULT_PUTRI;
  if (lower.includes('u18') && (lower.includes('putra') || lower.includes('pa'))) return CategoryType.U18_PUTRA;
  if (lower.includes('u18') && (lower.includes('putri') || lower.includes('pi'))) return CategoryType.U18_PUTRI;
  if (lower.includes('u12') && (lower.includes('putra') || lower.includes('pa'))) return CategoryType.U12_PUTRA;
  if (lower.includes('u12') && (lower.includes('putri') || lower.includes('pi'))) return CategoryType.U12_PUTRI;
  if (lower.includes('u9') && (lower.includes('putra') || lower.includes('pa'))) return CategoryType.U9_PUTRA;
  if (lower.includes('u9') && (lower.includes('putri') || lower.includes('pi'))) return CategoryType.U9_PUTRI;
  if (lower.includes('official')) return CategoryType.OFFICIAL;

  return trimmed;
}

/**
 * Find CategoryConfig from categoryConfigs record supporting key, label, or normalized lookup
 */
export function findCategoryConfig(
  cat?: string,
  categoryConfigs?: Partial<Record<CategoryType | string, CategoryConfig>> | null
): CategoryConfig | null {
  if (!cat || !categoryConfigs || typeof categoryConfigs !== 'object') return null;

  // 1. Direct match
  if ((categoryConfigs as any)[cat]) return (categoryConfigs as any)[cat];

  // 2. Normalized key match
  const normKey = normalizeCategoryKey(cat);
  if ((categoryConfigs as any)[normKey]) return (categoryConfigs as any)[normKey];

  // 3. Case-insensitive or label match
  const lowerCat = cat.toLowerCase();
  const lowerNorm = normKey.toLowerCase();
  for (const [k, v] of Object.entries(categoryConfigs)) {
    if (!v) continue;
    if (k.toLowerCase() === lowerCat || k.toLowerCase() === lowerNorm) {
      return v as CategoryConfig;
    }
    const label = CATEGORY_LABELS[k] || k;
    if (label.toLowerCase() === lowerCat || label.toLowerCase() === lowerNorm) {
      return v as CategoryConfig;
    }
  }

  return null;
}

/**
 * Deep merge category configurations preserving all properties and all categories
 */
export function mergeCategoryConfigs(
  existing?: Partial<Record<CategoryType | string, CategoryConfig>> | null,
  incoming?: Partial<Record<CategoryType | string, Partial<CategoryConfig>>> | null
): Partial<Record<CategoryType, CategoryConfig>> {
  const result: Record<string, any> = {};

  if (existing && typeof existing === 'object') {
    for (const [key, val] of Object.entries(existing)) {
      if (val && typeof val === 'object') {
        result[key] = { ...val };
      } else {
        result[key] = val;
      }
    }
  }

  if (incoming && typeof incoming === 'object') {
    for (const [key, val] of Object.entries(incoming)) {
      if (val && typeof val === 'object') {
        const existingCategoryConfig = result[key] || {};
        result[key] = {
          ...existingCategoryConfig,
          ...val
        };
      } else if (val !== undefined) {
        result[key] = val;
      }
    }
  }

  return result as Partial<Record<CategoryType, CategoryConfig>>;
}

/**
 * Deep merge tournament settings ensuring categoryConfigs and sub-configs are never lost
 */
export function mergeTournamentSettings(
  existing?: Partial<TournamentSettings> | null,
  incoming?: Partial<TournamentSettings> | null
): TournamentSettings {
  const base = { ...(existing || {}) };
  const next = { ...(incoming || {}) };

  const mergedConfigs = mergeCategoryConfigs(base.categoryConfigs, next.categoryConfigs);

  return {
    ...base,
    ...next,
    categoryConfigs: mergedConfigs
  } as TournamentSettings;
}

