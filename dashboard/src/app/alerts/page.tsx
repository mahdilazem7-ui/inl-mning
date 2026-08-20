import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { AlertCard } from "@/components/AlertCard";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await prisma.alert.findMany({
    orderBy: [{ acknowledged: "asc" }, { createdAt: "desc" }],
    take: 100
  });

  const open = alerts.filter((a) => !a.acknowledged);
  const done = alerts.filter((a) => a.acknowledged);

  return (
    <Shell
      title="Alerts"
      subtitle="Every workflow's flags in one feed, instead of one email per workflow."
    >
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">
            Nothing open. Every flag has been acknowledged.
          </div>
        ) : (
          <div className="space-y-3">
            {open.map((a) => (
              <AlertCard
                key={a.id}
                id={a.id}
                severity={a.severity}
                title={a.title}
                message={a.message}
                workflowKey={a.workflowKey}
                createdAt={a.createdAt.toISOString()}
                acknowledged={a.acknowledged}
              />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Acknowledged
          </h2>
          <div className="space-y-3">
            {done.slice(0, 20).map((a) => (
              <AlertCard
                key={a.id}
                id={a.id}
                severity={a.severity}
                title={a.title}
                message={a.message}
                workflowKey={a.workflowKey}
                createdAt={a.createdAt.toISOString()}
                acknowledged={a.acknowledged}
              />
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
