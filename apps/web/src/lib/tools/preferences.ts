import { getTool } from "./registry";

const KEY = "convertbox-tools-v1";
export interface ToolUsage { id: string; lastUsed: number; count: number }
export interface ToolPreferences { version: 1; favorites: string[]; recent: ToolUsage[] }

const empty = (): ToolPreferences => ({ version: 1, favorites: [], recent: [] });

export function readToolPreferences(): ToolPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1) return empty();
    const object = value as Partial<ToolPreferences>;
    const favorites = Array.isArray(object.favorites) ? object.favorites.filter((id): id is string => typeof id === "string" && !!getTool(id)).slice(0, 32) : [];
    const recent = Array.isArray(object.recent) ? object.recent.filter((item): item is ToolUsage => !!item && typeof item.id === "string" && !!getTool(item.id) && Number.isFinite(item.lastUsed) && Number.isInteger(item.count) && item.count > 0).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 8) : [];
    return { version: 1, favorites: [...new Set(favorites)], recent };
  } catch { return empty(); }
}

function write(value: ToolPreferences): ToolPreferences {
  localStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export function toggleFavorite(id: string): ToolPreferences {
  if (!getTool(id)) return readToolPreferences();
  const current = readToolPreferences();
  const favorites = current.favorites.includes(id) ? current.favorites.filter(item => item !== id) : [...current.favorites, id];
  return write({ ...current, favorites });
}

export function recordToolUse(id: string): ToolPreferences {
  if (!getTool(id)) return readToolPreferences();
  const current = readToolPreferences();
  const prior = current.recent.find(item => item.id === id);
  return write({ ...current, recent: [{ id, lastUsed: Date.now(), count: (prior?.count ?? 0) + 1 }, ...current.recent.filter(item => item.id !== id)].slice(0, 8) });
}
