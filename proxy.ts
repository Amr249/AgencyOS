import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const MEMBER_HOME = "/dashboard/me";
const MEMBER_ACCOUNT = "/dashboard/account";
const MEMBER_DRIVE = "/dashboard/member-drive";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

/** Injects `x-pathname` for `app/dashboard/layout.tsx` via root `proxy.ts`. */
function nextWithDashboardPathname(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isMemberAllowedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;
  if (pathname === MEMBER_HOME || pathname.startsWith(`${MEMBER_HOME}/`)) return true;
  if (pathname === MEMBER_ACCOUNT || pathname.startsWith(`${MEMBER_ACCOUNT}/`)) return true;
  if (pathname === MEMBER_DRIVE || pathname.startsWith(`${MEMBER_DRIVE}/`)) return true;
  if (pathname === "/dashboard/projects" || pathname.startsWith("/dashboard/projects/"))
    return true;
  if (pathname === "/dashboard/workspace" || pathname.startsWith("/dashboard/workspace/")) return true;
  if (pathname === "/dashboard/payments" || pathname.startsWith("/dashboard/payments/"))
    return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Client portal: unified sign-in at `/login`; `/portal/login` redirects there. */
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    if (pathname === "/portal/login") {
      const portalToken = await getToken({
        req: request,
        secret: NEXTAUTH_SECRET,
      });
      if (portalToken?.role === "client_portal") {
        return NextResponse.redirect(new URL("/portal", request.url));
      }
      const login = new URL("/login", request.url);
      const qsCallback = request.nextUrl.searchParams.get("callbackUrl");
      const safe =
        qsCallback &&
        qsCallback.startsWith("/") &&
        !qsCallback.startsWith("//") &&
        qsCallback.startsWith("/portal")
          ? qsCallback
          : "/portal";
      login.searchParams.set("callbackUrl", safe);
      return NextResponse.redirect(login);
    }

    const portalToken = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });
    if (!portalToken || portalToken.role !== "client_portal") {
      const signIn = new URL("/login", request.url);
      signIn.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return nextWithDashboardPathname(request);
  }

  const role = token.role as string | undefined;
  if (role !== "member") {
    return nextWithDashboardPathname(request);
  }

  if (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) {
    return NextResponse.redirect(new URL(MEMBER_ACCOUNT, request.url));
  }
  if (pathname === "/dashboard/drive" || pathname.startsWith("/dashboard/drive/")) {
    return NextResponse.redirect(new URL(MEMBER_DRIVE, request.url));
  }

  if (isMemberAllowedPath(pathname)) {
    return nextWithDashboardPathname(request);
  }

  return NextResponse.redirect(new URL(MEMBER_HOME, request.url));
}

export const config = {
  matcher: ["/", "/dashboard", "/dashboard/:path*", "/portal", "/portal/:path*"],
};
