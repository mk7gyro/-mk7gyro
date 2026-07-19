# Campaign Concept Studio

Campaign Concept Studio is a full-stack marketing workspace that turns a short brief into a structured campaign platform, three copy routes, a prioritized launch checklist, two image prompts, and generated campaign key art.

It uses the current OpenAI **Responses API** for both stages:

1. `responses.parse()` creates a strict, typed campaign plan.
2. `responses.create()` invokes the built-in `image_generation` tool for each visual direction.

No legacy Completions, Chat Completions, Assistants API, or browser-side OpenAI calls are used.

## Output

- Concise campaign concept and strategic rationale
- Exactly three headline, body, and CTA variants
- Prioritized launch checklist with phases and owner roles
- Two production-oriented image prompts
- Two generated campaign images by default
- Explicit assumptions when the brief lacks proof points or decisions

## Architecture

### Browser

- Collects campaign brief, audience, product details, tone, and channel selections.
- Calls `POST /api/concept` and renders the structured plan.
- Calls `POST /api/images` only after the plan succeeds.
- Shows empty, strategy-loading, image-loading, partial-success, error, and completed states.
- Keeps generated image data in the current browser session and supports image download.
- Never receives `OPENAI_API_KEY` and never imports the OpenAI SDK.

### Server

- Validates every request with Zod.
- Creates the campaign plan with `openai.responses.parse()` and `zodTextFormat`.
- Generates images with `openai.responses.create()` and the Responses `image_generation` tool.
- Uses `store: false` for both stages.
- Normalizes upstream failures into safe application errors.
- Allows strategy to remain usable if image generation fails or is rate-limited.

## Project structure

```text
api/concept.js                 Structured campaign plan endpoint
api/images.js                  Responses image-tool endpoint
src/campaign/config.js         Model and image settings
src/campaign/schemas.js        Input and structured-output schemas
src/campaign/prompts.js        Strategy and image prompt construction
src/campaign/openai.js         Server-only OpenAI SDK integration
src/server/errors.js           Safe JSON and error mapping
index.html                     Application shell
app.js                         Progressive client flow and rendering
styles.css                     Responsive production UI
tests/                         Validation, schema, and image extraction tests
scripts/verify-sdk.mjs         SDK and schema construction smoke check
docs/DEVELOPER_NOTES.md        Extension, operations, and tuning notes
```

## Requirements

- Node.js 20 or newer
- An OpenAI API project with access to the configured text model and image generation tool
- Image generation may require organization verification in the OpenAI developer console

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set the server-side key in `.env.local`:

```env
OPENAI_API_KEY=your_server_side_openai_key
OPENAI_TEXT_MODEL=gpt-5.6-terra
OPENAI_IMAGE_MODEL=gpt-5.6-terra
CAMPAIGN_IMAGE_COUNT=2
CAMPAIGN_IMAGE_QUALITY=low
CAMPAIGN_IMAGE_SIZE=1024x1024
```

Start the static frontend and serverless API routes together:

```bash
npm run dev
```

Open the localhost URL printed by Vercel Dev.

## Commands

```bash
npm test
npm run check
npm run build
```

`npm run check` validates browser and server syntax, executes the test suite, and verifies that the current OpenAI SDK helpers can construct the Responses request schema.

## Deployment

The repository is configured for Vercel:

1. Import the repository as a Vercel project.
2. Add `OPENAI_API_KEY` to the Production and Preview environments.
3. Optionally add the model and image-setting variables shown above.
4. Deploy. The build copies the static frontend into `public/` and deploys both API routes as Node.js functions.

Do not prefix the API key with `VITE_`, `NEXT_PUBLIC_`, or any other public environment-variable convention.

## Configuration and tuning

- **Text model:** `OPENAI_TEXT_MODEL` in `src/campaign/config.js`
- **Image orchestration model:** `OPENAI_IMAGE_MODEL` in `src/campaign/config.js`
- **Strategy prompt:** `CAMPAIGN_SYSTEM_PROMPT` in `src/campaign/prompts.js`
- **Output contract:** `campaignPlanSchema` in `src/campaign/schemas.js`
- **Image prompt wrapper:** `formatImagePrompt()` in `src/campaign/prompts.js`
- **Image count:** `CAMPAIGN_IMAGE_COUNT`, clamped from 1 to 3
- **Image quality:** `CAMPAIGN_IMAGE_QUALITY` (`low`, `medium`, `high`, or `auto`)
- **Image size:** `CAMPAIGN_IMAGE_SIZE` (`1024x1024`, `1536x1024`, `1024x1536`, or `auto`)

The default text and image orchestration model is `gpt-5.6-terra` for a balance of quality and cost. Evaluate `gpt-5.6-sol` for high-stakes strategic work and `gpt-5.6-luna` for high-volume, bounded generation before changing production routing.

The Responses image-generation tool selects the underlying GPT Image model. If the product later needs direct single-image generation controls or image editing outside a conversational flow, evaluate the standalone Image API with `gpt-image-2` separately.

## Validation checklist

### Local

- [ ] `npm install` completes on Node.js 20+.
- [ ] `npm run check` passes.
- [ ] `npm run dev` serves the frontend and both API routes.
- [ ] A missing `OPENAI_API_KEY` returns `server_not_configured` without exposing secrets.
- [ ] A valid brief returns one concept, three copy variants, 6–12 checklist items, and two image directions.
- [ ] Strategy renders before image generation completes.
- [ ] At least one generated image is displayed and downloadable.
- [ ] Image failure leaves the strategy and image prompts visible.
- [ ] Cancel stops the active browser request.

### Quality

- [ ] Copy variants use materially different strategic angles.
- [ ] Claims do not exceed supplied product evidence.
- [ ] Requested channels influence the concept and checklist.
- [ ] Image directions match the concept, audience, and tone.
- [ ] Generated images avoid logos, watermarks, unsupported UI, and legible marketing copy.
- [ ] Checklist items have useful priorities, phases, and owner roles.

### Deployment

- [ ] `OPENAI_API_KEY` exists in Preview and Production.
- [ ] `/api/concept` and `/api/images` reject GET with HTTP 405.
- [ ] Production CSP permits same-origin API calls and `data:` images.
- [ ] Image response size remains within the hosting platform limit.
- [ ] Rate-limit and organization-verification errors produce useful UI messages.
