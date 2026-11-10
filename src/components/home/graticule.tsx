import { cn } from "@/lib/utils";

const R = 280;
const C = 300;
const toRad = (deg: number) => (deg * Math.PI) / 180;

const meridians = [15, 30, 45, 60, 75].map((deg) => R * Math.cos(toRad(deg)));
const parallels = [-60, -40, -20, 20, 40, 60].map((lat) => ({
  cy: C - R * Math.sin(toRad(lat)),
  rx: R * Math.cos(toRad(lat)),
}));

/** Deterministic pseudo-random points (no Math.random: output must be identical on every render). */
function points(count: number, seed: number) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const angle = next() * Math.PI * 2;
    const radius = Math.sqrt(next()) * (R - 20);
    return {
      x: C + Math.cos(angle) * radius,
      y: C + Math.sin(angle) * radius,
      r: 0.8 + next() * 1.8,
      o: 0.25 + next() * 0.6,
    };
  });
}

const lights = points(46, 1871);

/**
 * Decorative globe graticule (lines of latitude and longitude) with an astrolabe ring. It shows no
 * coastlines or borders on purpose: geography on HISTORYVERSE comes only from sourced datasets.
 */
export function Graticule({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 600"
      className={cn("text-primary", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="hv-globe-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.03" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 10} fill="url(#hv-globe-glow)" />
      <g fill="none" stroke="currentColor">
        <circle cx={C} cy={C} r={R} strokeWidth="1.2" strokeOpacity="0.6" />
        <line x1={C} y1={C - R} x2={C} y2={C + R} strokeWidth="0.8" strokeOpacity="0.35" />
        <line x1={C - R} y1={C} x2={C + R} y2={C} strokeWidth="0.8" strokeOpacity="0.45" />
        {meridians.map((rx) => (
          <ellipse key={rx} cx={C} cy={C} rx={rx} ry={R} strokeWidth="0.7" strokeOpacity="0.3" />
        ))}
        {parallels.map((p) => (
          <ellipse
            key={p.cy}
            cx={C}
            cy={p.cy}
            rx={p.rx}
            ry={p.rx * 0.16}
            strokeWidth="0.7"
            strokeOpacity="0.28"
          />
        ))}
      </g>
      <g
        className="origin-center animate-[spin_180s_linear_infinite]"
        style={{ transformBox: "view-box" }}
      >
        <circle
          cx={C}
          cy={C}
          r={R + 8}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          strokeOpacity="0.5"
          strokeDasharray="1 7"
        />
        {Array.from({ length: 24 }, (_, i) => (
          <line
            key={i}
            x1={C}
            y1={C - R - 4}
            x2={C}
            y2={C - R - (i % 6 === 0 ? 20 : 12)}
            stroke="currentColor"
            strokeWidth={i % 6 === 0 ? 1.4 : 0.8}
            strokeOpacity="0.55"
            transform={`rotate(${i * 15} ${C} ${C})`}
          />
        ))}
      </g>
      <g fill="currentColor">
        {lights.map((p, i) => (
          <circle
            key={i}
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={p.r.toFixed(2)}
            opacity={p.o.toFixed(2)}
          />
        ))}
      </g>
    </svg>
  );
}
