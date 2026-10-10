// All game audio, synthesised with Web Audio: no sound files to download or license.
// Browsers only allow audio after a user gesture, so the context is created on first tap/keypress.

const MUTE_KEY = 'eko:muted'

let ctx: AudioContext | null = null
let master: GainNode
let musicBus: GainNode
let sfxBus: GainNode
let noiseBuffer: AudioBuffer
let muted = readMuted()
const listeners = new Set<(muted: boolean) => void>()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.16
  musicBus.connect(master)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.5
  sfxBus.connect(master)
  // One second of white noise, reused by every percussive sound
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

/** Call once at startup: unlocks audio on the first interaction. */
export function installAudioUnlock(onUnlock: () => void) {
  const unlock = () => {
    const c = ensureContext()
    if (c?.state === 'suspended') c.resume()
    onUnlock()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export const isMuted = () => muted

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Not remembered in private mode; still applies for this visit
  }
  if (ctx) master.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.05)
  listeners.forEach((fn) => fn(value))
}

export function onMutedChange(fn: (muted: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- Building blocks ----------

type ToneOpts = {
  freq: number
  to?: number
  type?: OscillatorType
  start?: number
  dur: number
  gain?: number
  attack?: number
  bus?: GainNode
}

function tone({ freq, to, type = 'sine', start = 0, dur, gain = 0.4, attack = 0.005, bus }: ToneOpts) {
  if (!ctx) return
  const t = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(gain, t + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(env).connect(bus ?? sfxBus)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise({
  start = 0,
  dur,
  gain = 0.3,
  filter = 'bandpass',
  freq = 2000,
  q = 1,
  bus,
}: {
  start?: number
  dur: number
  gain?: number
  filter?: BiquadFilterType
  freq?: number
  q?: number
  bus?: GainNode
}) {
  if (!ctx) return
  const t = ctx.currentTime + start
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.value = freq
  f.Q.value = q
  const env = ctx.createGain()
  env.gain.setValueAtTime(gain, t)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(env).connect(bus ?? sfxBus)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

// ---------- Sound effects ----------

export const sfx = {
  dice() {
    for (let i = 0; i < 7; i++) {
      const at = i * 0.07 + Math.random() * 0.03
      noise({ start: at, dur: 0.05, gain: 0.35 - i * 0.03, freq: 2500 + Math.random() * 2000, q: 4 })
      tone({ freq: 700 + Math.random() * 500, start: at, dur: 0.04, gain: 0.08, type: 'square' })
    }
  },
  hop() {
    tone({ freq: 520, to: 780, dur: 0.08, gain: 0.12, type: 'triangle' })
  },
  land() {
    tone({ freq: 660, dur: 0.25, gain: 0.18, type: 'sine' })
    tone({ freq: 990, dur: 0.18, gain: 0.08, type: 'sine', start: 0.02 })
  },
  coin() {
    tone({ freq: 988, dur: 0.12, gain: 0.22, type: 'square' })
    tone({ freq: 1319, dur: 0.35, gain: 0.2, type: 'square', start: 0.08 })
    noise({ start: 0.08, dur: 0.2, gain: 0.05, filter: 'highpass', freq: 7000 })
  },
  pay() {
    tone({ freq: 392, to: 262, dur: 0.28, gain: 0.25, type: 'triangle' })
    tone({ freq: 196, to: 131, dur: 0.32, gain: 0.2, type: 'sine', start: 0.05 })
  },
  buy() {
    // A rubber stamp: thump plus paper slap, then a little chime
    tone({ freq: 140, to: 60, dur: 0.18, gain: 0.5 })
    noise({ dur: 0.08, gain: 0.35, filter: 'lowpass', freq: 1800 })
    tone({ freq: 784, dur: 0.2, gain: 0.12, type: 'triangle', start: 0.12 })
    tone({ freq: 1175, dur: 0.3, gain: 0.12, type: 'triangle', start: 0.2 })
  },
  build() {
    tone({ freq: 300, dur: 0.06, gain: 0.3, type: 'square' })
    tone({ freq: 340, dur: 0.06, gain: 0.25, type: 'square', start: 0.11 })
    noise({ dur: 0.05, gain: 0.15, filter: 'bandpass', freq: 900, q: 3 })
  },
  card() {
    const c = ctx
    if (!c) return
    const t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 2
    f.frequency.setValueAtTime(600, t)
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.3)
    const env = c.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.25, t + 0.12)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    src.connect(f).connect(env).connect(sfxBus)
    src.start(t)
    src.stop(t + 0.4)
  },
  jail() {
    for (let i = 0; i < 2; i++) {
      tone({ freq: 620, to: 920, dur: 0.3, gain: 0.16, type: 'sawtooth', start: i * 0.6 })
      tone({ freq: 920, to: 620, dur: 0.3, gain: 0.16, type: 'sawtooth', start: i * 0.6 + 0.3 })
    }
  },
  bankrupt() {
    ;[392, 370, 349, 294].forEach((f, i) =>
      tone({ freq: f, to: i === 3 ? 220 : undefined, dur: i === 3 ? 0.9 : 0.32, gain: 0.2, type: 'sawtooth', start: i * 0.32 }),
    )
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.35, gain: 0.22, type: 'square', start: i * 0.13 }))
    tone({ freq: 1047, dur: 1.1, gain: 0.18, type: 'triangle', start: 0.55 })
    tone({ freq: 1319, dur: 1.1, gain: 0.14, type: 'triangle', start: 0.55 })
  },
  click() {
    tone({ freq: 1200, dur: 0.03, gain: 0.08, type: 'square' })
  },
}

// ---------- Background music: a light highlife groove ----------

const BPM = 108
const STEP = 60 / BPM / 4 // sixteenth note
// C – F – G – C, one bar each; chord tones as MIDI notes
const CHORDS = [
  [60, 64, 67],
  [65, 69, 72],
  [67, 71, 74],
  [60, 64, 67],
]
const BASS = [36, 41, 43, 36]
// Highlife guitar picks on the off-beats (step indexes within a bar of 16)
const GUITAR_STEPS = [2, 3, 6, 10, 11, 14]
const KICK_STEPS = [0, 6, 8, 11]

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let musicTimer: number | null = null
let nextStepTime = 0
let step = 0

function scheduleStep(s: number, at: number) {
  const bar = Math.floor(s / 16) % 4
  const beat = s % 16
  const chord = CHORDS[bar]
  const offset = at - ctx!.currentTime

  // Shaker on every sixteenth, accented on the off-beat
  noise({ start: offset, dur: 0.04, gain: beat % 2 ? 0.07 : 0.035, filter: 'highpass', freq: 7000, bus: musicBus })
  if (KICK_STEPS.includes(beat)) tone({ freq: 110, to: 45, dur: 0.22, gain: 0.55, start: offset, bus: musicBus })
  if (beat === 4 || beat === 12) noise({ start: offset, dur: 0.1, gain: 0.12, filter: 'bandpass', freq: 1500, q: 0.8, bus: musicBus })

  // Walking bass: root on 1, fifth on the "and" of 2, octave on 3
  const root = BASS[bar]
  if (beat === 0) tone({ freq: midi(root), dur: STEP * 3.5, gain: 0.5, type: 'triangle', start: offset, bus: musicBus })
  if (beat === 6) tone({ freq: midi(root + 7), dur: STEP * 2, gain: 0.4, type: 'triangle', start: offset, bus: musicBus })
  if (beat === 8) tone({ freq: midi(root + 12), dur: STEP * 2, gain: 0.35, type: 'triangle', start: offset, bus: musicBus })
  if (beat === 12) tone({ freq: midi(root + 7), dur: STEP * 3, gain: 0.4, type: 'triangle', start: offset, bus: musicBus })

  // Bright plucked guitar, cycling through chord tones
  if (GUITAR_STEPS.includes(beat)) {
    const note = chord[(beat + bar) % 3] + 12
    tone({ freq: midi(note), dur: 0.16, gain: 0.16, type: 'triangle', start: offset, attack: 0.002, bus: musicBus })
  }

  // A talking-drum bend to round off every fourth bar
  if (bar === 3 && (beat === 13 || beat === 15)) {
    tone({ freq: beat === 13 ? 180 : 240, to: beat === 13 ? 240 : 150, dur: 0.18, gain: 0.35, start: offset, bus: musicBus })
  }
}

export function startMusic() {
  if (!ensureContext() || musicTimer !== null) return
  nextStepTime = ctx!.currentTime + 0.1
  // Look-ahead scheduler: wake often, schedule a little ahead, so timing stays tight
  musicTimer = window.setInterval(() => {
    while (nextStepTime < ctx!.currentTime + 0.12) {
      scheduleStep(step, nextStepTime)
      nextStepTime += STEP
      step++
    }
  }, 25)
}

export function stopMusic() {
  if (musicTimer !== null) clearInterval(musicTimer)
  musicTimer = null
}
