"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, isNull, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { files } from "@/lib/db";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
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
  invoiceId: z.string().uuid().nullable().optional(),
  expenseId: z.string().uuid().nullable().optional(),
});

const getFilesSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    expenseId: z.string().uuid().optional(),
  })
  .refine(
    (d) =>
      d.clientId != null || d.projectId != null || d.invoiceId != null || d.expenseId != null,
    {
      message: "Provide clientId, projectId, invoiceId, or expenseId",
    }
  );

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
  invoiceId: string | null;
  expenseId: string | null;
  createdAt: Date;
};

export async function getFiles(params: {
  clientId?: string;
  projectId?: string;
  invoiceId?: string;
  expenseId?: string;
}) {
  const parsed = getFilesSchema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Invalid params: provide clientId, projectId, invoiceId, or expenseId",
      data: [] as FileRow[],
    };
  }
  const { clientId, projectId, invoiceId, expenseId } = parsed.data;
  try {
    const conditions = [isNull(files.deletedAt)];
    if (clientId != null) conditions.push(eq(files.clientId, clientId));
    if (projectId != null) conditions.push(eq(files.projectId, projectId));
    if (invoiceId != null) conditions.push(eq(files.invoiceId, invoiceId));
    if (expenseId != null) conditions.push(eq(files.expenseId, expenseId));

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
        invoiceId: files.invoiceId,
        expenseId: files.expenseId,
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
      invoiceId: r.invoiceId,
      expenseId: r.expenseId,
      createdAt: r.createdAt,
    }));

    return { ok: true as const, data };
  } catch (e) {
    console.error("getFiles", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: getDbErrorKey(e), data: [] as FileRow[] };
    }
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
        invoiceId: d.invoiceId ?? null,
        expenseId: d.expenseId ?? null,
      })
      .returning();

    if (!row) return { ok: false as const, error: { _form: ["Failed to create file record"] } };

    const data: FileRow = {
      id: row.id,
      name: row.name,
      imagekitFileId: row.imagekitFileId,
      imagekitUrl: row.imagekitUrl,
      filePath: row.filePath,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      clientId: row.clientId,
      projectId: row.projectId,
      invoiceId: row.invoiceId ?? null,
      expenseId: row.expenseId ?? null,
      createdAt: row.createdAt,
    };

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/expenses");
    if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
    if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
    if (row.invoiceId) revalidatePath(`/dashboard/invoices/${row.invoiceId}`);
    if (row.expenseId) revalidatePath(`/dashboard/expenses/${row.expenseId}`);

    return { ok: true as const, data };
  } catch (e) {
    console.error("createFile", e);
    if (isDbConnectionError(e)) {
      return { ok: false as const, error: { _form: [getDbErrorKey(e)] } };
    }
    return { ok: false as const, error: { _form: [e instanceof Error ? e.message : "حدث خطأ غير متوقع."] } };
  }
}

export async function deleteFile(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid file id" };
  }

  const [row] = await db
    .select({
      id: files.id,
      imagekitFileId: files.imagekitFileId,
      clientId: files.clientId,
      projectId: files.projectId,
      invoiceId: files.invoiceId,
      expenseId: files.expenseId,
    })
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
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/expenses");
  if (row.clientId) revalidatePath(`/dashboard/clients/${row.clientId}`);
  if (row.projectId) revalidatePath(`/dashboard/projects/${row.projectId}`);
  if (row.invoiceId) revalidatePath(`/dashboard/invoices/${row.invoiceId}`);
  if (row.expenseId) revalidatePath(`/dashboard/expenses/${row.expenseId}`);

  return { ok: true as const };
}
