import { Audio } from 'expo-av';
import { useGameStore } from '../store/gameStore';

// Thin wrappers around expo-av's Audio.Sound. Centralised so a future
// "sound off" preference touches one place, and so each call site
// stays a single line that reads like the haptics module next door.
//
// Loading model: eagerly preload all 6 sounds during the splash via
// `preloadSfx()` (called from App.tsx). The first time a sound fires,
// expo-av otherwise runs Audio.Sound.createAsync, which decodes the
// MP3/WAV on the JS thread and adds 100-300 ms of latency between
// the trigger event and the audible playback — very noticeable on
// the case-open buttons and the place-rejection buzz. Preloading
// pays the decode cost during the splash window (where the user
// can't trigger anything anyway) and the runtime fire path becomes a
// single `replayAsync()` native call.
//
// Failure model: every step is wrapped in a single try/catch that
// swallows. Matches haptics philosophy — a broken speaker / missing
// audio asset on a beta device shouldn't block gameplay or surface a
// toast. The user just hears nothing.

type SoundKey =
  | 'caseOpenStarter'
  | 'caseOpenQuality'
  | 'caseOpenFine'
  | 'tilePlace'
  | 'ceremonyCelebrate'
  | 'errorBuzz';

// expo-av decodes both MP3 and WAV transparently — these paths just
// need to match what actually lives in assets/audio/. Curated picks
// from a mix of CC0 sources (see assets/audio/ATTRIBUTIONS.md).
const sources: Record<SoundKey, number> = {
  caseOpenStarter: require('../../assets/audio/case_open_starter.mp3'),
  caseOpenQuality: require('../../assets/audio/case_open_quality.mp3'),
  caseOpenFine: require('../../assets/audio/case_open_fine.mp3'),
  tilePlace: require('../../assets/audio/tile_place.mp3'),
  ceremonyCelebrate: require('../../assets/audio/ceremony_celebrate.mp3'),
  errorBuzz: require('../../assets/audio/error_buzz.wav'),
};

const cache: Partial<Record<SoundKey, Audio.Sound>> = {};
// Per-sound playback duration in ms, captured at preload time and used
// to schedule the BGM un-duck after the sfx finishes. Fallback is 500
// ms if for whatever reason we can't read the duration (lazy-load
// fallback path, malformed asset, etc.).
const durations: Partial<Record<SoundKey, number>> = {};
const DEFAULT_DURATION_MS = 500;

// Eagerly load all sfx into the cache during the splash. Calling this
// twice is a no-op for any key that's already cached. Concurrent loads
// (Promise.all) — expo-av's createAsync is non-blocking on the native
// side so 6 in parallel finish in roughly the same time as 1 sequential.
//
// Each newly-loaded clip also gets a silent prime: play once at
// volume 0 and immediately reset. Android's audio output stream
// doesn't open until the first playAsync, and opening it is the
// 200-500 ms latency that makes the first sfx fire feel "late." A
// muted prime opens the stream during the splash so the real first
// fire is instant. The prime is inaudible on every device we've
// tested — volume 0 produces no waveform on the speaker, only the
// internal stream-routing setup we want.
export async function preloadSfx(): Promise<void> {
  await Promise.all(
    (Object.keys(sources) as SoundKey[]).map(async (key) => {
      if (cache[key] !== undefined) return;
      try {
        const { sound, status } = await Audio.Sound.createAsync(sources[key]);
        cache[key] = sound;
        if (status.isLoaded && typeof status.durationMillis === 'number') {
          durations[key] = status.durationMillis;
        }
        await sound.setVolumeAsync(0);
        await sound.playAsync();
        await sound.pauseAsync();
        await sound.setPositionAsync(0);
        await sound.setVolumeAsync(1);
      } catch {
        // Skip the failing clip; the play() path will silently no-op
        // when it's triggered later.
      }
    }),
  );
}

async function play(key: SoundKey): Promise<void> {
  // Read the toggle at fire time, not at module load. A SettingsModal
  // flip takes effect immediately — no app restart needed.
  const state = useGameStore.getState();
  if (!state.soundEnabled) return;

  try {
    let sound = cache[key];
    if (sound === undefined) {
      // Preload should have populated cache during the splash, but if
      // the user fires a sound before preloadSfx() resolves (e.g. a
      // ridiculously fast tap right after the splash hides), fall
      // back to a lazy load — better one slow first-fire than silence.
      const { sound: s } = await Audio.Sound.createAsync(sources[key]);
      cache[key] = s;
      sound = s;
    }
    // Apply the dev-tunable per-clip mix level on every fire. setVolume
    // is cheap on a cached Sound (no decode); the redundant set on
    // unchanged-volume calls is fine — expo-av no-ops it natively.
    void sound.setVolumeAsync(state.sfxVolumes[key]);
    // Duck BGM concurrently — don't await, so the duck setVolume and
    // the sfx replayAsync race to the native side together. Audible
    // result: BGM dips and SFX hits within the same ~16 ms frame.
    void duckBgm(durations[key] ?? DEFAULT_DURATION_MS);
    // replayAsync = seek-to-zero + play in a single native call.
    // The previous setPositionAsync + playAsync chain went through
    // the JS↔native bridge twice and added ~30-80 ms of latency on
    // top of the cold-load.
    await sound.replayAsync();
  } catch {
    // Silent on failure — see top-of-file note.
  }
}

// Dev tuner uses this to audition a sound at the current slider value
// regardless of the global soundEnabled toggle. Lets the tuner work
// even when the player has SFX globally off.
export function previewSfx(key: SoundKey): void {
  void (async () => {
    try {
      let sound = cache[key];
      if (sound === undefined) {
        const { sound: s } = await Audio.Sound.createAsync(sources[key]);
        cache[key] = s;
        sound = s;
      }
      const v = useGameStore.getState().sfxVolumes[key];
      await sound.setVolumeAsync(v);
      await sound.replayAsync();
    } catch {
      // Silent.
    }
  })();
}

export const sfx = {
  caseOpenStarter: () => void play('caseOpenStarter'),
  caseOpenQuality: () => void play('caseOpenQuality'),
  caseOpenFine: () => void play('caseOpenFine'),
  tilePlace: () => void play('tilePlace'),
  ceremonyCelebrate: () => void play('ceremonyCelebrate'),
  errorBuzz: () => void play('errorBuzz'),
};

// Called once at app boot from App.tsx. Configures the iOS audio
// session so the silent switch silences SFX (the correct default for
// a casual game — users muting their phone in a meeting expect total
// silence) and so Android ducks (lowers) any background music while a
// sound plays instead of cutting it off entirely.
export async function initAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
  } catch {
    // Non-fatal — sounds still play, just without the polite session
    // semantics on iOS / Android. Don't surface anything.
  }
}

// ── Background music ────────────────────────────────────────────────
// One looping Audio.Sound, kept resident for the app's lifetime. The
// SFX flow loads-cache-replay each sfx separately; BGM is a single
// long clip we never want to load more than once, so it gets its own
// module-level ref instead of going through the `cache` map.
//
// Volume default 0.35 — meant to sit under SFX (~1.0) and gameplay
// audio so it's atmosphere, not the centerpiece. Tune in one place if
// it ever feels off.
// Ducked-volume MULTIPLIER applied on top of the current music slider
// value. 0.25 means "duck to a quarter of whatever the slider is set
// to" — preserves the player's mix when the slider is at 0.35, while
// still ducking proportionally if they bumped it to 0.7. Tune up if
// SFX still feels lost in the mix.
const BGM_DUCK_MULTIPLIER = 0.25;
function getBgmVolume(): number {
  return useGameStore.getState().musicVolume;
}
const BGM_SOURCE = require('../../assets/audio/musicBG.mp3');
let bgmSound: Audio.Sound | null = null;
// Tracks the explicit intended state of BGM playback. Resolves race
// conditions where the app is backgrounded or toggled off while the
// asset is still in the middle of a lazy load.
let bgmShouldPlay = false;
// Latest scheduled un-duck timer. Rapid-fire SFX (5 tile places in a
// row) each call duckBgm() — without this guard the first restore
// would un-duck mid-second-SFX and the BGM would pop back up. We
// always clear the previous timer before scheduling a new one so the
// BGM only restores after the LAST sfx in a burst finishes.
let unduckTimer: ReturnType<typeof setTimeout> | null = null;

// Serial promise queue to prevent concurrent operations on the native
// audio bridge (such as overlapping play/pause or volume calls), which
// causes crackles, clicks, and stutters on some devices.
let bgmOperationQueue: Promise<void> = Promise.resolve();

function queueBgmOperation(op: () => Promise<void>): void {
  bgmOperationQueue = bgmOperationQueue.then(async () => {
    try {
      await op();
    } catch {
      // Swallow errors to prevent blocking subsequent operations
    }
  });
}

export function startMusic(): void {
  bgmShouldPlay = true;

  queueBgmOperation(async () => {
    if (!useGameStore.getState().musicEnabled || !bgmShouldPlay) return;

    if (bgmSound === null) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          BGM_SOURCE,
          { isLooping: true, volume: getBgmVolume(), shouldPlay: false },
        );
        bgmSound = sound;
      } catch {
        return;
      }
    }

    if (!useGameStore.getState().musicEnabled || !bgmShouldPlay) return;

    try {
      const status = await bgmSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await bgmSound.playAsync();
      }
    } catch {
      // Silent
    }
  });
}

export function stopMusic(): void {
  bgmShouldPlay = false;

  queueBgmOperation(async () => {
    if (bgmSound === null) return;

    if (unduckTimer !== null) {
      clearTimeout(unduckTimer);
      unduckTimer = null;
    }

    try {
      const status = await bgmSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await bgmSound.pauseAsync();
      }
    } catch {
      // Silent
    }
  });
}

// Drop BGM volume while a sfx plays, then restore after the clip
// finishes. Called from play() concurrently with replayAsync so the
// duck and the SFX hit within the same frame. Safe to call when BGM
// isn't playing — silently no-ops because bgmSound is null.
async function duckBgm(sfxDurationMs: number): Promise<void> {
  if (bgmSound === null) return;
  if (!useGameStore.getState().musicEnabled) return;
  if (!bgmShouldPlay) return;

  if (unduckTimer !== null) {
    clearTimeout(unduckTimer);
    unduckTimer = null;
  }

  // Queue BGM volume reduction
  queueBgmOperation(async () => {
    if (bgmSound === null || !bgmShouldPlay || !useGameStore.getState().musicEnabled) return;
    try {
      await bgmSound.setVolumeAsync(getBgmVolume() * BGM_DUCK_MULTIPLIER);
    } catch {
      // Silent
    }
  });

  // Schedule restoration
  unduckTimer = setTimeout(() => {
    queueBgmOperation(async () => {
      unduckTimer = null;
      if (bgmSound === null || !bgmShouldPlay || !useGameStore.getState().musicEnabled) return;
      try {
        await bgmSound.setVolumeAsync(getBgmVolume());
      } catch {
        // Silent
      }
    });
  }, sfxDurationMs + 120);
}

// Apply a new BGM volume immediately to the live Sound. Called from
// App.tsx via a store-subscriber so dragging the music slider in the
// dev tuner updates the volume in real time without restarting the
// loop. No-op if BGM hasn't loaded yet (startMusic will read the
// fresh value on first load).
export function applyMusicVolume(v: number): void {
  if (bgmSound === null) return;
  if (!bgmShouldPlay) return;
  if (unduckTimer !== null) return;

  queueBgmOperation(async () => {
    if (bgmSound === null || !bgmShouldPlay || unduckTimer !== null) return;
    try {
      await bgmSound.setVolumeAsync(v);
    } catch {
      // Silent
    }
  });
}
