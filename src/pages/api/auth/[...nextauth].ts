import { MongoDBAdapter } from "@auth/mongodb-adapter"
import NextAuth, { AuthOptions, Session } from "next-auth"
import { Adapter, AdapterUser } from "next-auth/adapters"
import GoogleProvider from "next-auth/providers/google";
import client from "@/lib/db/client";

if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variable")
}

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        }),
    ],
    adapter: MongoDBAdapter(client) as Adapter,
    pages: { 
        signIn: "/auth/signin",
        newUser: '/create-companion',
    },
    callbacks: {
        // TODO --> investigate the bug with not refreshing the access token properly
        // Credential logic adapted from [next-auth example](https://authjs.dev/guides/refresh-token-rotation)
        async session({ session, user }) {
            await client.connect();
            const db = client.db("accounts");
            const dbuser = await db.collection("users").findOne({ email: session.user?.email ?? "" });
            if (!dbuser) {
                // TODO --> Create a new user or something on this...
                return session;
            }

            const googleAccount = await db.collection("accounts").findOne({ _id : dbuser.userId, provider: "google" });

            if(!googleAccount) {
                // TOOD --> Create a new account or something on this...
                return session;
            }

            if (googleAccount.expires_at * 1000 < Date.now()) {
                // If the access token has expired, try to refresh it
                try {
                    // https://accounts.google.com/.well-known/openid-configuration
                    // We need the `token_endpoint`.
                    const response = await fetch("https://oauth2.googleapis.com/token", {
                        method: "POST",
                        body: new URLSearchParams({
                            client_id: process.env.AUTH_GOOGLE_ID!,
                            client_secret: process.env.AUTH_GOOGLE_SECRET!,
                            grant_type: "refresh_token",
                            refresh_token: googleAccount.refresh_token,
                        }),
                    })
            
                    const tokensOrError = await response.json()
            
                    if (!response.ok) throw tokensOrError
            
                    const newTokens = tokensOrError as {
                        access_token: string
                        expires_in: number
                        refresh_token?: string
                    }
            
                    await db.collection("accounts").updateOne(
                        { _id: dbuser.userId, provider: "google" },
                        {
                            $set: {
                                access_token: newTokens.access_token,
                                expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
                                refresh_token: newTokens.refresh_token ?? googleAccount.refresh_token,
                            }
                        }
                    )
                } catch (error) {
                    console.error("Error refreshing access_token", error)
                    // If we fail to refresh the token, return an error so we can handle it on the page
                    session.error = "RefreshTokenError"
                }
            }
            
            return session
        },
    }
}

export default NextAuth(authOptions)