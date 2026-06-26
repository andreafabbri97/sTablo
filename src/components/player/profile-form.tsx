"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Eye, EyeOff, Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/field";
import { PLAY_STYLES, type Attributes } from "@/lib/gamification";
import { updateProfile } from "@/lib/actions/player-actions";
import { fileToAvatarDataUrl } from "@/lib/avatar-image";
import { AttributeEditor } from "@/components/player/attribute-editor";
import { CardBackgroundPicker } from "@/components/player/card-background-picker";
import type { Player } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function ProfileForm({
  player,
  username,
  email,
  derived,
  level,
  cardBackground,
  onCardBackgroundChange,
}: {
  player: Player;
  username: string;
  email: string;
  derived: Attributes;
  level: number;
  /** Controlled by the parent so the live card preview shares the value. */
  cardBackground: string;
  onCardBackgroundChange: (id: string) => void;
}) {
  const router = useRouter();
  const [statsPublic, setStatsPublic] = useState(player.statsPublic);
  const [customAttributes, setCustomAttributes] = useState<
    Record<string, number>
  >(() => ({ ...(player.customAttributes ?? {}) }));
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? "");
  const [imgBusy, setImgBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    setError(null);
    setImgBusy(true);
    try {
      setAvatarUrl(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Immagine non valida");
    } finally {
      setImgBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await updateProfile({
      username: String(form.get("username") ?? "").trim().toLowerCase(),
      email: String(form.get("email") ?? "").trim(),
      motto: String(form.get("motto") ?? ""),
      bio: String(form.get("bio") ?? ""),
      preferredFoot: String(form.get("preferredFoot") ?? ""),
      playStyle: String(form.get("playStyle") ?? ""),
      specialMove: String(form.get("specialMove") ?? ""),
      instagram: String(form.get("instagram") ?? ""),
      avatarUrl,
      cardBackground,
      statsPublic,
      customAttributes,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
    // Nudge the header to refresh its avatar instantly (it loads it client-side).
    window.dispatchEvent(
      new CustomEvent("stablo-avatar", {
        detail: { avatarUrl: avatarUrl || null, avatarColor: player.avatarColor },
      }),
    );
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
        <Avatar
          name={player.name}
          colorIndex={player.avatarColor}
          imageUrl={avatarUrl || null}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Foto profilo</p>
          <p className="text-xs text-muted">
            Sostituisci le iniziali con una tua foto. Viene ritagliata quadrata.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={imgBusy}
            >
              <Camera className="h-4 w-4" />
              {imgBusy ? "Carico…" : avatarUrl ? "Cambia" : "Carica foto"}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAvatarUrl("")}
                disabled={imgBusy}
              >
                <Trash2 className="h-4 w-4" />
                Rimuovi
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="username">Username (per il login)</Label>
          <Input id="username" name="username" defaultValue={username} required minLength={3} maxLength={20} placeholder="es. mesh" autoComplete="username" />
        </div>
        <div>
          <Label htmlFor="email">Email (opzionale)</Label>
          <Input id="email" name="email" type="email" defaultValue={email} placeholder="tu@esempio.it" autoComplete="email" />
        </div>
      </div>

      <div>
        <Label htmlFor="specialMove">Mossa speciale ⚡</Label>
        <Input id="specialMove" name="specialMove" defaultValue={player.specialMove ?? ""} maxLength={60} placeholder="es. Rovesciata fronte mare" />
      </div>

      <div>
        <Label htmlFor="motto">Motto</Label>
        <Input id="motto" name="motto" defaultValue={player.motto ?? ""} maxLength={80} placeholder="Una frase che ti rappresenta" />
      </div>

      <div>
        <Label htmlFor="instagram">Instagram (opzionale)</Label>
        <Input id="instagram" name="instagram" defaultValue={player.instagram ?? ""} maxLength={100} placeholder="es. @mario.rossi" autoComplete="off" />
        <p className="mt-1 text-xs text-muted">
          Appare come icona Instagram solo sul tuo profilo e linka al tuo account. Lascia vuoto per non mostrarlo.
        </p>
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

      {/* Card attributes budget allocator */}
      <AttributeEditor
        derived={derived}
        level={level}
        initial={player.customAttributes ?? {}}
        onChange={setCustomAttributes}
      />

      {/* Card background picker (cosmetic) */}
      <CardBackgroundPicker
        value={cardBackground}
        onChange={onCardBackgroundChange}
      />

      {/* Privacy toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={statsPublic}
        aria-label="Statistiche pubbliche"
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
