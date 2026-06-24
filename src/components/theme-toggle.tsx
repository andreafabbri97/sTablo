"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  // Icon visibility is driven purely by the `.dark` class on <html> (set by
  // next-themes) via Tailwind `dark:` variants — no client-only mount flag, so
  // there's no hydration mismatch and no setState inside an effect.
  return (
    <button
      type="button"
      aria-label="Cambia tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface/60 text-foreground transition hover:bg-surface active:scale-90",
        className,
      )}
    >
      <Sun className="absolute h-5 w-5 scale-100 rotate-0 opacity-100 transition-all duration-300 dark:scale-0 dark:-rotate-90 dark:opacity-0" />
      <Moon className="absolute h-5 w-5 scale-0 rotate-90 opacity-0 transition-all duration-300 dark:scale-100 dark:rotate-0 dark:opacity-100" />
    </button>
  );
}
