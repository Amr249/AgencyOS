export type SavedTableView = {
  id: string;
  name: string;
  filters?: Record<string, string>;
  sort?: { id: string; desc: boolean }[];
  visibility?: Record<string, boolean>;
  viewMode?: string;
  createdAt: number;
  updatedAt: number;
};

const keyFor = (tableId: string) => `table-views:${tableId}`;

export function listSavedViews(tableId: string): SavedTableView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(tableId));
    const parsed = raw ? (JSON.parse(raw) as SavedTableView[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertSavedView(tableId: string, view: Omit<SavedTableView, "updatedAt">): SavedTableView[] {
  const existing = listSavedViews(tableId);
  const now = Date.now();
  const next = existing.some((v) => v.id === view.id)
    ? existing.map((v) => (v.id === view.id ? { ...view, updatedAt: now } : v))
    : [...existing, { ...view, updatedAt: now }];
  if (typeof window !== "undefined") {
    localStorage.setItem(keyFor(tableId), JSON.stringify(next));
  }
  return next;
}

export function removeSavedView(tableId: string, viewId: string): SavedTableView[] {
  const next = listSavedViews(tableId).filter((v) => v.id !== viewId);
  if (typeof window !== "undefined") {
    localStorage.setItem(keyFor(tableId), JSON.stringify(next));
  }
  return next;
}
