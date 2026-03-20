"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
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
  placeholder = "اختر تاريخًا",
  className,
  disabled,
  direction = "rtl",
  locale = arSA,
  popoverAlign = "end",
}: DatePickerArProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            direction === "rtl" ? "text-right" : "text-left",
            !value && "text-muted-foreground",
            className
          )}
          dir={direction}
        >
          {value ? (
            format(value, "dd/MM/yyyy", { locale })
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={popoverAlign} dir={direction}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          defaultMonth={value}
          dir={direction}
          locale={locale}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
