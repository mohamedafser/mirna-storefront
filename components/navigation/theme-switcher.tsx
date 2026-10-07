"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useId, useLayoutEffect, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n/client";
import { applyTheme, readTheme, setTheme, subscribeTheme, themes, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils/cn";

export const themeIcons: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

/**
 * Light / Dark / System selector (native radio group for accessibility),
 * used inline in the mobile drawer; the header uses ThemeMenu.
 */
export function ThemeSwitcher({
  className,
  showLegend = true,
  fullWidth = false,
}: {
  className?: string;
  showLegend?: boolean;
  /** Stretch to the container with equal segments (menus, drawers). */
  fullWidth?: boolean;
}) {
  const { messages } = useI18n();
  // Unique per instance: several switchers can be on one page (header, menu, drawer).
  const name = useId();
  // Server snapshot is null, so the first client render matches the server HTML.
  const current = useSyncExternalStore(subscribeTheme, readTheme, () => null);

  // React's dev Strict Mode remount resets <html> attributes; re-apply. No-op in production.
  useLayoutEffect(() => {
    applyTheme(readTheme());
  }, []);

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className={cn("caps mb-3 text-[0.6875rem] font-medium", !showLegend && "sr-only")}>
        {messages.theme.label}
      </legend>
      <div className={cn("border p-1", fullWidth ? "grid w-full grid-cols-3" : "inline-flex")}>
        {themes.map((theme) => {
          const Icon = themeIcons[theme];
          const active = current === theme;
          return (
            <label
              key={theme}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                "min-h-10 px-3",
                active && "bg-foreground font-medium text-background hover:text-background",
              )}
            >
              <input
                type="radio"
                name={name}
                value={theme}
                checked={active}
                onChange={() => setTheme(theme)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              <span>{messages.theme[theme]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
