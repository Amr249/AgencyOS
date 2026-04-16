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
  readOnly?: boolean;
};

export function ProjectNotesTab({ projectId, initialNotes, readOnly = false }: ProjectNotesTabProps) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    const result = await updateProjectNotes(projectId, notes.trim() || null);
    setSaving(false);
    if (result.ok) {
      toast.success("Notes saved");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to save notes");
    }
  };

  return (
    <Card dir="ltr" lang="en">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notes</CardTitle>
        {!readOnly ? (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add your notes here…"
          className="min-h-[200px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      </CardContent>
    </Card>
  );
}
