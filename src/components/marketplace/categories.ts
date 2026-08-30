/**
 * Marketplace categories — the OpenSea-style browse taxonomy for memory
 * buckets. Keys are what gets stored on the bucket (`nftCategory`) and
 * validated by the backend; labels/emoji are presentation only.
 *
 * Keep this list in sync with ALLOWED_CATEGORIES in
 * plurality-market-backend/src/services/blockchain-service/controllers/blockchain-controller.ts
 */
export interface MemoryCategory {
  key: string;
  label: string;
  emoji: string;
  blurb: string;
}

export const CATEGORIES: MemoryCategory[] = [
  { key: 'research', label: 'Research', emoji: '🔬', blurb: 'Papers, findings, literature notes' },
  { key: 'business', label: 'Business', emoji: '💼', blurb: 'Strategy, meetings, market intel' },
  { key: 'tech', label: 'Technology', emoji: '💻', blurb: 'Code, architecture, dev notes' },
  { key: 'finance', label: 'Finance & Crypto', emoji: '📈', blurb: 'Markets, DeFi, analysis' },
  { key: 'education', label: 'Education', emoji: '🎓', blurb: 'Courses, study notes, tutorials' },
  { key: 'creative', label: 'Creative & Writing', emoji: '🎨', blurb: 'Stories, drafts, design notes' },
  { key: 'health', label: 'Health & Fitness', emoji: '🧘', blurb: 'Routines, nutrition, wellbeing' },
  { key: 'lifestyle', label: 'Travel & Lifestyle', emoji: '🌍', blurb: 'Trips, recipes, recommendations' },
  { key: 'personal', label: 'Personal', emoji: '🧠', blurb: 'Journals, memories, reflections' },
  { key: 'other', label: 'Other', emoji: '✨', blurb: 'Everything else' },
];

export function findCategory(key?: string | null): MemoryCategory | null {
  if (!key) return null;
  return CATEGORIES.find((c) => c.key === key) ?? null;
}

export function categoryLabel(key?: string | null): string | null {
  return findCategory(key)?.label ?? null;
}
