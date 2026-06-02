let enabled = true;
let activeAudio: HTMLAudioElement | null = null;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function setNotificationSoundEnabled(nextEnabled: boolean) {
  enabled = nextEnabled;

  if (!enabled) {
    stopNotificationSound();
  }
}

export function stopNotificationSound() {
  activeAudio?.pause();
  activeAudio = null;
}

export async function playNotificationSound(sourceUrl?: string) {
  if (!enabled || typeof window === "undefined") {
    return;
  }

  if (sourceUrl) {
    activeAudio = new Audio(sourceUrl);
    activeAudio.volume = 0.35;
    await activeAudio.play();
    return;
  }

  const AudioContextConstructor =
    window.AudioContext ?? window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return;
  }

  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 740;
  gain.gain.value = 0.035;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.16);

  oscillator.addEventListener("ended", () => {
    void context.close();
  });
}
