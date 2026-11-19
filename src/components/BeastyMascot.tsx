import React, { useEffect, useRef, useState } from 'react';
import { SynthTelemetry } from '../synth/audioEngine';
import { ParamState } from '../synth/parameters';

interface BeastyMascotProps {
  params: ParamState;
  getTelemetry: () => SynthTelemetry;
  onRoar: () => void;
}

export type BearMood =
  | 'Cozy Nap'
  | 'Dreamy Mist'
  | 'Honey Hum'
  | 'Woodland Pluck'
  | 'Sub Rumble'
  | 'Acid Squelch'
  | 'Singing Lead'
  | 'Feral Growl'
  | 'Analog Wobble'
  | 'Full Roar';

function computeMood(p: ParamState, energy: number, roarBoost: number, activeVoices: number): BearMood {
  const drive = p.FILTER_DRIVE + (p.FX_SAT_ON >= 0.5 ? p.FX_SAT_DRIVE * 0.35 : 0);
  const res = p.FILTER_RES;
  const drift = p.ANALOG_DRIFT;
  const cut = p.FILTER_CUTOFF;
  const atk = p.AENV_ATTACK;
  const dec = p.AENV_DECAY;
  const sus = p.AENV_SUSTAIN;
  const hasSpaceFx =
    (p.FX_REVERB_ON >= 0.5 && p.FX_REVERB_MIX > 0.3) ||
    (p.FX_PHASER_ON >= 0.5 && p.FX_PHASER_MIX > 0.3) ||
    (p.FX_DELAY_ON >= 0.5 && p.FX_DELAY_MIX > 0.3);

  if (roarBoost > 0.18 || energy > 0.42) return 'Full Roar';
  if (res >= 0.65) return 'Acid Squelch';
  if (drive >= 0.7) return 'Feral Growl';
  if (drift >= 0.65 || (p.FX_FLANGER_ON >= 0.5 && p.FX_FLANGER_MIX > 0.3)) return 'Analog Wobble';
  if (atk >= 0.25 && hasSpaceFx) return 'Dreamy Mist';
  if (dec < 0.36 && sus < 0.26) return 'Woodland Pluck';
  if (cut < 680 && (p.OSC1_RANGE <= 1 || p.OSC3_RANGE === 0)) return 'Sub Rumble';
  if (cut >= 1700 && sus >= 0.72) return 'Singing Lead';
  if (activeVoices === 0 && drive < 0.28 && cut < 820) return 'Cozy Nap';
  return 'Honey Hum';
}

export const BeastyMascot: React.FC<BeastyMascotProps> = ({ params, getTelemetry, onRoar }) => {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const headRef = useRef<SVGGElement>(null);
  const leftEarRef = useRef<SVGGElement>(null);
  const rightEarRef = useRef<SVGGElement>(null);
  const leftBrowRef = useRef<SVGPathElement>(null);
  const rightBrowRef = useRef<SVGPathElement>(null);
  const leftEyeGroupRef = useRef<SVGGElement>(null);
  const rightEyeGroupRef = useRef<SVGGElement>(null);
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const leftIrisRef = useRef<SVGCircleElement>(null);
  const rightIrisRef = useRef<SVGCircleElement>(null);
  const leftLidRef = useRef<SVGPathElement>(null);
  const rightLidRef = useRef<SVGPathElement>(null);
  const mouthOpenRef = useRef<SVGEllipseElement>(null);
  const mouthSmileRef = useRef<SVGPathElement>(null);
  const teethRef = useRef<SVGPathElement>(null);
  const tongueRef = useRef<SVGEllipseElement>(null);
  const leftCheekRef = useRef<SVGEllipseElement>(null);
  const rightCheekRef = useRef<SVGEllipseElement>(null);
  const auraRing1Ref = useRef<SVGCircleElement>(null);
  const auraRing2Ref = useRef<SVGCircleElement>(null);
  const coreTubeRef = useRef<SVGCircleElement>(null);

  const roarBoostRef = useRef(0);
  const [mood, setMood] = useState<BearMood>('Honey Hum');
  const moodRef = useRef<BearMood>('Honey Hum');

  useEffect(() => {
    let rafId = 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let smoothedRms = 0;
    let smoothedFenv = 0;
    let lastMoodCheck = 0;

    const animate = (now: number) => {
      if (document.hidden) {
        rafId = requestAnimationFrame(animate);
        return;
      }
      const t = now * 0.001;
      const p = paramsRef.current;
      const tel = getTelemetry();

      smoothedRms += (tel.rms - smoothedRms) * 0.24;
      smoothedFenv += (tel.filterEnv - smoothedFenv) * 0.25;
      roarBoostRef.current *= 0.92;

      const energy = Math.min(1, smoothedRms * 2.8 + roarBoostRef.current);
      const drive = p.FILTER_DRIVE;
      const res = p.FILTER_RES;
      const drift = p.ANALOG_DRIFT;

      if (now - lastMoodCheck > 140) {
        lastMoodCheck = now;
        const nextMood = computeMood(p, energy, roarBoostRef.current, tel.activeVoices);
        if (nextMood !== moodRef.current) {
          moodRef.current = nextMood;
          setMood(nextMood);
        }
      }

      const curMood = moodRef.current;

      if (!reducedMotion) {
        // Head sway & cozy breathing tailored to mood
        const wobbleAmp = curMood === 'Analog Wobble' ? 6.5 : curMood === 'Full Roar' ? 3.5 : 1.2 + drift * 2.4;
        const breathSpeed = curMood === 'Cozy Nap' ? 1.05 : curMood === 'Woodland Pluck' ? 2.4 : 1.65;
        const breathY = Math.sin(t * breathSpeed) * 1.8 - energy * 3.4;
        const headScale = 1 + energy * 0.045 + (curMood === 'Sub Rumble' ? 0.018 : 0);
        const headTilt = Math.sin(t * (curMood === 'Analog Wobble' ? 1.9 : 0.95)) * wobbleAmp;

        if (headRef.current) {
          headRef.current.setAttribute(
            'transform',
            `translate(120 ${124 + breathY}) scale(${headScale}) rotate(${headTilt}) translate(-120 -124)`,
          );
        }

        // Bear ear wiggle
        const earBase = curMood === 'Full Roar' ? 10 : curMood === 'Cozy Nap' ? 0.8 : 2.2 + drift * 6;
        const earWiggleL = Math.sin(t * 2.6 + 0.5) * earBase - energy * 7;
        const earWiggleR = Math.sin(t * 2.3 + 2.1) * earBase + energy * 7;
        if (leftEarRef.current) leftEarRef.current.setAttribute('transform', `rotate(${earWiggleL} 68 62)`);
        if (rightEarRef.current) rightEarRef.current.setAttribute('transform', `rotate(${earWiggleR} 172 62)`);

        // Brow geometry per mood
        const lift = -energy * 3.2 - smoothedFenv * 2.2;
        if (leftBrowRef.current && rightBrowRef.current) {
          if (curMood === 'Feral Growl' || curMood === 'Full Roar') {
            leftBrowRef.current.setAttribute('d', `M 79 ${83 + lift} Q 92 ${87 + lift} 105 ${91 + lift}`);
            rightBrowRef.current.setAttribute('d', `M 135 ${91 + lift} Q 148 ${87 + lift} 161 ${83 + lift}`);
          } else if (curMood === 'Acid Squelch') {
            leftBrowRef.current.setAttribute('d', `M 80 ${88 + lift} Q 92 ${85 + lift} 103 ${88 + lift}`);
            rightBrowRef.current.setAttribute('d', `M 137 ${80 + lift} Q 148 ${73 + lift} 160 ${80 + lift}`);
          } else if (curMood === 'Cozy Nap') {
            leftBrowRef.current.setAttribute('d', `M 80 88 Q 92 86 103 88`);
            rightBrowRef.current.setAttribute('d', `M 137 88 Q 148 86 160 88`);
          } else if (curMood === 'Woodland Pluck' || curMood === 'Singing Lead' || curMood === 'Dreamy Mist') {
            leftBrowRef.current.setAttribute('d', `M 80 ${83 + lift} Q 92 ${74 + lift} 103 ${83 + lift}`);
            rightBrowRef.current.setAttribute('d', `M 137 ${83 + lift} Q 148 ${74 + lift} 160 ${83 + lift}`);
          } else if (curMood === 'Sub Rumble') {
            leftBrowRef.current.setAttribute('d', `M 79 ${88 + lift} Q 92 ${89 + lift} 104 ${90 + lift}`);
            rightBrowRef.current.setAttribute('d', `M 136 ${90 + lift} Q 148 ${89 + lift} 161 ${88 + lift}`);
          } else {
            leftBrowRef.current.setAttribute('d', `M 80 ${86 + lift} Q 92 ${80 + lift} 103 ${86 + lift}`);
            rightBrowRef.current.setAttribute('d', `M 137 ${86 + lift} Q 148 ${80 + lift} 160 ${86 + lift}`);
          }
        }

        // Eyelids & Blink per mood
        const blinkCycle = t % 4.1;
        const isBlinking = blinkCycle > 3.96;
        let eyeScaleY = isBlinking ? Math.max(0.12, Math.abs(blinkCycle - 4.03) / 0.07) : 1;
        if (curMood === 'Cozy Nap') eyeScaleY = 0.28;
        else if (curMood === 'Sub Rumble') eyeScaleY = Math.min(eyeScaleY, 0.72);
        else if (curMood === 'Woodland Pluck') eyeScaleY = isBlinking ? eyeScaleY : 1.08;

        if (leftEyeGroupRef.current && rightEyeGroupRef.current) {
          const rEyeScale = curMood === 'Acid Squelch' && !isBlinking ? 1.1 : eyeScaleY;
          const lEyeScale = curMood === 'Acid Squelch' && !isBlinking ? 0.78 : eyeScaleY;
          leftEyeGroupRef.current.setAttribute('transform', `translate(92 102) scale(1 ${lEyeScale.toFixed(2)}) translate(-92 -102)`);
          rightEyeGroupRef.current.setAttribute('transform', `translate(148 102) scale(1 ${rEyeScale.toFixed(2)}) translate(-148 -102)`);
        }

        // Sleepy lids visibility for Cozy Nap
        if (leftLidRef.current && rightLidRef.current) {
          const lidOp = curMood === 'Cozy Nap' ? '0.95' : '0';
          leftLidRef.current.setAttribute('opacity', lidOp);
          rightLidRef.current.setAttribute('opacity', lidOp);
        }

        // Iris Color & Pupil Drift
        let irisColor = '#fbbf24';
        if (curMood === 'Feral Growl' || curMood === 'Full Roar') irisColor = '#fb923c';
        else if (curMood === 'Acid Squelch') irisColor = '#a3e635';
        else if (curMood === 'Dreamy Mist') irisColor = '#6ee7b7';
        else if (curMood === 'Sub Rumble') irisColor = '#d97706';

        if (leftIrisRef.current && rightIrisRef.current) {
          leftIrisRef.current.setAttribute('fill', irisColor);
          rightIrisRef.current.setAttribute('fill', irisColor);
          const irisOp = Math.min(1, 0.8 + energy * 0.2 + res * 0.12).toFixed(2);
          leftIrisRef.current.setAttribute('opacity', irisOp);
          rightIrisRef.current.setAttribute('opacity', irisOp);
        }

        if (leftPupilRef.current && rightPupilRef.current) {
          const px = curMood === 'Analog Wobble' ? Math.sin(t * 4.2) * 3.2 : curMood === 'Acid Squelch' ? 1.8 : 0;
          const py = curMood === 'Analog Wobble' ? Math.cos(t * 3.7) * 2.4 : 0;
          leftPupilRef.current.setAttribute('cx', (92 + px).toFixed(1));
          leftPupilRef.current.setAttribute('cy', (102 + py).toFixed(1));
          rightPupilRef.current.setAttribute('cx', (148 - px).toFixed(1));
          rightPupilRef.current.setAttribute('cy', (102 - py).toFixed(1));
        }

        // Cheek Blush / Puff
        if (leftCheekRef.current && rightCheekRef.current) {
          const rx = curMood === 'Sub Rumble' ? '14' : '11';
          const op = curMood === 'Singing Lead' || curMood === 'Honey Hum' ? '0.42' : '0.26';
          leftCheekRef.current.setAttribute('rx', rx);
          rightCheekRef.current.setAttribute('rx', rx);
          leftCheekRef.current.setAttribute('opacity', op);
          rightCheekRef.current.setAttribute('opacity', op);
        }

        // Dynamic Mouth Expressions across 10 moods
        const isOpenMood =
          curMood === 'Full Roar' ||
          curMood === 'Singing Lead' ||
          curMood === 'Woodland Pluck' ||
          curMood === 'Feral Growl' ||
          energy > 0.14;

        let mouthRy = 2.2 + energy * 11.5 + roarBoostRef.current * 4.2;
        let mouthRx = 7 + energy * 7.5;
        if (curMood === 'Woodland Pluck' && energy < 0.15) {
          mouthRx = 5.5;
          mouthRy = 4.8;
        } else if (curMood === 'Singing Lead') {
          mouthRx = 9.5 + energy * 5;
          mouthRy = Math.max(5.2, mouthRy);
        } else if (curMood === 'Feral Growl') {
          mouthRx = 13 + energy * 4;
          mouthRy = Math.max(6.2, mouthRy);
        } else if (curMood === 'Sub Rumble') {
          mouthRx = 8;
          mouthRy = 3 + energy * 5;
        } else if (!isOpenMood) {
          mouthRx = 5;
          mouthRy = 1.6;
        }

        if (mouthOpenRef.current && tongueRef.current && teethRef.current && mouthSmileRef.current) {
          mouthOpenRef.current.setAttribute('ry', mouthRy.toFixed(2));
          mouthOpenRef.current.setAttribute('rx', mouthRx.toFixed(2));
          mouthOpenRef.current.setAttribute('opacity', isOpenMood || curMood === 'Sub Rumble' ? '1' : '0.45');

          tongueRef.current.setAttribute('opacity', mouthRy > 4.2 ? '0.9' : '0');
          tongueRef.current.setAttribute('cy', (146 + mouthRy * 0.34).toFixed(2));

          teethRef.current.setAttribute('opacity', curMood === 'Feral Growl' || curMood === 'Full Roar' ? '0.92' : '0');

          if (curMood === 'Acid Squelch') {
            mouthSmileRef.current.setAttribute('d', 'M 120 129 L 120 136 M 106 139 Q 114 142 120 137 Q 128 145 137 134');
          } else if (curMood === 'Analog Wobble') {
            mouthSmileRef.current.setAttribute('d', 'M 120 129 L 120 137 M 105 136 Q 112 145 120 137 Q 128 141 135 140');
          } else if (curMood === 'Cozy Nap' || curMood === 'Dreamy Mist') {
            mouthSmileRef.current.setAttribute('d', 'M 120 129 L 120 136 M 109 138 Q 115 143 120 137 Q 125 143 131 138');
          } else {
            mouthSmileRef.current.setAttribute('d', 'M 120 129 L 120 137 M 106 138 Q 113 145 120 137 Q 127 145 134 138');
          }
        }

        // Aura Rings
        if (auraRing1Ref.current && auraRing2Ref.current) {
          const r1 = 98 + energy * 12 + Math.sin(t * 2.0) * 1.4;
          const r2 = 86 + smoothedFenv * 9 + energy * 7;
          auraRing1Ref.current.setAttribute('r', r1.toFixed(1));
          auraRing1Ref.current.setAttribute('stroke', irisColor);
          auraRing1Ref.current.setAttribute('stroke-opacity', (0.16 + energy * 0.42).toFixed(2));
          auraRing2Ref.current.setAttribute('r', r2.toFixed(1));
          auraRing2Ref.current.setAttribute('stroke-opacity', (0.14 + smoothedFenv * 0.38).toFixed(2));
        }

        if (coreTubeRef.current) {
          coreTubeRef.current.setAttribute('fill', irisColor);
          coreTubeRef.current.setAttribute('opacity', Math.min(1, 0.55 + smoothedFenv * 0.35 + energy * 0.25).toFixed(2));
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [getTelemetry]);

  const handlePoke = () => {
    roarBoostRef.current = 1.0;
    onRoar();
  };

  return (
    <div className="beasty-card-3d rounded-xl w-full h-full lg:h-[222px] px-2.5 py-2 flex flex-col items-center justify-between gap-1.5">
      <div
        onClick={handlePoke}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handlePoke();
          }
        }}
        title="Click Beasty for a sub-bass roar (Expression shifts across 10 sound moods)"
        className="relative w-[156px] h-[156px] sm:w-[178px] sm:h-[178px] flex items-center justify-center rounded-full recessed-screen border border-amber-500/35 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shadow-[inset_0_4px_16px_rgba(0,0,0,0.95),0_0_18px_rgba(245,158,11,0.08)]"
      >
        <svg viewBox="0 0 240 240" className="w-full h-full overflow-hidden rounded-full select-none">
          <defs>
            <radialGradient id="forestMedallion" cx="50%" cy="34%" r="64%">
              <stop offset="0%" stopColor="#264731" stopOpacity="0.92" />
              <stop offset="55%" stopColor="#122418" stopOpacity="0.97" />
              <stop offset="100%" stopColor="#060b08" stopOpacity="1" />
            </radialGradient>
            <radialGradient id="canopyWarmth" cx="50%" cy="32%" r="48%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bearCoat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#82573b" />
              <stop offset="48%" stopColor="#583926" />
              <stop offset="100%" stopColor="#2a1a10" />
            </linearGradient>
            <radialGradient id="bearFaceHighlight" cx="50%" cy="36%" r="55%">
              <stop offset="0%" stopColor="#946546" stopOpacity="0.58" />
              <stop offset="70%" stopColor="#583926" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bearSnout" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cca077" />
              <stop offset="55%" stopColor="#b08159" />
              <stop offset="100%" stopColor="#775135" />
            </linearGradient>
            <linearGradient id="bearEarInner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bc8e67" />
              <stop offset="100%" stopColor="#6e4a31" />
            </linearGradient>
            <linearGradient id="brassCollar" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3be6b" />
              <stop offset="48%" stopColor="#8c5f27" />
              <stop offset="100%" stopColor="#d9963b" />
            </linearGradient>
          </defs>

          {/* Layered Forest Glade Medallion */}
          <circle cx="120" cy="120" r="118" fill="url(#forestMedallion)" />
          <circle cx="120" cy="82" r="76" fill="url(#canopyWarmth)" />
          {/* Distant Misty Ridge */}
          <path
            d="M 4 176 Q 55 148 120 158 Q 185 168 236 146 L 236 236 L 4 236 Z"
            fill="#0d1d13"
            opacity="0.72"
          />
          {/* Foreground Pine Silhouettes */}
          <path
            d="M 8 188 L 24 128 L 36 164 L 52 104 L 68 158 L 84 124 L 100 168 L 140 168 L 158 118 L 174 156 L 190 102 L 206 164 L 220 132 L 232 188 L 232 236 L 8 236 Z"
            fill="#08120c"
            opacity="0.9"
          />
          {/* Firefly Forest Spores */}
          <circle cx="38" cy="72" r="1.4" fill="#fde68a" opacity="0.65" />
          <circle cx="204" cy="64" r="1.6" fill="#fcd34d" opacity="0.55" />
          <circle cx="28" cy="122" r="1.1" fill="#a7f3d0" opacity="0.5" />
          <circle cx="212" cy="118" r="1.2" fill="#fde68a" opacity="0.6" />

          {/* Precision Brass Medallion Calibration Ring */}
          <circle cx="120" cy="120" r="113" fill="none" stroke="rgba(245, 158, 11, 0.24)" strokeWidth="0.9" strokeDasharray="2 7.85" />

          <circle
            ref={auraRing1Ref}
            cx="120"
            cy="120"
            r="98"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeOpacity="0.18"
            strokeDasharray="4 6"
          />
          <circle
            ref={auraRing2Ref}
            cx="120"
            cy="120"
            r="86"
            fill="none"
            stroke="#4ade80"
            strokeWidth="1.2"
            strokeOpacity="0.14"
          />

          {/* Broad Shoulders & Textured Chest Fur */}
          <path
            d="M 28 228 C 34 166, 72 150, 120 150 C 168 150, 206 166, 212 228 Z"
            fill="url(#bearCoat)"
            stroke="rgba(255, 224, 185, 0.2)"
            strokeWidth="1.2"
          />
          {/* Shoulder Rim Highlights */}
          <path
            d="M 40 202 C 50 174, 72 162, 92 159 M 200 202 C 190 174, 168 162, 148 159"
            fill="none"
            stroke="rgba(255, 220, 180, 0.16)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Chest Patch & V-Tufts */}
          <path
            d="M 88 186 Q 100 198 106 193 L 112 214 L 120 199 L 128 214 L 134 193 Q 140 198 152 186 C 148 220, 92 220, 88 186 Z"
            fill="#a4754f"
            opacity="0.62"
          />

          {/* Riveted Burnished Brass Studio Collar & Tube Resonance Core */}
          <path
            d="M 68 175 Q 120 197 172 175"
            fill="none"
            stroke="#1a1009"
            strokeWidth="9.5"
            strokeLinecap="round"
            opacity="0.7"
          />
          <path
            d="M 68 175 Q 120 197 172 175"
            fill="none"
            stroke="url(#brassCollar)"
            strokeWidth="6.8"
            strokeLinecap="round"
          />
          <circle cx="84" cy="181" r="1.6" fill="#fef3c7" opacity="0.65" />
          <circle cx="156" cy="181" r="1.6" fill="#fef3c7" opacity="0.65" />
          <circle cx="120" cy="190" r="11.5" fill="#140f0c" stroke="url(#brassCollar)" strokeWidth="2.4" />
          <circle cx="120" cy="190" r="8.2" fill="none" stroke="rgba(255,235,190,0.22)" strokeWidth="0.8" />
          <circle ref={coreTubeRef} cx="120" cy="190" r="5.8" fill="#fbbf24" opacity="0.75" />
          <circle cx="118.2" cy="188.2" r="1.7" fill="#fffbeb" opacity="0.85" />

          <g ref={headRef}>
            {/* Rounded Ears with Fur Rim & Warm Hollows */}
            <g ref={leftEarRef}>
              <circle cx="65" cy="63" r="23" fill="#4f3524" stroke="rgba(255,225,185,0.2)" strokeWidth="1.2" />
              <path d="M 48 56 Q 44 64 49 72" fill="none" stroke="#6e4b34" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="66.5" cy="65.5" r="13" fill="url(#bearEarInner)" />
              <path d="M 59 64 Q 65 56 74 62" fill="none" stroke="#3c2618" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
            </g>
            <g ref={rightEarRef}>
              <circle cx="175" cy="63" r="23" fill="#4f3524" stroke="rgba(255,225,185,0.2)" strokeWidth="1.2" />
              <path d="M 192 56 Q 196 64 191 72" fill="none" stroke="#6e4b34" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="173.5" cy="65.5" r="13" fill="url(#bearEarInner)" />
              <path d="M 166 62 Q 175 56 181 64" fill="none" stroke="#3c2618" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
            </g>

            {/* Bear Head Contour with Side Cheek Fur Tufts */}
            <path
              d="M 52 113 L 45 119 L 51 124 L 46 131 C 54 156, 78 173, 120 173 C 162 173, 186 156, 194 131 L 189 124 L 195 119 L 188 113 C 190 71, 162 47, 120 47 C 78 47, 50 71, 52 113 Z"
              fill="url(#bearCoat)"
              stroke="rgba(255, 224, 185, 0.22)"
              strokeWidth="1.4"
            />
            <ellipse cx="120" cy="98" rx="58" ry="44" fill="url(#bearFaceHighlight)" />

            {/* Forehead Fur Tuft & Crown Lighting */}
            <path
              d="M 109 52 L 114 44 L 120 49 L 126 44 L 131 52"
              fill="#6a4630"
              stroke="rgba(255,224,185,0.22)"
              strokeWidth="1"
              strokeLinejoin="round"
            />

            {/* Cheek Blush */}
            <ellipse ref={leftCheekRef} cx="74" cy="126" rx="11.5" ry="6.5" fill="#d48060" opacity="0.34" />
            <ellipse ref={rightCheekRef} cx="166" cy="126" rx="11.5" ry="6.5" fill="#d48060" opacity="0.34" />

            {/* Orbital Socket Rings & Multi-Layered Expressive Eyes */}
            <ellipse cx="92" cy="102" rx="14" ry="12.5" fill="#322015" opacity="0.48" />
            <ellipse cx="148" cy="102" rx="14" ry="12.5" fill="#322015" opacity="0.48" />

            <g ref={leftEyeGroupRef}>
              <circle cx="92" cy="102" r="11" fill="#17100b" stroke="rgba(255,220,185,0.16)" strokeWidth="0.9" />
              <circle ref={leftIrisRef} cx="92" cy="102" r="7.6" fill="#fbbf24" opacity="0.92" />
              <circle ref={leftPupilRef} cx="92" cy="102" r="4.4" fill="#140d08" />
              <circle cx="88.8" cy="98.6" r="2.6" fill="#fffbeb" opacity="0.96" />
              <circle cx="95.4" cy="105.2" r="1.2" fill="#fffbeb" opacity="0.72" />
              <path ref={leftLidRef} d="M 81 102 Q 92 108 103 102" fill="none" stroke="#2c1d13" strokeWidth="3.2" strokeLinecap="round" opacity="0" />
            </g>
            <g ref={rightEyeGroupRef}>
              <circle cx="148" cy="102" r="11" fill="#17100b" stroke="rgba(255,220,185,0.16)" strokeWidth="0.9" />
              <circle ref={rightIrisRef} cx="148" cy="102" r="7.6" fill="#fbbf24" opacity="0.92" />
              <circle ref={rightPupilRef} cx="148" cy="102" r="4.4" fill="#140d08" />
              <circle cx="144.8" cy="98.6" r="2.6" fill="#fffbeb" opacity="0.96" />
              <circle cx="151.4" cy="105.2" r="1.2" fill="#fffbeb" opacity="0.72" />
              <path ref={rightLidRef} d="M 137 102 Q 148 108 159 102" fill="none" stroke="#2c1d13" strokeWidth="3.2" strokeLinecap="round" opacity="0" />
            </g>

            {/* Expressive Brow Ridges */}
            <path
              ref={leftBrowRef}
              d="M 80 86 Q 92 80 103 86"
              fill="none"
              stroke="#a47450"
              strokeWidth="4.4"
              strokeLinecap="round"
            />
            <path
              ref={rightBrowRef}
              d="M 137 86 Q 148 80 160 86"
              fill="none"
              stroke="#a47450"
              strokeWidth="4.4"
              strokeLinecap="round"
            />

            {/* Muzzle Bridge Highlight */}
            <path
              d="M 111 94 Q 120 106 129 94 L 133 116 L 107 116 Z"
              fill="#9e714f"
              opacity="0.34"
            />

            {/* Sculpted Muzzle Pad + Soft Chin Shadow */}
            <ellipse cx="120" cy="134" rx="35.5" ry="24.5" fill="#2c190f" opacity="0.35" />
            <ellipse
              cx="120"
              cy="131"
              rx="34.5"
              ry="24"
              fill="url(#bearSnout)"
              stroke="rgba(255, 232, 200, 0.28)"
              strokeWidth="1.1"
            />
            {/* Delicate Snout Whisker Pores */}
            <g fill="#5b3b24" opacity="0.58">
              <circle cx="96" cy="126" r="1.1" />
              <circle cx="101" cy="129.5" r="1.1" />
              <circle cx="95" cy="132" r="1.1" />
              <circle cx="144" cy="126" r="1.1" />
              <circle cx="139" cy="129.5" r="1.1" />
              <circle cx="145" cy="132" r="1.1" />
            </g>

            {/* Animated Mouth, Tongue & Teeth */}
            <ellipse ref={mouthOpenRef} cx="120" cy="145" rx="7" ry="2.5" fill="#2c120d" />
            <ellipse ref={tongueRef} cx="120" cy="148" rx="6.5" ry="4" fill="#e07a7a" opacity="0" />
            <path
              ref={teethRef}
              d="M 111 140 L 114 144 L 117 140 M 123 140 L 126 144 L 129 140"
              fill="#fef3c7"
              opacity="0"
            />

            <path
              ref={mouthSmileRef}
              d="M 120 129 L 120 137 M 106 138 Q 113 144 120 137 Q 127 144 134 138"
              fill="none"
              stroke="#331e13"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Glossy Anatomical Bear Nose + Nostrils + Catchlight */}
            <path
              d="M 105 119 C 105 111.5, 135 111.5, 135 119 C 135 126, 125.5 131.5, 120 131.5 C 114.5 131.5, 105 126, 105 119 Z"
              fill="#19100c"
              stroke="rgba(255,235,210,0.18)"
              strokeWidth="0.8"
            />
            <circle cx="113.5" cy="122" r="2.1" fill="#070403" />
            <circle cx="126.5" cy="122" r="2.1" fill="#070403" />
            <ellipse cx="115" cy="116.5" rx="5.8" ry="2.2" fill="rgba(255,248,235,0.38)" />
            <circle cx="123" cy="116" r="1.1" fill="rgba(255,248,235,0.28)" />
          </g>
        </svg>

        <span className="absolute bottom-1.5 text-[9.5px] font-semibold tracking-wide text-amber-200/90 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Poke to Roar
        </span>
      </div>

      {/* 10-Mood Indicator Only */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] w-full pt-1 border-t border-white/[0.06] leading-tight">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)] shrink-0" />
        <span className="font-bold text-amber-300 tracking-wide truncate">{mood}</span>
      </div>
    </div>
  );
};
