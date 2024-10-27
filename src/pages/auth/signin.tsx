import type { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { getProviders } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]";
import AuthProviderBlock from "@/components/auth/AuthProviderBlock";
import client from '@/lib/db/client';
import { useEffect, useState } from "react";

const SignIn = ({
    providers
}: InferGetServerSidePropsType<typeof getServerSideProps>): JSX.Element => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    return (
        <div className="min-h-screen w-full relative overflow-hidden bg-background">
            {/* Animated gradient background */}
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    background: `radial-gradient(circle at ${50 + mousePosition.x * 10}% ${50 + mousePosition.y * 10}%, 
                rgb(212, 131, 17) 0%,
                rgba(105, 117, 101, 0.5) 25%,
                rgba(40, 42, 39, 0.1) 50%)`
                }}
            />

            {/* Content container */}
            <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
                {/* Logo and title section */}
                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-6xl font-bold text-text">
                        <span className="bg-gradient-to-r from-accent via-accent/80 to-secondary bg-clip-text text-transparent">
                            Reminisce
                        </span>
                    </h1>
                    <p className="text-xl text-text">
                        Your companion in preserving memories
                    </p>
                </div>

                {/* Providers section */}
                <div className="w-full max-w-md space-y-4">
                    {Object.values(providers).map((provider) => (
                        <div
                            key={provider.id}
                            className="transform transition-all duration-300 hover:scale-105"
                        >
                            <AuthProviderBlock
                                providerName={provider.name}
                                iconLink={`/providers/${provider.id}.png`}
                                provider={provider}
                            />
                        </div>
                    ))}
                </div>

                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-accent/10 rounded-full filter blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full filter blur-3xl" />
            </div>
        </div>
    );
};


export async function getServerSideProps(context: GetServerSidePropsContext) {
    const session = await getServerSession(context.req, context.res, authOptions);

    const db = (await client.connect()).db("DB");
    // If the user is already logged in, redirect.
    // Note: Make sure not to redirect to the same page
    // To avoid an infinite loop!
    if (session) {
        if (await db.collection("Companions").findOne({ userId: session.user?.email })) {
            return { redirect: { destination: "/companion" } };
        } else {
            return { redirect: { destination: "/create-companion" } };
        }
    }

    const providers = await getProviders();

    // TODO --> If no providers, this should error or something
    return {
        props: { providers: providers ?? [] }
    };
}

export default SignIn;