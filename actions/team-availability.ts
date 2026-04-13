"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, asc, between, eq, inArray } from "drizzle-orm";
import { addDays, format, parseISO } from "date-fns";
import { db } from "@/lib/db";
import { teamAvailability, teamMembers } from "@/lib/db/schema";
import { getDbErrorKey, isDbConnectionError } from "@/lib/db-errors";
import {
  TEAM_AVAILABILITY_TYPES,
  availabilityDeductionHours,
  isUtcWeekday,
} from "@/lib/team-availability";

export type TeamAvailabilityRow = {
  id: string;
  teamMemberId: string;
  memberName: string;
  date: string;
  type: string;
  notes: string | null;
  createdAt: Date;
};

const markUnavailableSchema = z.object({
  teamMemberId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(TEAM_AVAILABILITY_TYPES),
  notes: z.string().max(2000).optional(),
});

const getAvailabilitySchema = z.object({
  teamMemberId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function markUnavailable(
  input: z.infer<typeof markUnavailableSchema>
): Promise<{ ok: true; data: { id: string } } | { ok: false; error: string }> {
  const parsed = markUnavailableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const [member] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, parsed.data.teamMemberId), eq(teamMembers.status, "active")))
      .limit(1);
    if (!member) return { ok: false, error: "Team member not found or inactive" };

    const [row] = await db
      .insert(teamAvailability)
      .values({
        teamMemberId: parsed.data.teamMemberId,
        date: parsed.data.date,
        type: parsed.data.type,
        notes: parsed.data.notes?.trim() || null,
      })
      .onConflictDoUpdate({
        target: [teamAvailability.teamMemberId, teamAvailability.date],
        set: {
          type: parsed.data.type,
          notes: parsed.data.notes?.trim() || null,
        },
      })
      .returning({ id: teamAvailability.id });

    if (!row) return { ok: false, error: "Could not save availability" };

    revalidatePath("/dashboard/workspace/workload");
    revalidatePath("/dashboard/workspace/availability");
    return { ok: true, data: row };
  } catch (e) {
    console.error("markUnavailable", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Could not save availability" };
  }
}

export async function markAvailable(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid id" };

  try {
    const removed = await db
      .delete(teamAvailability)
      .where(eq(teamAvailability.id, parsed.data))
      .returning({ id: teamAvailability.id });
    if (!removed.length) return { ok: false, error: "Entry not found" };

    revalidatePath("/dashboard/workspace/workload");
    revalidatePath("/dashboard/workspace/availability");
    return { ok: true };
  } catch (e) {
    console.error("markAvailable", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Could not remove availability" };
  }
}

export async function getAvailability(
  input: z.infer<typeof getAvailabilitySchema>
): Promise<{ ok: true; data: TeamAvailabilityRow[] } | { ok: false; error: string }> {
  const parsed = getAvailabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid range" };

  const { teamMemberId, dateFrom, dateTo } = parsed.data;
  const range =
    dateFrom <= dateTo ? { from: dateFrom, to: dateTo } : { from: dateTo, to: dateFrom };

  try {
    const conditions = [
      between(teamAvailability.date, range.from, range.to),
      eq(teamMembers.status, "active"),
    ];
    if (teamMemberId) conditions.push(eq(teamAvailability.teamMemberId, teamMemberId));

    const rows = await db
      .select({
        id: teamAvailability.id,
        teamMemberId: teamAvailability.teamMemberId,
        memberName: teamMembers.name,
        date: teamAvailability.date,
        type: teamAvailability.type,
        notes: teamAvailability.notes,
        createdAt: teamAvailability.createdAt,
      })
      .from(teamAvailability)
      .innerJoin(teamMembers, eq(teamAvailability.teamMemberId, teamMembers.id))
      .where(and(...conditions))
      .orderBy(asc(teamAvailability.date), asc(teamMembers.name));

    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        teamMemberId: r.teamMemberId,
        memberName: r.memberName,
        date: r.date,
        type: r.type,
        notes: r.notes,
        createdAt: r.createdAt,
      })),
    };
  } catch (e) {
    console.error("getAvailability", e);
    if (isDbConnectionError(e)) return { ok: false, error: getDbErrorKey(e) };
    return { ok: false, error: "Could not load availability" };
  }
}

/** All team availability rows from `weekStart` through `weekStart + 6 days` (inclusive). */
export async function getTeamAvailabilityForWeek(
  weekStart: string
): Promise<{ ok: true; data: TeamAvailabilityRow[] } | { ok: false; error: string }> {
  const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(weekStart);
  if (!parsed.success) return { ok: false, error: "Invalid week start" };

  const end = format(addDays(parseISO(parsed.data), 6), "yyyy-MM-dd");
  return getAvailability({ dateFrom: parsed.data, dateTo: end });
}

/**
 * Sum of capacity deductions per member for dates in [dateFrom, dateTo] (inclusive),
 * counting only Mon–Fri UTC.
 */
export async function getAvailabilityDeductionsByMember(
  memberIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!memberIds.length) return map;

  const range =
    dateFrom <= dateTo ? { from: dateFrom, to: dateTo } : { from: dateTo, to: dateFrom };

  const rows = await db
    .select({
      teamMemberId: teamAvailability.teamMemberId,
      date: teamAvailability.date,
      type: teamAvailability.type,
    })
    .from(teamAvailability)
    .where(
      and(
        inArray(teamAvailability.teamMemberId, memberIds),
        between(teamAvailability.date, range.from, range.to)
      )
    );

  for (const r of rows) {
    if (!isUtcWeekday(r.date)) continue;
    const h = availabilityDeductionHours(r.type);
    map.set(r.teamMemberId, (map.get(r.teamMemberId) ?? 0) + h);
  }

  return map;
}
