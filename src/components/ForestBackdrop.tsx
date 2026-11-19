import React, { useState } from 'react';
import twilightForestUrl from '../assets/images/twilight_pine_forest_1795014923624.jpg';

/**
 * Full-bleed twilight evergreen forest photograph backdrop with a subtle dark-moss edge vignette
 * so the pine trees and golden sunbeams stay vividly visible around the synth chassis.
 */
export const ForestBackdrop: React.FC = () => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(85% 65% at 50% 25%, rgba(217, 119, 6, 0.22) 0%, rgba(16, 42, 26, 0.78) 52%, #050a07 100%)',
      }}
    >
      {!imgFailed && (
        <img
          src={twilightForestUrl}
          alt="Twilight evergreen pine forest"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover object-center opacity-95 brightness-110 contrast-105 scale-[1.02]"
        />
      )}

      {/* Light vignette scrim preserving woodland trees & amber shafts while keeping chassis readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(80% 75% at 50% 45%, rgba(6, 11, 8, 0.14) 0%, rgba(5, 9, 6, 0.56) 100%)',
        }}
      />
    </div>
  );
};
