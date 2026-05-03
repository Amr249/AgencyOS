"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";

const OPTION_KEYS = ["light", "dark", "system"] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");

  const options = OPTION_KEYS.map((value) => ({
    value,
    label:
      value === "light"
        ? t("themeModeLight")
        : value === "dark"
          ? t("themeModeDark")
          : t("themeModeSystem"),
    icon: value === "light" ? Sun : value === "dark" ? Moon : Monitor,
  }));

  return (
    <div className="flex flex-wrap gap-3">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex w-28 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
            ${theme === value
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50"
            }`}
        >
          <Icon className="h-6 w-6" />
          <span className="text-sm font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
