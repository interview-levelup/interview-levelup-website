# interview-levelup-website

> **GitHub description:** React + TypeScript frontend for an AI mock interview platform — real-time streaming UI, voice input (Web Speech & Whisper), text-to-speech playback, and per-answer scoring.

React single-page application for [Interview Levelup](https://github.com/interview-levelup/interview-levelup-backend). Connects to the Go backend via REST and SSE streaming to deliver a real-time mock interview experience with voice support.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| State | Zustand |
| Routing | React Router v6 |
| Styling | SCSS Modules |
| Markdown | react-markdown + remark-gfm |
| HTTP | Axios + native `fetch` (SSE) |

## Features

- **Instant interview start** — navigates to the interview page the moment the DB row is created; first question streams in without blocking
- **Real-time streaming** — SSE token-by-token rendering with an animated blinking cursor and subtle live-border pulse on the active bubble
- **Auto text-to-speech** — questions are read aloud as they stream using the Web Speech API; sentences are queued so playback is never interrupted by new tokens
- **Voice input (STT)** — two modes:
  - *Web Speech API* — in-browser, zero latency
  - *Whisper* — records audio and sends to the backend for OpenAI Whisper transcription
- **Per-answer evaluation** — each answer displays a score badge and collapsible evaluation detail after the interview ends
- **Final report modal** — structured debrief shown on interview completion
- **Optimistic answer display** — user's answer appears immediately on submit before the backend confirms, keeping the conversation feel natural
- **TTS controls** — toggle auto-read on/off; individual 🔊 button per question; 1.5× speed by default
- **JWT auth** — register, login, protected routes, change password

## Pages

| Route | Page |
|---|---|
| `/login` | Login |
| `/register` | Register |
| `/` | Dashboard — list of past interviews |
| `/interviews/new` | New interview form |
| `/interviews/:id` | Live interview / review |

## Local Setup

```bash
cp .env.example .env
# Set: VITE_API_BASE_URL=http://localhost:9786

npm install
npm run dev
# → http://localhost:5173
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Go backend base URL (no trailing slash) |

## Project Layout

```
src/
├── api/              # Axios/fetch wrappers for each resource
├── store/            # Zustand stores (auth, interviews)
├── hooks/            # useTTS, useSTT
├── pages/            # Route-level components
├── components/       # Navbar, modals, ProtectedRoute
└── main.tsx          # App entry, router
```

## Connecting to the Backend

This app expects:
- [interview-levelup-backend](https://github.com/interview-levelup/interview-levelup-backend) running on `VITE_API_BASE_URL`
- The backend is connected to [interview-levelup-agent](../interview-levelup-agent) internally — the frontend only talks to the Go API
