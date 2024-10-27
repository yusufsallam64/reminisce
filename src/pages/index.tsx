import AudioRecorder from "@/components/AudioRecorder";
import { signOut } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="text-text w-full flex flex-col place-content-center">
      <div className="m-auto">
        <Link href="/auth/signin">Sign In</Link>
        <button onClick={() => signOut({ callbackUrl: '/', redirect: false})}>Sign out</button>
      </div>
    </div>
  );
}
