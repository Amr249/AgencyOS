import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const MEMBER_HOME = "/dashboard/me";
const MEMBER_ACCOUNT = "/dashboard/account";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;

function isMemberAllowedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;
  if (pathname === MEMBER_HOME || pathname.startsWith(`${MEMBER_HOME}/`)) return true;
  if (pathname === MEMBER_ACCOUNT || pathname.startsWith(`${MEMBER_ACCOUNT}/`)) return true;
  if (pathname === "/dashboard/projects" || pathname.startsWith("/dashboard/projects/"))
    return true;
  if (pathname === "/dashboard/workspace" || pathname.startsWith("/dashboard/workspace/")) return true;
  if (pathname === "/dashboard/payments" || pathname.startsWith("/dashboard/payments/"))
    return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /** Client portal: `/portal/login` is public; everything else requires `client_portal` JWT. */
  if (pathname === "/portal" || pathname.startsWith("/portal/")) {
    if (pathname === "/portal/login") {
      return NextResponse.next();
    }
    const portalToken = await getToken({
      req: request,
      secret: NEXTAUTH_SECRET,
    });
    if (!portalToken || portalToken.role !== "client_portal") {
      const signIn = new URL("/portal/login", request.url);
      signIn.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.next();
  }

  const role = token.role as string | undefined;
  if (role !== "member") {
    return NextResponse.next();
  }

  if (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) {
    return NextResponse.redirect(new URL(MEMBER_ACCOUNT, request.url));
  }

  if (isMemberAllowedPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(MEMBER_HOME, request.url));
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/portal", "/portal/:path*"],
};
