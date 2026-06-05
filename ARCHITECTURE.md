# SayNative Architecture

## Overview

SayNative is split into two parts:

- iPhone client: Expo / React Native UI, recording, playback, local history.
- Backend API: Node.js server that owns all provider credentials and calls AI / speech APIs.

The app is designed this way so API keys are never shipped inside the mobile bundle.

## Current API Architecture

| Product capability | API / Model |
| --- | --- |
| Chinese realtime speech recognition | Alibaba Model Studio Qwen realtime ASR, `qwen3-asr-flash-realtime` |
| Chinese final audio confirmation | Alibaba Model Studio Qwen ASR, `qwen3-asr-flash` |
| Scene speech recognition | Alibaba Model Studio Qwen realtime ASR |
| Natural American spoken English generation | OpenAI, configured by `OPENAI_MODEL` |
| English learner repeat recognition | Alibaba Model Studio Qwen realtime ASR in manual mode |
| Repeat evaluation | OpenAI JSON evaluation |
| English audio playback | ElevenLabs, `eleven_flash_v2_5` |
| Cloud hosting | AWS Lightsail container service |

## Mobile Flow

1. User optionally records a scene in Chinese.
2. User taps `Start` and speaks Chinese.
3. The app streams audio to `/api/transcribe/realtime` for fast on-screen feedback.
4. When the user taps `Stop`, the app sends the full WAV recording to `/api/transcribe` for a more reliable final Chinese transcript.
5. The backend sends the final Chinese text and optional scene to OpenAI.
6. The backend returns 1-3 natural spoken American English options.
7. The app plays the selected phrase through ElevenLabs TTS.
8. User taps `Practice` and repeats the English.
9. English audio is recognized through realtime ASR in manual mode, so the backend commits the full phrase after `Stop`.
10. OpenAI evaluates the repeat attempt with strict word-level and phrase-chunk feedback.
11. Correct attempts trigger a temporary celebration and save to local history.
12. `Next` clears the current sentence while preserving the scene.

## Backend Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check and configured model summary |
| `POST /api/transcribe` | Final ASR from a complete audio file |
| `WS /api/transcribe/realtime` | Realtime streaming ASR |
| `POST /api/translate` | Chinese to natural spoken American English |
| `POST /api/evaluate` | Strict repeat evaluation |
| `POST /api/tts` | ElevenLabs speech synthesis |

## Environment Variables

Only `EXPO_PUBLIC_API_BASE_URL` is public and used by the iPhone app.

Backend-only secrets:

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `DASHSCOPE_API_KEY`

Model configuration:

- `OPENAI_MODEL`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_VOICE_ID`
- `QWEN_ASR_MODEL`
- `QWEN_ASR_REALTIME_MODEL`
- `QWEN_ASR_BASE_URL`
- `QWEN_ASR_REALTIME_URL`

## Deployment

The backend runs as a Docker container on AWS Lightsail. The mobile app talks to the public Lightsail HTTPS URL through `EXPO_PUBLIC_API_BASE_URL`.

For internal iPhone testing, EAS builds produce an ad hoc `.ipa` signed for registered devices.
