import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const MEMBER_HOME = "/dashboard/me";

function isMemberAllowedPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;
  if (pathname === "/dashboard/my-tasks" || pathname.startsWith("/dashboard/my-tasks/"))
    return true;
  if (pathname === MEMBER_HOME || pathname.startsWith(`${MEMBER_HOME}/`)) return true;
  if (pathname === "/dashboard/projects" || pathname.startsWith("/dashboard/projects/"))
    return true;
  if (pathname === "/dashboard/tasks" || pathname.startsWith("/dashboard/tasks/")) return true;
  if (pathname === "/dashboard/payments" || pathname.startsWith("/dashboard/payments/"))
    return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.sub) {
    return NextResponse.next();
  }

  const role = token.role as string | undefined;
  if (role !== "member") {
    return NextResponse.next();
  }

  if (pathname === "/dashboard/my-tasks" || pathname.startsWith("/dashboard/my-tasks/")) {
    return NextResponse.redirect(new URL(MEMBER_HOME, request.url));
  }

  if (isMemberAllowedPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(MEMBER_HOME, request.url));
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
