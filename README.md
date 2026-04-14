<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Galaxy Trip Scanner Manager

This is a Vite + React app deployed on Vercel. Gemini calls are made **server-side** via a Vercel Function so Google credentials never ship to the browser.

## Vercel (recommended)

Set these **Vercel Environment Variables** (Project → Settings → Environment Variables):

- `GOOGLE_CLOUD_PROJECT` (example: `quiet-radius-430208-t4`)
- `GOOGLE_CLOUD_LOCATION` (example: `us-central1`)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (paste the full service-account JSON contents)
- Optional: `GEMINI_MODEL` (default: `gemini-2.5-flash`)

The frontend calls `POST /api/gemini` and the server function `api/gemini.js` talks to Vertex AI using the service account.

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Create `.env.local` with the same variables as above
3. For a full local stack (Vite + Vercel Functions), run: `vercel dev`
   - `npm run dev` runs only Vite; `/api/*` won’t be available unless you proxy it yourself.
