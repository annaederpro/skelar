"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, CalendarCheck, CalendarDays, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  todayCount: number;
}

const TABS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/today", label: "Сьогодні", icon: CalendarCheck },
  { href: "/upcoming", label: "Незабаром", icon: CalendarDays },
  { href: "/browse", label: "Огляд", icon: FolderOpen },
] as const;

export function BottomNav({ todayCount }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t bg-background/95 px-2 py-2 backdrop-blur">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors",
              isActive ? "text-rose-500" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
            {href === "/today" && todayCount > 0 && (
              <span className="absolute -top-0.5 right-1 flex size-4 items-center justify-center rounded-full bg-rose-400 text-[10px] font-medium text-white">
                {todayCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
