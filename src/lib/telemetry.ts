type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface TelemetryEvent<TProps extends Record<string, JsonValue>> {
  name: string;
  properties?: TProps;
  timestamp: string;
}

const STORAGE_KEY = "glyph:telemetry-buffer";
const MAX_BUFFERED_EVENTS = 200;

function readBufferedEvents(): TelemetryEvent<Record<string, JsonValue>>[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBufferedEvents(events: TelemetryEvent<Record<string, JsonValue>>[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFERED_EVENTS)));
}

export function trackEvent<TProps extends Record<string, JsonValue>>(
  name: string,
  properties?: TProps
): void {
  if (typeof window === "undefined") return;

  const event: TelemetryEvent<TProps> = {
    name,
    properties,
    timestamp: new Date().toISOString(),
  };

  const buffered = readBufferedEvents();
  buffered.push(event as TelemetryEvent<Record<string, JsonValue>>);
  writeBufferedEvents(buffered);

  // Allow adapters to subscribe via browser events.
  window.dispatchEvent(
    new CustomEvent("glyph:telemetry", {
      detail: event,
    })
  );
}

export function consumeBufferedEvents(): TelemetryEvent<Record<string, JsonValue>>[] {
  const buffered = readBufferedEvents();
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  return buffered;
}

