"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { id: string; name: string; email: string; role: "USER" | "ADMIN" } | null;

export function Nav() {
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user))
      .finally(() => setLoaded(true));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          🎫 TicketNow
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {!loaded ? null : me ? (
            <>
              {me.role === "ADMIN" && (
                <Link href="/admin" className="text-indigo-600 hover:underline dark:text-indigo-400">
                  後台管理
                </Link>
              )}
              <span className="text-black/60 dark:text-white/60">{me.name}</span>
              <button
                onClick={logout}
                className="rounded-md border border-black/10 px-3 py-1.5 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                登出
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                登入
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500"
              >
                註冊
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
