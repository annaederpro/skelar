"use client";

import { Play, Pause } from "lucide-react";
import { useOceanNoise } from "@/lib/ocean-noise";
import { SPECIES } from "@/lib/aquarium-species";
import { cn } from "@/lib/utils";

interface AquariumTankProps {
  eggs: number;
  unlocked: typeof SPECIES;
  completedCount: number;
}

// Fixed spots inside the 210px-tall, full-width tank: `top` in px, `left` in
// % for the resting (paused) position, plus swim speed/delay/direction for
// when playing. Spread across the whole tank instead of bunched on one side.
const FRONT_LANES = [
  { top: 38, left: 12, dur: 14, delay: 0, dir: 1 },
  { top: 88, left: 70, dur: 18, delay: 3, dir: -1 },
  { top: 128, left: 30, dur: 12, delay: 1.5, dir: 1 },
  { top: 148, left: 55, dur: 20, delay: 6, dir: -1 },
  { top: 58, left: 85, dur: 16, delay: 4, dir: 1 },
  { top: 108, left: 8, dur: 15, delay: 2, dir: -1 },
  { top: 73, left: 45, dur: 19, delay: 5, dir: 1 },
  { top: 138, left: 65, dur: 13, delay: 7, dir: -1 },
];

// A second, smaller/dimmer depth layer behind the front lanes — once a tank
// fills its front lanes it keeps visibly getting busier instead of plateauing.
const BACK_LANES = [
  { top: 24, left: 40, dur: 24, delay: 1, dir: -1 },
  { top: 48, left: 60, dur: 27, delay: 8, dir: 1 },
  { top: 96, left: 20, dur: 22, delay: 4.5, dir: -1 },
  { top: 118, left: 78, dur: 26, delay: 10, dir: 1 },
  { top: 66, left: 5, dur: 25, delay: 6.5, dir: -1 },
  { top: 22, left: 90, dur: 23, delay: 2.5, dir: 1 },
];

const TOTAL_LANES = FRONT_LANES.length + BACK_LANES.length;

// Tank "richness" milestones independent of species unlocks — once the fixed
// swim lanes are full (see TOTAL_LANES), the tank keeps changing by growing
// the reef instead of trying to cram in more swimmers.
const DENSITY_MILESTONES = [25, 50, 100];

const TANK_CSS = `
.aq-tank{position:relative;height:210px;border-radius:24px;overflow:hidden;border:1px solid var(--line);
  background:linear-gradient(180deg,#BFE6E8 0%,#9CD2D8 60%,#8FC6CD 100%)}
.aq-rays{position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:linear-gradient(115deg,rgba(255,255,255,.35) 0 6%,transparent 12% 22%,rgba(255,255,255,.25) 24% 30%,transparent 34%)}
.aq-swimmer{position:absolute;will-change:left}
.aq-bob{animation:aq-bob 3s ease-in-out infinite}
@keyframes aq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes aq-swim-r{from{left:-70px}to{left:100%}}
@keyframes aq-swim-l{from{left:100%}to{left:-70px}}
.aq-bubble{position:absolute;bottom:8px;border-radius:50%;background:rgba(255,255,255,.5);animation:aq-bubble linear infinite}
@keyframes aq-bubble{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.7}100%{transform:translateY(-190px) scale(1);opacity:0}}
.aq-swimmer-back{opacity:.6;transform:scale(.68)}
`;

// A little more reef per density milestone reached (see DENSITY_MILESTONES) —
// independent of species/swimmer count, so the tank keeps changing all the
// way out past 150 completed tasks instead of visually stalling once the
// swim lanes are full.
const REEF_CLUSTERS = [
  <g key="r1" transform="translate(95,88)">
    <path d="M0 5 q-7 -18 2 -32 q5 13 -2 32Z" fill="#4FA0A0" opacity=".75" />
    <path d="M8 6 q6 -14 0 -26 q-8 11 0 26Z" fill="#3E8E9C" opacity=".7" />
  </g>,
  <g key="r2" transform="translate(255,90)">
    <circle cx="0" cy="0" r="3.5" fill="#B98AC0" opacity=".85" />
    <circle cx="6" cy="-2" r="2.6" fill="#CBA3D2" opacity=".85" />
    <circle cx="-5" cy="1" r="2.6" fill="#CBA3D2" opacity=".85" />
  </g>,
  <g key="r3" transform="translate(20,92)">
    <path d="M0 4 C-10 4 -11 -5 -5 -6 C-1 -10 8 -8 8 -1 C13 -1 12 5 5 5Z" fill="#E7936F" opacity=".85" />
  </g>,
];

export function AquariumTank({ eggs, unlocked, completedCount }: AquariumTankProps) {
  const { isPlaying, toggle } = useOceanNoise();
  const frontCount = Math.min(completedCount, FRONT_LANES.length);
  const backCount = Math.min(Math.max(completedCount - FRONT_LANES.length, 0), BACK_LANES.length);
  const densityTier = DENSITY_MILESTONES.filter((m) => completedCount >= m).length;

  const renderSwimmer = (lane: (typeof FRONT_LANES)[number], i: number, back: boolean) => {
    const species = unlocked[i % Math.max(unlocked.length, 1)] ?? SPECIES[0];
    return (
      <div
        key={`${back ? "b" : "f"}${i}`}
        className={cn("aq-swimmer", back && "aq-swimmer-back")}
        style={
          isPlaying
            ? {
                top: lane.top,
                animation: `${lane.dir > 0 ? "aq-swim-r" : "aq-swim-l"} ${lane.dur}s linear ${lane.delay}s infinite`,
              }
            : { top: lane.top, left: `${lane.left}%` }
        }
      >
        <div style={lane.dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
          <div
            className={cn(isPlaying && "aq-bob")}
            style={isPlaying ? { animationDuration: `${2.4 + (i % 4) * 0.4}s` } : undefined}
          >
            <svg width="42" height="33" viewBox="0 0 38 30" aria-hidden>
              {species.icon}
            </svg>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="aq-tank">
      <style>{TANK_CSS}</style>
      <div className="aq-rays" style={{ opacity: 0.5 + densityTier * 0.06 }} />
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 390 120"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 70 Q100 56 200 66 T390 62 V120 H0Z" fill="#E7D9BC" />
        <path d="M0 88 Q120 78 230 86 T390 82 V120 H0Z" fill="#D8C7A2" opacity=".6" />
        <g>
          <path d="M40 90 q-8 -22 2 -40 q6 16 -2 40Z" fill="#3E8E9C" opacity=".8" />
          <path d="M50 92 q10 -18 4 -34 q-10 14 -4 34Z" fill="#4FA0A0" opacity=".75" />
          <path d="M320 92 q-10 -20 0 -38 q8 16 0 38Z" fill="#4FA0A0" opacity=".8" />
          <path d="M330 93 q10 -16 2 -30 q-9 12 -2 30Z" fill="#3E8E9C" opacity=".7" />
          <g transform="translate(190,86)">
            <path
              d="M0 6 C-16 6 -18 -6 -8 -8 C-2 -14 12 -12 12 -2 C20 -2 18 8 8 8Z"
              fill="#E7936F"
              opacity=".9"
            />
            <path d="M-6 4 C-10 -2 -2 -6 2 -2" stroke="#F3B39A" strokeWidth="2" fill="none" />
          </g>
          <g transform="translate(150,90)">
            <circle cx="0" cy="0" r="4" fill="#DF8464" />
            <circle cx="7" cy="-2" r="3" fill="#E7936F" />
            <circle cx="-6" cy="-1" r="3" fill="#E7936F" />
          </g>
          {/* reef grows with real usage, independent of species unlocks */}
          {REEF_CLUSTERS.slice(0, densityTier)}
          {/* eggs resting on the sand, one per seeded task (up to 3 shown) */}
          {Array.from({ length: Math.min(eggs, 3) }).map((_, i) => (
            <g key={i} transform={`translate(${255 + i * 18},${92 - (i % 2) * 3})`}>
              <ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#EAF6F5" />
              <ellipse cx="0" cy="0" rx="2.4" ry="3" fill="#9FC7C9" />
            </g>
          ))}
        </g>
      </svg>

      {BACK_LANES.slice(0, backCount).map((lane, i) => renderSwimmer(lane, i, true))}
      {FRONT_LANES.slice(0, frontCount).map((lane, i) => renderSwimmer(lane, i, false))}

      {isPlaying &&
        Array.from({ length: 7 + densityTier * 2 }).map((_, i) => (
          <span
            key={i}
            className="aq-bubble"
            style={{
              left: `${10 + ((i * 13) % 80)}%`,
              width: 5 + (i % 3) * 3,
              height: 5 + (i % 3) * 3,
              animationDuration: `${5 + (i % 4)}s`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}

      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Зупинити акваріум" : "Оживити акваріум"}
        className="absolute bottom-2.5 right-2.5 z-10 flex size-9 items-center justify-center rounded-full bg-card/90 text-sea-deep shadow-sm backdrop-blur-sm transition-transform active:scale-95"
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
      </button>
    </div>
  );
}
