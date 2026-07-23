"use client";

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const OCEAN_CSS = `
.lo-scene{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#2E6E7A 0%,#3E8E9C 55%,#8FC6CD 100%)}
.lo-rays{position:absolute;inset:0;opacity:.4;pointer-events:none;
  background:linear-gradient(115deg,rgba(255,255,255,.3) 0 6%,transparent 12% 22%,rgba(255,255,255,.2) 24% 30%,transparent 34%)}
@keyframes lo-swim-r{from{left:-10%}to{left:110%}}
@keyframes lo-swim-l{from{left:110%}to{left:-10%}}
.lo-bob{animation:lo-bob 3.4s ease-in-out infinite}
@keyframes lo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.lo-bubble{position:absolute;bottom:-24px;border-radius:50%;background:rgba(255,255,255,.4);animation:lo-bubble linear infinite}
@keyframes lo-bubble{0%{transform:translateY(0) scale(.6);opacity:0}12%{opacity:.6}100%{transform:translateY(-70vh) scale(1);opacity:0}}
`;

const FISH_LANES = [
  { top: "20%", restLeft: 15, dur: 26, delay: 0, dir: 1 as const, size: 30, fill: "#E7936F", opacity: 0.85 },
  { top: "58%", restLeft: 72, dur: 32, delay: 4, dir: -1 as const, size: 24, fill: "#B4E0DE", opacity: 0.7 },
  { top: "38%", restLeft: 40, dur: 22, delay: 9, dir: 1 as const, size: 18, fill: "#F3C89A", opacity: 0.5 },
  { top: "72%", restLeft: 25, dur: 30, delay: 2, dir: -1 as const, size: 34, fill: "#DF8464", opacity: 0.9 },
  { top: "14%", restLeft: 60, dur: 36, delay: 12, dir: 1 as const, size: 20, fill: "#9FC7C9", opacity: 0.45 },
];

function FishSilhouette({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 38 30" aria-hidden>
      <path
        d="M0 6 C-16 6 -18 -6 -8 -8 C-2 -14 12 -12 12 -2 C20 -2 18 8 8 8Z"
        fill={fill}
        transform="translate(10,10)"
      />
    </svg>
  );
}

export function LandingOceanScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="lo-scene">
      <style>{OCEAN_CSS}</style>
      <div className="lo-rays" />

      {FISH_LANES.map((lane, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: lane.top,
            opacity: lane.opacity,
            ...(reducedMotion
              ? { left: `${lane.restLeft}%` }
              : {
                  animation: `${lane.dir > 0 ? "lo-swim-r" : "lo-swim-l"} ${lane.dur}s linear ${lane.delay}s infinite`,
                }),
          }}
        >
          <div className={reducedMotion ? undefined : "lo-bob"}>
            <div style={lane.dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
              <FishSilhouette size={lane.size} fill={lane.fill} />
            </div>
          </div>
        </div>
      ))}

      {!reducedMotion &&
        Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="lo-bubble"
            style={{
              left: `${8 + ((i * 11) % 86)}%`,
              width: 6 + (i % 3) * 4,
              height: 6 + (i % 3) * 4,
              animationDuration: `${9 + (i % 5) * 2}s`,
              animationDelay: `${i * 0.9}s`,
            }}
          />
        ))}

      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 90 Q360 40 720 76 T1440 64 V160 H0Z" fill="#E7D9BC" />
        <path d="M0 118 Q400 90 760 108 T1440 100 V160 H0Z" fill="#D8C7A2" opacity=".65" />
      </svg>
    </div>
  );
}
