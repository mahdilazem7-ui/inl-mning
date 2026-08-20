import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIngestKey, isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The kill switch the autonomous workflows check before doing anything
// that spends money or changes a price. Replaces the "flip a cell in a
// Google Sheet" approach with something the dashboard can toggle.
//
// Read (from n8n, before acting):
//   GET /api/kill-switch?workflow=dynamic-pricing-engine
//   -> { "enabled": true, "monitorOnly": true, "safeToAct": false }
//
// `safeToAct` is the single field an n8n IF node should branch on: it is
// true only when the workflow is enabled AND not in monitor-only mode.
//
// Write (from the dashboard UI, session-cookie auth):
//   POST { "workflow": "dynamic-pricing-engine", "monitorOnly": false }

async function authorized(req: NextRequest): Promise<boolean> {
  if (checkIngestKey(req.headers.get("authorization"))) return true;
  return isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("workflow");
  if (!key) {
    return NextResponse.json({ error: "missing required param: workflow" }, { status: 400 });
  }

  const workflow = await prisma.workflow.findUnique({ where: { key } });
  if (!workflow) {
    return NextResponse.json({ error: `unknown workflow key "${key}"` }, { status: 404 });
  }

  return NextResponse.json({
    workflow: workflow.key,
    enabled: workflow.enabled,
    monitorOnly: workflow.monitorOnly,
    safeToAct: workflow.enabled && !workflow.monitorOnly
  });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { workflow?: string; enabled?: boolean; monitorOnly?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.workflow) {
    return NextResponse.json({ error: "missing required field: workflow" }, { status: 400 });
  }

  const existing = await prisma.workflow.findUnique({ where: { key: body.workflow } });
  if (!existing) {
    return NextResponse.json({ error: `unknown workflow key "${body.workflow}"` }, { status: 404 });
  }

  const updated = await prisma.workflow.update({
    where: { key: body.workflow },
    data: {
      ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
      ...(typeof body.monitorOnly === "boolean" ? { monitorOnly: body.monitorOnly } : {})
    }
  });

  return NextResponse.json({
    workflow: updated.key,
    enabled: updated.enabled,
    monitorOnly: updated.monitorOnly,
    safeToAct: updated.enabled && !updated.monitorOnly
  });
}
