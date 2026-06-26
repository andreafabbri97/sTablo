"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { UserButton } from "./user-button";
import { MessagesButton } from "./messages-button";
import { NotificationsBell } from "./notifications-bell";
import { HeaderDataProvider } from "./header-data";
import { NAV_LINKS } from "./nav-links";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border glass shadow-[0_8px_30px_-18px_rgba(2,8,23,0.45)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
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
                aria-current={active ? "page" : undefined}
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
          <HeaderDataProvider>
            <NotificationsBell />
            <MessagesButton />
            <UserButton />
          </HeaderDataProvider>
        </div>
      </div>
    </header>
  );
}
