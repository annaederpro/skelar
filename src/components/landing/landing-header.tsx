"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/gentle/wordmark";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setSolid(!entry.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        solid ? "bg-paper/90 shadow-sm backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 text-ink">
        <Wordmark />
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-[13.5px] font-bold text-sea-deep transition-colors hover:text-ink"
          >
            Увійти
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-full bg-sea px-4 py-2 text-[13.5px] font-extrabold text-white transition-colors hover:bg-sea-deep"
          >
            Спробувати
          </Link>
        </nav>
      </div>
    </header>
  );
}
