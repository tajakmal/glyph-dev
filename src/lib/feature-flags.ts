export type FeatureFlagKey =
  | "sync_enabled"
  | "auth_required"
  | "library_search_enabled"
  | "reader_progress_unified"
  | "pdf_selection_mapping_v2"
  | "textreader_topbar_speedread_enabled"
  | "goalBasedReading";

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const STORAGE_KEY = "glyph:feature-flags";

const DEFAULT_FLAGS: FeatureFlags = {
  sync_enabled: false,
  auth_required: false,
  library_search_enabled: true,
  reader_progress_unified: true,
  pdf_selection_mapping_v2: true,
  textreader_topbar_speedread_enabled: true,
  goalBasedReading: true,
};

const ENV_KEYS: Record<FeatureFlagKey, string> = {
  sync_enabled: "NEXT_PUBLIC_FLAG_SYNC_ENABLED",
  auth_required: "NEXT_PUBLIC_FLAG_AUTH_REQUIRED",
  library_search_enabled: "NEXT_PUBLIC_FLAG_LIBRARY_SEARCH_ENABLED",
  reader_progress_unified: "NEXT_PUBLIC_FLAG_READER_PROGRESS_UNIFIED",
  pdf_selection_mapping_v2: "NEXT_PUBLIC_FLAG_PDF_SELECTION_MAPPING_V2",
  textreader_topbar_speedread_enabled:
    "NEXT_PUBLIC_FLAG_TEXTREADER_TOPBAR_SPEEDREAD_ENABLED",
  goalBasedReading: "NEXT_PUBLIC_FLAG_GOAL_BASED_READING",
};

function parseBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }
  return null;
}

function readStoredFlags(): Partial<FeatureFlags> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readEnvFlag(key: FeatureFlagKey): boolean | null {
  const envKey = ENV_KEYS[key];
  if (!envKey) return null;
  return parseBoolean(process.env[envKey]);
}

export function getFeatureFlags(): FeatureFlags {
  const stored = readStoredFlags();
  const merged: FeatureFlags = { ...DEFAULT_FLAGS };

  (Object.keys(DEFAULT_FLAGS) as FeatureFlagKey[]).forEach((key) => {
    const envValue = readEnvFlag(key);
    if (envValue !== null) {
      merged[key] = envValue;
      return;
    }

    if (typeof stored[key] === "boolean") {
      merged[key] = stored[key] as boolean;
    }
  });

  return merged;
}

export function getFeatureFlag(key: FeatureFlagKey): boolean {
  return getFeatureFlags()[key];
}

export function setFeatureFlags(partial: Partial<FeatureFlags>): void {
  if (typeof window === "undefined") return;

  const current = readStoredFlags();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

