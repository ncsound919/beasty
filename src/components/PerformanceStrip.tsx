import React from 'react';
import { ParamID, ParamState } from '../synth/parameters';
import { RotaryKnob } from './RotaryKnob';

interface PerformanceStripProps {
  params: ParamState;
  onChange: (id: ParamID, value: number) => void;
}

export const PerformanceStrip: React.FC<PerformanceStripProps> = ({ params, onChange }) => {
  return (
    <div
      aria-label="Drift, Pitch and Glide Controls"
      className="beasty-card-3d rounded-lg min-h-[36px] sm:h-[36px] px-2 py-1 sm:py-0.5 w-full max-w-[500px] mx-auto flex flex-wrap sm:flex-nowrap items-center justify-around gap-x-2 gap-y-1 sm:gap-1 shrink-0"
    >
      <RotaryKnob
        id="ANALOG_DRIFT"
        value={params.ANALOG_DRIFT}
        onChange={onChange}
        size="xxs"
        layout="inline"
        labelOverride="Drift"
        accent="copper"
      />
      <div className="hidden sm:block w-px h-4 bg-amber-500/15 shrink-0" aria-hidden="true" />
      <RotaryKnob
        id="PITCH_OFFSET"
        value={params.PITCH_OFFSET}
        onChange={onChange}
        size="xxs"
        layout="inline"
        labelOverride="Pitch"
        accent="ivory"
      />
      <div className="hidden sm:block w-px h-4 bg-amber-500/15 shrink-0" aria-hidden="true" />
      <RotaryKnob
        id="FINE_TUNE"
        value={params.FINE_TUNE}
        onChange={onChange}
        size="xxs"
        layout="inline"
        labelOverride="Tune"
        accent="ivory"
      />
      <div className="hidden sm:block w-px h-4 bg-amber-500/15 shrink-0" aria-hidden="true" />
      <RotaryKnob
        id="LEGATO"
        value={params.LEGATO}
        onChange={onChange}
        size="xxs"
        layout="inline"
        labelOverride="Legato"
        accent="amber"
      />
      <div className="hidden sm:block w-px h-4 bg-amber-500/15 shrink-0" aria-hidden="true" />
      <RotaryKnob
        id="GLIDE_TIME"
        value={params.GLIDE_TIME}
        onChange={onChange}
        size="xxs"
        layout="inline"
        labelOverride="Glide"
        accent="amber"
      />
    </div>
  );
};
