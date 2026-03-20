import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [{ db }, { users }] = await Promise.all([
    import("@/lib/db").then((m) => ({ db: m.db })),
    import("@/lib/db/schema").then((m) => ({ users: m.users })),
  ]);
  const bcrypt = (await import("bcryptjs")).default;

  const adminPassword = "Amro2004r";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await db
    .insert(users)
    .values({
      name: "OnePixle Agency",
      email: "onepixleagency@agency.com",
      passwordHash,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "OnePixle Agency", passwordHash, role: "admin" },
    });
  console.log("✅ Admin user seeded: onepixleagency@agency.com / Amro2004r (admin)");
  process.exit(0);
}

main();
