"use client";

import { Play, Pause } from "lucide-react";
import { useOceanNoise } from "@/lib/ocean-noise";
import { SPECIES } from "@/lib/aquarium-species";
import { cn } from "@/lib/utils";

interface AquariumTankProps {
  eggs: number;
  unlocked: typeof SPECIES;
  swimmerCount: number;
}

// Fixed spots inside the 210px-tall, full-width tank: `top` in px, `left` in
// % for the resting (paused) position, plus swim speed/delay/direction for
// when playing. Spread across the whole tank instead of bunched on one side.
const LANES = [
  { top: 38, left: 12, dur: 14, delay: 0, dir: 1 },
  { top: 88, left: 70, dur: 18, delay: 3, dir: -1 },
  { top: 128, left: 30, dur: 12, delay: 1.5, dir: 1 },
  { top: 148, left: 55, dur: 20, delay: 6, dir: -1 },
  { top: 58, left: 85, dur: 16, delay: 4, dir: 1 },
  { top: 108, left: 8, dur: 15, delay: 2, dir: -1 },
  { top: 73, left: 45, dur: 19, delay: 5, dir: 1 },
  { top: 138, left: 65, dur: 13, delay: 7, dir: -1 },
];

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
`;

export function AquariumTank({ eggs, unlocked, swimmerCount }: AquariumTankProps) {
  const { isPlaying, toggle } = useOceanNoise();

  return (
    <div className="aq-tank">
      <style>{TANK_CSS}</style>
      <div className="aq-rays" />
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
          {/* eggs resting on the sand, one per seeded task (up to 3 shown) */}
          {Array.from({ length: Math.min(eggs, 3) }).map((_, i) => (
            <g key={i} transform={`translate(${255 + i * 18},${92 - (i % 2) * 3})`}>
              <ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#EAF6F5" />
              <ellipse cx="0" cy="0" rx="2.4" ry="3" fill="#9FC7C9" />
            </g>
          ))}
        </g>
      </svg>

      {LANES.slice(0, swimmerCount).map((lane, i) => {
        const species = unlocked[i % Math.max(unlocked.length, 1)] ?? SPECIES[0];
        return (
          <div
            key={i}
            className="aq-swimmer"
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
      })}

      {isPlaying &&
        Array.from({ length: 7 }).map((_, i) => (
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
