import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkIngestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// One endpoint every workflow posts to at the end of its run.
//
// POST /api/ingest
// Authorization: Bearer <INGEST_API_KEY>
// {
//   "workflow": "ad-performance-alerts",     // required, matches Workflow.key
//   "status": "flagged",                     // success | error | flagged
//   "summary": "2 campaigns flagged",        // one-liner for the activity feed
//   "payload": { ... },                      // optional raw data, kept for debugging
//   "alerts":   [{ severity, title, message, data }],
//   "digests":  [{ title, body, data }],
//   "actions":  [{ type, target, before, after, status, reason }],
//   "segments": [{ name, memberCount, criteria, briefTitle, briefBody }],
//   "contacts": [{ customerRef, channel, kind }]
// }
//
// Every array is optional — a workflow sends whichever shapes it produces.

interface IngestBody {
  workflow?: string;
  status?: string;
  summary?: string;
  payload?: unknown;
  alerts?: Array<{
    severity?: string;
    title?: string;
    message?: string;
    data?: unknown;
  }>;
  digests?: Array<{ title?: string; body?: string; data?: unknown }>;
  actions?: Array<{
    type?: string;
    target?: string;
    before?: unknown;
    after?: unknown;
    status?: string;
    reason?: string;
  }>;
  segments?: Array<{
    name?: string;
    memberCount?: number;
    criteria?: unknown;
    briefTitle?: string;
    briefBody?: string;
  }>;
  contacts?: Array<{ customerRef?: string; channel?: string; kind?: string }>;
}

const RUN_STATUSES = ["success", "error", "flagged"] as const;
const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
const ACTION_STATUSES = ["executed", "pending_approval", "rejected"] as const;

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

// Prisma won't accept a bare `null` for a `Json?` column — writing SQL NULL
// means omitting the field entirely, so map both null and undefined to
// undefined and let the column default to NULL.
function json(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : (value as Prisma.InputJsonValue);
}

export async function POST(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const key = body.workflow;
  if (!key) {
    return NextResponse.json({ error: "missing required field: workflow" }, { status: 400 });
  }

  const workflow = await prisma.workflow.findUnique({ where: { key } });
  if (!workflow) {
    return NextResponse.json(
      { error: `unknown workflow key "${key}" — add it to src/lib/workflows.ts and reseed` },
      { status: 404 }
    );
  }

  const run = await prisma.run.create({
    data: {
      workflowId: workflow.id,
      status: oneOf(body.status, RUN_STATUSES, "success"),
      summary: body.summary ?? null,
      payload: json(body.payload)
    }
  });

  const counts = { alerts: 0, digests: 0, actions: 0, segments: 0, contacts: 0 };

  for (const a of body.alerts ?? []) {
    await prisma.alert.create({
      data: {
        runId: run.id,
        workflowKey: key,
        severity: oneOf(a.severity, ALERT_SEVERITIES, "warning"),
        title: a.title ?? "Untitled alert",
        message: a.message ?? "",
        data: json(a.data)
      }
    });
    counts.alerts++;
  }

  for (const d of body.digests ?? []) {
    await prisma.digest.create({
      data: {
        runId: run.id,
        workflowKey: key,
        title: d.title ?? "Untitled digest",
        body: d.body ?? "",
        data: json(d.data)
      }
    });
    counts.digests++;
  }

  for (const act of body.actions ?? []) {
    await prisma.action.create({
      data: {
        runId: run.id,
        workflowKey: key,
        type: act.type ?? "unknown",
        target: act.target ?? null,
        before: json(act.before),
        after: json(act.after),
        status: oneOf(act.status, ACTION_STATUSES, "executed"),
        reason: act.reason ?? null
      }
    });
    counts.actions++;
  }

  for (const s of body.segments ?? []) {
    await prisma.segment.create({
      data: {
        runId: run.id,
        workflowKey: key,
        name: s.name ?? "Unnamed segment",
        memberCount: s.memberCount ?? 0,
        criteria: json(s.criteria),
        briefTitle: s.briefTitle ?? null,
        briefBody: s.briefBody ?? null
      }
    });
    counts.segments++;
  }

  for (const c of body.contacts ?? []) {
    if (!c.customerRef) continue;
    await prisma.contactLog.create({
      data: {
        workflowKey: key,
        customerRef: c.customerRef,
        channel: c.channel ?? "email",
        kind: c.kind ?? "unknown"
      }
    });
    counts.contacts++;
  }

  return NextResponse.json({ ok: true, runId: run.id, recorded: counts });
}
