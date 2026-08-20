import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIngestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The read side of the shared data layer — how one workflow sees what the
// others have learned. This is what turns 16 isolated automations into a
// system.
//
//   GET /api/context?workflow=ai-chief-of-staff-briefing&days=1
//
// Returns recent alerts, digests, actions, and segments from ALL other
// workflows in the window. Drop the result into a Claude prompt and the
// briefing can now say "ads flagged 2 campaigns and pricing marked down 4
// variants yesterday" instead of only seeing its own three API pulls.
//
// Concretely, this is what each consumer gets out of it:
//   - Chief of Staff briefing: ad alerts + price changes + segment counts
//   - Trend-to-Drop: what the trend monitor found this week
//   - Self-writing ad loop: which A/B tests actually won
//   - Slack agent: everything, as recall for on-demand questions

export async function GET(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const requester = params.get("workflow");
  const days = Number(params.get("days") ?? 7);

  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ error: "days must be a positive number" }, { status: 400 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Exclude the caller's own output so a workflow doesn't feed on itself.
  const notMine = requester ? { workflowKey: { not: requester } } : {};

  const [alerts, digests, actions, segments, contactCount] = await Promise.all([
    prisma.alert.findMany({
      where: { createdAt: { gte: since }, acknowledged: false, ...notMine },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        workflowKey: true,
        severity: true,
        title: true,
        message: true,
        createdAt: true
      }
    }),
    prisma.digest.findMany({
      where: { createdAt: { gte: since }, ...notMine },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { workflowKey: true, title: true, body: true, createdAt: true }
    }),
    prisma.action.findMany({
      where: { createdAt: { gte: since }, ...notMine },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        workflowKey: true,
        type: true,
        target: true,
        before: true,
        after: true,
        status: true,
        reason: true,
        createdAt: true
      }
    }),
    prisma.segment.findMany({
      where: { createdAt: { gte: since }, ...notMine },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { workflowKey: true, name: true, memberCount: true, createdAt: true }
    }),
    prisma.contactLog.count({ where: { createdAt: { gte: since } } })
  ]);

  return NextResponse.json({
    windowDays: days,
    requestedBy: requester ?? null,
    alerts,
    digests,
    actions,
    segments,
    customersContactedInWindow: contactCount
  });
}
