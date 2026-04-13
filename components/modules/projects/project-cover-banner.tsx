"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateProject } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

type ProjectCoverBannerProps = {
  projectId: string;
  coverImageUrl: string | null;
};

export function ProjectCoverBanner({ projectId, coverImageUrl }: ProjectCoverBannerProps) {
  const router = useRouter();
  const [hover, setHover] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "project-cover");
      fd.set("projectId", projectId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        const result = await updateProject({ id: projectId, coverImageUrl: data.url });
        if (result.ok) {
          toast.success("Cover updated");
          router.refresh();
        } else {
          toast.error("Failed to save cover");
        }
      } else {
        toast.error(data.error ?? "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className={cn(
        "relative -mx-4 mt-2 w-full overflow-hidden rounded-xl bg-muted sm:-mx-6 sm:rounded-none",
        coverImageUrl ? "h-[200px]" : "h-[200px] border border-dashed border-muted-foreground/30"
      )}
      dir="ltr"
      lang="en"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverChange}
        disabled={uploading}
      />
      {coverImageUrl ? (
        <>
          <img
            src={coverImageUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-start justify-start gap-2 p-3 bg-black/40 transition-opacity",
              hover ? "opacity-100" : "opacity-0"
            )}
            dir="ltr"
            lang="en"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              {uploading ? "Uploading…" : "Edit Cover"}
            </Button>
            <p className="text-xs text-white/90">
              Recommended 1920×1080 (16:9) for best results
            </p>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? "Uploading…" : "+ Add Cover Image"}
          </Button>
        </div>
      )}
    </div>
  );
}
