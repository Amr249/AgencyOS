"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { createRecurringExpense, updateRecurringExpense } from "@/actions/recurring-expenses";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ExpenseCategory } from "@/actions/expenses";
import { enUS } from "date-fns/locale";

type RecurrenceFrequency = "weekly" | "monthly" | "quarterly" | "yearly";

export type RecurringExpenseFormShape = {
  id: string;
  title: string;
  amount: string;
  category: string;
  frequency: string;
  nextDueDate: string;
  notes?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  teamMemberId?: string | null;
  isBillable: boolean;
  isActive: boolean;
  vendorLogoUrl?: string | null;
};

interface NewRecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: RecurringExpenseFormShape | null;
  projects: { id: string; name: string; clientId: string }[];
  clients: { id: string; companyName: string | null }[];
  teamMembers: { id: string; name: string }[];
  onSuccess?: () => void;
}

const CATEGORIES = [
  { value: "software", label: "Software" },
  { value: "hosting", label: "Hosting" },
  { value: "marketing", label: "Marketing" },
  { value: "salaries", label: "Salaries" },
  { value: "equipment", label: "Equipment" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function NewRecurringExpenseDialog({
  open,
  onOpenChange,
  expense,
  projects,
  clients,
  teamMembers,
  onSuccess,
}: NewRecurringExpenseDialogProps) {
  const isEdit = !!expense;

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState<Date | undefined>(() => new Date());
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [isBillable, setIsBillable] = useState(false);
  const [vendorLogoUrl, setVendorLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setFrequency(expense.frequency);
      setNextDueDate(new Date(expense.nextDueDate + "T12:00:00"));
      setNotes(expense.notes || "");
      setProjectId(expense.projectId || null);
      setClientId(expense.clientId || null);
      setTeamMemberId(expense.teamMemberId || null);
      setIsBillable(expense.isBillable);
      setVendorLogoUrl(expense.vendorLogoUrl?.trim() ? expense.vendorLogoUrl : "");
    } else {
      setTitle("");
      setAmount("");
      setCategory("other");
      setFrequency("monthly");
      setNextDueDate(new Date());
      setNotes("");
      setProjectId(null);
      setClientId(null);
      setTeamMemberId(null);
      setIsBillable(false);
      setVendorLogoUrl("");
    }
  }, [expense, open]);

  useEffect(() => {
    if (projectId) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.clientId) {
        setClientId(project.clientId);
      }
    }
  }, [projectId, projects]);

  async function onVendorLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "recurring-vendor-logo");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.url) setVendorLogoUrl(data.url);
      else throw new Error("No URL returned");
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !amount || !nextDueDate) {
      toast.error("Please fill in required fields");
      return;
    }
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsSubmitting(true);

    const nextDueStr = nextDueDate.toISOString().split("T")[0]!;
    const trimmedNotes = notes.trim();
    const vendorLogoPayload =
      category === "software" && vendorLogoUrl.trim() ? vendorLogoUrl.trim() : null;

    const createPayload = {
      title: title.trim(),
      amount: amountNum,
      category: category as ExpenseCategory,
      frequency: frequency as RecurrenceFrequency,
      nextDueDate: nextDueStr,
      notes: trimmedNotes || undefined,
      projectId,
      clientId,
      teamMemberId,
      isBillable,
      vendorLogoUrl: vendorLogoPayload,
    };

    const result = isEdit
      ? await updateRecurringExpense({
          id: expense!.id,
          ...createPayload,
          notes: trimmedNotes ? trimmedNotes : null,
        })
      : await createRecurringExpense(createPayload);

    setIsSubmitting(false);

    if (result.ok) {
      toast.success(isEdit ? "Template updated" : "Template created");
      onSuccess?.();
    } else {
      toast.error("Failed to save template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recurring Expense" : "New Recurring Expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Adobe Creative Cloud"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (SAR) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  if (v !== "software") setVendorLogoUrl("");
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Next Due Date *</Label>
              <DatePickerAr
                value={nextDueDate}
                onChange={setNextDueDate}
                direction="ltr"
                locale={enUS}
              />
            </div>
          </div>

          {projects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(v) => setProjectId(v === "none" ? null : v)}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {clients.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={clientId || "none"}
                onValueChange={(v) => setClientId(v === "none" ? null : v)}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName ?? "Unnamed client"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {category === "software" && (
            <div className="space-y-2">
              <Label>Vendor logo</Label>
              <p className="text-muted-foreground text-xs">
                Optional image for the service (e.g. Vercel, Adobe). Shown in the recurring list.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0 rounded-md border">
                  <AvatarImage src={vendorLogoUrl || undefined} alt="" className="object-contain" />
                  <AvatarFallback className="rounded-md text-sm">
                    {(title.trim() || "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onVendorLogoChange(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {logoUploading ? "Uploading…" : vendorLogoUrl ? "Change image" : "Upload image"}
                  </Button>
                  {vendorLogoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setVendorLogoUrl("")}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {category === "salaries" && teamMembers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="teamMember">Team Member</Label>
              <Select
                value={teamMemberId || "none"}
                onValueChange={(v) => setTeamMemberId(v === "none" ? null : v)}
              >
                <SelectTrigger id="teamMember">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team member</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="billable"
              checked={isBillable}
              onCheckedChange={(c) => setIsBillable(c === true)}
            />
            <Label htmlFor="billable" className="text-sm font-normal cursor-pointer">
              Billable expense
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
