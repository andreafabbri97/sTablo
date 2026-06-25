import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Distinct badge marking a player whose account has the admin role, so the
 * community can see at a glance who the admins are. Purely presentational —
 * callers decide when to render it.
 */
export function AdminBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="gold"
      className={cn("uppercase tracking-wide", className)}
      title="Amministratore della community"
    >
      <ShieldCheck className="h-3 w-3" />
      Admin
    </Badge>
  );
}
