import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Plus,
  Swords,
  UserPlus,
  Users,
  FlaskConical,
  KeyRound,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CreatePlayerForm } from "@/components/admin/create-player-form";
import { CreateTeamForm } from "@/components/admin/create-team-form";
import { DemoControls } from "@/components/admin/demo-controls";
import { AccountManager } from "@/components/admin/account-manager";
import { ExportData } from "@/components/admin/export-data";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  getPlayerOptions,
  getPlayersList,
  getAllAccounts,
} from "@/lib/queries";
import { getTeamRanking } from "@/lib/stats";
import { countDemoMatches } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "admin") redirect("/");

  const [players, playerOpts, teams, demoCount, accounts] = await Promise.all([
    getPlayersList(),
    getPlayerOptions(),
    getTeamRanking(),
    countDemoMatches(),
    getAllAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Shield className="h-6 w-6" />}
        title="Pannello admin"
        subtitle="Gestisci partite, tornei, giocatori e team"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg" className="h-auto py-4">
          <Link href="/partite/nuova">
            <Plus className="h-5 w-5" /> Registra partita
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-auto py-4">
          <Link href="/tornei/nuovo">
            <Swords className="h-5 w-5" /> Crea torneo
          </Link>
        </Button>
      </div>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-brand" /> Partite demo
        </CardTitle>
        <DemoControls count={demoCount} />
      </Card>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-brand" /> Nuovo giocatore
        </CardTitle>
        <p className="mb-3 text-sm text-muted">
          Aggiungi un giocatore senza account (lo potrà rivendicare poi registrandosi).
        </p>
        <CreatePlayerForm />
      </Card>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" /> Nuovo team
        </CardTitle>
        <p className="mb-3 text-sm text-muted">
          Una coppia con un alias che gioca e viene classificata insieme.
        </p>
        <CreateTeamForm players={playerOpts} />
      </Card>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" /> Account e password
        </CardTitle>
        <p className="mb-3 text-sm text-muted">
          Se un giocatore dimentica la password, qui ne generi una temporanea da
          comunicargli: la cambierà poi dal suo profilo.
        </p>
        <AccountManager accounts={accounts} currentUserId={user.id} />
      </Card>

      <Card>
        <CardTitle className="mb-3 flex items-center gap-2">
          <Download className="h-5 w-5 text-brand" /> Esporta dati
        </CardTitle>
        <p className="mb-3 text-sm text-muted">
          Scarica giocatori, partite e tornei in CSV (per Excel/Fogli Google) o
          un backup completo in JSON. Le password non vengono mai esportate.
        </p>
        <ExportData />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle className="mb-3">Giocatori ({players.length})</CardTitle>
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.id}>
                <Link href={`/giocatori/${p.slug}`} className="flex items-center gap-2 text-sm hover:text-brand">
                  <Avatar name={p.name} colorIndex={p.avatarColor} imageUrl={p.avatarUrl} size="xs" />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-xs text-muted">{p.eloSingles}</span>
                </Link>
              </li>
            ))}
            {players.length === 0 && <p className="text-sm text-muted">Nessun giocatore.</p>}
          </ul>
        </Card>
        <Card>
          <CardTitle className="mb-3">Team ({teams.length})</CardTitle>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <Avatar name={t.name} colorIndex={t.avatarColor} size="xs" />
                <span className="flex-1 truncate">{t.name}</span>
                <span className="font-mono text-xs text-muted">{t.eloDoubles}</span>
              </li>
            ))}
            {teams.length === 0 && <p className="text-sm text-muted">Nessun team.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
