# NHK AI

A React + Vite chat interface with a server-side OpenAI Responses API integration.

## Requirements

- Node.js 20.19+ (or a current supported Node.js LTS release)
- An OpenAI API key with API access and available billing/usage
- npm

## Run locally

1. Install dependencies:

   `npm install`

2. Copy `.env.example` to `.env` and add your API key to `OPENAI_API_KEY`.
   Keep this file private. It is ignored by Git. Never put the key in a
   `VITE_*` variable or in frontend code.

3. Start the API server in one terminal:

   `npm run server`

4. Start the Vite frontend in another terminal:

   `npm run dev`

5. Open the local URL printed by Vite (normally http://localhost:5173).

The Vite development server forwards `/api/*` requests to the Express server
on port 3001. Check `/api/health` to confirm whether the server sees a key.
The health endpoint reports only whether a key is configured; it never returns it.

## Production

Build the frontend with `npm run build`, then run the server with
`NODE_ENV=production npm start`. Set `OPENAI_API_KEY`, `AI_MODEL`,
`APP_ORIGIN`, and `PORT` in the hosting provider's server-side environment
settings. Deploy the frontend and Express server together, or configure your
host's reverse proxy to route `/api` to this server.

Do not commit `.env`, expose secrets in browser code, or paste API keys into
chat messages or issue reports.

## API

- `GET /api/health` — basic status and provider configuration flag.
- `POST /api/chat` — accepts a bounded array of user/assistant text messages
  and a UI style (`NHK Smart`, `NHK Creative`, or `NHK Code`).

The server validates message roles and sizes, applies per-IP rate limiting,
restricts browser origins, sets security headers, and sends requests through
the official OpenAI Node SDK. Conversation storage remains in the browser.
Provider requests use `store: false`.

File selection in the current UI is only a local attachment preview; file
contents are not uploaded to or analyzed by the AI yet.


## NHK Command Center

The home screen is a personal dashboard with a live local clock, current weather (Open-Meteo), task list, month calendar, autosaved quick notes, and project cards. Use **Customize** to show or hide widgets. Dashboard data is saved in this browser's local storage. Weather location can be changed in the weather card.
