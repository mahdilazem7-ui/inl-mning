# Automation Control Center

The system that ties 16 n8n workflows together: one dashboard to see what
they all did, one database they all read and write, and guardrails on the
two that can spend money.

```
SETUP.md            start here — ordered path from empty n8n account to running
workflows/          the n8n workflow JSON files
dashboard/          Next.js + Postgres app (the shared layer + UI)
N8N_INTEGRATION.md  per-workflow wiring details, used in SETUP.md phase 3
```

## What it actually adds

Each workflow already works on its own and emails you a result. Three
things they can't do individually:

**They can see each other's findings.** `GET /api/context` returns what
every *other* workflow found recently. The morning briefing can say "ads
flagged two campaigns and pricing marked down four variants" instead of
only seeing its own three API pulls.

**They stop double-messaging customers.** Abandoned cart, back-in-stock,
win-back, and UGC each keep a private "already contacted" list today, so
one person can get hit by three of them in a week. `GET /api/contact-check`
is a shared gate they all call before sending.

**The autonomous ones have a real kill switch.** The pricing engine and the
ad loop check `GET /api/kill-switch` before touching Shopify or Meta.
Both ship in monitor-only mode — they log what they *would* do until you
flip them live from the Workflows page. Price changes above your
auto-approve threshold land on an Approvals page with Approve/Reject
buttons rather than being applied.

## Pages

| Page | What's on it |
|---|---|
| Overview | Today's briefing, open alerts, pending approvals, activity feed |
| Workflows | All 16, with Run-now buttons and kill-switch toggles |
| Alerts | Every workflow's flags in one feed, acknowledgeable |
| Approvals | Actions awaiting your decision + full audit trail |
| Customers | Segments, campaign briefs, shared contact log |
| Content & Trends | Everything Claude wrote across the content workflows |
| Ask the Business | Slack agent Q&A history |

## Setup

**New here? Follow [SETUP.md](SETUP.md)** — it sequences n8n and the
dashboard in the order that actually works. What follows is just the
dashboard on its own.

Requires Node 18+ and a Postgres database.

```bash
cd dashboard
npm install
cp .env.example .env
```

Fill in `.env`:

```bash
DATABASE_URL="postgresql://..."          # Neon and Supabase both have free tiers
INGEST_API_KEY="$(openssl rand -hex 32)" # what n8n authenticates with
DASHBOARD_PASSWORD="something-you-pick"  # to log into the dashboard
SESSION_SECRET="$(openssl rand -hex 32)" # signs the login cookie
```

Then:

```bash
npx prisma migrate deploy   # create the tables
npm run seed                # register all 16 workflows + sample data
npm run dev                 # http://localhost:3000
```

Log in with your `DASHBOARD_PASSWORD`. The sample data shows you what a
populated dashboard looks like before any real workflow has run.

When you're ready for real data only:

```bash
npm run seed -- --registry-only    # workflows registered, no sample rows
```

## Deploying

Vercel + Neon is the path of least resistance:

1. Create a Postgres database (Neon free tier) and copy its connection
   string.
2. Import this repo into Vercel, set the **Root Directory** to `dashboard`.
3. Add the four env vars from `.env` to Vercel's project settings.
4. Deploy, then run `npx prisma migrate deploy` and `npm run seed` against
   the production `DATABASE_URL` once.

Your n8n instance needs to reach the deployed URL, which is why this wants
to be hosted rather than running on your laptop.

## Then wire up the workflows

See **[N8N_INTEGRATION.md](N8N_INTEGRATION.md)** — one HTTP Request node
per workflow, about two minutes each. Do the Chief of Staff briefing first
so the overview page has something on it.

## API reference

Workflows authenticate with `Authorization: Bearer $INGEST_API_KEY`.
Dashboard actions use the login cookie.

| Endpoint | Purpose |
|---|---|
| `POST /api/ingest` | Every workflow posts its results here |
| `GET /api/context` | Read what the other workflows found |
| `GET /api/contact-check` | Cross-workflow dedup before messaging a customer |
| `GET/POST /api/kill-switch` | Guardrail for the autonomous workflows |
| `POST /api/chat-log` | Slack agent Q&A |
| `POST /api/trigger/[key]` | Manual run (session auth only) |
| `PATCH /api/alerts/[id]` | Acknowledge an alert |
| `PATCH /api/actions/[id]` | Approve or reject a pending action |

## Adding a 17th workflow

Add an entry to `dashboard/src/lib/workflows.ts` and re-run `npm run seed`.
The schema is generic — new workflows need a registry entry and a payload,
not a database migration.

## A note on the two autonomous workflows

The dynamic pricing engine has no COGS data wired into its price floor, and
the ad loop creates ad sets paused because Meta's creative object needs
account-specific image and page IDs. Both default to monitor-only for that
reason. Run them in log-only mode for a couple of weeks and read the
Approvals audit trail before letting either touch anything live.
