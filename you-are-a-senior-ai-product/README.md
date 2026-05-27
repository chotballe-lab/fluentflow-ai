# FluentFlow AI

Premium mobile-first AI English voice companion for natural realtime speaking practice.

## What This MVP Optimizes For

- Launch today as a web app, not a native app store app
- Free browser-native voice first
- Optional low-cost AI text coaching through serverless functions
- Optional OpenAI Realtime speech-to-speech when explicitly enabled
- Installable PWA with home-screen launch
- Vercel-ready static frontend plus tiny `/api` functions

## Local Run

This workspace has a bundled Node runtime available at:

```bash
/Users/mohamed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

Open `http://localhost:3000`.

The app works with no API key by using browser speech recognition, browser speech synthesis, and local correction rules.

For low-cost AI coaching, set `OPENAI_API_KEY` or `OPENROUTER_API_KEY`:

```bash
OPENAI_API_KEY=sk-... /Users/mohamed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

For OpenAI Realtime speech-to-speech, explicitly enable it:

```bash
OPENAI_API_KEY=sk-... OPENAI_REALTIME_ENABLED=true /Users/mohamed/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

## Vercel Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the short launch checklist.

1. Create a free Vercel account.
2. Push this folder to a GitHub repository.
3. In Vercel, choose **Add New Project** and import the repository.
4. Leave build settings empty. This project is static files in `public/` plus Node functions in `api/`.
5. Deploy.
6. Add environment variables only when needed:
   - No variables: free local/browser coaching mode
   - `OPENAI_API_KEY`: AI text coaching through `/api/coach`
   - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`: OpenRouter coaching through `/api/coach`
   - `OPENAI_REALTIME_ENABLED=true`: enable paid Realtime WebRTC mode
   - `NEWS_API_KEY`: optional current topic briefs

Your free URL will look like:

```text
https://fluentflow-ai.vercel.app
```

## Phone Install

On iPhone Safari:

1. Open the Vercel URL.
2. Tap Share.
3. Tap **Add to Home Screen**.

On Android Chrome:

1. Open the Vercel URL.
2. Tap the install prompt or browser menu.
3. Tap **Install app**.

The manifest uses standalone display mode, so the app opens like a native mobile app from the home screen.

## Architecture

```text
public/
  index.html      mobile-first PWA shell
  app.js          voice UX, memory, progress, install flow
  styles.css      premium responsive UI
  manifest.json   home-screen install metadata
  sw.js           offline-first asset cache

api/
  health.js              capability flags
  coach.js               low-cost text coaching
  topic-context.js       optional news/topic retrieval
  realtime/session.js    optional OpenAI Realtime WebRTC bridge

lib/
  fluentflow-core.js     shared API logic for local server and Vercel
```

## Cost-Control Strategy

- Default path costs $0: static hosting plus browser-native voice.
- Text AI is optional and can be rate-limited later.
- OpenAI Realtime is opt-in with `OPENAI_REALTIME_ENABLED=true`.
- User progress and memory stay in `localStorage`, so no database is required for launch.

## Product Scope

- Mobile-first AI speaking companion
- Browser-native voice MVP
- Optional Realtime WebRTC voice session through OpenAI
- Calm AI personality with gentle English corrections
- Topic modes for daily English conversation
- PWA install and standalone launch
- Local memory, streaks, minutes, vocabulary, recurring mistake tracking
