import Link from "next/link";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/workflows", label: "Workflows" },
  { href: "/alerts", label: "Alerts" },
  { href: "/approvals", label: "Approvals" },
  { href: "/customers", label: "Customers" },
  { href: "/content", label: "Content & Trends" },
  { href: "/ask", label: "Ask the Business" }
];

export function Shell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-panel/50">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
              Automation Control Center
            </Link>
            <form action="/api/login" method="post">
              <Link href="/login" className="text-xs text-zinc-500 hover:text-zinc-300">
                Sign out
              </Link>
            </form>
          </div>
          <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-zinc-400 transition hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        <div className="mt-6 space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel p-6 text-sm text-zinc-500">
      {children}
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-crit/15 text-crit",
    warning: "bg-warn/15 text-warn",
    info: "bg-zinc-500/15 text-zinc-400"
  };
  return <span className={`pill ${styles[severity] ?? styles.info}`}>{severity}</span>;
}

export function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Minimal markdown renderer for Claude-written bodies (headings, bullets,
// bold, inline code). Deliberately not a full parser — these bodies come
// from our own prompts and only ever use these four constructs.
export function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .split(/\n{2,}/)
    .map((block) => (block.match(/^<(h\d|ul)/) ? block : `<p>${block.replace(/\n/g, "<br/>")}</p>`))
    .join("");

  return <div className="prose-brief text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}
