import tickSoundUrl from "~/assets/sounds/mechanical-tick.wav";

// Haptic and audio ticks for value changes. Every entry point swallows its own failures, so a device that
// can't vibrate or play audio simply gets no feedback.

const MIN_INTERVAL_MS = 30;
const VIBRATION_MS = 10;

let audioContext: AudioContext | undefined;
let tickBuffer: AudioBuffer | undefined;
let warmUpPromise: Promise<void> | undefined;
let hapticSwitchLabel: HTMLLabelElement | undefined;
let lastHapticAt = 0;
let lastSoundAt = 0;

async function loadTickBuffer(context: AudioContext) {
  const response = await fetch(tickSoundUrl);
  tickBuffer = await context.decodeAudioData(await response.arrayBuffer());
}

// Must run inside a user gesture (e.g. pointerdown): iOS keeps the audio context suspended until then.
// Resolves once the sound is ready; it never rejects.
export function primeFeedback(): Promise<void> {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
    if (!tickBuffer && !warmUpPromise) {
      warmUpPromise = loadTickBuffer(audioContext).catch(() => {}).finally(() => {
        warmUpPromise = undefined;
      });
    }
    return warmUpPromise ?? Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export function triggerSound() {
  try {
    const now = performance.now();
    if (!audioContext || !tickBuffer || audioContext.state !== "running" || now - lastSoundAt < MIN_INTERVAL_MS) return;
    lastSoundAt = now;

    const source = audioContext.createBufferSource();
    source.buffer = tickBuffer;
    source.connect(audioContext.destination);
    source.start();
  } catch {
    // No sound is better than an error while sliding.
  }
}

// iOS has no Vibration API, but WebKit gives a tap when a switch-style checkbox is toggled.
function getHapticSwitchLabel() {
  if (hapticSwitchLabel?.isConnected) return hapticSwitchLabel;

  const switchInput = document.createElement("input");
  switchInput.type = "checkbox";
  switchInput.setAttribute("switch", "");
  switchInput.tabIndex = -1;

  hapticSwitchLabel = document.createElement("label");
  hapticSwitchLabel.setAttribute("aria-hidden", "true");
  hapticSwitchLabel.style.cssText = "position:fixed;left:-100px;top:0;opacity:0;pointer-events:none;";
  hapticSwitchLabel.append(switchInput);
  document.body.append(hapticSwitchLabel);
  return hapticSwitchLabel;
}

export function triggerHaptic() {
  try {
    const now = performance.now();
    if (now - lastHapticAt < MIN_INTERVAL_MS) return;
    lastHapticAt = now;

    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATION_MS);
    } else if (navigator.maxTouchPoints > 0) {
      getHapticSwitchLabel().click();
    }
  } catch {
    // Unsupported devices just get no haptic.
  }
}
