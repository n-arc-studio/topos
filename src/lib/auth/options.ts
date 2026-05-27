import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticateUser } from "@/lib/auth/storage";

const authSecret = process.env.NEXTAUTH_SECRET?.trim();

if (!authSecret && process.env.NODE_ENV === "production") {
  console.warn("[topos] NEXTAUTH_SECRET is not set; using fallback secret");
}

export const authOptions: NextAuthOptions = {
  secret: authSecret ?? "topos-dev-auth-secret-change-me",
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await authenticateUser(
          credentials.email,
          credentials.password
        );
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.email = token.email ?? session.user.email ?? undefined;
      }
      return session;
    },
  },
};