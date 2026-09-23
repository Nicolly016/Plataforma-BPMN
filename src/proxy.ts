import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";

  if (!env) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(data.user);
  // Sessão válida sem linha em profiles: o layout manda para esta URL.
  // Redirecionar de volta ao dashboard reabre o mesmo destino e entra em loop.
  const missingProfile = isLogin && request.nextUrl.searchParams.get("perfil") === "ausente";

  if (!isAuthenticated && !isLogin) {
    return redirectTo(request, "/login", response);
  }

  if (isAuthenticated && !missingProfile && (isLogin || pathname === "/")) {
    return redirectTo(request, "/dashboard", response);
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, source: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  source.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
