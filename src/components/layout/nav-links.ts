import {
  Home,
  Trophy,
  Users,
  Swords,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/classifica",
    label: "Classifica",
    icon: Trophy,
    match: (p) => p.startsWith("/classifica"),
  },
  {
    href: "/partite",
    label: "Partite",
    icon: ListChecks,
    match: (p) => p.startsWith("/partite"),
  },
  {
    href: "/tornei",
    label: "Tornei",
    icon: Swords,
    match: (p) => p.startsWith("/tornei"),
  },
  {
    href: "/giocatori",
    label: "Giocatori",
    icon: Users,
    match: (p) => p.startsWith("/giocatori"),
  },
];
