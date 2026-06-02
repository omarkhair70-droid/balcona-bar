function vibrate(pattern: VibratePattern) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return false;
  }

  return navigator.vibrate(pattern);
}

export function vibrateLight() {
  return vibrate(12);
}

export function vibrateSuccess() {
  return vibrate([12, 24, 18]);
}

export function vibrateWarning() {
  return vibrate([24, 32, 24]);
}
