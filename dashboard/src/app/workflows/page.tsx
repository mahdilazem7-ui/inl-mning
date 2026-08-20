import { prisma } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { WorkflowRow } from "@/components/WorkflowRow";
import { CATEGORY_LABELS, type WorkflowCategory } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = await prisma.workflow.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 1 }
    }
  });

  const grouped = new Map<string, typeof workflows>();
  for (const w of workflows) {
    const list = grouped.get(w.category) ?? [];
    list.push(w);
    grouped.set(w.category, list);
  }

  return (
    <Shell
      title="Workflows"
      subtitle="All automations in one registry. Paste each one's n8n webhook URL to enable manual runs, and flip the kill switch on anything that spends money."
    >
      {workflows.length === 0 && (
        <div className="panel p-6 text-sm text-zinc-500">
          No workflows registered. Run <code className="text-accent">npm run seed</code> to load
          the registry.
        </div>
      )}

      {[...grouped.entries()].map(([category, items]) => (
        <section key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {CATEGORY_LABELS[category as WorkflowCategory] ?? category}
          </h2>
          <div className="space-y-3">
            {items.map((w) => (
              <WorkflowRow
                key={w.id}
                workflowKey={w.key}
                name={w.name}
                description={w.description}
                schedule={w.schedule}
                autonomous={w.autonomous}
                monitorOnly={w.monitorOnly}
                enabled={w.enabled}
                webhookUrl={w.n8nWebhookUrl}
                lastRunAt={w.runs[0]?.startedAt.toISOString() ?? null}
                lastRunSummary={w.runs[0]?.summary ?? null}
              />
            ))}
          </div>
        </section>
      ))}
    </Shell>
  );
}
