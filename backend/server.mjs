import http from 'node:http'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import WebSocket, { WebSocketServer } from 'ws'
import { MORE_NATIVE_REWRITE_PROMPT } from './prompts/moreNativeRewritePrompt.mjs'
import { NATIVE_REWRITE_PROMPT } from './prompts/nativeRewritePrompt.mjs'

loadEnv()

const PORT = Number(process.env.PORT ?? 8787)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.5'
const ELEVENLABS_API_KEY = required('ELEVENLABS_API_KEY')
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_flash_v2_5'
const STT_PROVIDER = process.env.SAYNATIVE_STT_PROVIDER ?? 'qwen'
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY ?? process.env.ALIBABA_MODEL_STUDIO_API_KEY
const QWEN_ASR_MODEL = process.env.QWEN_ASR_MODEL ?? 'qwen3-asr-flash'
const QWEN_ASR_BASE_URL =
  process.env.QWEN_ASR_BASE_URL ?? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
const QWEN_ASR_REALTIME_MODEL = process.env.QWEN_ASR_REALTIME_MODEL ?? 'qwen3-asr-flash-realtime'
const QWEN_ASR_REALTIME_URL =
  process.env.QWEN_ASR_REALTIME_URL ?? 'wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime'
const REALTIME_TRANSCRIBE_PATH = '/api/transcribe/realtime'

const CORRECT_PROMPT = `You are evaluating whether a student correctly repeated a target English phrase.

You will receive:
- target: the exact English phrase the student should say
- userSpeech: what the student actually said, captured by speech recognition

This is shadowing practice, not translation or paraphrasing.
The student must repeat the target phrase closely.

Correctness rules:
- The student must say every meaningful word in the target phrase.
- Missing even small words like "so", "just", "out", or "to" counts as incorrect.
- Replacing any word with a different word, even a synonym, is incorrect.
- Adding extra meaningful words is incorrect.
- Changing word order is incorrect.
- Saying a different natural expression with the same meaning is incorrect.
- Filler sounds such as "oh", "um", "uh" should be ignored.
- Stuttering or repeating a word should be ignored.
- Speech recognition may expand contractions, such as "I'll" to "I will", "I've" to "I have", or "gonna" to "going to". Treat these as the same.

Feedback rules:
- If correct, return brief warm praise.
- If incorrect, give one short sentence.
- Point out the smallest natural spoken-English chunk the student needs to fix.
- Do not always point out only one word.
- For replaced words, include the surrounding spoken chunk when that chunk is what the student should practice.
- Do not repeat the whole sentence unless the user made many errors.
- Do not explain grammar.
- Do not talk about meaning.
- Be direct, specific, and easy to act on.

Examples:

Example 1: Missing small word
Target: "I've been so stressed out lately."
UserSpeech: "I've been stressed out lately."
Feedback: "Almost! Make sure to say 'so.'"

Example 2: Replaced word inside a spoken chunk
Target: "I'll do the chicken."
UserSpeech: "I'll have the chicken."
Feedback: "Almost! It should be 'do the chicken', but you said 'have the chicken.'"

Example 3: Replaced phrase
Target: "Feel free to come with me."
UserSpeech: "You can come with me."
Feedback: "Almost! It should be 'Feel free to', but you said 'You can.'"

Example 4: Added meaningful word
Target: "I'll have the chicken."
UserSpeech: "I'll have the grilled chicken."
Feedback: "Almost! You added 'grilled.'"

Example 5: Word order error
Target: "Can I get this without onions?"
UserSpeech: "Can I this get without onions?"
Feedback: "Almost! The word order should be 'Can I get this.'"

Example 6: Many errors
Target: "I'm pretty wiped out today."
UserSpeech: "I don't want to go."
Feedback: "Almost! Try again and match the full phrase more closely."

Respond in JSON exactly like this:
{"correct": true, "feedback": "Nailed it! That sounded totally natural."}
or
{"correct": false, "feedback": "Almost! It should be 'do the chicken', but you said 'have the chicken.'"}` 

const server = http.createServer(async (req, res) => {
  const requestStartedAt = Date.now()
  try {
    setCors(res)
    if (req.method === 'OPTIONS') return sendJson(res, 204, {})
    if (req.method === 'GET' && req.url === '/api/health') {
      return sendJson(res, 200, health())
    }
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })

    const bodyReadStartedAt = Date.now()
    const body = await readJson(req)
    console.log(
      `Timing read_json ${req.url ?? 'unknown'}: ${Date.now() - bodyReadStartedAt}ms bytes=${req.headers['content-length'] ?? 'unknown'}`
    )

    if (req.url === '/api/transcribe') {
      const text = await transcribeSpeech(body)
      logTiming(req.url, requestStartedAt)
      return sendJson(res, 200, { text })
    }

    if (req.url === '/api/translate') {
      const content = await translateChinese(body)
      logTiming(req.url, requestStartedAt)
      return sendJson(res, 200, { translations: parseTranslations(content) })
    }

    if (req.url === '/api/evaluate') {
      requiredField(body.target, 'target')
      requiredField(body.userSpeech, 'userSpeech')
      const quickEvaluation = quickEvaluate(body.target, body.userSpeech)
      if (quickEvaluation) {
        console.log('Timing evaluate_quick: 0ms')
        logTiming(req.url, requestStartedAt)
        return sendJson(res, 200, quickEvaluation)
      }
      const content = await openai(CORRECT_PROMPT, JSON.stringify(body))
      logTiming(req.url, requestStartedAt)
      return sendJson(res, 200, parseEvaluation(content))
    }

    if (req.url === '/api/tts') {
      const audio = await synthesizeWithElevenLabs(body.text)
      logTiming(req.url, requestStartedAt)
      return sendJson(res, 200, audio)
    }

    return sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    logTiming(`${req.url ?? 'unknown'} failed`, requestStartedAt)
    console.error(error)
    const status = error instanceof InputError ? 400 : 500
    return sendJson(res, status, { error: error.message || 'Server error' })
  }
})

const realtimeWss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (url.pathname !== REALTIME_TRANSCRIBE_PATH) {
    socket.destroy()
    return
  }

  realtimeWss.handleUpgrade(req, socket, head, (client) => {
    realtimeWss.emit('connection', client, req)
  })
})

realtimeWss.on('connection', (client) => {
  handleRealtimeTranscription(client)
})

server.listen(PORT, () => {
  console.log(`SayNative backend listening on http://localhost:${PORT}`)
  console.log(`STT provider: ${STT_PROVIDER}`)
})

function loadEnv() {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    for (const line of env.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index)
      const value = trimmed.slice(index + 1)
      process.env[key] ??= value
    }
  } catch {}
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function logTiming(label, startedAt) {
  console.log(`Timing ${label}: ${Date.now() - startedAt}ms`)
}

async function transcribeSpeech(body) {
  const audioBase64 = requiredField(body.audioBase64, 'audioBase64')
  const language = body.language === 'english' ? 'english' : 'chinese'
  if (STT_PROVIDER === 'mock') return mockTranscription(language)
  if (STT_PROVIDER !== 'qwen') throw new Error(`Unsupported STT provider: ${STT_PROVIDER}`)
  if (!DASHSCOPE_API_KEY) throw new Error('Missing DASHSCOPE_API_KEY')

  if (body.mimeType === 'audio/wav') {
    try {
      return await transcribeSpeechRealtime(audioBase64, language)
    } catch (error) {
      console.warn(`Qwen realtime ASR failed, falling back to HTTP: ${error.message}`)
    }
  }

  return transcribeSpeechHttp(body, audioBase64, language)
}

async function transcribeSpeechHttp(body, audioBase64, language) {
  const audioDataUrl = audioBase64.startsWith('data:')
    ? audioBase64
    : `data:${body.mimeType ?? 'audio/wav'};base64,${audioBase64}`
  console.log(
    `ASR request: language=${language}, mimeType=${body.mimeType ?? 'audio/wav'}, bytes=${audioByteLength(audioBase64)}`
  )
  const startedAt = Date.now()
  const response = await fetch(`${QWEN_ASR_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: QWEN_ASR_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: audioDataUrl },
            },
          ],
        },
      ],
      asr_options: {
        language: language === 'english' ? 'en' : 'zh',
        enable_itn: true,
      },
    }),
  })

  const data = await response.json()
  console.log(`Timing qwen_asr_${language}: ${Date.now() - startedAt}ms`)
  if (!response.ok) {
    throw new Error(`Qwen ASR error ${response.status}: ${JSON.stringify(data)}`)
  }

  return readAsrText(data)
}

async function transcribeSpeechRealtime(audioBase64, language) {
  const rawAudio = Buffer.from(audioBase64.includes(',') ? audioBase64.split(',').pop() : audioBase64, 'base64')
  const pcmAudio = extractPcm16FromWav(rawAudio)
  const startedAt = Date.now()
  const url = `${QWEN_ASR_REALTIME_URL}?model=${QWEN_ASR_REALTIME_MODEL}`

  return new Promise((resolve, reject) => {
    let transcript = ''
    let settled = false
    const timeout = setTimeout(() => finish(new Error('Qwen realtime ASR timed out')), 12000)
    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    })

    function finish(error, text) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'done')
        }
      } catch {}
      if (error) reject(error)
      else resolve((text || transcript).trim())
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({
        event_id: `event_${Date.now()}_session`,
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'pcm',
          sample_rate: 16000,
          input_audio_transcription: {
            language: language === 'english' ? 'en' : 'zh',
          },
          turn_detection: null,
        },
      }))

      for (let offset = 0; offset < pcmAudio.length; offset += 3200) {
        const chunk = pcmAudio.subarray(offset, Math.min(offset + 3200, pcmAudio.length))
        ws.send(JSON.stringify({
          event_id: `event_${Date.now()}_${offset}`,
          type: 'input_audio_buffer.append',
          audio: chunk.toString('base64'),
        }))
      }
      ws.send(JSON.stringify({ event_id: `event_${Date.now()}_commit`, type: 'input_audio_buffer.commit' }))
      ws.send(JSON.stringify({ event_id: `event_${Date.now()}_finish`, type: 'session.finish' }))
    })

    ws.on('message', (message) => {
      const data = JSON.parse(message.toString())
      if (data.type === 'error') {
        finish(new Error(JSON.stringify(data)))
        return
      }
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        transcript = data.transcript ?? data.text ?? transcript
      }
      if (data.type === 'session.finished') {
        if (!transcript.trim()) finish(new Error(`Qwen realtime ASR returned no transcript: ${JSON.stringify(data)}`))
        else {
          console.log(`Timing qwen_realtime_asr_${language}: ${Date.now() - startedAt}ms`)
          finish(null, transcript)
        }
      }
    })

    ws.on('error', (error) => finish(error))
  })
}

function handleRealtimeTranscription(client) {
  const startedAt = Date.now()
  let qwen = null
  let qwenReady = false
  let clientFinished = false
  let recognitionMode = 'vad'
  let transcript = ''
  let stableTranscript = ''
  const queuedAudio = []

  function sendClient(data) {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data))
  }

  function closeQwen() {
    try {
      if (qwen && (qwen.readyState === WebSocket.OPEN || qwen.readyState === WebSocket.CONNECTING)) {
        qwen.close(1000, 'client closed')
      }
    } catch {}
  }

  function sendQwen(data) {
    if (!qwen || qwen.readyState !== WebSocket.OPEN) return
    qwen.send(JSON.stringify(data))
  }

  function appendAudio(audio) {
    if (!audio) return
    if (!qwenReady) {
      queuedAudio.push(audio)
      return
    }
    sendQwen({
      event_id: `event_${Date.now()}_audio`,
      type: 'input_audio_buffer.append',
      audio,
    })
  }

  function connectQwen(language, mode = 'vad') {
    recognitionMode = mode === 'manual' ? 'manual' : 'vad'
    if (STT_PROVIDER === 'mock') {
      const mockText = mockTranscription(language)
      sendClient({ type: 'partial', text: mockText })
      sendClient({ type: 'final', text: mockText })
      sendClient({ type: 'done', text: mockText })
      return
    }
    if (STT_PROVIDER !== 'qwen') {
      sendClient({ type: 'error', error: `Unsupported STT provider: ${STT_PROVIDER}` })
      return
    }
    if (!DASHSCOPE_API_KEY) {
      sendClient({ type: 'error', error: 'Missing DASHSCOPE_API_KEY' })
      return
    }

    const url = `${QWEN_ASR_REALTIME_URL}?model=${QWEN_ASR_REALTIME_MODEL}`
    qwen = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    })

    qwen.on('open', () => {
      qwenReady = true
      sendQwen({
        event_id: `event_${Date.now()}_session`,
        type: 'session.update',
        session: {
          modalities: ['text'],
          input_audio_format: 'pcm',
          sample_rate: 16000,
          input_audio_transcription: {
            language: language === 'english' ? 'en' : 'zh',
          },
          turn_detection: recognitionMode === 'manual'
            ? null
            : {
                type: 'server_vad',
                threshold: 0.0,
                silence_duration_ms: 400,
              },
        },
      })
      sendClient({ type: 'ready' })
      while (queuedAudio.length) appendAudio(queuedAudio.shift())
      if (clientFinished) finishQwen()
    })

    qwen.on('message', (message) => {
      const data = JSON.parse(message.toString())
      if (data.type === 'error') {
        sendClient({ type: 'error', error: JSON.stringify(data) })
        closeQwen()
        return
      }

      const text = readRealtimeTranscript(data)
      if (text) {
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          stableTranscript = appendTranscript(stableTranscript, text)
          transcript = stableTranscript
          sendClient({ type: 'final', text: stableTranscript })
        } else {
          transcript = appendTranscript(stableTranscript, text)
          sendClient({ type: 'partial', text: transcript })
        }
      }

      if (data.type === 'session.finished') {
        console.log(`Timing qwen_streaming_asr: ${Date.now() - startedAt}ms`)
        sendClient({ type: 'done', text: transcript.trim() })
        try {
          client.close(1000, 'done')
        } catch {}
      }
    })

    qwen.on('error', (error) => {
      sendClient({ type: 'error', error: error.message })
    })
  }

  function finishQwen() {
    if (!qwenReady) return
    if (recognitionMode === 'manual') {
      sendQwen({ event_id: `event_${Date.now()}_commit`, type: 'input_audio_buffer.commit' })
    }
    sendQwen({ event_id: `event_${Date.now()}_finish`, type: 'session.finish' })
  }

  client.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString())
      if (data.type === 'start') {
        connectQwen(data.language === 'english' ? 'english' : 'chinese', data.mode)
        return
      }
      if (data.type === 'audio') {
        appendAudio(data.audio)
        return
      }
      if (data.type === 'stop') {
        clientFinished = true
        finishQwen()
      }
    } catch (error) {
      sendClient({ type: 'error', error: error.message || 'Invalid realtime message' })
    }
  })

  client.on('close', closeQwen)
  client.on('error', closeQwen)
}

function mockTranscription(language) {
  if (language === 'english') return process.env.MOCK_ENGLISH_TRANSCRIPT ?? "I've been really busy lately."
  return process.env.MOCK_CHINESE_TRANSCRIPT ?? '我最近真的很忙。'
}

function health() {
  return {
    ok: true,
    sttProvider: STT_PROVIDER,
    qwenAsrModel: QWEN_ASR_MODEL,
    qwenAsrRealtimeModel: QWEN_ASR_REALTIME_MODEL,
    openaiModel: OPENAI_MODEL,
    elevenLabsModel: ELEVENLABS_MODEL_ID,
    hasOpenAIKey: Boolean(OPENAI_API_KEY),
    hasElevenLabsKey: Boolean(ELEVENLABS_API_KEY),
    hasDashScopeKey: Boolean(DASHSCOPE_API_KEY),
  }
}

function readAsrText(data) {
  const content = data.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    const text = content
      .map((item) => item.text ?? item.transcript ?? '')
      .filter(Boolean)
      .join('')
      .trim()
    if (text) return text
  }
  const fallback = data.output?.choices?.[0]?.message?.content?.[0]?.text ?? data.output?.text
  if (fallback) return String(fallback).trim()
  throw new Error(`Qwen ASR returned an unexpected response: ${JSON.stringify(data)}`)
}

function readRealtimeTranscript(data) {
  if (data.type === 'conversation.item.input_audio_transcription.text') {
    return `${data.text ?? ''}${data.stash ?? ''}`.trim()
  }
  return (
    data.transcript ??
    data.text ??
    data.stash ??
    data.delta ??
    data.item?.transcript ??
    data.item?.text ??
    data.response?.transcript ??
    ''
  ).trim()
}

function appendTranscript(current, next) {
  const cleanCurrent = String(current ?? '').trim()
  const cleanNext = String(next ?? '').trim()
  if (!cleanNext) return cleanCurrent
  if (!cleanCurrent) return cleanNext
  if (cleanCurrent.endsWith(cleanNext)) return cleanCurrent
  if (cleanNext.startsWith(cleanCurrent)) return cleanNext

  const last = cleanCurrent.slice(-1)
  const first = cleanNext[0]
  const separator = /[A-Za-z0-9]/.test(last) && /[A-Za-z0-9]/.test(first) ? ' ' : ''
  return `${cleanCurrent}${separator}${cleanNext}`.trim()
}

async function translateChinese(body) {
  const chinese = requiredField(body.chinese, 'chinese')
  const mode = body.mode === 'moreNative' ? 'moreNative' : 'fast'
  const input = formatTranslateInput(chinese, body.scene)
  const draft = await openai(NATIVE_REWRITE_PROMPT, input)
  if (mode === 'fast') return draft

  return openai(
    MORE_NATIVE_REWRITE_PROMPT,
    formatMoreNativeInput(chinese, body.scene, draft),
    { maxOutputTokens: 500 }
  )
}

function extractPcm16FromWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return buffer
  }

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const dataStart = offset + 8
    if (chunkId === 'data') {
      return buffer.subarray(dataStart, dataStart + chunkSize)
    }
    offset = dataStart + chunkSize + (chunkSize % 2)
  }

  throw new Error('WAV file does not contain a data chunk')
}

async function openai(systemPrompt, userContent, options = {}) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')

  const payload = {
    model: OPENAI_MODEL,
    instructions: systemPrompt,
    input: userContent,
    max_output_tokens: options.maxOutputTokens ?? 350,
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
  }

  const startedAt = Date.now()
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${message}`)
  }
  const data = await response.json()
  console.log(`Timing openai_${OPENAI_MODEL}: ${Date.now() - startedAt}ms`)
  return readOpenAiText(data)
}

function readOpenAiText(data) {
  if (typeof data.output_text === 'string') return data.output_text.trim()
  if (Array.isArray(data.output)) {
    const text = data.output
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .filter(Boolean)
      .join('')
      .trim()
    if (text) return text
  }
  throw new Error(`OpenAI returned an unexpected response: ${JSON.stringify(data)}`)
}

function formatTranslateInput(chinese, scene) {
  const cleanScene = typeof scene === 'string' ? scene.trim() : ''
  if (!cleanScene) return chinese
  return `Scene/context where the user will say this: ${cleanScene}

Chinese sentence: ${chinese}`
}

function formatMoreNativeInput(chinese, scene, draft) {
  const cleanScene = typeof scene === 'string' ? scene.trim() : ''
  return `Chinese sentence:
${chinese}

Scene/context:
${cleanScene || '(none provided)'}

Fast candidate options:
${draft}`
}

function parseTranslations(content) {
  const results = []
  for (const line of content.split('\n')) {
    const match = line.match(/^\d+\.\s+"([^"]+)"\s+[—\-–]\s+(.+)$/)
    if (match) results.push({ text: match[1].trim(), note: match[2].trim() })
  }
  if (results.length === 0) results.push({ text: content.trim(), note: '' })
  return results
}

function parseEvaluation(content) {
  try {
    const parsed = JSON.parse(content)
    return {
      correct: Boolean(parsed.correct),
      feedback: String(parsed.feedback ?? ''),
    }
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        return {
          correct: Boolean(parsed.correct),
          feedback: String(parsed.feedback ?? ''),
        }
      } catch {}
    }
    return { correct: false, feedback: content }
  }
}

function quickEvaluate(target, userSpeech) {
  const targetWords = speechWords(target)
  const userWords = speechWords(userSpeech)
  if (!targetWords.length || !userWords.length) return null
  if (sameWords(targetWords, userWords)) {
    return { correct: true, feedback: 'Nailed it! That sounded natural.' }
  }
  return null
}

function speechWords(text) {
  const fillerWords = new Set(['oh', 'ohh', 'um', 'umm', 'uh', 'uhh', 'er', 'ah'])
  const words = String(text)
    .toLowerCase()
    .replace(/\bi['’]?ve\b/g, 'i have')
    .replace(/\bi['’]?m\b/g, 'i am')
    .replace(/\byou['’]?re\b/g, 'you are')
    .replace(/\bi['’]?ll\b/g, 'i will')
    .replace(/\bi['’]?d\b/g, 'i would')
    .replace(/\bcan['’]?t\b/g, 'can not')
    .replace(/\bdon['’]?t\b/g, 'do not')
    .replace(/\bwon['’]?t\b/g, 'will not')
    .replace(/\bgonna\b/g, 'going to')
    .replace(/\bwanna\b/g, 'want to')
    .replace(/\bkinda\b/g, 'kind of')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !fillerWords.has(word))

  return words.filter((word, index) => index === 0 || word !== words[index - 1])
}

function sameWords(a, b) {
  return a.length === b.length && a.every((word, index) => word === b[index])
}

async function synthesizeWithElevenLabs(text) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`)
  url.searchParams.set('output_format', 'mp3_44100_128')

  const startedAt = Date.now()
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: requiredField(text, 'text'),
      model_id: ELEVENLABS_MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`ElevenLabs API error ${response.status}: ${message}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  console.log(`Timing elevenlabs_${ELEVENLABS_MODEL_ID}: ${Date.now() - startedAt}ms`)
  return {
    audioBase64: Buffer.from(arrayBuffer).toString('base64'),
    contentType: response.headers.get('content-type') ?? 'audio/mpeg',
  }
}

function requiredField(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new InputError(`Missing ${name}`)
  return value
}

function audioByteLength(audioBase64) {
  const rawBase64 = audioBase64.includes(',') ? audioBase64.split(',').pop() : audioBase64
  return Buffer.byteLength(rawBase64 ?? '', 'base64')
}

class InputError extends Error {}
