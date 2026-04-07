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

const STATUS_OPTIONS = [
  { value: "applied", label: "مُقدَّم" },
  { value: "viewed", label: "تمت المشاهدة" },
  { value: "shortlisted", label: "في القائمة المختصرة" },
  { value: "won", label: "تم الفوز" },
  { value: "lost", label: "لم يُكسب" },
  { value: "cancelled", label: "ملغي" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type NewProposalDialogProps = {
  trigger: React.ReactNode;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function NewProposalDialog({
  trigger,
  onSuccess,
  open: openProp,
  onOpenChange: setOpenProp,
}: NewProposalDialogProps) {
  const [openLocal, setOpenLocal] = React.useState(false);
  const open = openProp ?? openLocal;
  const setOpen = setOpenProp ?? setOpenLocal;

  const [url, setUrl] = React.useState("");
  const [scraping, setScraping] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState<string>("");
  const [budgetMax, setBudgetMax] = React.useState<string>("");
  const [description, setDescription] = React.useState("");
  const [myBid, setMyBid] = React.useState<string>("");
  const [appliedAt, setAppliedAt] = React.useState<Date | undefined>(() => new Date());
  const [status, setStatus] = React.useState("applied");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleScrape = async () => {
    const u = url.trim();
    if (!u) {
      toast.error("أدخل رابط المشروع أولاً");
      return;
    }
    setScraping(true);
    try {
      const res = await fetch(`/api/scrape-mostaql?url=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error("تعذر جلب البيانات — يمكنك الإدخال يدوياً");
        return;
      }
      if (data.title) setTitle(data.title);
      if (data.category) setCategory(data.category);
      if (data.budgetMin != null) setBudgetMin(String(data.budgetMin));
      if (data.budgetMax != null) setBudgetMax(String(data.budgetMax));
      if (data.description) setDescription(data.description);
      toast.success("تم جلب بيانات المشروع بنجاح ✨");
    } catch {
      toast.error("تعذر جلب البيانات — يمكنك الإدخال يدوياً");
    } finally {
      setScraping(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setCategory("");
    setBudgetMin("");
    setBudgetMax("");
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
      toast.error("العنوان مطلوب");
      return;
    }
    const bid = myBid.trim() ? parseFloat(myBid) : undefined;
    if (bid == null || isNaN(bid) || bid < 0) {
      toast.error("عرضي (المبلغ) مطلوب");
      return;
    }
    const appliedAtStr = appliedAt ? appliedAt.toISOString().slice(0, 10) : todayISO();
    setSaving(true);
    const result = await createProposal({
      title: t,
      url: url.trim() || undefined,
      platform: "mostaql",
      budgetMin: budgetMin.trim() ? parseFloat(budgetMin) : null,
      budgetMax: budgetMax.trim() ? parseFloat(budgetMax) : null,
      currency: "SAR",
      category: category.trim() || null,
      description: description.trim() || null,
      myBid: bid,
      status: status as "applied" | "viewed" | "shortlisted" | "won" | "lost" | "cancelled",
      appliedAt: appliedAtStr,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("تم حفظ العرض");
      handleOpenChange(false);
      onSuccess?.();
    } else {
      const err = result.error;
      if (typeof err === "object") {
        toast.error(Object.values(err).flat().join(" ") || "فشل الحفظ");
      } else {
        toast.error(err ?? "فشل الحفظ");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة عرض</DialogTitle>
          <DialogDescription>عرض جديد من مستقل أو غيره</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. URL + scrape */}
          <div className="space-y-2">
            <Label>رابط المشروع على مستقل</Label>
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
                    جارٍ الجلب...
                  </>
                ) : (
                  "✨ جلب البيانات"
                )}
              </Button>
            </div>
          </div>
          {/* 2. Title */}
          <div className="space-y-2">
            <Label>عنوان المشروع *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المشروع"
              required
            />
          </div>
          {/* 3. Category */}
          <div className="space-y-2">
            <Label>الفئة</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="مثال: تطوير مواقع"
            />
          </div>
          {/* 4. Description (optional, auto-filled from scrape) */}
          <div className="space-y-2">
            <Label>الوصف (اختياري)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف المشروع"
              rows={3}
            />
          </div>
          {/* 5. Budget min / max */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1">
                الميزانية من
                <SarCurrencyIcon className="h-3 w-3 shrink-0" />
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
                الميزانية إلى
                <SarCurrencyIcon className="h-3 w-3 shrink-0" />
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
          </div>
          {/* 6. My bid */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1">
              عرضي *
              <SarCurrencyIcon className="h-3 w-3 shrink-0" />
            </Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={myBid}
              onChange={(e) => setMyBid(e.target.value)}
              placeholder="المبلغ الذي قدمته"
              required
            />
          </div>
          {/* 7. Applied at */}
          <div className="space-y-2">
            <Label>تاريخ التقديم</Label>
            <DatePickerAr
              value={appliedAt}
              onChange={(d) => setAppliedAt(d)}
              placeholder="اختر تاريخًا"
            />
          </div>
          {/* 8. Status */}
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
          {/* 9. Notes */}
          <div className="space-y-2">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ العرض"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
