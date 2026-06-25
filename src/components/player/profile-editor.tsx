"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { FifaCard } from "@/components/player/fifa-card";
import { ProfileForm } from "@/components/player/profile-form";
import { DEFAULT_CARD_BACKGROUND } from "@/lib/card-backgrounds";
import type { Attributes, LevelInfo } from "@/lib/gamification";
import type { Player } from "@/lib/db/schema";

/**
 * Client wrapper that pairs the live card preview with the profile form. The
 * chosen card background is lifted here so picking one in the form re-renders
 * the big preview instantly (the rest of the form keeps its own state and is
 * only reflected after saving). The secondary cards (security, install, push)
 * are passed through as `children` so the page keeps its exact two-column shape.
 */
export function ProfileEditor({
  player,
  overall,
  attributes,
  level,
  derived,
  username,
  email,
  children,
}: {
  player: Player;
  overall: number;
  attributes: Attributes;
  level: LevelInfo;
  derived: Attributes;
  username: string;
  email: string;
  children: React.ReactNode;
}) {
  const [cardBackground, setCardBackground] = useState(
    player.cardBackground ?? DEFAULT_CARD_BACKGROUND,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="space-y-4">
        <FifaCard
          player={player}
          overall={overall}
          attributes={attributes}
          level={level}
          backgroundId={cardBackground}
        />
        <p className="text-center text-xs text-muted">Anteprima della tua card</p>
      </div>
      <div className="space-y-6">
        <Card>
          <CardTitle className="mb-4">Modifica profilo</CardTitle>
          <ProfileForm
            player={player}
            username={username}
            email={email}
            derived={derived}
            level={level.level}
            cardBackground={cardBackground}
            onCardBackgroundChange={setCardBackground}
          />
        </Card>
        {children}
      </div>
    </div>
  );
}
