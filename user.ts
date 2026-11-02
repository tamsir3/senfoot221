"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { follows, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function toggleFollow(targetType: "club" | "competition", targetId: number) {
  const user = await getCurrentUser();
  if (!user) return { error: "login" as const };
  const where = and(eq(follows.userId, user.id), eq(follows.targetType, targetType), eq(follows.targetId, targetId));
  const [existing] = await db.select().from(follows).where(where).limit(1);
  if (existing) await db.delete(follows).where(where);
  else await db.insert(follows).values({ userId: user.id, targetType, targetId }).onConflictDoNothing();
  revalidatePath("/compte");
  return { following: !existing };
}

export async function markAllRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
}
