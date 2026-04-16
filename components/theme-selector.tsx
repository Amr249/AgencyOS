"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

const options = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

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
