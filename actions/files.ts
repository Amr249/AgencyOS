"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { files } from "@/lib/db";
import { getImageKitClient } from "@/lib/imagekit";

const createFileSchema = z.object({
  name: z.string().min(1),
  imagekitFileId: z.string().min(1),
  imagekitUrl: z.string().url(),
  filePath: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  sizeBytes: z.number().int().min(0).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

const getFilesSchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
}).refine((d) => d.clientId != null || d.projectId != null, {
  message: "Provide either clientId or projectId",
});

export type FileRow = {
  id: string;
  name: string;
  imagekitFileId: string;
  imagekitUrl: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  clientId: string | null;
  projectId: string | null;
  createdAt: Date;
};

export async function getFiles(params: { clientId?: string; projectId?: string }) {
  const parsed = getFilesSchema.safeParse(params);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid params: provide clientId or projectId", data: [] as FileRow[] };
  }
  const { clientId, projectId } = parsed.data;
  try {
    const conditions = [isNull(files.deletedAt)];
    if (clientId != null) conditions.push(eq(files.clientId, clientId));
    if (projectId != null) conditions.push(eq(files.projectId, projectId));

    const rows = await db
      .select({
        id: files.id,
        name: files.name,
        imagekitFileId: files.imagekitFileId,
        imagekitUrl: files.imagekitUrl,
        filePath: files.filePath,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        clientId: files.clientId,
        projectId: files.projectId,
        createdAt: files.createdAt,
      })
      .from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));

    const data: FileRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      imagekitFileId: r.imagekitFileId,
      imagekitUrl: r.imagekitUrl,
      filePath: r.filePath,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      clientId: r.clientId,
      projectId: r.projectId,
      createdAt: r.createdAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getFiles", e);
    return { ok: false as const, error: "Failed to load files", data: [] as FileRow[] };
  }
}

export async function createFile(data: z.infer<typeof createFileSchema>) {
  const parsed = createFileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(files)
      .values({
        name: d.name,
        imagekitFileId: d.imagekitFileId,
        imagekitUrl: d.imagekitUrl,
        filePath: d.filePath,
        mimeType: d.mimeType ?? null,
        sizeBytes: d.sizeBytes ?? null,
        clientId: d.clientId ?? null,
        projectId: d.projectId ?? null,
      })
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Failed to create file record"] } };

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);

    return { ok: true as const, data: row };
  } catch (e) {
    console.error("createFile", e);
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "Failed to create file"] } };
  }
}

export async function deleteFile(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid file id" };
  }

  const [row] = await db
    .select({ id: files.id, imagekitFileId: files.imagekitFileId, clientId: files.clientId, projectId: files.projectId })
    .from(files)
    .where(eq(files.id, parsed.data));

  if (!row) {
    return { ok: false as const, error: "File not found" };
  }

  const client = getImageKitClient();
  if (client && row.imagekitFileId) {
    try {
      await client.files.delete(row.imagekitFileId);
    } catch (e) {
      console.error("ImageKit delete error", e);
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Failed to delete file from storage",
      };
    }
  }

  await db.delete(files).where(eq(files.id, parsed.data));

  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/projects");
  if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
  if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);

  return { ok: true as const };
}
