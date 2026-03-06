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
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerArProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePickerAr({
  value,
  onChange,
  placeholder = "اختر تاريخًا",
  className,
  disabled,
}: DatePickerArProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-right font-normal",
            !value && "text-muted-foreground",
            className
          )}
          dir="rtl"
        >
          {value ? (
            format(value, "dd/MM/yyyy", { locale: arSA })
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end" dir="rtl">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          defaultMonth={value}
          dir="rtl"
          locale={arSA}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
