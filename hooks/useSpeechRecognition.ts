import { useState, useRef } from 'react'

export default function useSpeechRecognition(lang: string = 'es-AR') {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const getRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null
    const recog = new SpeechRecognition()
    recog.lang = lang
    recog.interimResults = false
    recog.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setTranscript(text)
    }
    recog.onend = () => {
      setListening(false)
    }
    recognitionRef.current = recog
    return recog
  }

  const start = () => {
    const rec = getRecognition()
    if (!rec) return false
    setTranscript('')
    rec.start()
    setListening(true)
    return true
  }

  const stop = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const supported = !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  )

  return { supported, listening, transcript, start, stop }
}
