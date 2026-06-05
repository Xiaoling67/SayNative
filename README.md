# SayNative

SayNative is an iPhone app that helps Chinese speakers practice natural spoken American English.

Users speak Chinese, optionally add a scene, receive native-sounding American English options, listen to the phrase, repeat it out loud, and get strict pronunciation/shadowing feedback.

## Core Features

| Feature | API / System |
| --- | --- |
| Chinese speech recognition | Alibaba Model Studio Qwen realtime ASR |
| Scene capture | Alibaba Model Studio Qwen realtime ASR |
| Natural spoken American English generation | OpenAI |
| English text-to-speech for imitation | ElevenLabs |
| English repeat recognition | Alibaba Model Studio Qwen realtime ASR |
| Strict repeat evaluation | OpenAI with exact phrase evaluation rules |
| Practice history | Local AsyncStorage |
| Backend deployment | AWS Lightsail container service |

## Product Flow

1. Tap `Scene` optionally and describe the context in Chinese.
2. Tap `Start` and say a Chinese sentence.
3. The app shows natural American English options.
4. Select or use the first option.
5. Listen to the English audio.
6. Tap `Practice` and repeat the phrase.
7. The app evaluates whether every meaningful word was repeated correctly.
8. Correct attempts trigger a short celebration and save to history.
9. Tap `Next` to clear the current sentence and start another prompt.

## Tech Stack

- Expo / React Native
- TypeScript
- Node.js backend
- WebSocket realtime transcription
- Alibaba Model Studio Qwen ASR
- OpenAI
- ElevenLabs
- AWS Lightsail

## Security

Provider API keys are never stored in the iPhone app.

The mobile app only receives `EXPO_PUBLIC_API_BASE_URL`. OpenAI, Alibaba, and ElevenLabs credentials live on the backend through environment variables.

See `.env.example` for required configuration.

## Development

```sh
npm install
npm run check
npm run backend
```

Run the app with Expo/Xcode or create an internal iOS build with EAS.

```sh
npx eas-cli build --platform ios --profile preview
```
