import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // No DB initialization needed - Supabase is the primary data source on Vercel
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
