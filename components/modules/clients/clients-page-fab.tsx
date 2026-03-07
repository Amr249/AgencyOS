"use client";

import { ClientFormSheet } from "./client-form-sheet";

export function ClientsPageFAB() {
  return (
    <ClientFormSheet
      asChild
      trigger={
        <button
          type="button"
          className="md:hidden fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
          aria-label="عميل جديد"
        >
          +
        </button>
      }
    />
  );
}
