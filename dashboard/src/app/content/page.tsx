import { prisma } from "@/lib/db";
import { Shell, Markdown, timeAgo } from "@/components/Shell";

export const dynamic = "force-dynamic";

const CONTENT_WORKFLOWS = [
  "trend-hashtag-monitoring",
  "ai-trend-to-drop-pipeline",
  "newsletter-automation",
  "influencer-discovery",
  "influencer-outreach-tracker",
  "ab-test-reporting"
];

export default async function ContentPage() {
  const digests = await prisma.digest.findMany({
    where: { workflowKey: { in: CONTENT_WORKFLOWS } },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  return (
    <Shell
      title="Content, Trends & Creative"
      subtitle="Everything Claude wrote across the trend monitor, drop pipeline, newsletter, influencer workflows, and A/B test reports."
    >
      {digests.length === 0 ? (
        <div className="panel p-6 text-sm text-zinc-500">
          Nothing yet. These workflows post their write-ups here as they run.
        </div>
      ) : (
        <div className="space-y-4">
          {digests.map((d) => (
            <article key={d.id} className="panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold text-zinc-100">{d.title}</h2>
                <span className="text-xs text-zinc-600">
                  {d.workflowKey} · {timeAgo(d.createdAt)}
                </span>
              </div>
              <div className="mt-3">
                <Markdown text={d.body} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
