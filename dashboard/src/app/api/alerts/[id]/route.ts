import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Acknowledge an alert so it drops off the "needs attention" feed.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await prisma.alert.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "alert not found" }, { status: 404 });
  }

  const updated = await prisma.alert.update({
    where: { id: params.id },
    data: { acknowledged: true }
  });

  return NextResponse.json({ ok: true, acknowledged: updated.acknowledged });
}
