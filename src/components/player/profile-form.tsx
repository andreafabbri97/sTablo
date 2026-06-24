"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/field";
import { PLAY_STYLES } from "@/lib/gamification";
import { updateProfile } from "@/lib/actions/player-actions";
import type { Player } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function ProfileForm({ player }: { player: Player }) {
  const router = useRouter();
  const [statsPublic, setStatsPublic] = useState(player.statsPublic);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await updateProfile({
      nickname: String(form.get("nickname") ?? ""),
      motto: String(form.get("motto") ?? ""),
      bio: String(form.get("bio") ?? ""),
      preferredFoot: String(form.get("preferredFoot") ?? ""),
      playStyle: String(form.get("playStyle") ?? ""),
      specialMove: String(form.get("specialMove") ?? ""),
      statsPublic,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nickname">Soprannome</Label>
          <Input id="nickname" name="nickname" defaultValue={player.nickname ?? ""} maxLength={24} placeholder="es. Il Fenomeno" />
        </div>
        <div>
          <Label htmlFor="specialMove">Mossa speciale ⚡</Label>
          <Input id="specialMove" name="specialMove" defaultValue={player.specialMove ?? ""} maxLength={60} placeholder="es. Rovesciata fronte mare" />
        </div>
      </div>

      <div>
        <Label htmlFor="motto">Motto</Label>
        <Input id="motto" name="motto" defaultValue={player.motto ?? ""} maxLength={80} placeholder="Una frase che ti rappresenta" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="preferredFoot">Piede preferito</Label>
          <Select id="preferredFoot" name="preferredFoot" defaultValue={player.preferredFoot ?? ""}>
            <option value="">Non specificato</option>
            <option value="right">Destro</option>
            <option value="left">Mancino</option>
            <option value="both">Ambidestro</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="playStyle">Stile di gioco</Label>
          <Select id="playStyle" name="playStyle" defaultValue={player.playStyle ?? ""}>
            <option value="">Non specificato</option>
            {PLAY_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name} — {s.tagline}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={player.bio ?? ""} rows={3} maxLength={280} placeholder="Racconta qualcosa di te in campo…" />
      </div>

      {/* Privacy toggle */}
      <button
        type="button"
        onClick={() => setStatsPublic((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition",
          statsPublic ? "border-brand bg-brand-soft" : "border-border bg-surface",
        )}
      >
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", statsPublic ? "bg-brand text-white" : "bg-surface-2 text-muted")}>
          {statsPublic ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">
            Statistiche {statsPublic ? "pubbliche" : "private"}
          </span>
          <span className="block text-xs text-muted">
            {statsPublic
              ? "Tutti vedono livello, caratteristiche e card."
              : "Solo tu vedi la card. Classifica e risultati restano pubblici."}
          </span>
        </span>
        <span className={cn("relative h-6 w-11 rounded-full transition", statsPublic ? "bg-brand" : "bg-surface-2")}>
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", statsPublic ? "left-[22px]" : "left-0.5")} />
        </span>
      </button>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "Salvato!" : loading ? "Salvataggio…" : "Salva profilo"}
      </Button>
    </form>
  );
}
