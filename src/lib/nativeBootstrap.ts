type NativeWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
  CapacitorCustomPlatform?: { name: string };
  androidBridge?: unknown;
  webkit?: { messageHandlers?: { bridge?: unknown } };
};

/** Match Capacitor's injected bridge detection without loading its web runtime. */
export function isNativeRuntime() {
  if (typeof window === 'undefined') return false;
  const runtime = window as NativeWindow;
  if (runtime.Capacitor?.isNativePlatform) return runtime.Capacitor.isNativePlatform();
  if (runtime.CapacitorCustomPlatform) return runtime.CapacitorCustomPlatform.name !== 'web';
  return !!(runtime.androidBridge || runtime.webkit?.messageHandlers?.bridge);
}

/** Abort before/after module loading; each mount removes only its own listeners. */
export function startNativeFeatures() {
  if (!isNativeRuntime()) return () => {};
  const controller = new AbortController();
  void import('./mobile').then(({ initializeMobileFeatures }) => {
    if (!controller.signal.aborted) return initializeMobileFeatures(controller.signal);
  }).catch(error => {
    if (!controller.signal.aborted) console.error('Mobile initialization failed:', error);
  });
  return () => controller.abort();
}
