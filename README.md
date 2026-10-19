# Next Steps.IO

Voice-first life-transition coach. Tell **Peaches** where you are and where you want to be; she builds a 4-week plan, finds events, adds them to your calendar, schedules text reminders and rewards progress. Mobile-first installable PWA that also works well on desktop.

This is the **Demo build** phase of the PRD: Landing → Sign up & transition (Screen 1) → Trial paywall (Screen 2) → Personalized plan + Peaches (Screen 3), Scenario B (Williamsburg running demo) and Scenario A, browser voice, seeded events, Pro page.

## Run

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Demo script (Scenario B)

1. Landing → **Start with Peaches** (or tap the *Couch potato → Running* chip).
2. Answer by voice or tap: name, age, location (*Williamsburg, Brooklyn*), timeline, phone (demo code shown on screen).
3. Start the free month (simulated checkout) and Peaches presents the plan card by card.
4. Say or tap: “Find me run clubs in Williamsburg” → “Find me a run I can join this week” → “Yes”.
   Calendar + reminders + **First Step** badge + 50 Peach Points.
5. On a later day: “Welcome back!” with chips **Ask Tina to run with you**, **Find another run event**, **Check your stats**.

Shortcuts on desktop: **Space** or **Cmd/Ctrl+K** to talk.

## Architecture

| Piece | Where | Notes |
|---|---|---|
| Free voice | `src/lib/voice.ts` | Web Speech API STT + SpeechSynthesis TTS, barge-in, tap/text fallback |
| Free NLP | `src/lib/intents.ts` | Rule-based intents (find_events, check_stats, draft_message, set_reminder) and crisis detection (988). Runs server-side and on-device when offline |
| Orchestrator | `src/app/api/peaches/route.ts` | Free intents first; otherwise Claude (`claude-opus-5-5`, low effort, server-side refusal fallback) with tools. Write tools only *propose*; the user confirms on-device |
| Events | `src/lib/events.ts` | Seeded Williamsburg listings, flagged **Demo listing** with source links. Replace with live sources in Alpha |
| Calendar | `src/lib/calendar.ts` | .ics (with 1-day/2-hour alarms) + Google Calendar link |
| Rewards | `src/lib/rewards.ts` | Points, badges, streaks with one free rest day per week |
| Billing | `src/lib/purchases.ts` | Simulated; seam for RevenueCat Web Billing + Apple Pay |
| State | `src/lib/store.ts` | On-device (localStorage) for the demo; Supabase in Alpha |
| PWA | `src/app/manifest.ts`, `public/sw.js` | Installable, offline shell |

## Not yet wired (Alpha)

RevenueCat checkout, Twilio SMS + Verify (texts are queued on-device), Google/Apple calendar OAuth, live event search, ElevenLabs Peaches voice, Supabase persistence, web push.
