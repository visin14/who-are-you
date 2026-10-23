import React, { useEffect, useRef } from "react";

export const PATHS = {
  mountain: "M4 86 L36 30 L52 54 L66 36 L96 86 Z",
  compass: "M50 4 L60 40 L96 50 L60 60 L50 96 L40 60 L4 50 L40 40 Z",
  sun: "M50 0 L58 30 L85 15 L70 42 L100 50 L70 58 L85 85 L58 70 L50 100 L42 70 L15 85 L30 58 L0 50 L30 42 L15 15 L42 30 Z",
  pick: "M50 6 C78 6 94 18 94 34 C94 58 66 86 50 94 C34 86 6 58 6 34 C6 18 22 6 50 6 Z",
  star: "M50 4 L61 37 L96 37 L68 58 L79 92 L50 71 L21 92 L32 58 L4 37 L39 37 Z",
  bolt: "M58 4 L18 56 L46 56 L38 96 L82 40 L54 40 Z",
  atom: "M10 50 A40 16 0 1 0 90 50 A40 16 0 1 0 10 50 Z M50 10 A16 40 0 1 0 50 90 A16 40 0 1 0 50 10 Z",
  beaker: "M36 6 L64 6 L64 14 L60 14 L60 40 L90 86 C94 93 90 98 82 98 L18 98 C10 98 6 93 10 86 L40 40 L40 14 L36 14 Z",
  crown: "M8 78 L14 26 L34 50 L50 14 L66 50 L86 26 L92 78 Z M8 84 L92 84 L92 96 L8 96 Z",
  gem: "M28 10 L72 10 L94 38 L50 94 L6 38 Z",
  brush: "M70 6 L94 30 L54 62 L38 46 Z M34 50 L50 66 C46 84 30 96 8 94 C14 80 14 62 34 50 Z",
  blob: "M52 8 C74 6 94 22 92 44 C90 62 98 76 84 88 C70 98 48 90 34 92 C16 94 4 78 8 60 C11 46 4 30 18 18 C28 10 40 9 52 8 Z",
  squig: "M6 60 C18 20 34 20 42 50 S 64 84 74 50 S 90 20 96 40",
  moon: "M70 8 C40 10 18 32 18 56 C18 80 40 96 64 94 C46 86 36 70 36 52 C36 34 50 16 70 8 Z",
  crystal: "M50 2 L74 30 L66 98 L34 98 L26 30 Z",
  spark: "M50 0 C54 34 66 46 100 50 C66 54 54 66 50 100 C46 66 34 54 0 50 C34 46 46 34 50 0 Z",
};

// Per-archetype sticker sets (6 slots) used on the result screen.
export const SETS = {
  E: ["mountain", "compass", "sun", "mountain", "spark", "sun"],
  R: ["pick", "star", "bolt", "pick", "spark", "star"],
  S: ["atom", "beaker", "atom", "beaker", "spark", "spark"],
  L: ["crown", "gem", "gem", "crown", "spark", "star"],
  A: ["blob", "brush", "squig", "blob", "spark", "brush"],
  M: ["moon", "crystal", "crystal", "moon", "spark", "spark"],
};
export const ICON = { E: "mountain", R: "bolt", S: "beaker", L: "crown", A: "brush", M: "moon" };
const LINES = new Set(["atom", "squig"]);

// Persistent objects: each one glides to a new position per screen, so changing screens feels like moving through space.
const OBJS = [
  { id: "blob", type: "blob", c: "#8b5cf6", depth: "far", anim: "a2", w: 170 },
  { id: "torus", type: "torus", depth: "far", anim: "a1", w: 150 },
  { id: "chromeS", type: "chrome", depth: "far", anim: "a3", w: 52 },
  { id: "glossC", type: "gloss", c: "#06b6d4", depth: "far", anim: "a1", w: 84 },
  { id: "chromeL", type: "chrome", depth: "near", anim: "a2", w: 120 },
  { id: "sparkL", type: "spark", fill: "url(#gLime)", depth: "near", anim: "tw", w: 38 },
  { id: "sparkW", type: "spark", fill: "#fff", depth: "near", anim: "tw", w: 26 },
  { id: "star", type: "star", depth: "near", anim: "a1", w: 58 },
  { id: "squig", type: "squig", depth: "near", anim: "a3", w: 104 },
  { id: "glossP", type: "gloss", c: "#ec4899", depth: "far", anim: "a3", w: 96 },
];

// Edge slots (% of viewport) used by the quiz so shapes stay off the cards.
const SLOTS = [[-12, 6], [80, 3], [86, 28], [-9, 33], [82, 54], [-8, 60], [84, 82], [-6, 88], [60, 92], [14, 94]];

const H = null; // hidden
const PRESETS = {
  landing: { blob: [-19, 7, 200], torus: [63, 35, 170], chromeS: [84, 73, 52], glossC: [-8, 71, 96], chromeL: [55, 25, 150], sparkL: [85, 20, 46], sparkW: [7, 13, 30], star: [77, 56, 64], squig: [2, 48, 110], glossP: H },
  selfie: { blob: [78, 12, 120], torus: [-14, 36, 130], chromeS: [84, 56, 56], sparkW: [10, 21, 26], glossC: H, chromeL: H, sparkL: [88, 80, 30], star: H, squig: H, glossP: [-10, 82, 80] },
  loading: { blob: [-14, 70, 150], torus: [74, 8, 120], chromeS: [86, 85, 46], glossC: [-6, 12, 70], chromeL: H, sparkL: [10, 40, 24], sparkW: [88, 40, 20], star: H, squig: H, glossP: [76, 72, 80] },
  error: { blob: H, torus: H, chromeS: H, glossC: [78, 8, 56], chromeL: H, sparkL: H, sparkW: H, star: H, squig: H, glossP: [-8, 72, 110] },
  limit: { blob: [-10, 76, 130], torus: [70, 36, 160], chromeS: H, glossC: H, chromeL: [4, 9, 74], sparkL: H, sparkW: H, star: H, squig: H, glossP: H },
  result: { blob: H, torus: H, chromeS: H, glossC: H, chromeL: [-3, 38, 46], sparkL: H, sparkW: H, star: H, squig: H, glossP: H },
};

function posFor(screen, step, obj, idx) {
  if (screen === "quiz") {
    const [l, t] = SLOTS[(idx + step * 3) % SLOTS.length];
    return [l, t, obj.w];
  }
  return (PRESETS[screen] || PRESETS.landing)[obj.id];
}

function Shape({ obj }) {
  if (obj.type === "chrome") return <div className="chrome" />;
  if (obj.type === "gloss") return <div className="gloss" style={{ "--c": obj.c }} />;
  if (obj.type === "blob") return <div className="gloss blob" style={{ "--c": obj.c }} />;
  if (obj.type === "torus") return <div className="torus tilt" />;
  if (obj.type === "spark") return <svg viewBox="0 0 100 100"><path d={PATHS.spark} fill={obj.fill} /></svg>;
  if (obj.type === "star")
    return <svg viewBox="0 0 100 100" style={{ overflow: "visible" }}><path d={PATHS.star} fill="url(#gPink)" stroke="#0b0a12" strokeWidth="4" strokeLinejoin="round" /></svg>;
  return <svg viewBox="0 0 100 70" style={{ overflow: "visible" }}><path d={PATHS.squig} fill="none" stroke="url(#gLime)" strokeWidth="10" strokeLinecap="round" /></svg>;
}

export default function Scene({ screen, step = 0 }) {
  const far = useRef(), near = useRef();

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf, hidden = false;
    const set = (x, y) => { tx = Math.max(-0.5, Math.min(0.5, x)); ty = Math.max(-0.5, Math.min(0.5, y)); };
    const move = (e) => set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    const tilt = (e) => e.gamma != null && set(e.gamma / 40, (e.beta - 45) / 40);
    const vis = () => { hidden = document.hidden; if (!hidden) loop(); };
    const loop = () => {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      if (far.current) far.current.style.transform = `translate3d(${(-cx * 12).toFixed(1)}px,${(-cy * 12).toFixed(1)}px,0)`;
      if (near.current) near.current.style.transform = `translate3d(${(-cx * 36).toFixed(1)}px,${(-cy * 36).toFixed(1)}px,0)`;
      if (!hidden) raf = requestAnimationFrame(loop);
    };
    addEventListener("pointermove", move);
    addEventListener("deviceorientation", tilt);
    document.addEventListener("visibilitychange", vis);
    loop();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("deviceorientation", tilt);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const render = (depth) =>
    OBJS.map((obj, i) => {
      if (obj.depth !== depth) return null;
      const p = posFor(screen, step, obj, i);
      const hide = !p;
      const [l, t, s] = p || [50, 50, 0];
      const h = obj.type === "squig" ? s * 0.45 : s;
      return (
        <div
          key={obj.id}
          className={`o ${obj.anim} ${obj.type === "torus" ? "p" : ""}`}
          style={{ left: `${l}%`, top: `${t}%`, width: hide ? 0 : s, height: hide ? 0 : h, opacity: hide ? 0 : 1 }}
        >
          <Shape obj={obj} />
        </div>
      );
    });

  return (
    <div className={`scene ${screen === "result" ? "slow" : ""}`} aria-hidden="true">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="gLime" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f5ffd0" /><stop offset=".45" stopColor="#c8ff2e" /><stop offset="1" stopColor="#6f9a00" /></linearGradient>
          <linearGradient id="gPink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd1e8" /><stop offset=".45" stopColor="#ec4899" /><stop offset="1" stopColor="#8a1650" /></linearGradient>
        </defs>
      </svg>
      <div className="layer" ref={far}>{render("far")}</div>
      <div className="layer" ref={near}>{render("near")}</div>
    </div>
  );
}

/** Archetype sticker set that bursts outward on reveal. */
export function ArchetypeObjects({ code }) {
  const set = SETS[code];
  const slots = [
    [-4, 12, 86, -16, "a1"], [80, 8, 72, 14, "a2"], [82, 56, 66, -8, "a3"],
    [-4, 66, 72, 18, "a2"], [44, 5, 30, 0, "tw"], [80, 84, 40, 10, "tw"],
  ];
  return (
    <div className="scene burst" aria-hidden="true" style={{ zIndex: 1 }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".38" style={{ stopColor: "var(--acc)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--acc) 55%, #000)" }} />
          </linearGradient>
        </defs>
      </svg>
      {slots.map(([l, t, s, r, cls], i) => {
        const k = set[i], line = LINES.has(k);
        return (
          <div key={i} className={`o ${cls}`} style={{ left: `${l}%`, top: `${t}%`, width: s, height: s }}>
            <svg viewBox="0 0 100 100" style={{ transform: `rotate(${r}deg)`, overflow: "visible" }}>
              <path d={PATHS[k]} fill={line ? "none" : "url(#gA)"} stroke={line ? "url(#gA)" : "#0b0a12"} strokeWidth={line ? 9 : 4} strokeLinejoin="round" strokeLinecap="round" fillRule="evenodd" />
            </svg>
          </div>
        );
      })}
      <div className="o a2" style={{ left: "82%", top: "30%", width: 74, height: 74 }}><div className="gloss" style={{ "--c": "var(--acc)" }} /></div>
    </div>
  );
}
