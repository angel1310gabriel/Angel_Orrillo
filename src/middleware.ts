import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/auth-verify'

const PUBLIC_ROUTES = new Set([
  '/api/auth',
  '/api/supabase-config',
])

const PUBLIC_READ_ROUTES = new Set([
  '/api/profile',
  '/api/profile/sync-uid',
  '/api/profile/lookup',
])

const SKIP_AUTH_ROUTES = new Set([
  '/api/supabase-config',
  '/api/payment-settings',
])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Rutas completamente públicas
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next()
  }

  // Rutas que no requieren autenticación
  if (SKIP_AUTH_ROUTES.has(pathname)) {
    return NextResponse.next()
  }

  // GET requests en rutas públicas de lectura (login flow)
  if (PUBLIC_READ_ROUTES.has(pathname) && method === 'GET') {
    return NextResponse.next()
  }

  // GET requests: solo verificar token si existe, no bloquear
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ')) {
      try {
        const result = await verifyFirebaseToken(auth.slice(7))
        const reqHeaders = new Headers(request.headers)
        reqHeaders.set('x-user-uid', result.uid)
        reqHeaders.set('x-user-email', result.email)
        return NextResponse.next({ request: { headers: reqHeaders } })
      } catch {
        // Token inválido, continuar sin auth
      }
    }
    return NextResponse.next()
  }

  // POST, PUT, DELETE, PATCH: requieren autenticación
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return unauthorized('Se requiere autenticación para esta operación')
  }

  try {
    const result = await verifyFirebaseToken(auth.slice(7))
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('x-user-uid', result.uid)
    reqHeaders.set('x-user-email', result.email)
    return NextResponse.next({ request: { headers: reqHeaders } })
  } catch (err: any) {
    return unauthorized(err.message || 'Token inválido')
  }
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 })
}

export const config = {
  matcher: '/api/:path*',
}
