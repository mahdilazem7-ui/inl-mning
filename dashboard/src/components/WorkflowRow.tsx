"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  workflowKey: string;
  name: string;
  description: string;
  schedule: string | null;
  autonomous: boolean;
  monitorOnly: boolean;
  enabled: boolean;
  webhookUrl: string | null;
  lastRunAt: string | null;
  lastRunSummary: string | null;
}

export function WorkflowRow(props: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(props.webhookUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveUrl() {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/workflows/${props.workflowKey}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ n8nWebhookUrl: url })
    });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? "Saved." : data.error ?? "Save failed.");
    setBusy(false);
    router.refresh();
  }

  async function runNow() {
    setBusy(true);
    setStatus(null);
    const res = await fetch(`/api/trigger/${props.workflowKey}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? "Triggered in n8n." : data.error ?? "Trigger failed.");
    setBusy(false);
    router.refresh();
  }

  async function toggleMonitor() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/kill-switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow: props.workflowKey, monitorOnly: !props.monitorOnly })
    });
    const data = await res.json().catch(() => ({}));
    setStatus(
      res.ok
        ? data.monitorOnly
          ? "Now in monitor-only mode — it will log but not act."
          : "LIVE — this workflow can now take real action."
        : data.error ?? "Toggle failed."
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-zinc-100">{props.name}</h3>
            {props.autonomous && (
              <span className="pill bg-crit/15 text-crit">takes live action</span>
            )}
            {props.autonomous && props.monitorOnly && (
              <span className="pill bg-warn/15 text-warn">monitor only</span>
            )}
            {!props.enabled && <span className="pill bg-zinc-700 text-zinc-400">disabled</span>}
          </div>
          <p className="mt-1 text-sm text-zinc-400">{props.description}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {props.schedule}
            {props.lastRunAt && ` · last run ${new Date(props.lastRunAt).toLocaleString()}`}
            {props.lastRunSummary && ` · ${props.lastRunSummary}`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {props.autonomous && (
            <button onClick={toggleMonitor} className="btn" disabled={busy}>
              {props.monitorOnly ? "Go live" : "Switch to monitor-only"}
            </button>
          )}
          <button onClick={runNow} className="btn" disabled={busy || !props.webhookUrl}>
            Run now
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[16rem]"
          placeholder="n8n Production Webhook URL (enables Run now)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={saveUrl} className="btn" disabled={busy}>
          Save
        </button>
      </div>

      {status && <p className="mt-2 text-xs text-zinc-400">{status}</p>}
    </div>
  );
}
