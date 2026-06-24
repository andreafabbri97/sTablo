"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Shield, LogIn, ChevronDown, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { colorFromString } from "@/lib/utils";

export function UserButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (status === "loading") {
    return <div className="h-10 w-10 rounded-full skeleton" />;
  }

  if (!session?.user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">
          <LogIn className="h-4 w-4" />
          Accedi
        </Link>
      </Button>
    );
  }

  const name = session.user.name ?? "Giocatore";
  const isAdmin = session.user.role === "admin";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface/60 p-1 pr-2 transition hover:bg-surface"
      >
        <Avatar name={name} colorIndex={colorFromString(name)} size="sm" />
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 animate-scale-in rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-lg)]">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-xs text-muted">{session.user.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <MenuLink href="/profilo" icon={<User className="h-4 w-4" />} onClick={() => setOpen(false)}>
            Il mio profilo
          </MenuLink>
          <MenuLink href="/amici" icon={<Users className="h-4 w-4" />} onClick={() => setOpen(false)}>
            Amici
          </MenuLink>
          {isAdmin && (
            <MenuLink href="/admin" icon={<Shield className="h-4 w-4" />} onClick={() => setOpen(false)}>
              Pannello admin
            </MenuLink>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-loss transition hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-surface-2"
    >
      {icon}
      {children}
    </Link>
  );
}
