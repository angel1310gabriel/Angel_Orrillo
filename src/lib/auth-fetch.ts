import { auth } from './firebase-client';

let patched = false;

export function patchFetch() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('/api/')) {
      return original(input, init);
    }

    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        init = init || {};
        init.headers = init.headers || {};
        if (Array.isArray(init.headers)) {
          init.headers = Object.fromEntries(init.headers);
        }
        if (typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
          (init.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch {}

    return original(input, init);
  };
}
