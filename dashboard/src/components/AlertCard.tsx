"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SeverityPill } from "@/components/Shell";

export function AlertCard({
  id,
  severity,
  title,
  message,
  workflowKey,
  createdAt,
  acknowledged
}: {
  id: string;
  severity: string;
  title: string;
  message: string;
  workflowKey: string;
  createdAt: string;
  acknowledged: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function acknowledge() {
    setBusy(true);
    await fetch(`/api/alerts/${id}`, { method: "PATCH" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className={`panel p-4 ${acknowledged ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SeverityPill severity={severity} />
            <h3 className="font-medium text-zinc-100">{title}</h3>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{message}</p>
          <p className="mt-2 text-xs text-zinc-600">
            {workflowKey} · {new Date(createdAt).toLocaleString()}
          </p>
        </div>
        {!acknowledged && (
          <button onClick={acknowledge} className="btn shrink-0" disabled={busy}>
            {busy ? "…" : "Acknowledge"}
          </button>
        )}
      </div>
    </div>
  );
}
