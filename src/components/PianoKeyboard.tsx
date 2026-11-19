import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PianoKeyboardProps {
  onNoteOn: (midiNote: number) => void;
  onNoteOff: (midiNote: number) => void;
  onPitchBend: (semitones: number) => void;
  onPanic: () => void;
  disabled?: boolean;
  panicSignal?: number;
}

const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17,
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_OFFSETS = new Set([1, 3, 6, 8, 10]);

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  onNoteOn,
  onNoteOff,
  onPitchBend,
  onPanic,
  disabled = false,
  panicSignal = 0,
}) => {
  const [baseOctave, setBaseOctave] = useState(3);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [holdLatch, setHoldLatch] = useState(false);
  const [bendVal, setBendVal] = useState(0);
  const pointerDownRef = useRef(false);
  const activePointerNoteRef = useRef<number | null>(null);
  const heldNotesRef = useRef<Set<number>>(new Set());
  const pressedMapRef = useRef<Map<string, number>>(new Map());

  const keys = useMemo(() => {
    const startMidi = (baseOctave + 1) * 12;
    const list: { midi: number; isBlack: boolean; label: string; keyHint?: string }[] = [];
    const totalSemis = 30;
    for (let i = 0; i < totalSemis; i++) {
      const midi = startMidi + i;
      const pc = midi % 12;
      const oct = Math.floor(midi / 12) - 1;
      const hintEntry = Object.entries(KEY_TO_SEMITONE).find(([, s]) => s === i);
      list.push({
        midi,
        isBlack: BLACK_OFFSETS.has(pc),
        label: pc === 0 ? `C${oct}` : NOTE_NAMES[pc],
        keyHint: hintEntry ? hintEntry[0].toUpperCase() : undefined,
      });
    }
    return list;
  }, [baseOctave]);

  const whiteKeys = useMemo(() => keys.filter((k) => !k.isBlack), [keys]);

  const triggerNoteOn = useCallback(
    (midi: number) => {
      if (holdLatch) {
        if (heldNotesRef.current.has(midi)) {
          heldNotesRef.current.delete(midi);
          onNoteOff(midi);
          setActiveNotes(new Set(heldNotesRef.current));
          return;
        }
        heldNotesRef.current.add(midi);
        onNoteOn(midi);
        setActiveNotes(new Set(heldNotesRef.current));
        return;
      }

      setActiveNotes((prev) => {
        if (prev.has(midi)) return prev;
        const next = new Set(prev);
        next.add(midi);
        return next;
      });
      onNoteOn(midi);
    },
    [holdLatch, onNoteOff, onNoteOn],
  );

  const triggerNoteOff = useCallback(
    (midi: number) => {
      if (holdLatch) return;
      setActiveNotes((prev) => {
        if (!prev.has(midi)) return prev;
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
      onNoteOff(midi);
    },
    [holdLatch, onNoteOff],
  );

  const kbRef = useRef({ baseOctave, triggerNoteOff, triggerNoteOn, disabled });
  kbRef.current = { baseOctave, triggerNoteOff, triggerNoteOn, disabled };

  // Clear local note state whenever global Panic triggers
  useEffect(() => {
    if (panicSignal === 0) return;
    pressedMapRef.current.clear();
    heldNotesRef.current.clear();
    pointerDownRef.current = false;
    activePointerNoteRef.current = null;
    setActiveNotes(new Set());
  }, [panicSignal]);

  // Single-mount keyboard, blur, and global pointerup handlers so octave/hold shifts never orphan notes
  useEffect(() => {
    const releaseAllTransient = () => {
      const { triggerNoteOff: off } = kbRef.current;
      pressedMapRef.current.forEach((midi) => off(midi));
      pressedMapRef.current.clear();
      if (activePointerNoteRef.current !== null) {
        off(activePointerNoteRef.current);
        activePointerNoteRef.current = null;
      }
      pointerDownRef.current = false;
    };

    const handleGlobalPointerUp = () => {
      if (pointerDownRef.current || activePointerNoteRef.current !== null) {
        if (activePointerNoteRef.current !== null) {
          kbRef.current.triggerNoteOff(activePointerNoteRef.current);
          activePointerNoteRef.current = null;
        }
        pointerDownRef.current = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || kbRef.current.disabled) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'z') {
        setBaseOctave((o) => Math.max(1, o - 1));
        return;
      }
      if (k === 'x') {
        setBaseOctave((o) => Math.min(5, o + 1));
        return;
      }
      if (k in KEY_TO_SEMITONE) {
        if (!pressedMapRef.current.has(k)) {
          const midi = (kbRef.current.baseOctave + 1) * 12 + KEY_TO_SEMITONE[k];
          pressedMapRef.current.set(k, midi);
          kbRef.current.triggerNoteOn(midi);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const midi = pressedMapRef.current.get(k);
      if (midi !== undefined) {
        pressedMapRef.current.delete(k);
        kbRef.current.triggerNoteOff(midi);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAllTransient);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAllTransient);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      releaseAllTransient();
    };
  }, []);

  const toggleHold = () => {
    if (holdLatch) {
      heldNotesRef.current.forEach((m) => onNoteOff(m));
      heldNotesRef.current.clear();
      setActiveNotes(new Set());
      onPanic();
    }
    setHoldLatch((h) => !h);
  };

  const handleBendPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const normY = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
    const bi = Math.max(-1, Math.min(1, normY * 2 - 1));
    setBendVal(bi);
    onPitchBend(bi * 2);
  };

  const resetBend = () => {
    setBendVal(0);
    onPitchBend(0);
  };

  return (
    <div className="flex flex-col md:flex-row items-stretch gap-2 md:gap-2.5 pt-1.5 border-t border-amber-500/20">
      {/* Left Pitch Bend & Octave Strip */}
      <div className="flex items-center justify-between md:justify-start gap-2 shrink-0 pb-1.5 md:pb-0 md:pr-2.5 border-b md:border-b-0 md:border-r border-white/[0.08]">
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <div className="flex flex-col justify-between h-[42px] text-[7.5px] font-mono-tabular text-[#6f7e72] leading-none py-0.5" aria-hidden="true">
              <span>+2</span>
              <span>0</span>
              <span>-2</span>
            </div>
            <div
              role="slider"
              aria-label="Pitch Bend"
              aria-valuemin={-2}
              aria-valuemax={2}
              aria-valuenow={Number((bendVal * 2).toFixed(1))}
              tabIndex={0}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handleBendPointer(e);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) handleBendPointer(e);
              }}
              onPointerUp={resetBend}
              onPointerCancel={resetBend}
              className="relative w-6 h-[48px] rounded-md bg-[#050806] border border-amber-500/35 shadow-[inset_0_3px_8px_rgba(0,0,0,0.95)] cursor-ns-resize overflow-hidden select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title="Pitch Bend Wheel (+/-2 semitones)"
            >
              <div className="absolute inset-x-1 top-1/2 h-px bg-amber-300/30" />
              <div
                className="absolute inset-x-0.5 h-3 rounded-[3px] bg-gradient-to-b from-amber-200 via-amber-500 to-amber-800 border border-amber-200/45 shadow-[0_2px_5px_rgba(0,0,0,0.85)] flex flex-col justify-center gap-[1.5px] px-1"
                style={{
                  top: `calc(${(1 - (bendVal + 1) / 2) * 70}% + 2px)`,
                }}
              >
                <span className="block h-px bg-black/45" />
                <span className="block h-px bg-amber-100/50" />
                <span className="block h-px bg-black/45" />
              </div>
            </div>
          </div>
          <span className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-[#98a69a] leading-none">Pitch</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center rounded-md bg-[#070b08] border border-white/[0.12] p-0.5">
            <button
              type="button"
              onClick={() => setBaseOctave((o) => Math.max(1, o - 1))}
              className="px-1.5 py-0.5 text-[11px] font-mono-tabular text-[#c2cec3] hover:text-amber-300 transition-colors"
              title="Octave Down (Z)"
            >
              -
            </button>
            <span className="px-1 text-[11px] font-mono-tabular font-semibold text-[#f4efe6]">
              C{baseOctave}
            </span>
            <button
              type="button"
              onClick={() => setBaseOctave((o) => Math.min(5, o + 1))}
              className="px-1.5 py-0.5 text-[11px] font-mono-tabular text-[#c2cec3] hover:text-amber-300 transition-colors"
              title="Octave Up (X)"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={toggleHold}
            aria-pressed={holdLatch}
            className={`flex items-center justify-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors ${
              holdLatch
                ? 'border-amber-400/70 bg-amber-500/25 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                : 'border-white/[0.12] bg-[#121914] text-[#9aa89c] hover:text-[#f4efe6]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                holdLatch ? 'bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.95)]' : 'bg-[#2a382d]'
              }`}
            />
            <span>{holdLatch ? 'Hold On' : 'Hold'}</span>
          </button>
        </div>
      </div>

      {/* Realistic 3D Sculpted Piano Keybed with Crimson Felt Rail (scrollable on narrow phones) */}
      <div className="flex-1 min-w-0 overflow-x-auto beasty-scroll">
        <div
          className="relative w-full min-w-[560px] md:min-w-0 h-[68px] select-none touch-none rounded-b-lg bg-[#050706] p-[2px] pt-[4px] shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)]"
        onPointerUp={() => {
          pointerDownRef.current = false;
          if (activePointerNoteRef.current !== null) {
            triggerNoteOff(activePointerNoteRef.current);
            activePointerNoteRef.current = null;
          }
        }}
        onPointerLeave={() => {
          if (pointerDownRef.current && activePointerNoteRef.current !== null) {
            triggerNoteOff(activePointerNoteRef.current);
            activePointerNoteRef.current = null;
          }
          pointerDownRef.current = false;
        }}
      >
        {/* Classic Velvet Crimson Keybed Felt Strip */}
        <div
          className="absolute inset-x-[2px] top-[1px] h-[5px] rounded-t-sm"
          style={{
            background: 'linear-gradient(180deg, #4b1212 0%, #7a1d1d 60%, #2a0909 100%)',
          }}
        />

        {/* Sculpted 3D Ivory White Keys */}
        <div className="flex w-full h-full gap-[2px]">
          {whiteKeys.map((wk) => {
            const isActive = activeNotes.has(wk.midi);
            return (
              <button
                key={wk.midi}
                type="button"
                aria-label={wk.label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pointerDownRef.current = true;
                  activePointerNoteRef.current = wk.midi;
                  triggerNoteOn(wk.midi);
                }}
                onPointerEnter={() => {
                  if (pointerDownRef.current && activePointerNoteRef.current !== wk.midi) {
                    if (activePointerNoteRef.current !== null) {
                      triggerNoteOff(activePointerNoteRef.current);
                    }
                    activePointerNoteRef.current = wk.midi;
                    triggerNoteOn(wk.midi);
                  }
                }}
                className={`relative flex-1 h-full rounded-b-[4px] transition-all duration-75 flex flex-col justify-end items-center pb-1 ${
                  isActive
                    ? 'translate-y-[2px] border-b-[3px] border-[#b45309] bg-gradient-to-b from-[#fef3c7] via-[#fde68a] to-[#f59e0b] text-[#2a1705] shadow-[inset_0_5px_8px_rgba(0,0,0,0.3)]'
                    : 'border-b-[5px] border-[#a39988] bg-gradient-to-b from-[#f8f4ec] via-[#efe9dc] to-[#dcd3c1] text-[#5e5549] shadow-[inset_0_4px_6px_rgba(0,0,0,0.22),inset_0_1px_2px_rgba(255,255,255,0.85),inset_-1px_0_2px_rgba(0,0,0,0.08)] hover:from-[#fffdf9]'
                }`}
              >
                {wk.midi % 12 === 0 && (
                  <span className="text-[7.5px] font-mono-tabular font-bold text-[#7c7162]/85 leading-none mb-0.5">
                    {wk.label}
                  </span>
                )}
                {wk.keyHint && (
                  <span className="text-[8.5px] font-mono-tabular font-semibold opacity-65 leading-none">
                    {wk.keyHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sculpted 3D Ebony Black Keys with Realistic Piano Staggered Geometry */}
        <div className="absolute inset-x-[2px] top-[4px] h-[56%] pointer-events-none">
          {keys.map((k, idx) => {
            if (!k.isBlack) return null;
            const whitesBefore = keys.slice(0, idx).filter((x) => !x.isBlack).length;
            const pc = k.midi % 12;
            const stagger = pc === 1 || pc === 6 ? -0.07 : pc === 3 || pc === 10 ? 0.07 : 0;
            const leftPct = ((whitesBefore + stagger) / whiteKeys.length) * 100;
            const widthPct = (1 / whiteKeys.length) * 62;
            const isActive = activeNotes.has(k.midi);

            return (
              <button
                key={k.midi}
                type="button"
                aria-label={k.label}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  pointerDownRef.current = true;
                  activePointerNoteRef.current = k.midi;
                  triggerNoteOn(k.midi);
                }}
                onPointerEnter={() => {
                  if (pointerDownRef.current && activePointerNoteRef.current !== k.midi) {
                    if (activePointerNoteRef.current !== null) {
                      triggerNoteOff(activePointerNoteRef.current);
                    }
                    activePointerNoteRef.current = k.midi;
                    triggerNoteOn(k.midi);
                  }
                }}
                style={{
                  left: `calc(${leftPct}% - ${widthPct / 2}%)`,
                  width: `${widthPct}%`,
                }}
                className={`absolute top-0 h-full pointer-events-auto rounded-b-[3px] border-x border-[#050605] transition-all duration-75 flex flex-col justify-end items-center pb-1 ${
                  isActive
                    ? 'translate-y-[2px] border-b-[2px] border-amber-700 bg-gradient-to-b from-[#d97706] via-[#b45309] to-[#78350f] text-amber-100 shadow-[0_2px_4px_rgba(0,0,0,0.75)]'
                    : 'border-b-[5px] border-[#050605] bg-gradient-to-b from-[#333633] via-[#191b19] to-[#0a0b0a] text-[#98a69a] shadow-[0_3px_6px_rgba(0,0,0,0.78),inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(255,255,255,0.06)] hover:from-[#3e423e]'
                }`}
              >
                {/* Top specular ebony ridge */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-[2px] top-[2px] bottom-[7px] rounded-[2px] pointer-events-none border border-white/[0.08]"
                />
                {k.keyHint && (
                  <span className="relative z-10 text-[8.5px] font-mono-tabular font-semibold opacity-80 leading-none">
                    {k.keyHint}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
};
