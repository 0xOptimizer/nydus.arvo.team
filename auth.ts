import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import Credentials from "next-auth/providers/credentials"

const isDev = process.env.ENVIRONMENT === "development"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    isDev 
      ? Credentials({
          id: "discord",
          name: "Mock Login",
          credentials: {},
          async authorize() {
            return {
              id: "dev-user-id",
              name: "Dev Admin",
              email: "dev@example.com",
              image: "https://github.com/identicons/dev.png",
            }
          },
        })
      : Discord({
          clientId: process.env.AUTH_DISCORD_ID as string,
          clientSecret: process.env.AUTH_DISCORD_SECRET as string,
          authorization: "https://discord.com/api/oauth2/authorize?scope=identify",
        }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (isDev) {
        return true
      }

      if (!profile?.id) return false

      try {
        const response = await fetch(`${process.env.BACKEND_URL}/api/auth/check-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            discord_id: profile.id,
          }),
        })

        return response.ok
      } catch (error) {
        return false
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.name = user.name
        token.picture = user.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? ""
        session.user.image = (token.picture as string) ?? ""
        session.user.name = (token.name as string) ?? ""
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  }
})