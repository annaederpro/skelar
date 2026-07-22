"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, CalendarCheck, CalendarDays, Fish } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  todayCount: number;
}

const TABS = [
  { href: "/today", label: "Сьогодні", icon: CalendarCheck },
  { href: "/upcoming", label: "Незабаром", icon: CalendarDays },
  { href: "/inbox", label: "Всі задачі", icon: Inbox },
  { href: "/aquarium", label: "Мій акваріум", icon: Fish },
] as const;

export function BottomNav({ todayCount }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper/90 px-2 pb-3.5 pt-2.5 backdrop-blur-md">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[11.5px] font-bold transition-colors",
              isActive ? "bg-sea-soft text-sea-deep" : "text-ink-soft hover:text-ink",
            )}
          >
            <Icon className="size-5" />
            {label}
            {href === "/today" && todayCount > 0 && (
              <span className="absolute -top-1 right-[calc(50%-20px)] flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border border-paper bg-sea-soft px-1 text-[10px] font-bold text-sea-deep">
                {todayCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
