/**
 * Phase-2 style long-text retrieval without pgvector: keyword match on prose fields.
 * When embeddings exist later, merge here instead of or in addition to ilike snippets.
 */

import { and, desc, ilike, isNull, or } from "drizzle-orm";
import { db, proposals, projects, mostaqlProjects } from "@/lib/db";
import { cleanLikeToken } from "@/lib/ai-chat/retrieval-tools";

const SNIPPET_MAX = 480;

function clip(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= SNIPPET_MAX ? t : `${t.slice(0, SNIPPET_MAX)}…`;
}

export async function retrieveUnstructuredSnippets(tokens: string[], perSource = 4): Promise<string[]> {
  const cleaned = tokens.map((t) => cleanLikeToken(t)).filter((x): x is string => Boolean(x));
  if (!cleaned.length) return [];

  const blocks: string[] = [];

  for (const token of cleaned.slice(0, 4)) {
    const p = `%${token}%`;
    const propRows = await db
      .select({
        id: proposals.id,
        title: proposals.title,
        description: proposals.description,
        notes: proposals.notes,
        status: proposals.status,
      })
      .from(proposals)
      .where(
        or(
          ilike(proposals.title, p),
          ilike(proposals.description, p),
          ilike(proposals.notes, p)
        )
      )
      .orderBy(desc(proposals.appliedAt))
      .limit(perSource);

    for (const r of propRows) {
      blocks.push(
        `- Proposal ${r.id} "${r.title}" (${r.status}): ${clip(r.description) || clip(r.notes) || "(no body)"}`
      );
    }

    const projRows = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        notes: projects.notes,
        status: projects.status,
      })
      .from(projects)
      .where(
        and(
          isNull(projects.deletedAt),
          or(ilike(projects.name, p), ilike(projects.description, p), ilike(projects.notes, p))
        )
      )
      .orderBy(desc(projects.createdAt))
      .limit(perSource);

    for (const r of projRows) {
      blocks.push(
        `- Project ${r.id} "${r.name}" (${r.status}): ${clip(r.description) || clip(r.notes) || "(no notes)"}`
      );
    }

    const mqRows = await db
      .select({
        id: mostaqlProjects.id,
        title: mostaqlProjects.title,
        description: mostaqlProjects.description,
        url: mostaqlProjects.url,
      })
      .from(mostaqlProjects)
      .where(or(ilike(mostaqlProjects.title, p), ilike(mostaqlProjects.description, p)))
      .orderBy(desc(mostaqlProjects.scrapedAt))
      .limit(perSource);

    for (const r of mqRows) {
      blocks.push(`- Mostaql row ${r.id} "${r.title ?? ""}": ${clip(r.description)} (${r.url ?? ""})`);
    }
  }

  return blocks;
}
