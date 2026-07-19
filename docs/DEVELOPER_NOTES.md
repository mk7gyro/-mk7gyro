# Campaign Concept Studio developer notes

## Current OpenAI pattern

The application uses the official `openai` Node SDK and the Responses API exclusively.

### Strategy stage

`src/campaign/openai.js` calls `responses.parse()` with:

- `gpt-5.6-terra` by default
- server-owned instructions
- a normalized user brief
- `zodTextFormat(campaignPlanSchema, "campaign_plan")`
- low reasoning effort
- `store: false`

The strict schema is the public contract between the server and browser. Change it deliberately and update the renderer and tests in the same commit.

### Image stage

The browser sends only the server-generated image directions and campaign context to `/api/images`. The server calls `responses.create()` once per requested direction with the built-in `image_generation` tool. It extracts `image_generation_call.result` and returns a PNG data URL.

The Responses tool chooses the underlying GPT Image model. `OPENAI_IMAGE_MODEL` is the mainline Responses model that decides and invokes the tool; it is not a direct `gpt-image-2` setting.

## Why there are two routes

Text strategy and image generation have different latency, cost, access, and failure modes. Separating them provides:

- faster perceived completion
- a usable partial result when image generation fails
- independent rate-limit handling
- a clearer future path for image queues or object storage

## Client/server boundary

### Client owns

- input collection and browser validation
- progress and cancellation UI
- rendering structured data
- current-session image downloads
- copying the campaign summary

### Server owns

- OpenAI credentials
- prompt and model configuration
- input and output validation
- Responses API calls
- image-tool invocation
- provider error normalization
- logging correlation IDs without prompt content

Never instantiate `OpenAI` in `app.js` or expose the key through a public environment variable.

## Latency and cost

- Strategy is one structured Responses request.
- Images run concurrently after strategy succeeds.
- The default is two `1024x1024`, low-quality drafts.
- Increase quality only for final asset generation; low quality is appropriate for direction selection.
- Keep the number of images within the serverless response-size limit. For larger outputs, upload image bytes to private object storage and return signed URLs.

## Reliability

- Both routes validate the HTTP method and request body before calling OpenAI.
- The UI preserves the strategy when the image stage fails.
- `Promise.allSettled()` permits partial image success.
- Upstream errors are mapped to stable user-facing messages.
- Vercel function duration is set to 60 seconds; raise it only after reviewing plan limits and measured image latency.

## Extending the studio

### Add a channel

1. Add it to `CHANNELS` in `src/campaign/schemas.js`.
2. Add the checkbox in `index.html`.
3. Add a fixture covering the channel.
4. Confirm the model creates relevant checklist and copy choices.

### Add another campaign artifact

1. Extend `campaignPlanSchema`.
2. Update `CAMPAIGN_SYSTEM_PROMPT`.
3. Render the new field in `app.js`.
4. Update `campaignAsText()`.
5. Add schema and UI validation tests.

### Add image editing

Use `previous_response_id` or include the prior `image_generation_call` in a follow-up Responses request. Persist response IDs only after privacy and retention review.

### Move images to storage

Decode the base64 result server-side, upload it to approved object storage, and return a short-lived URL. Do not make a public bucket the default for confidential campaign work.

## Manual review points

- Brand and legal review for generated claims
- Organization verification for GPT Image access
- Content moderation and audience suitability
- Data retention policy before changing `store: false`
- Image copyright, likeness, and trademark review
- Hosting response-size and function-duration limits
- Authentication and per-user rate limiting before public launch
