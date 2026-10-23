// Client helpers: face check, resize/EXIF-strip, fingerprint, framed PNG export.

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorPromise;
function getDetector() {
  detectorPromise ??= import("@mediapipe/tasks-vision").then(async ({ FaceDetector, FilesetResolver }) => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.6,
    });
  });
  return detectorPromise;
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

/** Returns { ok, message }. If the detector can't load (offline), we let the photo through. */
export async function checkFace(img) {
  let detector;
  try {
    detector = await getDetector();
  } catch {
    return { ok: true, message: "Looks good (face check unavailable, so we couldn't verify).", skipped: true };
  }
  const { detections } = detector.detect(img);
  if (detections.length === 0) return { ok: false, message: "We couldn't find a face. Try a clear, front-facing selfie in good light." };
  if (detections.length > 1) return { ok: false, message: "We found more than one face. Please use a photo of just you." };
  const w = detections[0].boundingBox.width / img.naturalWidth;
  if (w < 0.15) return { ok: false, message: "Your face is too small in the photo. Move closer or crop in." };
  return { ok: true, message: "Looks great!" };
}

/** Resize to max 1024px and re-encode as JPEG via canvas (drops EXIF incl. GPS). */
export function resizeToJpeg(img, max = 1024) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, "image/jpeg", 0.9));
}

export function fingerprint() {
  const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone].join("|");
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bake the archetype name and accent frame into a PNG. */
export async function renderCard({ imageUrl, name, tagline, accent }) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageUrl;
  });
  const W = 1080, pad = 36, bar = 170;
  const imgH = Math.round(((W - pad * 2) * img.naturalHeight) / img.naturalWidth);
  const H = pad + imgH + bar;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = accent;
  g.fillRect(0, 0, W, H);
  g.drawImage(img, pad, pad, W - pad * 2, imgH);
  g.fillStyle = "#0b0a12";
  g.textAlign = "center";
  g.font = "900 72px Unbounded, system-ui, sans-serif";
  g.fillText(`The ${name}`, W / 2, pad + imgH + 80);
  g.font = "700 34px Nunito, system-ui, sans-serif";
  g.fillText(tagline, W / 2, pad + imgH + 130);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
