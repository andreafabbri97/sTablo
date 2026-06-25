"use client";

import { Download, Share, Smartphone } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/use-install-prompt";

/**
 * Settings card that installs the PWA straight from the profile.
 *  - Already running as the installed app → render nothing (there's nothing to
 *    do, and we don't want a dead button inside the PWA).
 *  - Native prompt available (Android/desktop Chromium) → one-tap install.
 *  - iOS Safari → the manual Share → "Aggiungi a Home" steps (the only way iOS
 *    installs a PWA), which is also the prerequisite for push on iPhone.
 *  - Anything else (already installed but viewed in a browser tab, desktop
 *    Firefox/Safari…) → a short hint, since the web has no API to launch an
 *    installed PWA from a browser tab.
 */
export function InstallAppCard() {
  const { installed, canPrompt, iosInstall, promptInstall } = useInstallPrompt();

  // Inside the installed app there's nothing to install — hide the card.
  if (installed) return null;

  return (
    <Card>
      <CardTitle className="mb-1 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-brand" /> Installa l&apos;app
      </CardTitle>
      <p className="mb-4 text-sm text-muted">
        Aggiungi sTablo alla schermata Home: si apre a tutto schermo come
        un&apos;app vera ed è il modo giusto per ricevere le notifiche su iPhone.
      </p>

      {canPrompt ? (
        <Button
          onClick={() => void promptInstall()}
          size="lg"
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4" /> Installa sTablo
        </Button>
      ) : iosInstall ? (
        <p className="text-sm">
          Tocca <Share className="inline h-4 w-4 align-text-bottom" /> in basso,
          poi{" "}
          <span className="font-semibold text-foreground">
            «Aggiungi a schermata Home»
          </span>
          .
        </p>
      ) : (
        <p className="text-sm text-muted">
          Se l&apos;hai già installata, aprila dalla schermata Home. Altrimenti
          usa il menu del browser →{" "}
          <span className="font-semibold text-foreground">«Installa app»</span>.
        </p>
      )}
    </Card>
  );
}
