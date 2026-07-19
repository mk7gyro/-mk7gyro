const $ = (selector) => document.querySelector(selector);

const form = $("#campaignForm");
const generateButton = $("#generateButton");
const cancelButton = $("#cancelButton");
const sampleButton = $("#sampleButton");
const retryButton = $("#retryButton");
const copyButton = $("#copyButton");
const statusPill = $("#statusPill");
const statusText = $("#statusText");
const boardTitle = $("#boardTitle");
const emptyState = $("#emptyState");
const loadingState = $("#loadingState");
const loadingTitle = $("#loadingTitle");
const loadingDescription = $("#loadingDescription");
const errorState = $("#errorState");
const errorMessage = $("#errorMessage");
const results = $("#results");
const copyGrid = $("#copyGrid");
const checklist = $("#checklist");
const imageGrid = $("#imageGrid");
const imageWarning = $("#imageWarning");
const assumptionsSection = $("#assumptionsSection");
const assumptionsList = $("#assumptionsList");
const resultMeta = $("#resultMeta");
const toast = $("#toast");

let controller = null;
let latestPlan = null;
let latestImages = [];
let latestRequest = null;
let stageTimer = null;

function textElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function setStatus(state, label) {
  statusPill.dataset.state = state;
  statusText.textContent = label;
}

function setStage(name, state, label) {
  const stage = document.querySelector(`[data-stage="${name}"]`);
  if (!stage) return;
  stage.dataset.state = state;
  stage.querySelector("small").textContent = label;
}

function resetStages() {
  ["strategy", "copy", "art"].forEach((stage) => setStage(stage, "waiting", "Waiting"));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function showPanel(panel) {
  emptyState.hidden = panel !== "empty";
  loadingState.hidden = panel !== "loading";
  errorState.hidden = panel !== "error";
  results.hidden = panel !== "results";
}

function getPayload() {
  const channels = [...document.querySelectorAll('input[name="channels"]:checked')].map((input) => input.value);
  return {
    brief: $("#brief").value.trim(),
    audience: $("#audience").value.trim(),
    productDetails: $("#productDetails").value.trim(),
    tone: $("#tone").value,
    channels
  };
}

async function postJson(url, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}.`);
    error.code = data.error;
    error.requestId = data.requestId;
    throw error;
  }
  return data;
}

function renderCopyVariants(variants) {
  copyGrid.replaceChildren();
  variants.forEach((variant, index) => {
    const card = document.createElement("article");
    card.className = "copy-card";
    const top = document.createElement("div");
    top.className = "copy-card-top";
    top.append(textElement("span", "route-number", String(index + 1).padStart(2, "0")));
    top.append(textElement("strong", "route-label", variant.label));
    card.append(top);
    card.append(textElement("h4", "", variant.headline));
    card.append(textElement("p", "copy-body", variant.body));
    card.append(textElement("span", "copy-cta", variant.cta));
    copyGrid.append(card);
  });
}

function renderChecklist(items) {
  checklist.replaceChildren();
  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "check-row";
    const priority = textElement("span", `priority priority-${item.priority.toLowerCase()}`, item.priority);
    const copy = document.createElement("div");
    copy.append(textElement("strong", "", item.item));
    copy.append(textElement("small", "", `${item.phase} · ${item.owner}`));
    row.append(priority, copy);
    checklist.append(row);
  });
}

function createImagePlaceholder(direction, index) {
  const card = document.createElement("article");
  card.className = "image-card is-loading";
  card.dataset.imageIndex = String(index);

  const visual = document.createElement("div");
  visual.className = "image-placeholder";
  visual.append(textElement("span", "", "Rendering key art"));

  const body = document.createElement("div");
  body.className = "image-card-body";
  body.append(textElement("p", "image-label", `Direction ${String(index + 1).padStart(2, "0")}`));
  body.append(textElement("h4", "", direction.title));
  const details = document.createElement("details");
  details.append(textElement("summary", "", "View image prompt"));
  details.append(textElement("p", "", direction.prompt));
  body.append(details);

  card.append(visual, body);
  return card;
}

function renderImagePlaceholders(directions) {
  imageGrid.replaceChildren();
  directions.forEach((direction, index) => imageGrid.append(createImagePlaceholder(direction, index)));
  imageWarning.hidden = true;
}

function renderImages(images, directions) {
  latestImages = images;
  imageGrid.replaceChildren();
  directions.forEach((direction, index) => {
    const image = images.find((item) => item.title === direction.title) || images[index];
    if (!image) {
      imageGrid.append(createImagePlaceholder(direction, index));
      return;
    }

    const card = document.createElement("article");
    card.className = "image-card";
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.src = image.dataUrl;
    img.alt = image.altText;
    img.loading = "lazy";
    figure.append(img);

    const body = document.createElement("div");
    body.className = "image-card-body";
    body.append(textElement("p", "image-label", `Direction ${String(index + 1).padStart(2, "0")}`));
    body.append(textElement("h4", "", image.title));
    const actions = document.createElement("div");
    actions.className = "image-actions";
    const details = document.createElement("details");
    details.append(textElement("summary", "", "View image prompt"));
    details.append(textElement("p", "", image.prompt));
    const download = document.createElement("a");
    download.href = image.dataUrl;
    download.download = `${image.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "campaign-art"}.png`;
    download.textContent = "Download";
    actions.append(details, download);
    body.append(actions);
    card.append(figure, body);
    imageGrid.append(card);
  });
}

function renderPlan(plan, meta) {
  latestPlan = plan;
  $("#conceptName").textContent = plan.concept.name;
  $("#conceptLine").textContent = plan.concept.oneLiner;
  $("#bigIdea").textContent = plan.concept.bigIdea;
  $("#audienceInsight").textContent = plan.concept.audienceInsight;
  $("#keyMessage").textContent = plan.concept.keyMessage;
  $("#visualDirection").textContent = plan.concept.visualDirection;
  boardTitle.textContent = plan.concept.name;
  renderCopyVariants(plan.copyVariants);
  renderChecklist(plan.checklist);
  renderImagePlaceholders(plan.imageDirections);

  assumptionsList.replaceChildren();
  if (plan.assumptions.length) {
    plan.assumptions.forEach((assumption) => assumptionsList.append(textElement("li", "", assumption)));
    assumptionsSection.hidden = false;
  } else {
    assumptionsSection.hidden = true;
  }

  resultMeta.textContent = `Strategy generated with ${meta.model}${meta.responseId ? ` · ${meta.responseId}` : ""}`;
  copyButton.disabled = false;
  showPanel("results");
}

function campaignAsText() {
  if (!latestPlan) return "";
  const plan = latestPlan;
  const copy = plan.copyVariants.map((item, index) => `${index + 1}. ${item.label}\n${item.headline}\n${item.body}\nCTA: ${item.cta}`).join("\n\n");
  const checklistText = plan.checklist.map((item) => `- [${item.priority}] ${item.item} — ${item.owner} (${item.phase})`).join("\n");
  const prompts = plan.imageDirections.map((item) => `${item.title}\n${item.prompt}`).join("\n\n");
  return `${plan.concept.name}\n${plan.concept.oneLiner}\n\nBIG IDEA\n${plan.concept.bigIdea}\n\nAUDIENCE INSIGHT\n${plan.concept.audienceInsight}\n\nKEY MESSAGE\n${plan.concept.keyMessage}\n\nCOPY ROUTES\n${copy}\n\nLAUNCH CHECKLIST\n${checklistText}\n\nIMAGE PROMPTS\n${prompts}`;
}

function setWorking(working) {
  generateButton.disabled = working;
  sampleButton.disabled = working;
  cancelButton.hidden = !working;
  form.querySelectorAll("input, textarea, select").forEach((input) => { input.disabled = working; });
}

async function runCampaign() {
  if (!form.reportValidity()) return;
  const payload = getPayload();
  if (!payload.channels.length) {
    showToast("Select at least one channel.");
    return;
  }

  latestRequest = payload;
  latestPlan = null;
  latestImages = [];
  controller?.abort();
  controller = new AbortController();
  window.clearTimeout(stageTimer);
  setWorking(true);
  resetStages();
  setStage("strategy", "active", "Synthesizing");
  setStatus("working", "Building campaign");
  boardTitle.textContent = "Developing the platform";
  loadingTitle.textContent = "Finding the strategic angle";
  loadingDescription.textContent = "Synthesizing the brief into a campaign platform and message system.";
  showPanel("loading");
  copyButton.disabled = true;

  stageTimer = window.setTimeout(() => {
    setStage("strategy", "done", "Complete");
    setStage("copy", "active", "Writing routes");
    loadingTitle.textContent = "Writing the message system";
    loadingDescription.textContent = "Developing three distinct headline, body, and CTA routes.";
  }, 1200);

  try {
    const conceptResponse = await postJson("/api/concept", payload, controller.signal);
    window.clearTimeout(stageTimer);
    setStage("strategy", "done", "Complete");
    setStage("copy", "done", "Complete");
    setStage("art", "active", "Rendering");
    renderPlan(conceptResponse.plan, conceptResponse.meta);
    setStatus("working", "Rendering key art");

    const imageResponse = await postJson("/api/images", {
      campaignName: conceptResponse.plan.concept.name,
      tone: payload.tone,
      audience: payload.audience,
      imageDirections: conceptResponse.plan.imageDirections
    }, controller.signal);

    renderImages(imageResponse.images, conceptResponse.plan.imageDirections);
    if (imageResponse.warnings?.length) {
      imageWarning.textContent = imageResponse.warnings.join(" ");
      imageWarning.hidden = false;
    }
    setStage("art", "done", `${imageResponse.meta.completed} complete`);
    setStatus("done", "Campaign ready");
    resultMeta.textContent += ` · ${imageResponse.meta.completed} images · ${imageResponse.meta.quality} quality`;
  } catch (error) {
    window.clearTimeout(stageTimer);
    if (error.name === "AbortError") {
      setStatus("ready", "Generation cancelled");
      if (!latestPlan) showPanel("empty");
      return;
    }

    if (latestPlan) {
      setStage("art", "error", "Unavailable");
      setStatus("partial", "Strategy ready · art unavailable");
      imageWarning.textContent = `${error.message} The image prompts are still available for later rendering.`;
      imageWarning.hidden = false;
    } else {
      setStatus("error", "Generation failed");
      setStage("strategy", "error", "Failed");
      errorMessage.textContent = error.requestId ? `${error.message} Reference: ${error.requestId}` : error.message;
      showPanel("error");
    }
  } finally {
    setWorking(false);
    controller = null;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  runCampaign();
});

cancelButton.addEventListener("click", () => controller?.abort());
retryButton.addEventListener("click", runCampaign);

sampleButton.addEventListener("click", () => {
  $("#brief").value = "Launch a collaborative research workspace that turns scattered customer interviews, support notes, and market findings into a shared evidence library for product teams.";
  $("#audience").value = "Product managers and UX researchers at growing B2B software companies who are tired of insights disappearing across documents and chat threads.";
  $("#productDetails").value = "The product imports notes, tags evidence, links findings to roadmap decisions, and generates traceable summaries. It is entering public beta. Differentiators are source-linked synthesis, fast team onboarding, and a calm interface. No customer metrics or testimonials are approved yet.";
  $("#tone").value = "Confident, clear, and modern";
  document.querySelectorAll('input[name="channels"]').forEach((input) => {
    input.checked = ["Landing page", "Email", "LinkedIn", "In-product"].includes(input.value);
  });
  showToast("Example brief loaded.");
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(campaignAsText());
    showToast("Campaign copied.");
  } catch {
    showToast("Copy is unavailable in this browser.");
  }
});

resetStages();
showPanel("empty");
