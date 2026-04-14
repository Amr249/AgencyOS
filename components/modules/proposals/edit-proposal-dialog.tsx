"use client";

import * as React from "react";
import { updateProposal } from "@/actions/proposals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { formatCalendarDate, parseCalendarDate } from "@/lib/calendar-date";

const STATUS_OPTIONS = [
  { value: "applied", label: PROPOSAL_STATUS_LABELS.applied },
  { value: "viewed", label: PROPOSAL_STATUS_LABELS.viewed },
  { value: "shortlisted", label: PROPOSAL_STATUS_LABELS.shortlisted },
  { value: "won", label: PROPOSAL_STATUS_LABELS.won },
  { value: "lost", label: PROPOSAL_STATUS_LABELS.lost },
  { value: "cancelled", label: PROPOSAL_STATUS_LABELS.cancelled },
];

type ProposalRow = {
  id: string;
  title: string;
  url: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  currency: string;
  category: string | null;
  skillsTags: string | null;
  description: string | null;
  myBid: string | null;
  status: string;
  appliedAt: string;
  notes: string | null;
  services: { id: string; name: string }[];
};

type EditProposalDialogProps = {
  proposal: ProposalRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  serviceOptions?: { id: string; name: string }[];
};

export function EditProposalDialog({
  proposal,
  open,
  onOpenChange,
  onSuccess,
  serviceOptions = [],
}: EditProposalDialogProps) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [serviceIds, setServiceIds] = React.useState<string[]>([]);
  const [skillsTags, setSkillsTags] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [currency, setCurrency] = React.useState<"SAR" | "USD">("SAR");
  const [description, setDescription] = React.useState("");
  const [myBid, setMyBid] = React.useState("");
  const [appliedAt, setAppliedAt] = React.useState<Date | undefined>();
  const [status, setStatus] = React.useState("applied");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const mergedServiceOptions = React.useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const s of serviceOptions) byId.set(s.id, s);
    for (const s of proposal?.services ?? []) {
      if (!byId.has(s.id)) {
        byId.set(s.id, { id: s.id, name: `${s.name} (inactive)` });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [serviceOptions, proposal?.services]);

  React.useEffect(() => {
    if (proposal && open) {
      setTitle(proposal.title);
      setUrl(proposal.url ?? "");
      setCategory(proposal.category ?? "");
      setSkillsTags(proposal.skillsTags ?? "");
      setBudgetMin(proposal.budgetMin ?? "");
      setBudgetMax(proposal.budgetMax ?? "");
      setCurrency(proposal.currency === "USD" ? "USD" : "SAR");
      setDescription(proposal.description ?? "");
      setMyBid(proposal.myBid ?? "");
      setAppliedAt(proposal.appliedAt ? parseCalendarDate(proposal.appliedAt) : undefined);
      setStatus(proposal.status);
      setNotes(proposal.notes ?? "");
      setServiceIds(proposal.services.map((s) => s.id));
    }
  }, [proposal, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal) return;
    const t = title.trim();
    if (!t) {
      toast.error("Title is required");
      return;
    }
    const bid = myBid.trim() ? parseFloat(myBid) : null;
    if (bid != null && (isNaN(bid) || bid < 0)) {
      toast.error("Your bid must be a positive number");
      return;
    }
    const appliedAtStr = appliedAt ? formatCalendarDate(appliedAt) : proposal.appliedAt;
    setSaving(true);
    const result = await updateProposal({
      id: proposal.id,
      title: t,
      url: url.trim() || undefined,
      budgetMin: budgetMin.trim() ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax.trim() ? parseFloat(budgetMax) : null,
      currency,
      category: category.trim() || null,
      serviceIds,
      skillsTags: skillsTags.trim() || null,
      description: description.trim() || null,
      myBid: bid ?? undefined,
      status: status as "applied" | "viewed" | "shortlisted" | "won" | "lost" | "cancelled",
      appliedAt: appliedAtStr,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Proposal updated");
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(typeof result.error === "string" ? result.error : "Update failed");
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="ltr">
        <DialogHeader>
          <DialogTitle>Edit proposal</DialogTitle>
          <DialogDescription>Update proposal details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Project URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://mostaql.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Project title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <ProposalServicesField
            options={mergedServiceOptions}
            value={serviceIds}
            onChange={setServiceIds}
          />
          <div className="space-y-2">
            <Label>Platform category (optional)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="From Mostaql — reference only"
            />
          </div>
          <div className="space-y-2">
            <Label>Client skill tags</Label>
            <Input
              value={skillsTags}
              onChange={(e) => setSkillsTags(e.target.value)}
              placeholder="Comma-separated"
            />
          </div>
          <div className="space-y-2">
            <Label>Project details</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Scope and requirements from the client"
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
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
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
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
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
              Your offer price ({currency})
              {currency === "SAR" ? <SarCurrencyIcon className="h-3 w-3 shrink-0" /> : null}
            </Label>
            <Input
              type="number"
              min={0}
              value={myBid}
              onChange={(e) => setMyBid(e.target.value)}
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
              rows={6}
              placeholder="Cover letter / bid text"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
