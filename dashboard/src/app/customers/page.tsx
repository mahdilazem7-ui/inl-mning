import { prisma } from "@/lib/db";
import { Shell, Markdown, timeAgo } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [segments, contactsByKind, recentContacts] = await Promise.all([
    prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10
    }),
    prisma.contactLog.groupBy({
      by: ["kind"],
      _count: { _all: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    }),
    prisma.contactLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30
    })
  ]);

  return (
    <Shell
      title="Customers"
      subtitle="Segments from the strategist workflow, and a shared contact log so cart recovery, win-back, back-in-stock, and UGC asks don't all hit the same person in one week."
    >
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Messages sent (last 30 days)
        </h2>
        {contactsByKind.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">No customer messages logged yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            {contactsByKind.map((c) => (
              <div key={c.kind} className="panel p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {c.kind.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-100">{c._count._all}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Segments & campaign briefs
        </h2>
        {segments.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">
            No segmentation run yet. The Customer Segmentation Strategist posts here weekly.
          </div>
        ) : (
          <div className="space-y-3">
            {segments.map((s) => (
              <div key={s.id} className="panel p-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium text-zinc-100">
                    {s.name}{" "}
                    <span className="ml-2 text-sm font-normal text-zinc-500">
                      {s.memberCount} customers
                    </span>
                  </h3>
                  <span className="text-xs text-zinc-600">{timeAgo(s.createdAt)}</span>
                </div>
                {s.briefTitle && (
                  <p className="mt-2 text-sm font-medium text-accent">{s.briefTitle}</p>
                )}
                {s.briefBody && (
                  <div className="mt-2">
                    <Markdown text={s.briefBody} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Recent contact log
        </h2>
        {recentContacts.length === 0 ? (
          <div className="panel p-6 text-sm text-zinc-500">Nothing logged yet.</div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {recentContacts.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {timeAgo(c.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{maskRef(c.customerRef)}</td>
                    <td className="px-4 py-2 text-zinc-400">{c.kind.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2 text-zinc-400">{c.channel}</td>
                    <td className="px-4 py-2 text-zinc-500">{c.workflowKey}</td>
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

// Partially mask customer contact details — this dashboard is for
// operations, not a place to browse a full customer list.
function maskRef(ref: string): string {
  if (ref.includes("@")) {
    const [user, domain] = ref.split("@");
    return `${user.slice(0, 2)}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
  }
  return `${"*".repeat(Math.max(ref.length - 4, 0))}${ref.slice(-4)}`;
}
