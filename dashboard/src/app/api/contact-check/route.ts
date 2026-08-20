import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIngestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Cross-workflow dedup gate. Four workflows message customers directly
// (abandoned cart, back-in-stock, win-back, UGC ask) and each currently
// keeps its own private "already contacted" log — which means one customer
// can get hit by three of them in the same week.
//
// Call this BEFORE sending, from an IF node:
//   GET /api/contact-check?customerRef=+15551234567&kind=winback&withinDays=14
//   -> { "contacted": false, "safeToSend": true, "lastContactedAt": null }
//
// `kind` is optional — omit it to check whether the customer has been
// messaged by ANY workflow in the window, which is the setting you want
// for global message fatigue.

export async function GET(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const customerRef = params.get("customerRef");
  const kind = params.get("kind");
  const withinDays = Number(params.get("withinDays") ?? 14);

  if (!customerRef) {
    return NextResponse.json({ error: "missing required param: customerRef" }, { status: 400 });
  }
  if (!Number.isFinite(withinDays) || withinDays < 0) {
    return NextResponse.json({ error: "withinDays must be a non-negative number" }, { status: 400 });
  }

  const since = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);

  const last = await prisma.contactLog.findFirst({
    where: {
      customerRef,
      createdAt: { gte: since },
      ...(kind ? { kind } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({
    contacted: Boolean(last),
    safeToSend: !last,
    lastContactedAt: last?.createdAt ?? null,
    lastContactedBy: last?.workflowKey ?? null,
    lastKind: last?.kind ?? null,
    windowDays: withinDays
  });
}
