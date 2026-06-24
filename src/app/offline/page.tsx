import { WifiOff } from "lucide-react";
import { Logo } from "@/components/logo";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Logo className="scale-150" />
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <WifiOff className="h-6 w-6" />
      </span>
      <h1 className="font-display text-2xl font-extrabold">Sei offline</h1>
      <p className="max-w-xs text-sm text-muted">
        Connettiti a internet per vedere classifiche e partite aggiornate.
      </p>
    </div>
  );
}
