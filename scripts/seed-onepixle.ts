/**
 * OnePixle migration seed — idempotent.
 * Creates / updates the OnePixle org, admin user, org_members, default settings,
 * then sets organization_id on all tenant rows where it is NULL.
 *
 *   npx tsx scripts/seed-onepixle.ts
 *
 * Requires `.env.local`:
 *   DATABASE_URL=...
 *   ADMIN_EMAIL=you@example.com
 *   ADMIN_PASSWORD_HASH=<bcrypt hash from bcrypt.hash(password, 12)>
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { sql, eq, and, isNull } from "drizzle-orm";

const SLUG = "onepixle";

type UpdateStat = { table: string; rowsUpdated: number };

/** Drizzle db client — keep loose typing for generic table/count helpers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countNullOrg(db: any, table: any, col: any): Promise<number> {
  const [row] = await db.select({ n: sql<string>`count(*)::text` }).from(table).where(isNull(col));
  return Number(row?.n ?? 0);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!adminEmail || !passwordHash) {
    console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD_HASH in .env.local");
    process.exit(1);
  }

  const [{ db }, schema] = await Promise.all([
    import("@/lib/db").then((m) => ({ db: m.db })),
    import("@/lib/db/schema"),
  ]);

  const {
    organizations,
    orgMembers,
    users,
    invitations,
    clients,
    projects,
    invoices,
    expenses,
    tasks,
    teamMembers,
    files,
    settings,
    services,
    proposals,
  } = schema;

  const stats: UpdateStat[] = [];
  let storageSyncedTotalBytes = 0;

  // 1) OnePixle organization
  const [existingOrg] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, SLUG))
    .limit(1);

  let orgId: string;
  if (existingOrg) {
    orgId = existingOrg.id;
    await db
      .update(organizations)
      .set({
        name: "OnePixle",
        plan: "internal",
        trialEndsAt: null,
        onboardingCompleted: true,
        onboardingStep: 1,
        aiUsageCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId));
  } else {
    const [inserted] = await db
      .insert(organizations)
      .values({
        name: "OnePixle",
        slug: SLUG,
        plan: "internal",
        trialEndsAt: null,
        features: {},
        onboardingCompleted: true,
        onboardingStep: 1,
        aiUsageCount: 0,
        storageUsedBytes: 0,
        updatedAt: new Date(),
      })
      .returning({ id: organizations.id });
    if (!inserted?.id) throw new Error("Failed to create OnePixle organization");
    orgId = inserted.id;
  }

  // 2) Admin user (idempotent on email)
  await db
    .insert(users)
    .values({
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", name: "Admin" },
    });

  const [adminUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
  if (!adminUser) throw new Error("Admin user missing after upsert");

  // 3) org_members (owner)
  const [existingMember] = await db
    .select({ id: orgMembers.id })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, adminUser.id), eq(orgMembers.organizationId, orgId)))
    .limit(1);
  if (!existingMember) {
    await db.insert(orgMembers).values({
      userId: adminUser.id,
      organizationId: orgId,
      role: "owner",
      joinedAt: new Date(),
    });
  }

  // 4) Default settings for OnePixle
  const alreadyLinked = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.organizationId, orgId))
    .limit(1);

  if (alreadyLinked.length === 0) {
    const nullOrgSettings = await db
      .select({ id: settings.id })
      .from(settings)
      .where(isNull(settings.organizationId));

    if (nullOrgSettings.length === 1) {
      await db
        .update(settings)
        .set({ organizationId: orgId })
        .where(eq(settings.id, nullOrgSettings[0].id));
    } else if (nullOrgSettings.length > 1) {
      await db
        .update(settings)
        .set({ organizationId: orgId })
        .where(eq(settings.id, nullOrgSettings[0].id));
      console.warn(
        `[seed-onepixle] Multiple settings rows with NULL organization_id (${nullOrgSettings.length}); updated only id=${nullOrgSettings[0].id}.`
      );
    } else {
      await db.insert(settings).values({ organizationId: orgId });
    }
  }

  // 5) Backfill organization_id (only NULL). invoice_items, phases, junction tables have no organization_id in schema.
  const updates: Array<{ label: string; run: () => Promise<number> }> = [
    {
      label: "clients",
      run: async () => {
        const n = await countNullOrg(db, clients, clients.organizationId);
        if (n) await db.update(clients).set({ organizationId: orgId }).where(isNull(clients.organizationId));
        return n;
      },
    },
    {
      label: "projects",
      run: async () => {
        const n = await countNullOrg(db, projects, projects.organizationId);
        if (n) await db.update(projects).set({ organizationId: orgId }).where(isNull(projects.organizationId));
        return n;
      },
    },
    {
      label: "proposals",
      run: async () => {
        const n = await countNullOrg(db, proposals, proposals.organizationId);
        if (n) await db.update(proposals).set({ organizationId: orgId }).where(isNull(proposals.organizationId));
        return n;
      },
    },
    {
      label: "tasks",
      run: async () => {
        const n = await countNullOrg(db, tasks, tasks.organizationId);
        if (n) await db.update(tasks).set({ organizationId: orgId }).where(isNull(tasks.organizationId));
        return n;
      },
    },
    {
      label: "invoices",
      run: async () => {
        const n = await countNullOrg(db, invoices, invoices.organizationId);
        if (n) await db.update(invoices).set({ organizationId: orgId }).where(isNull(invoices.organizationId));
        return n;
      },
    },
    {
      label: "expenses",
      run: async () => {
        const n = await countNullOrg(db, expenses, expenses.organizationId);
        if (n) await db.update(expenses).set({ organizationId: orgId }).where(isNull(expenses.organizationId));
        return n;
      },
    },
    {
      label: "files",
      run: async () => {
        const n = await countNullOrg(db, files, files.organizationId);
        if (n) await db.update(files).set({ organizationId: orgId }).where(isNull(files.organizationId));
        return n;
      },
    },
    {
      label: "team_members",
      run: async () => {
        const n = await countNullOrg(db, teamMembers, teamMembers.organizationId);
        if (n) await db.update(teamMembers).set({ organizationId: orgId }).where(isNull(teamMembers.organizationId));
        return n;
      },
    },
    {
      label: "services",
      run: async () => {
        const n = await countNullOrg(db, services, services.organizationId);
        if (n) await db.update(services).set({ organizationId: orgId }).where(isNull(services.organizationId));
        return n;
      },
    },
    {
      label: "invitations",
      run: async () => {
        const n = await countNullOrg(db, invitations, invitations.organizationId);
        if (n) await db.update(invitations).set({ organizationId: orgId }).where(isNull(invitations.organizationId));
        return n;
      },
    },
  ];

  for (const u of updates) {
    const rowsUpdated = await u.run();
    stats.push({ table: u.label, rowsUpdated });
  }

  const [agg] = await db
    .select({
      total: sql<number>`coalesce(sum(${files.sizeBytes}), 0)::double precision`.mapWith(Number),
    })
    .from(files)
    .where(eq(files.organizationId, orgId));
  storageSyncedTotalBytes = Math.floor(Number(agg?.total ?? 0));
  await db
    .update(organizations)
    .set({ storageUsedBytes: storageSyncedTotalBytes, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));

  console.log("\n✅ OnePixle seed committed.");
  console.log(
    `   OnePixle storage usage: ${(storageSyncedTotalBytes / (1024 * 1024)).toFixed(2)} MB (${storageSyncedTotalBytes} bytes)`
  );
  console.log("   Organization slug:", SLUG, "| admin:", adminEmail);
  console.log("\n--- Rows updated (WHERE organization_id IS NULL) ---");
  for (const s of stats) {
    console.log(`   ${s.table}: ${s.rowsUpdated}`);
  }

  const verify = await db.execute(sql`
    SELECT 'organizations' AS tbl, COUNT(*)::text AS total FROM organizations
    UNION ALL SELECT 'org_members', COUNT(*)::text FROM org_members
    UNION ALL SELECT 'clients (null org)', COUNT(*)::text FROM clients WHERE organization_id IS NULL
    UNION ALL SELECT 'projects (null org)', COUNT(*)::text FROM projects WHERE organization_id IS NULL
    UNION ALL SELECT 'invoices (null org)', COUNT(*)::text FROM invoices WHERE organization_id IS NULL
    UNION ALL SELECT 'tasks (null org)', COUNT(*)::text FROM tasks WHERE organization_id IS NULL
    UNION ALL SELECT 'expenses (null org)', COUNT(*)::text FROM expenses WHERE organization_id IS NULL
    UNION ALL SELECT 'team_members (null org)', COUNT(*)::text FROM team_members WHERE organization_id IS NULL
    UNION ALL SELECT 'files (null org)', COUNT(*)::text FROM files WHERE organization_id IS NULL
    UNION ALL SELECT 'settings (null org)', COUNT(*)::text FROM settings WHERE organization_id IS NULL
    UNION ALL SELECT 'proposals (null org)', COUNT(*)::text FROM proposals WHERE organization_id IS NULL
    UNION ALL SELECT 'services (null org)', COUNT(*)::text FROM services WHERE organization_id IS NULL
    UNION ALL SELECT 'invitations (null org)', COUNT(*)::text FROM invitations WHERE organization_id IS NULL
  `);

  console.log("\n--- Verification query ---");
  for (const row of verify.rows as { tbl: string; total: string }[]) {
    console.log(`   ${row.tbl}: ${row.total}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
