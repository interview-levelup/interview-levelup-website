import { useCallback, useEffect, useRef, useState } from 'react'

export type SttMode = 'webspeech' | 'whisper'

type STTOptions = {
  /** BCP-47 lang tag, e.g. 'zh-CN' or 'en-US'. Defaults to 'zh-CN'. */
  lang?: string
}

/**
 * Provides speech-to-text in two selectable modes:
 *  - 'webspeech': uses the browser's built-in SpeechRecognition API (Chrome/Edge)
 *  - 'whisper':   records audio with MediaRecorder, uploads to /api/v1/transcribe,
 *                 which proxies to OpenAI Whisper server-side
 *
 * Usage:
 *   const { listening, startListening, stopListening } = useSTT('webspeech', onText)
 *   startListening()   // begin recording / recognition
 *   stopListening()    // stop and (for whisper) upload
 */
export function useSTT(
  mode: SttMode,
  onTranscript: (text: string) => void,
  onError?: (msg: string) => void,
) {
  const [listening, setListening] = useState(false)

  // Web Speech API refs
  const recRef = useRef<SpeechRecognition | null>(null)

  // Whisper / MediaRecorder refs
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  /* ── Web Speech ─────────────────────────────────────────────────────────── */
  const startWebSpeech = useCallback(
    (lang: string) => {
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (!SR) {
        onError?.('浏览器不支持 Web Speech API，请使用 Chrome 或 Edge，或切换为 Whisper 模式')
        return
      }
      const rec = new SR()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = false

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) text += e.results[i][0].transcript
        }
        if (text) onTranscript(text)
      }
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        onError?.(e.error)
        setListening(false)
      }
      rec.onend = () => setListening(false)

      rec.start()
      recRef.current = rec
      setListening(true)
    },
    [onTranscript, onError],
  )

  const stopWebSpeech = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setListening(false)
  }, [])

  /* ── Whisper via MediaRecorder ──────────────────────────────────────────── */
  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      // Prefer webm; Safari falls back to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setListening(false)

        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')

        const token = localStorage.getItem('token')
        try {
          const resp = await fetch('/api/v1/transcribe', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          })
          const data = await resp.json()
          if (data.text) onTranscript(data.text)
          else onError?.('Whisper 未返回转写结果')
        } catch {
          onError?.('Whisper 转写请求失败')
        }
      }

      mr.start()
      mrRef.current = mr
      setListening(true)
    } catch {
      onError?.('无法访问麦克风，请检查浏览器权限')
    }
  }, [onTranscript, onError])

  const stopWhisper = useCallback(() => {
    if (mrRef.current?.state === 'recording') {
      mrRef.current.stop()
    }
  }, [])

  /* ── Public API ─────────────────────────────────────────────────────────── */
  const startListening = useCallback(
    (opts: STTOptions = {}) => {
      if (listening) return
      if (mode === 'webspeech') startWebSpeech(opts.lang ?? 'zh-CN')
      else startWhisper()
    },
    [mode, listening, startWebSpeech, startWhisper],
  )

  const stopListening = useCallback(() => {
    if (mode === 'webspeech') stopWebSpeech()
    else stopWhisper()
  }, [mode, stopWebSpeech, stopWhisper])

  // Cleanup on unmount or mode change
  useEffect(() => {
    return () => {
      recRef.current?.stop()
      if (mrRef.current?.state === 'recording') mrRef.current.stop()
    }
  }, [])

  return { listening, startListening, stopListening }
}
