"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ClientLossCategory } from "@/lib/client-loss";

export type ClientLostDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Match pipeline win dialog (`false` keeps dropdowns usable underneath). */
  modal?: boolean;
  companyName: string;
  pending?: boolean;
  onConfirm: (payload: { lossCategory: ClientLossCategory; notes: string }) => void | Promise<void>;
};

export function ClientLostDialog({
  open,
  onOpenChange,
  modal = true,
  companyName,
  pending = false,
  onConfirm,
}: ClientLostDialogProps) {
  const t = useTranslations("clients");
  const [lossCategory, setLossCategory] = React.useState<ClientLossCategory>("not_serious");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setLossCategory("not_serious");
      setNotes("");
    }
  }, [open]);

  return (
    <Dialog modal={modal} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{t("pipelineMarkLostTitle")}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{companyName}</span>
            {" — "}
            {t("pipelineMarkLostDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label>{t("lossCategoryLabel")}</Label>
            <RadioGroup
              value={lossCategory}
              onValueChange={(v) => setLossCategory(v as ClientLossCategory)}
              className="gap-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="not_serious" id="lost-not-serious" />
                <Label htmlFor="lost-not-serious" className="font-normal">
                  {t("lossCategoryNotSerious")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="rejected_work" id="lost-rejected" />
                <Label htmlFor="lost-rejected" className="font-normal">
                  {t("lossCategoryRejectedWork")}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lost-why-notes">{t("lossWhyLabel")}</Label>
            <Textarea
              id="lost-why-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("lossWhyPlaceholder")}
              rows={4}
              className="resize-none"
            />
            <p className="text-muted-foreground text-xs">{t("lossWhyHint")}</p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t("pipelineCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void onConfirm({ lossCategory, notes: notes.trim() })}
          >
            {t("pipelineSaveOutcome")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
