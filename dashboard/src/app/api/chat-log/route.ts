import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkIngestKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The Slack agent posts each Q&A here so on-demand questions show up in
// the dashboard alongside the scheduled workflows.
//
// POST { "question": "...", "answer": "...", "toolUsed": "sales", "askedBy": "mahdi" }

export async function POST(req: NextRequest) {
  if (!checkIngestKey(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { question?: string; answer?: string; toolUsed?: string; askedBy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.question || !body.answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 });
  }

  const row = await prisma.chatQuery.create({
    data: {
      question: body.question,
      answer: body.answer,
      toolUsed: body.toolUsed ?? null,
      askedBy: body.askedBy ?? null
    }
  });

  return NextResponse.json({ ok: true, id: row.id });
}
