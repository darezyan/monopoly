import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteParticipant, Room } from 'livekit-client'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Voice chat for online rooms, over LiveKit. Everyone joins listening with their mic off;
// a Supabase function hands out the pass (see supabase/functions/livekit-token).

export type VoiceStatus =
  /** Not an online game, or no Supabase */
  | 'off'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  /** The voice server isn't set up yet */
  | 'unavailable'
  | 'error'

const PREFS_KEY = 'eko:voice'
/** Hold this key to talk when push-to-talk is on (Space already rolls the dice) */
export const TALK_KEY = 'KeyV'

type Prefs = { pushToTalk: boolean; volume: number }

function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
    return {
      pushToTalk: saved.pushToTalk === true,
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 1,
    }
  } catch {
    return { pushToTalk: false, volume: 1 }
  }
}

function micProblem(err: unknown) {
  const name = (err as Error)?.name
  if (name === 'NotAllowedError') return 'Your browser blocked the mic. Allow it from the address bar, then try again.'
  if (name === 'NotFoundError') return 'No microphone found on this device.'
  if (name === 'NotReadableError') return 'Another app is using your mic.'
  return 'Couldn’t turn on your mic.'
}

/** Ask the server for a pass into this game's voice room. */
async function fetchPass(gameId: string): Promise<{ url: string; token: string } | 'unavailable'> {
  const { data, error } = await supabase!.functions.invoke('livekit-token', { body: { gameId } })
  if (!error) return data
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response).status
    // Not deployed (404) or deployed without its secrets (503)
    if (status === 404 || status === 503) return 'unavailable'
    const body = await (error.context as Response).json().catch(() => null)
    throw new Error(body?.error ?? 'Couldn’t join voice.')
  }
  throw new Error('Voice isn’t available right now. Tap to try again.')
}

/**
 * Leaving voice waits a moment, so passing from the lobby through the loading screen into
 * the game doesn't drop the call and rejoin.
 */
function useLingering(id: string | null, ms: number) {
  const [held, setHeld] = useState(id)
  useEffect(() => {
    if (id) return setHeld(id)
    const t = setTimeout(() => setHeld(null), ms)
    return () => clearTimeout(t)
  }, [id, ms])
  return id ?? held
}

export function useVoice(requestedId: string | null) {
  const gameId = useLingering(requestedId, 2000)
  const [status, setStatus] = useState<VoiceStatus>('off')
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<string | null>(null)
  /** Everyone else in voice, by user id */
  const [people, setPeople] = useState<Record<string, { micOn: boolean }>>({})
  const [speaking, setSpeaking] = useState<ReadonlySet<string>>(new Set())
  const [micOn, setMicOn] = useState(false)
  const [deafened, setDeafened] = useState(false)
  /** The browser wants a tap before it will play voices */
  const [blocked, setBlocked] = useState(false)
  const [mutedPeers, setMutedPeers] = useState<ReadonlySet<string>>(new Set())
  const [prefs, setPrefs] = useState(readPrefs)
  const [holding, setHolding] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const roomRef = useRef<Room | null>(null)
  /** The mic state asked for most recently, so a slow switch can't overwrite a newer one */
  const wantMic = useRef(false)
  /** Mic state to restore after undeafening */
  const micBeforeDeafen = useRef(false)
  const levelFor = useRef<(id: string) => number>(() => 1)
  levelFor.current = (id) => (deafened || mutedPeers.has(id) ? 0 : prefs.volume)

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // Not remembered in private mode
    }
  }, [prefs])

  // Join the game's voice room (listening only) for as long as the game is open
  useEffect(() => {
    if (!gameId || !supabase) return setStatus('off')
    let cancelled = false
    let room: Room | null = null
    // Voices play through hidden audio elements
    const sink = document.createElement('div')
    sink.hidden = true
    document.body.appendChild(sink)

    setStatus('connecting')
    setError(null)
    ;(async () => {
      // The voice library is only downloaded once someone is in an online room
      const [lk, pass] = await Promise.all([import('livekit-client'), fetchPass(gameId)])
      if (cancelled) return
      if (pass === 'unavailable') return setStatus('unavailable')
      const { DisconnectReason, Room, RoomEvent, Track } = lk
      const r = new Room({
        webAudioMix: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        publishDefaults: { dtx: true, red: true },
      })
      room = r
      roomRef.current = r
      // Dev-only console hook for checking the call: __voice.remoteParticipants, __voice.activeSpeakers
      if (import.meta.env.DEV) (window as unknown as { __voice: Room }).__voice = r

      const refresh = () => {
        const next: Record<string, { micOn: boolean }> = {}
        r.remoteParticipants.forEach((p) => (next[p.identity] = { micOn: p.isMicrophoneEnabled }))
        setPeople(next)
      }
      const applyLevel = (p: RemoteParticipant) => p.setVolume(levelFor.current(p.identity))

      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio) return
        sink.appendChild(track.attach())
        applyLevel(participant)
        refresh()
      })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove())
          refresh()
        })
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackPublished, refresh)
        .on(RoomEvent.TrackUnpublished, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => setSpeaking(new Set(speakers.map((s) => s.identity))))
        .on(RoomEvent.AudioPlaybackStatusChanged, () => setBlocked(!r.canPlaybackAudio))
        .on(RoomEvent.Reconnecting, () => setStatus('reconnecting'))
        .on(RoomEvent.Reconnected, () => setStatus('live'))
        .on(RoomEvent.MediaDevicesError, (err) => setError(micProblem(err)))
        .on(RoomEvent.Disconnected, (reason) => {
          if (cancelled) return
          setStatus('error')
          setMicOn(false)
          setPeople({})
          setSpeaking(new Set())
          setError(
            reason === DisconnectReason.DUPLICATE_IDENTITY
              ? 'Voice moved to your other tab.'
              : 'Voice dropped. Tap to rejoin.',
          )
        })

      await r.connect(pass.url, pass.token).catch((err) => {
        // LiveKit's own messages are technical; keep them in the console for debugging
        console.error('Voice connection failed', err)
        throw new Error('Couldn’t join voice. Tap to try again.')
      })
      if (cancelled) return r.disconnect()
      setMe(r.localParticipant.identity)
      setBlocked(!r.canPlaybackAudio)
      setStatus('live')
      refresh()
    })().catch((err) => {
      if (cancelled) return
      setStatus('error')
      setError((err as Error).message || 'Couldn’t join voice.')
    })

    return () => {
      cancelled = true
      room?.removeAllListeners()
      room?.disconnect()
      sink.remove()
      roomRef.current = null
      wantMic.current = false
      setMicOn(false)
      setHolding(false)
      setPeople({})
      setSpeaking(new Set())
      setMe(null)
    }
  }, [gameId, attempt])

  // Off the game screen, the mic goes quiet straight away even while the call lingers
  useEffect(() => {
    if (!requestedId && wantMic.current) {
      wantMic.current = false
      roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      setMicOn(false)
      setHolding(false)
    }
  }, [requestedId])

  // Keep everyone's loudness in step with deafen, per-person mutes and the voice slider
  useEffect(() => {
    roomRef.current?.remoteParticipants.forEach((p) => p.setVolume(levelFor.current(p.identity)))
  }, [deafened, mutedPeers, prefs.volume, people])

  const setMic = useCallback(async (on: boolean) => {
    const room = roomRef.current
    wantMic.current = on
    if (!room || room.state !== 'connected') return
    try {
      await room.localParticipant.setMicrophoneEnabled(on)
      if (wantMic.current !== on) return
      setMicOn(on)
      setError(null)
    } catch (err) {
      wantMic.current = false
      setMicOn(false)
      setError(micProblem(err))
    }
  }, [])

  const toggleMic = useCallback(() => {
    if (prefs.pushToTalk) return
    if (deafened) setDeafened(false)
    setMic(!wantMic.current)
  }, [prefs.pushToTalk, deafened, setMic])

  /** Deafening also mutes your mic, like on a phone call; undeafening puts it back. */
  const toggleDeafen = useCallback(() => {
    if (!deafened) {
      micBeforeDeafen.current = wantMic.current
      setMic(false)
      setHolding(false)
    } else if (micBeforeDeafen.current && !prefs.pushToTalk) {
      setMic(true)
    }
    setDeafened(!deafened)
  }, [deafened, prefs.pushToTalk, setMic])

  /** Push-to-talk: the mic is live only while the talk key or button is held. */
  const talk = useCallback(
    (down: boolean) => {
      if (!prefs.pushToTalk || (down && deafened)) return
      setHolding(down)
      setMic(down)
    },
    [prefs.pushToTalk, deafened, setMic],
  )

  const setPushToTalk = useCallback(
    (on: boolean) => {
      setPrefs((p) => ({ ...p, pushToTalk: on }))
      setHolding(false)
      setMic(false)
    },
    [setMic],
  )

  // Hold V to talk (ignored while typing in a box)
  useEffect(() => {
    if (!prefs.pushToTalk || status !== 'live') return
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && !!e.target.closest('input, textarea')
    const down = (e: KeyboardEvent) => {
      if (e.code !== TALK_KEY || e.repeat || e.metaKey || e.ctrlKey || typing(e)) return
      talk(true)
    }
    const up = (e: KeyboardEvent) => e.code === TALK_KEY && talk(false)
    const release = () => talk(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
    }
  }, [prefs.pushToTalk, status, talk])

  const togglePeer = useCallback((id: string) => {
    setMutedPeers((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const startAudio = useCallback(() => {
    roomRef.current
      ?.startAudio()
      .then(() => setBlocked(false))
      .catch(() => {})
  }, [])

  return {
    status,
    error,
    /** My user id once connected */
    me,
    people,
    speaking,
    micOn,
    deafened,
    blocked,
    holding,
    pushToTalk: prefs.pushToTalk,
    volume: prefs.volume,
    mutedPeers,
    toggleMic,
    toggleDeafen,
    talk,
    setPushToTalk,
    setVolume: (volume: number) => setPrefs((p) => ({ ...p, volume })),
    togglePeer,
    startAudio,
    retry: () => setAttempt((n) => n + 1),
  }
}

export type Voice = ReturnType<typeof useVoice>
