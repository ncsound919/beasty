import { ALL_PARAM_IDS, ParamID, normToValue, valueToNorm } from './parameters';
import { AutomationEvent, AutomationMapping, parseAutomation } from './automation';

interface JuceGlobal {
  initialisationData?: {
    __juce__functions?: string[];
    __juce__sliders?: string[];
  };
  postMessage?: (msg: string) => void;
  backend?: {
    addEventListener?: (eventId: string, cb: (payload: unknown) => void) => void;
    emitByBackend?: (eventId: string, jsonPayload: string) => void;
  };
}

declare global {
  interface Window {
    __JUCE__?: JuceGlobal;
  }
}

type ParamUpdateCb = (id: ParamID, value: number) => void;

const ALL_PARAM_SET = new Set<string>(ALL_PARAM_IDS);

class JuceBridge {
  private isJuceEnv = false;
  private listeners: Set<ParamUpdateCb> = new Set();
  private initialized = false;

  init(): boolean {
    if (this.initialized) return this.isJuceEnv;
    this.initialized = true;

    const juce = window.__JUCE__;
    this.isJuceEnv = Boolean(juce && typeof juce.postMessage === 'function' && juce.backend);
    if (!this.isJuceEnv || !juce?.backend?.addEventListener) {
      return false;
    }

    for (const id of ALL_PARAM_IDS) {
      const eventId = `__juce__slider${id}`;
      juce.backend.addEventListener(eventId, (rawPayload: unknown) => {
        try {
          const payload =
            typeof rawPayload === 'string'
              ? JSON.parse(rawPayload)
              : (rawPayload as { eventType?: string; value?: number });
          if (payload?.eventType === 'valueChanged' && typeof payload.value === 'number') {
            this.listeners.forEach((cb) => cb(id, payload.value as number));
          }
        } catch {
          // Ignore malformed payloads
        }
      });

      juce.postMessage?.(
        JSON.stringify({
          eventId,
          payload: { eventType: 'requestInitialUpdate' },
        }),
      );
    }

    return true;
  }

  isHostedInJuce(): boolean {
    return this.isJuceEnv;
  }

  onHostParamChange(cb: ParamUpdateCb): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  sendParam(id: ParamID, value: number): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage || !ALL_PARAM_SET.has(id)) return;
    const norm = valueToNorm(id, value);
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: `__juce__slider${id}`,
        payload: {
          eventType: 'valueChanged',
          value,
          normalisedValue: norm,
        },
      }),
    );
  }

  invokeNoteOn(midiNote: number): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage) return;
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: '__juce__invoke',
        payload: {
          name: 'noteOn',
          params: [midiNote],
          resultId: Date.now(),
        },
      }),
    );
  }

  invokeNoteOff(midiNote: number): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage) return;
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: '__juce__invoke',
        payload: {
          name: 'noteOff',
          params: [midiNote],
          resultId: Date.now(),
        },
      }),
    );
  }

  invokePitchBend(semis: number): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage) return;
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: '__juce__invoke',
        payload: {
          name: 'pitchBend',
          params: [semis],
          resultId: Date.now(),
        },
      }),
    );
  }

  invokePanic(): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage) return;
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: '__juce__invoke',
        payload: {
          name: 'panic',
          params: [],
          resultId: Date.now(),
        },
      }),
    );
  }

  // ---- CC automation (ported from Modi: automationGet / Set / Learn) -------
  requestAutomation(id: ParamID): void {
    this.invokeHost('automationGet', [id]);
  }

  setAutomation(id: ParamID, mapping: AutomationMapping): void {
    this.invokeHost('automationSet', [id, JSON.stringify(mapping)]);
  }

  learnAutomation(id: ParamID): void {
    this.invokeHost('automationLearn', [id]);
  }

  onAutomation(cb: (event: AutomationEvent) => void): () => void {
    const backend = window.__JUCE__?.backend;
    if (!this.isJuceEnv || !backend?.addEventListener) return () => {};
    backend.addEventListener('automation', (raw: unknown) => {
      const parsed = parseAutomation(raw);
      const id = (raw as { id?: string })?.id ?? '';
      cb({ ...parsed, id });
    });
    return () => {};
  }

  applyNormFromHost(id: ParamID, norm: number): number {
    return normToValue(id, norm);
  }

  private invokeHost(name: string, params: unknown[]): void {
    if (!this.isJuceEnv || !window.__JUCE__?.postMessage) return;
    window.__JUCE__.postMessage(
      JSON.stringify({
        eventId: '__juce__invoke',
        payload: { name, params, resultId: Date.now() },
      }),
    );
  }
}

export const juceBridge = new JuceBridge();
