import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const path = req.nextUrl.pathname;
      if (path === "/portal/login") return true;
      if (!token) return false;
      return token.role === "client_portal";
    },
  },
  pages: {
    signIn: "/portal/login",
  },
});

export const config = {
  matcher: ["/portal", "/portal/:path*"],
};
