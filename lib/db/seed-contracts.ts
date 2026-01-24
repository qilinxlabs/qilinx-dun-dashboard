import { config } from "dotenv";
import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });

const runSeed = async () => {
  if (!process.env.POSTGRES_URL) {
    console.log("⏭️  POSTGRES_URL not defined, skipping seed");
    process.exit(0);
  }

  const sql = postgres(process.env.POSTGRES_URL);

  console.log("⏳ Running contract templates seed...");

  try {
    const seedSql = readFileSync(
      join(process.cwd(), "lib/db/migrations/0013_seed-contract-templates.sql"),
      "utf-8"
    );

    await sql.unsafe(seedSql);
    console.log("✅ Contract templates seeded successfully");
  } catch (err: any) {
    if (err.code === "23505") {
      console.log("ℹ️  Templates already exist, skipping seed");
    } else {
      throw err;
    }
  }

  await sql.end();
  process.exit(0);
};

runSeed().catch((err) => {
  console.error("❌ Seed failed");
  console.error(err);
  process.exit(1);
});
