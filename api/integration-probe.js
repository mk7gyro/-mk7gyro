import conceptHandler from "./concept.js";
import imagesHandler from "./images.js";

export const config = { maxDuration: 60 };
const TOKEN = "ccs-20260719-5d8e2a";

function invoke(handler, body) {
  return new Promise((resolve) => {
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      end(value = "") {
        let parsed = null;
        try { parsed = JSON.parse(String(value || "{}")); } catch { parsed = { raw: String(value) }; }
        resolve({ status: this.statusCode, body: parsed });
      }
    };
    Promise.resolve(handler({ method: "POST", body }, response)).catch((error) => {
      resolve({ status: 500, body: { error: "probe_exception", message: error?.message } });
    });
  });
}

export default async function handler(req, res) {
  if (req.query?.token !== TOKEN) return res.status(404).json({ error: "not_found" });

  const input = {
    brief: "Launch a collaborative research workspace that turns scattered customer interviews and support notes into a shared evidence library for product teams.",
    audience: "Product managers and UX researchers at growing B2B software companies.",
    productDetails: "The public beta imports notes, links evidence to roadmap decisions, and creates source-backed summaries. No customer metrics or testimonials are approved.",
    tone: "Confident, clear, and modern",
    channels: ["Landing page", "Email", "LinkedIn"]
  };

  const concept = await invoke(conceptHandler, input);
  if (concept.status !== 200 || !concept.body?.plan) {
    return res.status(502).json({ ok: false, stage: "concept", status: concept.status, error: concept.body?.error, message: concept.body?.message });
  }

  const firstDirection = concept.body.plan.imageDirections?.[0];
  const image = await invoke(imagesHandler, {
    campaignName: concept.body.plan.concept.name,
    tone: input.tone,
    audience: input.audience,
    imageDirections: [firstDirection]
  });

  const generated = image.status === 200 && Array.isArray(image.body?.images) && image.body.images.some((item) => typeof item.dataUrl === "string" && item.dataUrl.startsWith("data:image/png;base64,"));
  return res.status(generated ? 200 : 502).json({
    ok: generated,
    conceptStatus: concept.status,
    imageStatus: image.status,
    conceptName: concept.body.plan.concept.name,
    copyVariants: concept.body.plan.copyVariants?.length,
    checklistItems: concept.body.plan.checklist?.length,
    imageGenerated: generated,
    imageError: generated ? null : image.body?.error,
    imageMessage: generated ? null : image.body?.message
  });
}
