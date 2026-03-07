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

const STATUS_OPTIONS = [
  { value: "applied", label: "مُقدَّم" },
  { value: "viewed", label: "تمت المشاهدة" },
  { value: "shortlisted", label: "في القائمة المختصرة" },
  { value: "won", label: "تم الفوز" },
  { value: "lost", label: "لم يُكسب" },
  { value: "cancelled", label: "ملغي" },
];

type ProposalRow = {
  id: string;
  title: string;
  url: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  category: string | null;
  description: string | null;
  myBid: string | null;
  status: string;
  appliedAt: string;
  notes: string | null;
};

type EditProposalDialogProps = {
  proposal: ProposalRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditProposalDialog({
  proposal,
  open,
  onOpenChange,
  onSuccess,
}: EditProposalDialogProps) {
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [myBid, setMyBid] = React.useState("");
  const [appliedAt, setAppliedAt] = React.useState<Date | undefined>();
  const [status, setStatus] = React.useState("applied");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (proposal && open) {
      setTitle(proposal.title);
      setUrl(proposal.url ?? "");
      setCategory(proposal.category ?? "");
      setBudgetMin(proposal.budgetMin ?? "");
      setBudgetMax(proposal.budgetMax ?? "");
      setDescription(proposal.description ?? "");
      setMyBid(proposal.myBid ?? "");
      setAppliedAt(proposal.appliedAt ? new Date(proposal.appliedAt) : undefined);
      setStatus(proposal.status);
      setNotes(proposal.notes ?? "");
    }
  }, [proposal, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposal) return;
    const t = title.trim();
    if (!t) {
      toast.error("العنوان مطلوب");
      return;
    }
    const bid = myBid.trim() ? parseFloat(myBid) : null;
    if (bid != null && (isNaN(bid) || bid < 0)) {
      toast.error("عرضي يجب أن يكون رقماً موجباً");
      return;
    }
    const appliedAtStr = appliedAt ? appliedAt.toISOString().slice(0, 10) : proposal.appliedAt;
    setSaving(true);
    const result = await updateProposal({
      id: proposal.id,
      title: t,
      url: url.trim() || undefined,
      budgetMin: budgetMin.trim() ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax.trim() ? parseFloat(budgetMax) : null,
      category: category.trim() || null,
      description: description.trim() || null,
      myBid: bid ?? undefined,
      status: status as "applied" | "viewed" | "shortlisted" | "won" | "lost" | "cancelled",
      appliedAt: appliedAtStr,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("تم تحديث العرض");
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast.error(typeof result.error === "string" ? result.error : "فشل التحديث");
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل العرض</DialogTitle>
          <DialogDescription>تعديل بيانات العرض</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>رابط المشروع</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://mostaql.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>عنوان المشروع *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>الفئة</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>الميزانية من (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الميزانية إلى (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>عرضي (ر.س)</Label>
            <Input
              type="number"
              min={0}
              value={myBid}
              onChange={(e) => setMyBid(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>تاريخ التقديم</Label>
            <DatePickerAr
              value={appliedAt}
              onChange={(d) => setAppliedAt(d)}
            />
          </div>
          <div className="space-y-2">
            <Label>الحالة</Label>
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
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ التعديلات"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
