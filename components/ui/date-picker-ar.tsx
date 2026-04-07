"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerArProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  direction?: "rtl" | "ltr";
  locale?: Locale;
  popoverAlign?: "start" | "center" | "end";
}

export function DatePickerAr({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  direction,
  locale: localeProp,
  popoverAlign = "end",
}: DatePickerArProps) {
  const appLocale = useLocale();
  const isAr = appLocale === "ar";
  const dir = direction ?? (isAr ? "rtl" : "ltr");
  const dateFnsLocale = localeProp ?? (isAr ? arSA : enUS);
  const defaultPlaceholder = isAr ? "اختر تاريخًا" : "Pick a date";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            dir === "rtl" ? "text-right" : "text-left",
            !value && "text-muted-foreground",
            className
          )}
          dir={dir}
        >
          {value ? (
            format(value, "dd MMM yyyy", { locale: dateFnsLocale })
          ) : (
            <span>{placeholder ?? defaultPlaceholder}</span>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={popoverAlign} dir={dir}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          defaultMonth={value}
          dir={dir}
          locale={dateFnsLocale}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
