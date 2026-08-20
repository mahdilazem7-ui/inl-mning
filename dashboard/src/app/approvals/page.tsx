import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { ApprovalCard } from "@/components/ApprovalCard";
import { timeAgo } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [pending, recent] = await Promise.all([
    prisma.action.findMany({
      where: { status: "pending_approval" },
      orderBy: { createdAt: "desc" }
    }),
    prisma.action.findMany({
      where: { status: { in: ["executed", "rejected"] } },
      orderBy: { createdAt: "desc" },
      take: 40
    })
  ]);

  return (
    <Shell
      title="Approvals & Action Log"
      subtitle="Anything an autonomous workflow wanted to do but wasn't allowed to do alone — plus a full audit trail of what it did do."
    >
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Pending approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">
            Nothing waiting on you.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <ApprovalCard
                key={a.id}
                id={a.id}
                type={a.type}
                target={a.target}
                reason={a.reason}
                before={a.before}
                after={a.after}
                workflowKey={a.workflowKey}
                createdAt={a.createdAt.toISOString()}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Audit trail
        </h2>
        {recent.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">No actions recorded yet.</div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {timeAgo(a.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-zinc-400">{a.workflowKey}</td>
                    <td className="px-4 py-2 text-zinc-300">{a.type}</td>
                    <td className="px-4 py-2 text-zinc-400">{a.target ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`pill ${
                          a.status === "executed"
                            ? "bg-accent/15 text-accent"
                            : "bg-zinc-600/20 text-zinc-400"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Shell>
  );
}
