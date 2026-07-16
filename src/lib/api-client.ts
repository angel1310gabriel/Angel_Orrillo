import { auth } from './firebase-client';

async function getToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch(url: string, options: ApiOptions = {}): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  return fetch(url, fetchOptions);
}
