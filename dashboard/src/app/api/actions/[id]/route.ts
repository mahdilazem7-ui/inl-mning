import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Approve or reject a pending action (e.g. a price change the pricing
// engine considered too large to apply on its own).
//
// Approving here marks the record approved; a follow-up n8n workflow polls
// GET /api/actions?status=executed&type=price_change to apply them, so the
// dashboard never talks to Shopify directly.

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  const existing = await prisma.action.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "action not found" }, { status: 404 });
  }
  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { error: `action is already ${existing.status}, nothing to decide` },
      { status: 409 }
    );
  }

  const updated = await prisma.action.update({
    where: { id: params.id },
    data: { status: body.decision === "approve" ? "executed" : "rejected" }
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
