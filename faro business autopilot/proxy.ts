import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // basePath ("/dashboard") is applied by Next.js when resolving these
  // routes externally — internally, within this app, the dashboard lives at
  // "/" (see app/(dashboard)/) and login at "/login". Using
  // request.nextUrl.clone() (a basePath-aware NextURL) rather than
  // `new URL(path, request.url)` for redirects, since the latter would drop
  // the basePath prefix.
  const isDashboardRoute = request.nextUrl.pathname === "/";
  const isLoginRoute = request.nextUrl.pathname === "/login";

  if (isDashboardRoute && (!user || !isAdminEmail(user.email))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user && isAdminEmail(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/", "/login"],
};
