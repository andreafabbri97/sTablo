import { cn, initials, AVATAR_GRADIENTS } from "@/lib/utils";

const sizes = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-3xl",
};

export function Avatar({
  name,
  colorIndex = 0,
  size = "md",
  className,
  ring,
  imageUrl,
}: {
  name: string;
  colorIndex?: number;
  size?: keyof typeof sizes;
  className?: string;
  ring?: boolean;
  /** optional uploaded picture; falls back to initials when absent */
  imageUrl?: string | null;
}) {
  const gradient = AVATAR_GRADIENTS[colorIndex % AVATAR_GRADIENTS.length];
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br font-display font-extrabold text-white",
        gradient,
        sizes[size],
        ring && "ring-2 ring-background ring-offset-2 ring-offset-brand",
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data-URL avatar, no remote loader needed
        <img
          src={imageUrl}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
