import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const foundUser = await getUserById(session.user.id);
    
    if (!foundUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ apiToken: foundUser.apiToken });
  } catch (error) {
    console.error("Failed to get API token:", error);
    return Response.json({ error: "Failed to get API token" }, { status: 500 });
  }
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Generate new UUID token using crypto
    const newToken = crypto.randomUUID();

    // Update user with new token
    await db
      .update(user)
      .set({ apiToken: newToken })
      .where(eq(user.id, session.user.id));

    return Response.json({ apiToken: newToken });
  } catch (error) {
    console.error("Failed to regenerate API token:", error);
    return Response.json({ error: "Failed to regenerate API token" }, { status: 500 });
  }
}
