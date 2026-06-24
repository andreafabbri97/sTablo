"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./nav-links";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {NAV_LINKS.map((link) => {
          const active = link.match(pathname);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-xl transition-all duration-200",
                  active
                    ? "bg-brand text-white shadow-[var(--shadow-brand)]"
                    : "text-muted group-active:scale-90",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold transition",
                  active ? "text-brand" : "text-muted",
                )}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
