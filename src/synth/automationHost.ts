import { AutomationMapping, EMPTY_AUTOMATION_MAPPING, parseAutomation } from './automation';

export interface AutomationHostOptions {
  /** Slew step in ms used when advancing ramps. */
  tickMs?: number;
}

/**
 * Web-side reference implementation of the host's CC automation engine
 * (mirrors Modi's C++ `applyCcAutomation`):
 *   - learn binds the next CC to an armed parameter
 *   - a mapped CC sweeps [min, max] of the normalised parameter
 *   - slew ramps towards the target instead of stepping (no zipper)
 *   - unmapped CCs are ignored
 *
 * The JUCE host implements the same three native calls
 * (automationGet / automationSet / automationLearn); this class is the
 * contract the UI (and tests) run against when no host is present.
 */
export class AutomationHost {
  private readonly mappings = new Map<string, AutomationMapping>();
  private readonly targets = new Map<string, number>();
  private readonly positions = new Map<string, number>();
  private learnTarget: string | null = null;
  private readonly tickMs: number;

  constructor(options: AutomationHostOptions = {}) {
    this.tickMs = options.tickMs ?? 16;
  }

  get(id: string): AutomationMapping {
    return this.mappings.get(id) ?? { ...EMPTY_AUTOMATION_MAPPING };
  }

  set(id: string, mapping: unknown): AutomationMapping {
    const parsed = parseAutomation(mapping);
    this.mappings.set(id, parsed);
    if (parsed.cc < 0) {
      this.targets.delete(id);
      this.positions.delete(id);
    }
    return parsed;
  }

  learn(id: string | null): void {
    this.learnTarget = id;
  }

  isLearning(id: string): boolean {
    return this.learnTarget === id;
  }

  /** Feed an incoming CC. Returns normalised parameter updates. */
  onCc(cc: number, value01: number): Array<{ id: string; value: number }> {
    const v = Math.min(1, Math.max(0, value01));

    if (this.learnTarget) {
      const target = this.learnTarget;
      const m = this.get(target);
      this.mappings.set(target, { ...m, cc });
      this.learnTarget = null;
    }

    const updates: Array<{ id: string; value: number }> = [];
    for (const [id, m] of this.mappings) {
      if (m.cc !== cc) continue;
      const target = m.min + (m.max - m.min) * v;
      this.targets.set(id, target);
      if (m.slew <= 0) {
        this.positions.set(id, target);
        updates.push({ id, value: target });
      } else if (!this.positions.has(id)) {
        this.positions.set(id, target);
        updates.push({ id, value: target });
      }
    }
    return updates;
  }

  /** Advance slewed ramps. Returns parameter updates for this tick. */
  tick(): Array<{ id: string; value: number }> {
    const updates: Array<{ id: string; value: number }> = [];
    for (const [id, target] of this.targets) {
      const m = this.get(id);
      if (m.slew <= 0) continue;
      const pos = this.positions.get(id) ?? target;
      const step = this.tickMs / m.slew;
      const next = target > pos ? Math.min(target, pos + step) : Math.max(target, pos - step);
      this.positions.set(id, next);
      updates.push({ id, value: next });
      if (Math.abs(next - target) < 1e-4) this.targets.delete(id);
    }
    return updates;
  }
}
