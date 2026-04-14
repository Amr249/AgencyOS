"use client";

import * as React from "react";
import { createProposal } from "@/actions/proposals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { PROPOSAL_STATUS_LABELS } from "@/types";
import { enUS } from "date-fns/locale";
import { ProposalServicesField } from "./proposal-services-field";
import { formatCalendarDate } from "@/lib/calendar-date";

const STATUS_OPTIONS = [
  { value: "applied", label: PROPOSAL_STATUS_LABELS.applied },
  { value: "viewed", label: PROPOSAL_STATUS_LABELS.viewed },
  { value: "shortlisted", label: PROPOSAL_STATUS_LABELS.shortlisted },
  { value: "won", label: PROPOSAL_STATUS_LABELS.won },
  { value: "lost", label: PROPOSAL_STATUS_LABELS.lost },
  { value: "cancelled", label: PROPOSAL_STATUS_LABELS.cancelled },
];

type NewProposalDialogProps = {
  trigger: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Active services from Settings — multi-select for proposal taxonomy. */
  serviceOptions?: { id: string; name: string }[];
};

export function NewProposalDialog({
  trigger,
  onSuccess,
  open: openProp,
  onOpenChange: setOpenProp,
  serviceOptions = [],
}: NewProposalDialogProps) {
  const [openLocal, setOpenLocal] = React.useState(false);
  const open = openProp ?? openLocal;
  const setOpen = setOpenProp ?? setOpenLocal;

  const [url, setUrl] = React.useState("");
  const [scraping, setScraping] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [serviceIds, setServiceIds] = React.useState<string[]>([]);
  const [skillsTags, setSkillsTags] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState<string>("");
  const [budgetMax, setBudgetMax] = React.useState<string>("");
  const [currency, setCurrency] = React.useState<"SAR" | "USD">("SAR");
  const [description, setDescription] = React.useState("");
  const [myBid, setMyBid] = React.useState<string>("");
  const [appliedAt, setAppliedAt] = React.useState<Date | undefined>(() => new Date());
  const [status, setStatus] = React.useState("applied");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleScrape = async () => {
    const u = url.trim();
    if (!u) {
      toast.error("Enter the project URL first");
      return;
    }
    let urlHasBid = false;
    try {
      urlHasBid = Boolean(new URL(u).searchParams.get("bid"));
    } catch {
      toast.error("Invalid URL");
      return;
    }
    setScraping(true);
    try {
      const res = await fetch(`/api/scrape-mostaql?url=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error("Could not fetch details — you can enter them manually");
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.category) setCategory(data.category);
      if (data.budgetMin != null) setBudgetMin(String(data.budgetMin));
      if (data.budgetMax != null) setBudgetMax(String(data.budgetMax));
      if (data.budgetCurrency === "USD" || data.budgetCurrency === "SAR") {
        setCurrency(data.budgetCurrency);
      }
      if (data.description) setDescription(data.description);
      if (Array.isArray(data.skillsTags) && data.skillsTags.length > 0) {
        setSkillsTags(
          data.skillsTags.map((s: unknown) => String(s).trim()).filter(Boolean).join(", ")
        );
      }
      if (data.offerAmount != null && typeof data.offerAmount === "number") {
        setMyBid(String(data.offerAmount));
      }
      if (typeof data.offerText === "string" && data.offerText.trim()) {
        setNotes(data.offerText.trim());
      }
      const offerLoaded =
        typeof data.offerText === "string" && data.offerText.trim().length > 0;
      const priceLoaded =
        data.offerAmount != null && typeof data.offerAmount === "number";
      const priceEstimated = data.offerAmountIsEstimate === true;
      if (urlHasBid && offerLoaded && priceLoaded && !priceEstimated) {
        toast.success("Project and offer details loaded");
      } else if (urlHasBid && offerLoaded && priceLoaded && priceEstimated) {
        toast.success(
          "Project and proposal loaded — offer amount is the budget midpoint (correct it to your real bid). Optional: MOSTAQL_COOKIE in .env.local for exact scrape."
        );
      } else if (urlHasBid && offerLoaded) {
        toast.success(
          "Project and proposal text loaded — no price found (no budget range on page). Enter your bid manually."
        );
      } else if (urlHasBid) {
        toast.success("Project details loaded — offer text not detected; add notes manually if needed");
      } else {
        toast.success("Project details loaded");
      }
    } catch {
      toast.error("Could not fetch details — you can enter them manually");
    } finally {
      setScraping(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setCategory("");
    setServiceIds([]);
    setSkillsTags("");
    setBudgetMin("");
    setBudgetMax("");
    setCurrency("SAR");
    setDescription("");
    setMyBid("");
    setAppliedAt(new Date());
    setStatus("applied");
    setNotes("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    const bid = myBid.trim() ? parseFloat(myBid) : undefined;
    if (bid == null || isNaN(bid) || bid < 0) {
      toast.error("Your bid amount is required");
      return;
    }
    const appliedAtStr = appliedAt ? formatCalendarDate(appliedAt) : formatCalendarDate(new Date());
    setSaving(true);
    const result = await createProposal({
      title: t,
      url: url.trim() || undefined,
      platform: "mostaql",
      budgetMin: budgetMin.trim() ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax.trim() ? parseFloat(budgetMax) : null,
      currency,
      category: category.trim() || null,
      serviceIds,
      skillsTags: skillsTags.trim() || null,
      description: description.trim() || null,
      myBid: bid,
      status: status as "applied" | "viewed" | "shortlisted" | "won" | "lost" | "cancelled",
      appliedAt: appliedAtStr,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Proposal saved");
      handleOpenChange(false);
      onSuccess?.();
    } else {
      const err = result.error;
      if (typeof err === "object") {
        toast.error(Object.values(err).flat().join(" ") || "Save failed");
      } else {
        toast.error(err ?? "Save failed");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="ltr">
        <DialogHeader>
          <DialogTitle>New proposal</DialogTitle>
          <DialogDescription>Add a proposal from Mostaql or elsewhere.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Mostaql project URL</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://mostaql.com/projects/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                dir="ltr"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleScrape}
                disabled={scraping}
              >
                {scraping ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    Fetching…
                  </>
                ) : (
                  "Fetch details"
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Project title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title"
              required
            />
          </div>
          <ProposalServicesField
            options={serviceOptions}
            value={serviceIds}
            onChange={setServiceIds}
          />
          <div className="space-y-2">
            <Label>Platform category (optional)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="From Mostaql scrape — reference only"
            />
          </div>
          <div className="space-y-2">
            <Label>Client skill tags</Label>
            <Input
              value={skillsTags}
              onChange={(e) => setSkillsTags(e.target.value)}
              placeholder="Comma-separated, e.g. Keras, Python, SaaS"
            />
          </div>
          <div className="space-y-2">
            <Label>Project details</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope and requirements from the client"
              rows={5}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">
                Budget from ({currency})
                {currency === "SAR" ? <SarCurrencyIcon className="h-3 w-3 shrink-0" /> : null}
              </Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">
                Budget to ({currency})
                {currency === "SAR" ? <SarCurrencyIcon className="h-3 w-3 shrink-0" /> : null}
              </Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as "SAR" | "USD")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1">
              Your offer price ({currency}) *
              {currency === "SAR" ? <SarCurrencyIcon className="h-3 w-3 shrink-0" /> : null}
            </Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={myBid}
              onChange={(e) => setMyBid(e.target.value)}
              placeholder="Amount you proposed"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Applied date</Label>
            <DatePickerAr
              value={appliedAt}
              onChange={(d) => setAppliedAt(d)}
              placeholder="Pick a date"
              direction="ltr"
              locale={enUS}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Your written proposal</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cover letter / bid text you submitted on Mostaql"
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save proposal"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
