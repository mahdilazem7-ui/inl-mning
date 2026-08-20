import Link from "next/link";
import { prisma } from "@/lib/db";
import { Shell, EmptyState, SeverityPill, Markdown, timeAgo } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [briefing, openAlerts, pendingActions, recentRuns, segments, contactCount] =
    await Promise.all([
      prisma.digest.findFirst({
        where: { workflowKey: "ai-chief-of-staff-briefing" },
        orderBy: { createdAt: "desc" }
      }),
      prisma.alert.findMany({
        where: { acknowledged: false },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 6
      }),
      prisma.action.findMany({
        where: { status: "pending_approval" },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.run.findMany({
        orderBy: { startedAt: "desc" },
        take: 12,
        include: { workflow: { select: { name: true, key: true } } }
      }),
      prisma.segment.findMany({
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.contactLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      })
    ]);

  return (
    <Shell
      title="Overview"
      subtitle="What every automation did, in one place."
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Open alerts" value={openAlerts.length} tone={openAlerts.length ? "warn" : "ok"} />
        <Stat
          label="Awaiting approval"
          value={pendingActions.length}
          tone={pendingActions.length ? "warn" : "ok"}
        />
        <Stat label="Runs (recent)" value={recentRuns.length} tone="ok" />
        <Stat label="Customers messaged (7d)" value={contactCount} tone="ok" />
      </div>

      <section className="panel p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold text-zinc-100">Today&apos;s Briefing</h2>
          {briefing && (
            <span className="text-xs text-zinc-500">{timeAgo(briefing.createdAt)}</span>
          )}
        </div>
        {briefing ? (
          <div className="mt-3">
            <Markdown text={briefing.body} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No briefing yet. Once the Chief of Staff workflow runs and posts to{" "}
            <code className="text-accent">/api/ingest</code>, it lands here.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-zinc-100">Needs attention</h2>
            <Link href="/alerts" className="text-xs text-zinc-500 hover:text-accent">
              View all →
            </Link>
          </div>
          {openAlerts.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nothing flagged. Quiet day.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {openAlerts.map((a) => (
                <li key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <SeverityPill severity={a.severity} />
                    <span className="text-sm font-medium text-zinc-200">{a.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{a.message}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {a.workflowKey} · {timeAgo(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-zinc-100">Awaiting your approval</h2>
            <Link href="/approvals" className="text-xs text-zinc-500 hover:text-accent">
              View all →
            </Link>
          </div>
          {pendingActions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Nothing pending. Autonomous workflows stayed inside their guardrails.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pendingActions.map((a) => (
                <li key={a.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-zinc-200">
                    {a.type} · {a.target}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{a.reason}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {a.workflowKey} · {timeAgo(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-semibold text-zinc-100">Recent activity</h2>
          {recentRuns.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No runs recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {recentRuns.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-zinc-300">{r.workflow.name}</span>
                    {r.summary && <p className="text-xs text-zinc-500">{r.summary}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600">{timeAgo(r.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-zinc-100">Customer segments</h2>
            <Link href="/customers" className="text-xs text-zinc-500 hover:text-accent">
              View all →
            </Link>
          </div>
          {segments.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              No segmentation run yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {segments.map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="text-zinc-300">{s.name}</span>
                  <span className="text-zinc-500">{s.memberCount} customers</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "ok" | "warn";
}) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-warn" : "text-zinc-100"}`}>
        {value}
      </p>
    </div>
  );
}
