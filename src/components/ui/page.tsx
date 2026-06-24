import * as React from "react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/components/help/help-button";

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
  help,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Topic key into the guide registry; renders a "?" help button. */
  help?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            {icon}
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {(action || help) && (
        <div className="flex items-center gap-2">
          {action}
          {help && <HelpButton topic={help} />}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-surface flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          {icon}
        </span>
      )}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      )}
      {action}
    </div>
  );
}
