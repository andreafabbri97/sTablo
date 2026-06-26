"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Header actions on /tornei. «Albo d'oro» is always shown; «Crea torneo» appears
 * for signed-in users. Client-side (via the session) so the page header can live
 * in a cached static shell.
 */
export function TorneiActions() {
  const { status } = useSession();
  return (
    <>
      <Button asChild size="sm" variant="secondary">
        <Link href="/tornei/albo">
          <Trophy className="h-4 w-4" /> Albo d&apos;oro
        </Link>
      </Button>
      {status === "authenticated" && (
        <Button asChild size="sm">
          <Link href="/tornei/nuovo">
            <Plus className="h-4 w-4" /> Crea torneo
          </Link>
        </Button>
      )}
    </>
  );
}
