"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserButton } from "./user-button";
import { NotificationsBell } from "./notifications-bell";
import { NAV_LINKS } from "./nav-links";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border glass shadow-[0_8px_30px_-18px_rgba(2,8,23,0.45)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
        <Link href="/" className="mr-2 transition-transform hover:scale-105">
          <Logo withWordmark />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                  active
                    ? "text-brand"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-xl bg-brand-soft" />
                )}
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationsBell />
          <ThemeToggle />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
