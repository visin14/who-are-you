import React, { useEffect, useRef, useState } from "react";
import { archetypes, calculateArchetype, questions } from "../shared/config.js";
import { checkFace, fingerprint, loadImage, renderCard, resizeToJpeg, shuffle } from "./lib.js";
import Scene, { ArchetypeObjects, ICON, PATHS } from "./Scene.jsx";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const LOADING_MSGS = ["Reading your answers...", "Matching your aura...", "Summoning your avatar..."];
const FACTS = [
  "your archetype is already decided. we’re just doing its makeup.",
  "no refreshing. the avatar can sense it.",
  "quick, practice your reveal face.",
];
const POLL_MS = 2000;
const CLIENT_TIMEOUT_MS = 90_000;
const CARD_ROT = [-3, 2.5, 2, -2.5];
const CARD_SH = ["#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const Svg = ({ children, size = 22, sw = 3, stroke = "currentColor", ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
const Back = ({ onClick, label }) => (
  <button className="iconbtn" onClick={onClick} aria-label={label}><Svg><path d="M19 12H5M11 6l-6 6 6 6" /></Svg></button>
);
const Footer = () => <p className="foot">Your photo is used only to create your avatar and is deleted within 24 hours.</p>;
const Spark = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><path d={PATHS.spark} fill="currentColor" /></svg>
);

export default function App() {
  const [stage, setStage] = useState("landing"); // landing|quiz|selfie|loading|result|error|limit
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [order, setOrder] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [capReached, setCapReached] = useState(false);
  const [upload, setUpload] = useState(null);
  const advancing = useRef(null);

  const code = answers.length === questions.length ? calculateArchetype(answers) : null;
  const accent = archetypes[result?.archetype]?.accentColor || "#c8ff2e";

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then((s) => setCapReached(s.capReached)).catch(() => {});
  }, []);
  useEffect(() => () => clearTimeout(advancing.current), []);

  const start = async () => {
    // iOS needs a user gesture to allow tilt-based parallax; ignore if denied/unavailable.
    try { await window.DeviceOrientationEvent?.requestPermission?.(); } catch {}
    if (capReached) return setStage("limit");
    reset();
    setStage("quiz");
  };
  const reset = () => {
    clearTimeout(advancing.current);
    advancing.current = null;
    setOrder(questions.map((q) => shuffle(q.options.map((_, i) => i)))); // new option order every run
    setAnswers([]);
    setStep(0);
    setResult(null);
    setError(null);
  };
  const restart = () => { reset(); setStage("landing"); };

  const pick = (qi, optIdx) => {
    if (advancing.current) return;
    const next = answers.slice(0, qi);
    next[qi] = questions[qi].options[optIdx].archetype;
    setAnswers(next);
    try { navigator.vibrate?.(10); } catch {}
    advancing.current = setTimeout(() => {
      advancing.current = null;
      if (qi === questions.length - 1) setStage("selfie");
      else setStep(qi + 1);
    }, reduced() ? 150 : 450);
  };
  const back = () => {
    clearTimeout(advancing.current);
    advancing.current = null;
    if (stage === "selfie") { setAnswers(answers.slice(0, questions.length - 1)); setStage("quiz"); setStep(questions.length - 1); }
    else if (step > 0) setStep(step - 1);
    else setStage("landing");
  };

  const sceneScreen = stage === "quiz" ? "quiz" : stage;

  return (
    <div className="app" style={{ "--acc": accent }}>
      <div className={`mesh bg-${stage === "quiz" ? "quiz" : stage}`} />
      <Scene screen={sceneScreen} step={step} />
      {stage === "result" && result && <ArchetypeObjects code={result.archetype} />}
      <svg className="grain" aria-hidden="true"><filter id="grainF"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#grainF)" /></svg>

      <main className="col">
        {stage === "landing" && <Landing onStart={start} capReached={capReached} />}
        {stage === "quiz" && <Quiz step={step} order={order} answers={answers} onPick={pick} onBack={back} />}
        {stage === "selfie" && (
          <Selfie
            archetype={code}
            onBack={back}
            onSubmit={(blob) => { setUpload(blob); setStage("loading"); }}
          />
        )}
        {stage === "loading" && (
          <Loading
            blob={upload}
            archetype={code}
            onDone={(r) => { setResult(r); setStage("result"); }}
            onFail={(e) => {
              setError(e);
              if (e.code === "daily_cap" || e.code === "rate_limit") { setCapReached(true); setStage("limit"); }
              else setStage("error");
            }}
          />
        )}
        {stage === "result" && <Result r={result} onRetake={restart} />}
        {stage === "error" && <ErrorScreen error={error} onRetry={() => setStage("selfie")} onRestart={restart} />}
        {stage === "limit" && <Limit message={error?.message} onRestart={restart} />}
        <Footer />
      </main>
    </div>
  );
}

function Landing({ onStart, capReached }) {
  const tape = ["explorer", "rockstar", "scientist", "leader", "artist", "mystic"];
  const dots = ["#f97316", "#ec4899", "#06b6d4", "#d4a017", "#8b5cf6", "#10b981"];
  return (
    <>
      <div className="topbar" style={{ justifyContent: "space-between" }}>
        <span className="glass mono" style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 999 }}>6 questions · 1 selfie</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--lime)" }}>✦ archetype quiz</span>
      </div>
      <div style={{ position: "relative" }}>
        <h1 className="disp hero-title">
          <span>Who</span>
          <span className="outline">Are</span>
          <span className="you">You?</span>
        </h1>
        <div className="disp sticker-tag">6 archetypes.<br />1 of them is you.</div>
      </div>
      <div className="grow" />
      <div className="glass sub">Discover your archetype. <b>See yourself as one.</b></div>
      {capReached && <p className="limit-pill" role="status">We've hit today's limit, come back tomorrow!</p>}
      <button className="btn btn-lime big" onClick={onStart}>
        Start <Svg size={24}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
      </button>
      <p className="mono note">no wrong answers. only vibes.</p>
      <div className="tape" aria-hidden="true">
        <div className="in disp">
          {[0, 1].map((n) => tape.map((t, i) => (
            <React.Fragment key={`${n}${t}`}><span>{t}</span><span style={{ color: dots[i] }}>●</span></React.Fragment>
          )))}
        </div>
      </div>
    </>
  );
}

function Quiz({ step, order, answers, onPick, onBack }) {
  const q = questions[step];
  const opts = order[step] || q.options.map((_, i) => i);
  const h = useRef();
  useEffect(() => { h.current?.focus(); }, [step]);
  return (
    <>
      <div className="topbar">
        <Back onClick={onBack} label="Previous question" />
        <div className="progress" role="progressbar" aria-label={`Question ${step + 1} of ${questions.length}`} aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={step + 1}>
          {questions.map((_, i) => <span key={i} className={i < step ? "done" : i === step ? "cur" : ""} />)}
        </div>
        <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{String(step + 1).padStart(2, "0")}<span style={{ color: "var(--muted)" }}>/06</span></span>
      </div>
      <div key={`h${step}`} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
        <span className="mono kicker">no thoughts, just pick</span>
        <h1 className="disp qh" ref={h} tabIndex={-1}>{q.text}</h1>
      </div>
      <div className="answers" role="group" aria-label="Answers" key={`a${step}`}>
        {opts.map((oi, pos) => {
          const o = q.options[oi];
          const on = answers[step] === o.archetype;
          const a = archetypes[o.archetype];
          return (
            <button
              key={oi}
              className={`card ${on ? "on" : ""}`}
              aria-pressed={on}
              onClick={() => onPick(step, oi)}
              style={{ "--rot": `${CARD_ROT[pos]}deg`, "--sh": CARD_SH[pos], "--d": `${pos * 70}ms` }}
            >
              <span className="row">
                <span className="k mono">{"ABCD"[pos]}</span>
                <svg width="44" height="44" viewBox="0 0 100 100" aria-hidden="true" style={{ overflow: "visible" }}>
                  <path d={PATHS[ICON[o.archetype]]} fill={a.accentColor} stroke="#0b0a12" strokeWidth="6" strokeLinejoin="round" fillRule="evenodd" />
                </svg>
              </span>
              <span className="t">{o.label}</span>
              {on && <span className="check" aria-hidden="true"><Svg stroke="#c8ff2e" sw={3.5}><path d="M5 12.5l4.5 4.5L19 7" /></Svg></span>}
            </button>
          );
        })}
      </div>
      <p className="mono note" style={{ marginTop: 10 }}>tap one — we move on automatically</p>
    </>
  );
}

function Selfie({ archetype, onSubmit, onBack }) {
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState(null);
  const [check, setCheck] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef();

  const onFile = async (file) => {
    setBlob(null);
    setCheck(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setCheck({ ok: false, message: "Please choose a JPG, PNG, or WebP image." });
    if (file.size > MAX_BYTES) return setCheck({ ok: false, message: "That file is over 5 MB. Try a smaller one." });
    setBusy(true);
    try {
      const img = await loadImage(file);
      setPreview(img.src);
      const res = await checkFace(img);
      setCheck(res);
      if (res.ok) setBlob(await resizeToJpeg(img));
    } catch {
      setCheck({ ok: false, message: "We couldn't read that image. Try another." });
    }
    setBusy(false);
  };

  const tips = [
    ["front-facing", "#c8ff2e", <><circle cx="12" cy="12" r="9" /><path d="M9 10h.01M15 10h.01M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" /></>],
    ["good light", "#c8ff2e", <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>],
    ["no sunglasses", "#ff4d8d", <><circle cx="7" cy="13" r="3.5" /><circle cx="17" cy="13" r="3.5" /><path d="M10.5 13h3M3 3l18 18" /></>],
    ["no heavy filters", "#ff4d8d", <path d="M12 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6zM3 3l18 18" />],
  ];
  const caption = !preview ? "waiting for you…" : check && !check.ok ? "hmm, who dis?" : "you, probably";

  return (
    <>
      <div className="topbar">
        <Back onClick={onBack} label="Back to the quiz" />
        <span className="mono kicker">last step</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="disp" style={{ fontSize: 44 }}>drop a <span style={{ color: "var(--lime)" }}>selfie</span></h1>
        <p style={{ fontSize: 16, lineHeight: 1.4, fontWeight: 700, color: "var(--muted)" }}>
          This is what we turn into your {archetypes[archetype]?.name || "archetype"} avatar.
        </p>
      </div>
      <input ref={input} type="file" accept={TYPES.join(",")} hidden onChange={(e) => onFile(e.target.files[0])} />
      <div className="polaroid" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
        <div className="pic">
          {preview ? (
            <img src={preview} alt="Your selfie preview" />
          ) : (
            <button className="drop" onClick={() => input.current.click()}>
              <Svg size={40} sw={2.4} stroke="#0b0a12"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="4" /></Svg>
              <span className="disp" style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" }}>tap to add a selfie</span>
              <span className="mono" style={{ fontSize: 11 }}>or drag one in here</span>
            </button>
          )}
          {check && !check.ok && <div className="qmark"><span className="disp">?</span></div>}
        </div>
        <div className="cap">
          <span className="mono">{busy ? "checking…" : caption}</span>
          {preview && (
            <button className="iconbtn" aria-label="Choose a different photo" onClick={() => input.current.click()} style={{ width: 44, height: 44, boxShadow: "0 3px 0 #0b0a12", marginBottom: -10 }}>
              <Svg size={18}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Svg>
            </button>
          )}
        </div>
      </div>
      <ul className="tips" aria-label="Selfie tips">
        {tips.map(([t, c, icon]) => (
          <li key={t} className="glass"><Svg stroke={c} sw={2.4}>{icon}</Svg>{t}</li>
        ))}
      </ul>
      <label className="glass consent">
        <input type="checkbox" className="chk" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I'm 18 or older, or I have permission from a parent or guardian, and I agree my photo will be processed by an AI image service to create my avatar.</span>
      </label>
      {check?.ok && (
        <p role="status" className="msg-ok"><Svg size={20} sw={3.2}><path d="M5 12.5l4.5 4.5L19 7" /></Svg>{check.message}</p>
      )}
      {check && !check.ok && (
        <p role="alert" className="msg-err"><Svg size={20} style={{ flex: "none", marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></Svg>{check.message}</p>
      )}
      <button className="btn btn-lime big" disabled={!blob || !consent || busy} onClick={() => onSubmit(blob)} style={{ fontSize: 18 }}>
        make my avatar <Spark />
      </button>
    </>
  );
}

function Loading({ blob, archetype, onDone, onFail }) {
  const [i, setI] = useState(0);
  const [f, setF] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const a = setInterval(() => setI((n) => n + 1), 2600);
    const b = setInterval(() => setF((n) => n + 1), 4000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  useEffect(() => {
    if (started.current) return; // StrictMode double-invoke guard
    started.current = true;
    (async () => {
      try {
        const fd = new FormData();
        fd.append("selfie", blob, "selfie.jpg");
        fd.append("archetype", archetype);
        fd.append("consent", "true");
        const r = await fetch("/api/generate", { method: "POST", body: fd, headers: { "x-fingerprint": fingerprint() } });
        const j = await r.json().catch(() => ({}));
        if (r.status !== 202) return onFail({ code: j.code, message: j.error || "Upload failed. Please try again." });
        const t0 = Date.now();
        for (;;) {
          await new Promise((res) => setTimeout(res, POLL_MS));
          if (Date.now() - t0 > CLIENT_TIMEOUT_MS) return onFail({ code: "timeout", message: "That took too long. Please try again." });
          const s = await (await fetch(`/api/generate/${j.jobId}`)).json();
          if (s.status === "done") return onDone(s);
          if (s.status === "failed") return onFail({ code: s.code, message: s.error });
        }
      } catch {
        onFail({ code: "network", message: "Network problem. Please try again." });
      }
    })();
  }, []);

  const m = i % LOADING_MSGS.length;
  const dashed = (inset, dur, rev, extra) => ({ inset, animationDuration: dur, animationDirection: rev ? "reverse" : "normal", ...extra });
  return (
    <>
      <span className="mono kicker">cooking…</span>
      <div className="orbits" aria-hidden="true">
        <div className="orbit" style={dashed(0, "9s", true)}>
          <div className="o" style={{ left: -14, top: "45%", width: 28, height: 28 }}><div className="gloss" style={{ "--c": "#ec4899" }} /></div>
          <div className="o" style={{ right: -20, top: "43%", width: 40, height: 40 }}><svg viewBox="0 0 100 100" style={{ overflow: "visible" }}><path d={PATHS.star} fill="#c8ff2e" stroke="#0b0a12" strokeWidth="5" strokeLinejoin="round" /></svg></div>
        </div>
        <div className="orbit" style={dashed("11%", "5s")}>
          <div className="o" style={{ left: "43%", top: -20, width: 40, height: 40 }}><div className="chrome" /></div>
          <div className="o" style={{ left: "43%", bottom: -20, width: 40, height: 40 }}><div className="torus" /></div>
        </div>
        <div className="orbit" style={dashed("23%", "3.2s", false, { borderColor: "rgba(200,255,46,.35)" })}>
          <div className="o" style={{ left: -10, top: "42%", width: 20, height: 20 }}><svg viewBox="0 0 100 100"><path d={PATHS.spark} fill="#fff" /></svg></div>
          <div className="o" style={{ right: -10, top: "42%", width: 20, height: 20 }}><div className="gloss" style={{ "--c": "#06b6d4" }} /></div>
        </div>
        <div className="orb" />
      </div>
      <div className="status disp" aria-live="polite">
        <p key={i} className={`glitch ${m === 1 ? "alt" : ""}`}>{LOADING_MSGS[m]}</p>
      </div>
      <svg className="squig" aria-hidden="true" width="180" height="30" viewBox="0 0 180 30">
        <path d="M4 15 C 19 0, 34 0, 49 15 S 79 30, 94 15 S 124 0, 139 15 S 169 30, 176 15" fill="none" stroke="#c8ff2e" strokeWidth="5" strokeLinecap="round" strokeDasharray="40 20" style={{ animation: "squig 1.6s linear infinite" }} />
      </svg>
      <p className="mono note">usually 10–40 seconds. keep this tab open.</p>
      <div className="wait">
        <span className="mono tag">while you wait</span>
        <p key={f}>{FACTS[f % FACTS.length]}</p>
      </div>
    </>
  );
}

function Result({ r, onRetake }) {
  const a = archetypes[r.archetype];
  const [go, setGo] = useState(false);
  const [note, setNote] = useState("");
  const img = useRef();
  const num = String("ERSLAM".indexOf(r.archetype) + 1).padStart(2, "0");

  useEffect(() => {
    let alive = true;
    const el = new Image();
    el.src = r.imageUrl;
    (el.decode ? el.decode() : Promise.resolve()).catch(() => {}).then(() => alive && setGo(true));
    return () => { alive = false; };
  }, [r.imageUrl]);

  const card = () => renderCard({ imageUrl: r.imageUrl, name: a.name, tagline: a.tagline, accent: a.accentColor });
  const download = async () => {
    const url = URL.createObjectURL(await card());
    Object.assign(document.createElement("a"), { href: url, download: `my-${a.name.toLowerCase()}.png` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = async () => {
    const text = `I got ${a.name}! What's yours?`;
    try {
      const file = new File([await card()], `${a.name}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text, url: location.origin });
      if (navigator.share) return await navigator.share({ text, url: location.origin });
      await navigator.clipboard.writeText(`${text} ${location.origin}`);
      setNote("Link copied!");
    } catch (e) {
      if (e?.name !== "AbortError") setNote("Couldn't share. Try Download instead.");
    }
  };

  const pal = [a.accentColor, "#c8ff2e", "#ffffff", "#fff4e0", "#7a3a1f"];
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const ang = (i / 24) * Math.PI * 2 + (i % 3) * 0.17;
    const dist = 150 + ((i * 37) % 110);
    return { dx: Math.round(Math.cos(ang) * dist), dy: Math.round(Math.sin(ang) * dist + 60), r: ((i * 97) % 540) - 270, c: pal[i % 5], br: i % 3 === 0 ? "50%" : "2px" };
  });
  const chips = [[a.accentColor, "#0b0a12", -3], ["#0b0a12", "#fff", 2], ["#c8ff2e", "#0b0a12", -1.5]];

  return (
    <>
      <div className="topbar" style={{ justifyContent: "space-between" }}>
        <span className="mono kicker" style={{ background: "var(--acc)" }}>the results are in</span>
        <span className="disp" style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.01em" }}>who are you?</span>
      </div>
      <section className={`tcard ${go ? "go" : ""}`} aria-labelledby="arch">
        <div className="inner">
          <div className="mono meta"><span>No. {num} / 06</span><span>collect all 6</span></div>
          <div className={`art ${go ? "go" : ""}`}>
            <img ref={img} src={r.imageUrl} alt={`Your ${a.name} avatar`} />
            <div className="holo" />
            <div className="flash" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 id="arch" className="disp rise" style={{ "--d": "1.2s" }}><small>The</small>{a.name}</h1>
            <p className="rise tag" style={{ "--d": "1.3s" }}>{a.tagline}</p>
          </div>
          <ul className="traits" aria-label="Traits">
            {r.traits.map((t, i) => (
              <li key={t} className="rise" style={{ background: chips[i][0], color: chips[i][1], transform: `rotate(${chips[i][2]}deg)`, "--d": `${1.4 + i * 0.08}s` }}>{t}</li>
            ))}
          </ul>
        </div>
      </section>
      {go && !reduced() && (
        <div className="cfwrap" aria-hidden="true">
          {pieces.map((c, i) => (
            <span key={i} className="cf" style={{ "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--r": `${c.r}deg`, background: c.c, borderRadius: c.br }} />
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn btn-acc" onClick={download}><Svg size={20}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>Download</button>
        <button className="btn btn-cream" onClick={share}><Svg size={20}><path d="M12 15V4M7 9l5-5 5 5M5 14v5h14v-5" /></Svg>Share</button>
      </div>
      {note && <p className="mono note" role="status">{note}</p>}
      <button className="ghost" onClick={onRetake}><Svg size={18}><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5" /></Svg>Retake quiz</button>
    </>
  );
}

function ErrorScreen({ error, onRetry, onRestart }) {
  const code = (error?.code || "error").toUpperCase();
  return (
    <>
      <div className="gsphere" aria-hidden="true">
        <div className="chrome" />
        <div className="slice chrome" style={{ clipPath: "inset(22% 0 62% 0)", filter: "hue-rotate(290deg) saturate(4)", animation: "g1 3.2s steps(1) infinite" }} />
        <div className="slice chrome" style={{ clipPath: "inset(58% 0 26% 0)", filter: "hue-rotate(160deg) saturate(4)", animation: "g2 3.2s steps(1) infinite" }} />
        <span className="disp oops">oops</span>
      </div>
      <h1 className="disp err-h">well, that <span>glitched.</span></h1>
      <div className="glass panel-g" role="alert">{error?.message || "Something broke while making your avatar. Give it another go."}</div>
      <span className="mono code">error · {code}</span>
      <div className="grow" />
      <button className="btn btn-lime big" onClick={onRetry}>try again <Svg size={20}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></Svg></button>
      <button className="btn btn-cream big" onClick={onRestart}>start over</button>
    </>
  );
}

function Limit({ message, onRestart }) {
  const left = () => {
    const n = new Date();
    return Math.max(0, Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime());
  };
  const [ms, setMs] = useState(left);
  useEffect(() => { const t = setInterval(() => setMs(left()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return (
    <>
      <div className="badge" aria-hidden="true">
        <svg viewBox="0 0 200 200"><path d="M100 0 L114 22 L139 9 L143 36 L171 31 L163 58 L190 65 L172 86 L195 104 L171 117 L184 142 L157 145 L157 173 L131 164 L120 190 L100 172 L80 190 L69 164 L43 173 L43 145 L16 142 L29 117 L5 104 L28 86 L10 65 L37 58 L29 31 L57 36 L61 9 L86 22 Z" fill="#c8ff2e" stroke="#0b0a12" strokeWidth="4" strokeLinejoin="round" /></svg>
        <div className="t disp">out of<br />avatars</div>
      </div>
      <h1 className="disp lim-h">that’s today’s avatars, <span>used up.</span></h1>
      <div className="glass panel-g">{message || "There’s a daily limit so the avatar machine doesn’t melt. Come back after the reset and run it again."}</div>
      <div className="timer" role="timer" aria-label={`Limit resets in ${Math.floor(s / 3600)} hours ${Math.floor((s % 3600) / 60)} minutes`}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>resets in</span>
        <span className="disp big">{clock}</span>
      </div>
      <div className="grow" />
      <button className="btn btn-cream big" onClick={onRestart}>back to start</button>
    </>
  );
}
