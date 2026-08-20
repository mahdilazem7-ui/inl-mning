# Setup: from an empty n8n account to everything running

Read this one first. It's the order to do things in. `N8N_INTEGRATION.md`
has the wiring details you'll need in Phase 3.

**Do not import all 16 workflows at once.** Get one working end to end
first. Every credential problem you're going to hit will surface on that
first workflow, and the fix applies to all the others.

---

## Phase 1 — One workflow, working, emailing you

Goal: the morning briefing lands in your inbox. No dashboard yet, no
database. This phase is worth doing on its own even if you stop here.

### 1.1 Create the four credentials

Your n8n account is new, so it has no credentials yet — even if you used
these same tokens elsewhere before. In n8n: **Credentials → Add credential**.

| Credential | Type | Setting |
|---|---|---|
| Shopify Admin API | Header Auth | Name `X-Shopify-Access-Token`, Value = your Admin API access token |
| Meta Marketing API | Header Auth | Name `Authorization`, Value = `Bearer YOUR_META_TOKEN` |
| Anthropic API Key | Header Auth | Name `x-api-key`, Value = your key from console.anthropic.com |
| Your Email SMTP | SMTP | Host/port/user/pass. Gmail needs an App Password, not your login password |

Getting the Shopify token: Shopify admin → Settings → Apps and sales
channels → Develop apps → Create an app → Configure Admin API scopes →
enable `read_orders` and `read_products` → Install app → reveal the Admin
API access token. It's shown once.

### 1.2 Import the workflow

**Workflows → Import from File** →
`workflows/ai-chief-of-staff-daily-executive-briefing.json`

### 1.3 Attach the credentials

The exported JSON carries credential *names* but empty IDs, so n8n cannot
match them to your new account automatically. Five nodes will show a
credential warning. Open each and pick the credential from the dropdown:

- Get Yesterday's Orders → Shopify Admin API
- Get Inventory Levels → Shopify Admin API
- Get Ad Insights → Meta Marketing API
- Generate Briefing → Anthropic API Key
- Send Briefing → Your Email SMTP

### 1.4 Replace the placeholders

| Node | Find | Replace with |
|---|---|---|
| Get Yesterday's Orders | `YOUR_STORE.myshopify.com` | your real store domain |
| Get Inventory Levels | `YOUR_STORE.myshopify.com` | your real store domain |
| Get Ad Insights | `act_YOUR_AD_ACCOUNT_ID` | your ad account ID, keeping the `act_` prefix |
| Send Briefing | `you@yourcompany.com` | your email |
| Send Briefing | `briefing@yourcompany.com` | a from-address your SMTP is allowed to send as |

Optional: in **Summarize Raw Data**, `LOW_STOCK_THRESHOLD = 10` — set it to
your actual reorder point.

### 1.5 Run it manually and read every node's output

Click **Execute Workflow**. Don't activate it yet. Click through each node
and confirm the data is real:

- **Orders / Inventory** — a `401` means the token is wrong; a `404` means
  the store domain is wrong. An empty `orders` array is fine if you had no
  orders yesterday, but check it's `[]` and not an error object.
- **Get Ad Insights** — an empty `data` array usually means no spend
  yesterday, not a broken token.
- **Generate Briefing** — should return `content[0].text` containing JSON.
- **Parse AI Response** — check `email_body` reads like a real briefing.
  If it says "Could not generate briefing", Claude returned something that
  didn't parse; look at the previous node's raw output.
- **Send Briefing** — check your inbox, including spam.

### 1.6 Activate

Toggle **Active**. It now runs at 7am daily.

**Then repeat 1.2–1.6 for the other workflows, one at a time.** Fifteen of
them aren't in this repo yet — see the note at the bottom.

---

## Phase 2 — Deploy the dashboard

Do this only once at least one workflow is running. Nothing here changes
what your workflows already do.

**Order matters: the dashboard must be publicly reachable before Phase 3.**
n8n Cloud runs on n8n's servers and cannot reach `localhost` on your
laptop. A deployed URL is the whole point.

### 2.1 Database

Create a Postgres database at [neon.tech](https://neon.tech) or
[supabase.com](https://supabase.com) — both have free tiers that are fine
for this. Copy the connection string.

### 2.2 Deploy to Vercel

1. Import this GitHub repo at [vercel.com/new](https://vercel.com/new)
2. **Set Root Directory to `dashboard`** — the most common mistake is
   leaving it at the repo root, which fails to build
3. Add four environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon/Supabase connection string |
| `INGEST_API_KEY` | run `openssl rand -hex 32` |
| `DASHBOARD_PASSWORD` | whatever you want to log in with |
| `SESSION_SECRET` | run `openssl rand -hex 32` again — a different value |

4. Deploy.

### 2.3 Create the tables

From your own machine, once:

```bash
cd dashboard
npm install
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
DATABASE_URL="your-neon-connection-string" npm run seed
```

`npm run seed` registers all 16 workflows and loads sample data so the
dashboard isn't empty while you're still wiring things up. When you want
only real data: `npm run seed -- --registry-only`.

### 2.4 Log in

Visit your Vercel URL and log in with `DASHBOARD_PASSWORD`.

Want to try it locally first instead? `docker compose up -d db` in the repo
root gives you Postgres, then `cd dashboard && npm run dev`.

---

## Phase 3 — Wire the workflows into the dashboard

Now the workflows start feeding the shared database. Full per-workflow
bodies are in **[N8N_INTEGRATION.md](N8N_INTEGRATION.md)**.

The short version, for each workflow:

1. Add one **HTTP Request** node at the end (keep the email node — this is
   in addition to it)
2. `POST https://your-app.vercel.app/api/ingest`
3. Header Auth credential: `Authorization` = `Bearer YOUR_INGEST_API_KEY`
4. JSON body with at minimum `{"workflow": "the-workflow-key"}`

Start with the briefing so the overview page has something on it.

Once results are flowing, add the three cross-workflow calls — these are
what make the system more than a viewer:

- **Kill switch** before the pricing engine and ad loop act. Both ship in
  monitor-only mode; they log what they *would* do until you flip them live.
- **Contact check** before any of the four messaging workflows send, so one
  customer doesn't get hit by three of them in a week.
- **Context** before the briefing's Claude node, so it can see what the
  other workflows found.

---

## Practical notes

**n8n Cloud trials expire.** If yours lapses mid-setup, your workflows stop
running. Self-hosting (`docker run -it --rm -p 5678:5678 n8nio/n8n`) avoids
that but then n8n needs to be reachable and always-on for schedules to fire.

**Two workflows can spend money.** The dynamic pricing engine changes
Shopify prices and the ad loop creates Meta campaigns. Both default to
monitor-only. Leave them there for a couple of weeks and read the Approvals
audit trail before flipping either live — the pricing engine has no COGS
data in its price floor, so it doesn't currently know what a change does to
your margin.

**Costs.** Anthropic API is billed per call — 16 workflows on daily and
weekly schedules is a small monthly cost, not free. SMS in the retention
workflows costs per message. Neon and Vercel free tiers are fine here.

---

## The 15 missing workflow files

Only the Chief of Staff briefing is in `workflows/`. The other 15 exist on
your side but aren't in this repo, which matters for two reasons:

1. They aren't backed up here.
2. The per-workflow bodies in `N8N_INTEGRATION.md` were written from your
   descriptions, not your actual JSON, so field names like
   `$json.flagged_campaigns` are guesses at your Code node output.

Add the JSON files to `workflows/` and the integration snippets can be
rewritten against the real field names — the difference between copy-paste
and debugging.
