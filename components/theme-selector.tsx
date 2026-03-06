"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

const options = [
  { value: "light" as const, label: "فاتح", icon: Sun },
  { value: "dark" as const, label: "داكن", icon: Moon },
  { value: "system" as const, label: "تلقائي", icon: Monitor },
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-3 justify-end flex-wrap" dir="rtl">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer w-28
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
