# FluentFlow AI Free MVP Deployment

This project is built for a near-zero-cost launch:

- `public/` is the PWA frontend.
- `api/` is the Vercel serverless backend.
- `localStorage` stores memory, progress, streaks, and recent sessions.
- Browser speech recognition and speech synthesis power the free voice MVP.

## Deploy On Vercel

1. Push this folder to GitHub.
2. Open Vercel and import the repository.
3. Keep framework preset as **Other** if Vercel asks.
4. Leave build command empty.
5. Deploy.

## Environment Variables

No variables are required for the free MVP.

Optional:

```text
OPENAI_API_KEY=...
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
NEWS_API_KEY=...
OPENAI_REALTIME_ENABLED=false
```

Only set `OPENAI_REALTIME_ENABLED=true` when you intentionally want paid Realtime speech-to-speech sessions.

## Launch Checklist

- Open the deployed URL on iPhone Safari and Android Chrome.
- Allow microphone permission.
- Confirm the app shows `Free web voice`.
- Add it to the home screen.
- Launch from the home-screen icon.
- Speak one sentence and confirm the coach responds.

## Cost Control

Start with no API key. Add text AI only after the core voice habit feels good. Enable OpenAI Realtime later for premium users or a paid beta.
