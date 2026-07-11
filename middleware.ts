import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Generate a short unique request ID
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function middleware(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()

  // Helper to add logging headers and log the request
  function finalizeResponse(response: NextResponse, status?: number): NextResponse {
    const duration = Date.now() - startTime
    response.headers.set('x-request-id', requestId)

    // Log in development or if explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.LOG_REQUESTS === 'true') {
      console.log(
        `[${requestId}] ${request.method} ${request.nextUrl.pathname} - ${status || response.status} (${duration}ms)`
      )
    }

    return response
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // Skip auth check if env vars are not configured (e.g., during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return finalizeResponse(supabaseResponse)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Redirect root immediately without auth check
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return finalizeResponse(NextResponse.redirect(url), 307)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - require authentication
  const protectedPaths = ['/dashboard', '/account', '/tools']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Also protect dynamic proposal routes like /[id]
  const isProposalRoute = /^\/[a-zA-Z0-9-]+$/.test(request.nextUrl.pathname) &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    !request.nextUrl.pathname.startsWith('/reset-password') &&
    !request.nextUrl.pathname.startsWith('/onboarding') &&
    !request.nextUrl.pathname.startsWith('/pricing') &&
    !request.nextUrl.pathname.startsWith('/docs')

  if ((isProtectedPath || isProposalRoute) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return finalizeResponse(NextResponse.redirect(url), 307)
  }

  // Auth routes - redirect to dashboard if already logged in
  const authPaths = ['/login', '/signup', '/forgot-password', '/reset-password']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return finalizeResponse(NextResponse.redirect(url), 307)
  }

  return finalizeResponse(supabaseResponse)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
}
