import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Manual "Run now" button. Calls the workflow's n8n Webhook URL, which you
// set per-workflow on the /workflows page. Requires a logged-in session —
// this one is deliberately NOT available via the ingest API key, since a
// leaked workflow token shouldn't be able to kick off ad spend.

export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  if (!(await isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const workflow = await prisma.workflow.findUnique({ where: { key: params.key } });
  if (!workflow) {
    return NextResponse.json({ error: `unknown workflow "${params.key}"` }, { status: 404 });
  }

  if (!workflow.n8nWebhookUrl) {
    return NextResponse.json(
      {
        error:
          "No n8n webhook URL set for this workflow. Add a Webhook trigger node in n8n, then paste its Production URL on the Workflows page."
      },
      { status: 400 }
    );
  }

  if (!workflow.enabled) {
    return NextResponse.json({ error: "workflow is disabled" }, { status: 409 });
  }

  try {
    const res = await fetch(workflow.n8nWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ triggeredBy: "dashboard", at: new Date().toISOString() }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n returned ${res.status}`, detail: (await res.text()).slice(0, 500) },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, triggered: workflow.key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `could not reach n8n: ${message}` }, { status: 502 });
  }
}
