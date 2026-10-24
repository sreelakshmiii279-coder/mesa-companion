// Task types and priorities, shared by the server and the add/edit form.
export const CATEGORIES = {
  college: { label: 'College work', emoji: '📚' },
  house: { label: 'House work', emoji: '🏠' },
  chill: { label: 'Chill time', emoji: '😌' },
  health: { label: 'Health & gym', emoji: '💪' },
  personal: { label: 'Personal', emoji: '🌱' },
  other: { label: 'Other', emoji: '⚡' },
};

export const PRIORITIES = {
  high: { label: 'High', emoji: '🔴', rank: 0 },
  medium: { label: 'Medium', emoji: '🟡', rank: 1 },
  low: { label: 'Low', emoji: '🟢', rank: 2 },
};

export const category = (key) => CATEGORIES[key] ?? CATEGORIES.other;
export const cleanCategory = (v) => (v in CATEGORIES ? v : 'other');
export const cleanPriority = (v) => (v in PRIORITIES ? v : 'medium');
