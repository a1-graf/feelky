import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { ensureUserDefaults } from "@/lib/user-defaults";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 90
  },
  pages: {
    signIn: "/auth/signin"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "missing",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "missing"
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && user.email) {
        const email = user.email.toLowerCase();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) {
          const userCount = await prisma.user.count();
          if (userCount > 0) return false;
        }
        const saved = existing
          ? await prisma.user.update({
              where: { email },
              data: {
                name: user.name || profile?.name || existing.name,
                image: user.image || existing.image,
                emailVerified: new Date()
              }
            })
          : await prisma.user.create({
              data: {
                email,
                name: user.name || profile?.name || null,
                image: user.image || null,
                emailVerified: new Date()
              }
            });
        user.id = saved.id;
      }
      if (user.id) await ensureUserDefaults(user.id);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
        token.sub = dbUser?.id || user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }
  }
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
