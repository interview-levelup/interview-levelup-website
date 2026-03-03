import { useCallback, useEffect, useRef, useState } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectLang(text: string): string {
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp >= 0x4e00 && cp <= 0x9fff) return 'zh-CN'
    if (cp >= 0x3040 && cp <= 0x30ff) return 'ja-JP'
  }
  return 'en-US'
}

/**
 * Pick the best available voice.
 * Personality voices (e.g. "Eddy (Chinese…)") silently fail in Chrome —
 * prefer plain-named voices like "Li-Mu" or "Ting-Ting" first.
 */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const isPersonality = (v: SpeechSynthesisVoice) => /\(.*\(/.test(v.name)

  // 1. Exact lang, non-personality
  const cleanExact = voices.find((v) => v.lang === lang && !isPersonality(v))
  if (cleanExact) { console.log('[TTS] picked (clean exact):', cleanExact.name); return cleanExact }

  // 2. Exact lang, any (personality as fallback)
  const anyExact = voices.find((v) => v.lang === lang)
  if (anyExact) { console.log('[TTS] picked (exact, personality):', anyExact.name); return anyExact }

  // 3. Language prefix, non-personality
  const prefix = lang.split('-')[0]
  const cleanPrefix = voices.find((v) => v.lang.startsWith(prefix) && !isPersonality(v))
  if (cleanPrefix) { console.log('[TTS] picked (prefix clean):', cleanPrefix.name); return cleanPrefix }

  // 4. Let browser decide
  console.log('[TTS] no matching voice, using browser default')
  return null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [voicesReady, setVoicesReady] = useState(false)
  const queueRef = useRef<string[]>([])
  const activeRef = useRef(false)
  // Chrome bug: synthesis stalls silently unless we ping it periodically
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const startKeepAlive = useCallback(() => {
    stopKeepAlive()
    keepAliveRef.current = setInterval(() => {
      if (!window.speechSynthesis.speaking) { stopKeepAlive(); return }
      // Pause+resume nudges Chrome out of the silent-stuck state
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }, 10_000)
  }, [stopKeepAlive])

  useEffect(() => {
    if (!window.speechSynthesis) {
      console.warn('[TTS] speechSynthesis not available')
      return
    }
    const load = () => {
      const n = window.speechSynthesis.getVoices().length
      console.log('[TTS] voiceschanged, count:', n)
      if (n > 0) setVoicesReady(true)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  const processNext = useCallback(() => {
    console.log('[TTS] processNext — active:', activeRef.current, 'queue:', queueRef.current.length)
    if (activeRef.current || queueRef.current.length === 0) return
    if (!window.speechSynthesis) return

    const raw = queueRef.current.shift()!
    const text = raw.trim()
    if (!text) { processNext(); return }

    const lang = detectLang(text)
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice(lang)
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang }
    utterance.rate = 1.5

    activeRef.current = true
    setSpeaking(true)

    utterance.onstart = () => console.log('[TTS] utterance started:', text.slice(0, 20))
    utterance.onend = () => {
      console.log('[TTS] utterance ended')
      activeRef.current = false
      if (queueRef.current.length > 0) processNext()
      else { setSpeaking(false); stopKeepAlive() }
    }
    utterance.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error
      if (err !== 'interrupted') console.error('[TTS] error:', err)
      activeRef.current = false
      setSpeaking(false)
      stopKeepAlive()
    }

    window.speechSynthesis.resume()
    window.speechSynthesis.speak(utterance)
    startKeepAlive()
    console.log('[TTS] speak() sent — paused:', window.speechSynthesis.paused,
      'pending:', window.speechSynthesis.pending,
      'speaking:', window.speechSynthesis.speaking)
  }, [startKeepAlive, stopKeepAlive])

  /** Cancel everything and speak fresh (for manual button clicks). */
  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) { console.error('[TTS] not available'); return }
      window.speechSynthesis.cancel()
      stopKeepAlive()
      activeRef.current = false
      queueRef.current = text
        .split(/(?<=[。！？.!?])\s*/)
        .filter((s) => s.trim().length > 0)
      if (!queueRef.current.length) queueRef.current = [text]
      setTimeout(processNext, 50)
    },
    [processNext, stopKeepAlive],
  )

  /**
   * Append a single sentence to the queue without canceling what's playing.
   * Use this when sentences arrive one-by-one from a stream.
   */
  const enqueue = useCallback(
    (sentence: string) => {
      if (!window.speechSynthesis || !sentence.trim()) return
      queueRef.current.push(sentence.trim())
      // If nothing is playing yet, kick off processNext
      if (!activeRef.current) setTimeout(processNext, 50)
    },
    [processNext],
  )

  const stop = useCallback(() => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    stopKeepAlive()
    queueRef.current = []
    activeRef.current = false
    setSpeaking(false)
  }, [stopKeepAlive])

  return { speaking, speak, enqueue, stop, voicesReady }
}
