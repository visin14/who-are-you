// Image-edit providers. start() returns a handle, poll() returns a Buffer when done, null while pending,
// and throws an Error with .code = "refused" | "timeout" | "provider_down" on failure.

const mock = {
  name: "mock",
  async start({ image }) {
    return { image, readyAt: Date.now() + 4000 };
  },
  async poll(h) {
    // Echoes the selfie so the whole flow can be tested for free.
    return Date.now() >= h.readyAt ? h.image : null;
  },
};

const replicate = {
  name: "replicate",
  async start({ prompt, image, mime }) {
    const model = process.env.REPLICATE_MODEL || "black-forest-labs/flux-kontext-pro";
    const r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
          prompt,
          input_image: `data:${mime};base64,${image.toString("base64")}`,
          aspect_ratio: process.env.ASPECT_RATIO || "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    });
    if (!r.ok) throw Object.assign(new Error(`replicate ${r.status}`), { code: r.status === 422 ? "refused" : "provider_down" });
    return { id: (await r.json()).id };
  },
  async poll({ id }) {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!r.ok) throw Object.assign(new Error(`replicate ${r.status}`), { code: "provider_down" });
    const p = await r.json();
    if (p.status === "succeeded") {
      const url = Array.isArray(p.output) ? p.output[0] : p.output;
      const img = await fetch(url); // copy now; provider URLs expire
      if (!img.ok) throw Object.assign(new Error("download"), { code: "provider_down" });
      return Buffer.from(await img.arrayBuffer());
    }
    if (p.status === "failed" || p.status === "canceled") {
      const flagged = /sensitive|flagged|safety|nsfw/i.test(String(p.error));
      throw Object.assign(new Error("failed"), { code: flagged ? "refused" : "provider_down" });
    }
    return null;
  },
};

export function getProvider() {
  const name = process.env.IMAGE_PROVIDER || "mock";
  if (name === "replicate") {
    if (!process.env.REPLICATE_API_TOKEN) throw new Error("IMAGE_PROVIDER=replicate needs REPLICATE_API_TOKEN");
    return replicate;
  }
  return mock;
}
