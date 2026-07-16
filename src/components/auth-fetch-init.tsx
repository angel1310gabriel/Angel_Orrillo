'use client';

import { useEffect } from 'react';
import { patchFetch } from '@/lib/auth-fetch';

export default function AuthFetchInit() {
  useEffect(() => { patchFetch(); }, []);
  return null;
}
