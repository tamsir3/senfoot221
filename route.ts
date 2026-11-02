import { desc, eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ unread: 0, items: [] }, { status: 401 });
  const [items, [{ c }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.id)).limit(15),
    db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), eq(notifications.read, false))),
  ]);
  return Response.json({ unread: c, items }, { headers: { "Cache-Control": "no-store" } });
}
