"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { Button } from "./Button";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          ReachInbox
        </p>
        <h1 className="text-lg font-semibold text-slate-900">
          Email Scheduler Dashboard
        </h1>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          {user.image && (
            <Image
              src={user.image}
              alt={user.name ?? "User avatar"}
              width={40}
              height={40}
              className="rounded-full"
            />
          )}
          <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
            Logout
          </Button>
        </div>
      )}
    </header>
  );
}
