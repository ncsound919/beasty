/**
 * CC-automation mapping contract (ported from Modi's automationGet/Set/Learn).
 *
 * The host (or the browser mock) returns a mapping for a parameter:
 *   { cc, min, max, slew }   — cc = -1 means unmapped.
 * Values are normalised 0..1 with an optional slew in milliseconds so 7-bit
 * CC steps do not zipper. Parsing is defensive: malformed input degrades to
 * the empty mapping rather than throwing.
 */

export interface AutomationMapping {
  cc: number;
  min: number;
  max: number;
  slew: number;
}

export interface AutomationEvent extends AutomationMapping {
  id: string;
}

export const EMPTY_AUTOMATION_MAPPING: AutomationMapping = {
  cc: -1,
  min: 0,
  max: 1,
  slew: 0,
};

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampNumber(value: unknown, fallback: number, lo: number, hi: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function parseAutomation(raw: unknown): AutomationMapping {
  const obj = (typeof raw === 'string' ? safeJson(raw) : raw) as
    | Partial<AutomationMapping>
    | null
    | undefined;

  if (!obj || typeof obj !== 'object') return { ...EMPTY_AUTOMATION_MAPPING };

  const cc = Math.round(clampNumber(obj.cc, -1, -1, 127));
  const a = clampNumber(obj.min, 0, 0, 1);
  const b = clampNumber(obj.max, 1, 0, 1);
  const slew = clampNumber(obj.slew, 0, 0, 2000);

  return {
    cc,
    min: Math.min(a, b),
    max: Math.max(a, b),
    slew,
  };
}

export function automationLabel(mapping: AutomationMapping): string {
  if (mapping.cc < 0) return 'Unmapped';
  const range = `${Math.round(mapping.min * 100)}–${Math.round(mapping.max * 100)}%`;
  const slew = mapping.slew > 0 ? `${Math.round(mapping.slew)} ms` : 'instant';
  return `CC ${mapping.cc} · ${range} · ${slew}`;
}
