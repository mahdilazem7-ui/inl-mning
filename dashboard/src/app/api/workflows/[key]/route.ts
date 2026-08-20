import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidSessionToken, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Saves the n8n Production Webhook URL for a workflow, so the "Run now"
// button has somewhere to call.

export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  if (!(await isValidSessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { n8nWebhookUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const url = body.n8nWebhookUrl?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("bad protocol");
      }
    } catch {
      return NextResponse.json({ error: "n8nWebhookUrl must be a valid http(s) URL" }, { status: 400 });
    }
  }

  const existing = await prisma.workflow.findUnique({ where: { key: params.key } });
  if (!existing) {
    return NextResponse.json({ error: `unknown workflow "${params.key}"` }, { status: 404 });
  }

  const updated = await prisma.workflow.update({
    where: { key: params.key },
    data: { n8nWebhookUrl: url || null }
  });

  return NextResponse.json({ ok: true, n8nWebhookUrl: updated.n8nWebhookUrl });
}
