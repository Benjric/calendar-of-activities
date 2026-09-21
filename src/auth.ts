import { compare } from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Authentication.
 *
 * Email + password, because a field office needs accounts it can create and
 * reset itself without depending on an external identity provider.
 *
 * The JWT strategy is required for the Credentials provider, so the role rides
 * in the token. It is refreshed from the database on every request, otherwise
 * demoting someone would not take effect until their token expired.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      divisionId: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Same failure for unknown email and wrong password, so this cannot be
        // used to discover which addresses have accounts.
        if (!user?.passwordHash || !user.isActive) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          divisionId: user.divisionId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
      }

      // Re-read the role each request. A user demoted from Program Manager to
      // Viewer loses access immediately rather than at token expiry.
      if (token.uid) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, divisionId: true, isActive: true, name: true },
        });
        if (!fresh?.isActive) return null;
        token.role = fresh.role;
        token.divisionId = fresh.divisionId;
        token.name = fresh.name;
      }

      return token;
    },

    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as UserRole) ?? "VIEWER";
        session.user.divisionId = (token.divisionId as string | null) ?? null;
      }
      return session;
    },
  },
});
