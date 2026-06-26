"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The «Programma» / «Nuova» header actions on /partite. Rendered client-side
 * (via the session) so the page header can live in a cached static shell — the
 * buttons appear once the session resolves as authenticated.
 */
export function PartiteActions() {
  const { status } = useSession();
  if (status !== "authenticated") return null;
  return (
    <div className="flex gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/partite/programma">
          <Swords className="h-4 w-4" /> Programma
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/partite/nuova">
          <Plus className="h-4 w-4" /> Nuova
        </Link>
      </Button>
    </div>
  );
}
