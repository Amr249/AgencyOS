"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { updateProjectNotes } from "@/actions/projects";
import { toast } from "sonner";

type ProjectNotesTabProps = {
  projectId: string;
  initialNotes: string | null;
};

export function ProjectNotesTab({ projectId, initialNotes }: ProjectNotesTabProps) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProjectNotes(projectId, notes.trim() || null);
    setSaving(false);
    if (result.ok) {
      toast.success("تم حفظ الملاحظات");
      router.refresh();
    } else {
      toast.error(result.error ?? "فشل حفظ الملاحظات");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ملاحظات</CardTitle>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "جاري الحفظ…" : "حفظ"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="ملاحظات خاصة بهذا المشروع..."
          className="min-h-[200px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
