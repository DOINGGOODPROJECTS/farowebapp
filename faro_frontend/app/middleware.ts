import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname

    // If the request is for the site root, rewrite to /chat
    if (pathname === '/' || pathname === '') {
      const url = req.nextUrl.clone()
      url.pathname = '/chat'
      return NextResponse.rewrite(url)
    }
  } catch (e) {
    // silent fallback to continue request
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/'],
}
