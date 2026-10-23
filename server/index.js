import express from "express";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { archetypes, buildPrompt } from "../shared/config.js";
import { getProvider } from "./provider.js";

// Minimal .env loader (no extra dependency)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {}

const PORT = Number(process.env.PORT || 8787);
const USER_LIMIT = Number(process.env.USER_DAILY_LIMIT || 3);
const GLOBAL_CAP = Number(process.env.GLOBAL_DAILY_CAP || 50);
const SECRET = process.env.SIGNING_SECRET || crypto.randomBytes(16).toString("hex");
const JOB_TIMEOUT_MS = 120_000;
const TTL_MS = 24 * 3600 * 1000;
const DATA_DIR = path.join(root, "server", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const provider = getProvider();

// ---- storage with 24h expiry (swap for S3/Cloudinary lifecycle rule in production) ----
const sweep = () => {
  const cutoff = Date.now() - TTL_MS;
  for (const f of fs.readdirSync(DATA_DIR)) {
    const p = path.join(DATA_DIR, f);
    try {
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    } catch {}
  }
};
sweep();
setInterval(sweep, 10 * 60 * 1000).unref();

const sign = (id, exp) => crypto.createHmac("sha256", SECRET).update(`${id}.${exp}`).digest("hex");
const signedUrl = (id) => {
  const exp = Date.now() + 60 * 60 * 1000;
  return `/api/image/${id}?exp=${exp}&sig=${sign(id, exp)}`;
};

// ---- rate limiting: completed + in-flight reservations; failures release their slot ----
const dayKey = () => new Date().toISOString().slice(0, 10);
const usage = new Map(); // `${day}:${key}` -> count
const globalUsage = new Map(); // day -> count
const bump = (day, key, d) => {
  usage.set(`${day}:${key}`, Math.max(0, (usage.get(`${day}:${key}`) || 0) + d));
  globalUsage.set(day, Math.max(0, (globalUsage.get(day) || 0) + d));
};
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const jobs = new Map();

const app = express();
app.set("trust proxy", 1);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length > 8 && buf.slice(1, 4).toString() === "PNG") return "image/png";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

app.get("/api/status", (_req, res) => {
  res.json({ capReached: (globalUsage.get(dayKey()) || 0) >= GLOBAL_CAP, provider: provider.name });
});

function fail(job, e) {
  if (job.settled) return;
  job.settled = true;
  job.status = "failed";
  job.errorCode = e?.code || "provider_down";
  job.error =
    {
      refused: "The image service couldn't use that photo. Try a different, clearer selfie.",
      timeout: "That took too long. Please try again.",
    }[job.errorCode] || "The image service is having trouble. Please try again in a moment.";
  bump(job.day, job.key, -1); // failed jobs don't count against the limit
  try {
    fs.unlinkSync(path.join(DATA_DIR, `${job.id}-selfie`));
  } catch {}
  console.error(`job ${job.id} failed: ${job.errorCode} (${e?.message || "no detail"})`); // never log images, URLs or IPs
}

app.post(
  "/api/generate",
  (req, res, next) =>
    upload.single("selfie")(req, res, (err) => {
      if (err?.code === "LIMIT_FILE_SIZE")
        return res.status(413).json({ code: "file_too_large", error: "That photo is over 5 MB. Try a smaller one." });
      if (err) return res.status(400).json({ code: "bad_upload", error: "Upload failed. Please try again." });
      next();
    }),
  async (req, res) => {
    const { archetype, consent } = req.body;
    if (consent !== "true") return res.status(400).json({ code: "no_consent", error: "Please tick the consent box first." });
    if (!archetypes[archetype]) return res.status(400).json({ code: "bad_archetype", error: "Unknown archetype." });
    const mime = req.file && sniff(req.file.buffer);
    if (!mime) return res.status(400).json({ code: "bad_file_type", error: "Please upload a JPG, PNG, or WebP photo." });

    const day = dayKey();
    if ((globalUsage.get(day) || 0) >= GLOBAL_CAP)
      return res.status(429).json({ code: "daily_cap", error: "We've hit today's limit, come back tomorrow!" });
    const fp = String(req.headers["x-fingerprint"] || "").slice(0, 64);
    const key = hash(`${req.ip}|${fp}`);
    if ((usage.get(`${day}:${key}`) || 0) >= USER_LIMIT)
      return res
        .status(429)
        .json({ code: "rate_limit", error: `You've used your ${USER_LIMIT} avatars for today. Come back tomorrow!` });

    bump(day, key, 1); // reserve a slot
    const id = crypto.randomUUID();
    const job = { id, status: "pending", archetype, day, key, createdAt: Date.now(), settled: false };
    jobs.set(id, job);
    try {
      fs.writeFileSync(path.join(DATA_DIR, `${id}-selfie`), req.file.buffer);
      job.providerJob = await provider.start({ prompt: buildPrompt(archetype), image: req.file.buffer, mime });
      res.status(202).json({ jobId: id });
    } catch (e) {
      fail(job, e);
      res.status(502).json({ code: job.errorCode, error: job.error });
    }
  }
);

app.get("/api/generate/:jobId", async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ status: "failed", error: "Job not found." });
  if (job.status === "pending") {
    if (Date.now() - job.createdAt > JOB_TIMEOUT_MS) {
      fail(job, Object.assign(new Error("timeout"), { code: "timeout" }));
    } else {
      try {
        const out = await provider.poll(job.providerJob);
        if (out && job.status === "pending") {
          fs.writeFileSync(path.join(DATA_DIR, `${job.id}-result`), out);
          job.status = "done";
          job.settled = true;
          try {
            fs.unlinkSync(path.join(DATA_DIR, `${job.id}-selfie`));
          } catch {}
        }
      } catch (e) {
        fail(job, e);
      }
    }
  }
  if (job.status === "done") {
    const a = archetypes[job.archetype];
    return res.json({
      status: "done",
      imageUrl: signedUrl(job.id),
      archetype: job.archetype,
      name: a.name,
      tagline: a.tagline,
      traits: a.traits,
    });
  }
  if (job.status === "failed") return res.json({ status: "failed", code: job.errorCode, error: job.error });
  res.json({ status: "pending" });
});

app.get("/api/image/:id", (req, res) => {
  const { exp, sig } = req.query;
  if (!/^[0-9a-f-]{36}$/.test(req.params.id) || !sig || !(Number(exp) > Date.now())) return res.status(403).end();
  const expected = Buffer.from(sign(req.params.id, exp));
  const got = Buffer.from(String(sig));
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return res.status(403).end();
  const p = path.join(DATA_DIR, `${req.params.id}-result`);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.set("Content-Type", sniff(fs.readFileSync(p)) || "image/jpeg").set("Cache-Control", "private, max-age=3600");
  fs.createReadStream(p).pipe(res);
});

const dist = path.join(root, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () =>
  console.log(`API on :${PORT} (provider: ${provider.name}, cap ${GLOBAL_CAP}/day, ${USER_LIMIT}/user)`)
);
