import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Friendly 404. Shown whenever `notFound()` is called or a route doesn't exist,
 * so a mistyped link lands somewhere helpful instead of on a bare error page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Compass className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Pagina non trovata
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Questa pagina non esiste o è stata spostata. Torna in campo e riprova
          dalla home.
        </p>
      </div>
      <Button asChild>
        <Link href="/">
          <Home className="h-4 w-4" /> Torna alla home
        </Link>
      </Button>
    </div>
  );
}
