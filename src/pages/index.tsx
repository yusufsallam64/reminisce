import { signOut } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <Link href="/auth/signin">Sign In</Link>
      <button onClick={() => signOut({ callbackUrl: '/', redirect: false})}>Sign out</button>
    </div>
  );
}
