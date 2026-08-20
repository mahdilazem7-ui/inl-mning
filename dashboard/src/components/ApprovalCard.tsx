"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalCard({
  id,
  type,
  target,
  reason,
  before,
  after,
  workflowKey,
  createdAt
}: {
  id: string;
  type: string;
  target: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  workflowKey: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-zinc-100">
            {type} <span className="text-zinc-500">·</span>{" "}
            <span className="text-zinc-300">{target}</span>
          </h3>
          {reason && <p className="mt-1 text-sm text-zinc-400">{reason}</p>}

          {(before || after) && (
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="rounded bg-black/40 px-2 py-1 text-zinc-400 line-through">
                {formatValue(before)}
              </span>
              <span className="text-zinc-600">→</span>
              <span className="rounded bg-accent/10 px-2 py-1 text-accent">
                {formatValue(after)}
              </span>
            </div>
          )}

          <p className="mt-2 text-xs text-zinc-600">
            {workflowKey} · {new Date(createdAt).toLocaleString()}
          </p>
          {error && <p className="mt-2 text-xs text-crit">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2">
          <button onClick={() => decide("reject")} className="btn" disabled={busy}>
            Reject
          </button>
          <button onClick={() => decide("approve")} className="btn-primary" disabled={busy}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("price" in obj) return `$${obj.price}`;
    return JSON.stringify(obj);
  }
  return String(value);
}
