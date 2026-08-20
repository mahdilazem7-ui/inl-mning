import { prisma } from "@/lib/db";
import { Shell, timeAgo } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const queries = await prisma.chatQuery.findMany({
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <Shell
      title="Ask the Business"
      subtitle="Every question asked of the Slack agent and what it answered — so the on-demand agent's history lives with everything else instead of scrolling away in Slack."
    >
      <div className="panel p-5">
        <h2 className="text-sm font-semibold text-zinc-100">How to ask</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Questions are asked in Slack by @-mentioning the bot — the agent picks which system to
          query and replies in-thread. Add a{" "}
          <code className="rounded bg-black/50 px-1 py-0.5 text-xs text-accent">
            POST /api/chat-log
          </code>{" "}
          node at the end of that workflow and each exchange gets mirrored here.
        </p>
      </div>

      {queries.length === 0 ? (
        <div className="panel p-6 text-sm text-zinc-500">
          No questions logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {queries.map((q) => (
            <div key={q.id} className="panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-zinc-100">{q.question}</p>
                <span className="text-xs text-zinc-600">
                  {q.askedBy ? `${q.askedBy} · ` : ""}
                  {timeAgo(q.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{q.answer}</p>
              {q.toolUsed && (
                <p className="mt-2 text-xs text-zinc-600">queried: {q.toolUsed}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
