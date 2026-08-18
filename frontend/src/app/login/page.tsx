"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/Button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          ReachInbox
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Email Scheduler
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with Google to access your scheduling dashboard.
        </p>
        <Button
          className="mt-8 w-full"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
