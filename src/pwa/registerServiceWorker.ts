/**
 * Registers the offline service worker (public/sw.js) in production builds.
 * Call once from main.tsx: `registerServiceWorker()`.
 *
 * When a new version is deployed, the new worker takes over on the next
 * launch; `onUpdate` lets the UI offer a "Reload for the new version" toast.
 */
export function registerServiceWorker(onUpdate?: () => void): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.();
          });
        });
      })
      .catch((err) => console.warn('[cookin] service worker registration failed', err));
  });
}
