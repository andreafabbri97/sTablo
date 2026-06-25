import { Users, Swords, Trophy, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Admin data export. Plain download links to the admin-gated export route —
 * `Content-Disposition: attachment` makes the browser save the file, so no
 * client JS is needed. CSV per entity plus a full JSON backup.
 */

type ExportLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const CSV_LINKS: ExportLink[] = [
  {
    href: "/api/admin/export?dataset=players&format=csv",
    label: "Giocatori (CSV)",
    icon: <Users className="h-4 w-4" />,
  },
  {
    href: "/api/admin/export?dataset=matches&format=csv",
    label: "Partite (CSV)",
    icon: <Swords className="h-4 w-4" />,
  },
  {
    href: "/api/admin/export?dataset=tournaments&format=csv",
    label: "Tornei (CSV)",
    icon: <Trophy className="h-4 w-4" />,
  },
];

export function ExportData() {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {CSV_LINKS.map((l) => (
          <Button key={l.href} asChild variant="secondary" size="sm">
            {/* download lets the browser save with the server filename. */}
            <a href={l.href} download>
              {l.icon} {l.label}
            </a>
          </Button>
        ))}
      </div>
      <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
        <a href="/api/admin/export?dataset=all&format=json" download>
          <Database className="h-4 w-4" /> Backup completo (JSON)
        </a>
      </Button>
    </div>
  );
}
