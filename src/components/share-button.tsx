"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({
  url,
  title = "sTablo",
  text,
  label = "Condividi",
}: {
  url: string;
  title?: string;
  text?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const nav = navigator as Navigator & {
      share?: (d: ShareData) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title, text, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall back to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={onShare}>
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Link copiato!" : label}
    </Button>
  );
}
