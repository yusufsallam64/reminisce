import React from 'react';
import { signIn } from 'next-auth/react';
import LandingModel from '@/components/LandingModel';
import Typewriter from 'typewriter-effect';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary to-secondary/30 flex items-center justify-center p-4">
      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Column */}
        <div className="space-y-8 flex flex-col justify-center m-10">
          <div className="space-y-4">
            <h1 className="text-7xl font-bold text-text tracking-tight">
              Reminisce.
            </h1>
            <p className="text-xl text-text">
              A companion for your loved one with dementia
            </p>
          </div>
          
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="flex items-center justify-center gap-2 bg-secondary text-gray-900 font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow w-60 group"
          >
            <img
              src="/providers/google.png"
              alt="Google"
              className="w-5 h-5"
            />
            <span className="font-medium">Sign in with Google</span>
          </button>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          <div className="w-full max-w-md mx-auto">
            <LandingModel />
          </div>
          <div className="text-3xl text-text text-center">
            <Typewriter
              options={{
                strings: ['How are you?', 'Your AI Companion', 'Always Here to Help'],
                autoStart: true,
                loop: true,
                delay: 75,
                deleteSpeed: 50,
                cursor: '|'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}