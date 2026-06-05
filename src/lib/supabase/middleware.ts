import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessPathname, getAccessRuleForPath, isPublicPath } from "@/lib/rbac";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const accessRule = getAccessRuleForPath(pathname);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (accessRule && !pathname.startsWith("/api/auth")) {
      return redirectTo(request, "/login");
    }

    return supabaseResponse;
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("role, is_active, clinics(settings)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!staff?.is_active) {
    await supabase.auth.signOut();

    if (pathname === "/login") {
      return supabaseResponse;
    }

    return redirectTo(request, "/login");
  }

  if (pathname === "/login") {
    return redirectTo(request, "/dashboard");
  }

  const clinic = Array.isArray(staff.clinics) ? staff.clinics[0] : staff.clinics;

  if (
    accessRule &&
    !canAccessPathname({
      pathname,
      role: staff.role,
      clinicSettings: clinic?.settings,
    })
  ) {
    return redirectTo(request, "/dashboard");
  }

  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  return supabaseResponse;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
