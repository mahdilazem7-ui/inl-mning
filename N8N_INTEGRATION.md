# Wiring your workflows into the dashboard

Every workflow keeps doing exactly what it does today. You're adding one
HTTP Request node at the end of each one so its results land in a shared
database instead of only in an email.

Do this **one workflow at a time**, starting with the Chief of Staff
briefing. Each one takes about two minutes.

---

## One-time setup in n8n

Create a credential you'll reuse for every workflow:

1. **Credentials → New → Header Auth**
2. Name: `Dashboard Ingest`
3. Header name: `Authorization`
4. Header value: `Bearer YOUR_INGEST_API_KEY` — the `INGEST_API_KEY` from
   your dashboard `.env`, with `Bearer ` in front of it.

Everything below uses this one credential.

---

## The basic pattern: send results to the dashboard

Add an **HTTP Request** node as the last node in the workflow (after the
email node — keep your emails, this is in addition):

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `https://your-dashboard.vercel.app/api/ingest` |
| Authentication | Generic Credential Type → Header Auth → `Dashboard Ingest` |
| Send Body | on |
| Body Content Type | JSON |
| Specify Body | Using JSON |

The only required field is `workflow`. Everything else is optional — send
whichever shapes that workflow actually produces:

```json
{
  "workflow": "ad-performance-alerts",
  "status": "flagged",
  "summary": "2 campaigns flagged",
  "alerts": [],
  "digests": [],
  "actions": [],
  "segments": [],
  "contacts": []
}
```

`status` is one of `success`, `error`, `flagged`.

### Workflow keys

Use these exactly — an unknown key returns a 404 rather than silently
discarding your data:

| Key | Workflow |
|---|---|
| `ai-chief-of-staff-briefing` | Daily Executive Briefing |
| `slack-agent` | "Talk to Your Business" Slack Agent |
| `ab-test-reporting` | A/B Test Reporting |
| `ad-performance-alerts` | Ad Performance Alerts |
| `self-writing-ad-loop` | Self-Writing Ad Loop |
| `abandoned-cart-recovery` | Abandoned Cart Recovery |
| `back-in-stock-alerts` | Back-in-Stock Alerts |
| `win-back` | Win-Back Campaign |
| `ugc-collection` | UGC Collection |
| `customer-segmentation-strategist` | Customer Segmentation Strategist |
| `dynamic-pricing-engine` | Dynamic Pricing Engine |
| `newsletter-automation` | Newsletter Automation |
| `trend-hashtag-monitoring` | Trend & Hashtag Monitoring |
| `ai-trend-to-drop-pipeline` | Trend-to-Drop Pipeline |
| `influencer-outreach-tracker` | Influencer Outreach Tracker |
| `influencer-discovery` | Influencer Discovery |

---

## Per-workflow bodies

### 1. Chief of Staff briefing

Add after **Parse AI Response**. This is the one that puts the briefing on
your overview page:

```
={
  "workflow": "ai-chief-of-staff-briefing",
  "status": "success",
  "summary": "{{ $('Summarize Raw Data').first().json.sales.order_count }} orders / ${{ $('Summarize Raw Data').first().json.sales.total_revenue }} revenue",
  "payload": {{ JSON.stringify($('Summarize Raw Data').first().json) }},
  "digests": [{
    "title": "Morning Briefing",
    "body": {{ JSON.stringify($json.email_body) }}
  }]
}
```

To also raise low-stock items as real alerts, add a Code node before it
that maps `inventory.low_stock_items` into an `alerts` array.

### 2. Ad performance alerts

One `alerts` entry per flagged campaign. Use `critical` when it breached
your threshold multiple days running, `warning` for a first offence:

```
={
  "workflow": "ad-performance-alerts",
  "status": "flagged",
  "summary": "{{ $json.flagged_campaigns.length }} campaigns flagged",
  "alerts": {{ JSON.stringify($json.flagged_campaigns.map(c => ({
      severity: c.days_flagged > 2 ? "critical" : "warning",
      title: c.campaign_name + ": CTR " + c.ctr + "%",
      message: c.diagnosis + " Suggested fix: " + c.suggested_fix,
      data: { spend: c.spend, ctr: c.ctr, cpc: c.cpc }
  }))) }}
}
```

### 3. A/B test reporting, trend monitoring, trend-to-drop, newsletter, influencer discovery

All the "Claude writes a digest" workflows use the same shape — these show
up on the **Content & Trends** page:

```
={
  "workflow": "ab-test-reporting",
  "status": "success",
  "summary": "1 test concluded",
  "digests": [{
    "title": "A/B Test: {{ $json.test_name }}",
    "body": {{ JSON.stringify($json.writeup) }}
  }]
}
```

### 4. Dynamic pricing engine

**Read the kill switch before acting** (see below), then log every change:

```
={
  "workflow": "dynamic-pricing-engine",
  "status": "success",
  "summary": "{{ $json.changes.length }} price changes",
  "actions": {{ JSON.stringify($json.changes.map(c => ({
      type: "price_change",
      target: c.product_title + " / " + c.variant_title,
      before: { price: c.old_price },
      after: { price: c.new_price },
      status: c.needs_approval ? "pending_approval" : "executed",
      reason: c.reason
  }))) }}
}
```

Anything sent as `pending_approval` appears on the **Approvals** page with
Approve/Reject buttons instead of being applied.

### 5. Customer segmentation strategist

```
={
  "workflow": "customer-segmentation-strategist",
  "status": "success",
  "summary": "{{ $json.total_customers }} customers across {{ $json.segments.length }} segments",
  "segments": {{ JSON.stringify($json.segments.map(s => ({
      name: s.name,
      memberCount: s.members.length,
      criteria: s.criteria,
      briefTitle: s.brief_title,
      briefBody: s.brief_body
  }))) }}
}
```

### 6. The four messaging workflows

Abandoned cart, back-in-stock, win-back, and UGC each log who they
contacted, using the `kind` values `cart_recovery`, `back_in_stock`,
`winback`, `ugc_ask`:

```
={
  "workflow": "win-back",
  "status": "success",
  "summary": "{{ $json.sent.length }} customers messaged",
  "contacts": {{ JSON.stringify($json.sent.map(c => ({
      customerRef: c.phone || c.email,
      channel: c.phone ? "sms" : "email",
      kind: "winback"
  }))) }}
}
```

### 7. Slack agent

Posts to a different endpoint (`/api/chat-log`), same credential:

```
={
  "question": {{ JSON.stringify($json.question) }},
  "answer": {{ JSON.stringify($json.answer) }},
  "toolUsed": "{{ $json.tool_used }}",
  "askedBy": "{{ $json.slack_user }}"
}
```

---

## The three endpoints that make workflows work together

Everything above is reporting. These three are what turn 16 separate
automations into one system.

### Kill switch — check before spending money

**Put this in the pricing engine and the ad loop before they act.**
Replaces the "flip a cell in a Google Sheet" approach.

HTTP Request node, `GET`:
```
https://your-dashboard.vercel.app/api/kill-switch?workflow=dynamic-pricing-engine
```

Returns:
```json
{ "enabled": true, "monitorOnly": true, "safeToAct": false }
```

Add an **IF** node on `{{ $json.safeToAct }}`:
- **true** → apply the change to Shopify/Meta for real
- **false** → skip the write, still POST to `/api/ingest` so you can see
  what it *would* have done

This is how you run both workflows in log-only mode for a couple of weeks.
Both ship in monitor-only mode; you flip them live from the Workflows page
when you trust what you're seeing.

### Contact check — stop double-messaging customers

Right now cart recovery, back-in-stock, win-back, and UGC each keep their
own private "already contacted" list, so one customer can get hit by three
of them in a week. Add this **before sending**, `GET`:

```
https://your-dashboard.vercel.app/api/contact-check?customerRef={{ $json.email }}&withinDays=14
```

Returns `{ "safeToSend": true/false, "lastContactedBy": "win-back", ... }`

IF node on `{{ $json.safeToSend }}` → only send when true. Omit `kind` to
check across *all* workflows (message fatigue); pass `&kind=winback` to
only check that one campaign type.

### Context — let each workflow see what the others found

This is what makes the briefing genuinely smarter than the sum of its
parts. Add before the Claude node, `GET`:

```
https://your-dashboard.vercel.app/api/context?workflow=ai-chief-of-staff-briefing&days=1
```

Returns recent alerts, digests, actions, and segments from **every other**
workflow (its own output is excluded, so it doesn't feed on itself).

Then include it in the Claude prompt:

```
"content": "Yesterday's raw business data:\n{{ JSON.stringify($('Summarize Raw Data').first().json) }}\n\nWhat your other automations found:\n{{ JSON.stringify($('Get Context').first().json) }}"
```

Now the briefing can say *"ads flagged two campaigns and pricing marked
down four variants"* instead of only seeing its own three API pulls.

Worth wiring into:
- **Chief of Staff** — the big one; sees everything
- **Trend-to-Drop** — reads what the trend monitor found
- **Self-writing ad loop** — reads which A/B tests actually won
- **Slack agent** — recall for on-demand questions

---

## Manual "Run now" buttons

To trigger a workflow from the dashboard:

1. In n8n, add a **Webhook** node as an *additional* trigger alongside the
   schedule trigger, wired into the same first node.
2. Copy its **Production URL**.
3. Paste it into that workflow's row on the **Workflows** page and hit Save.

The Run now button then POSTs to it. A disabled workflow refuses to fire.

---

## Verifying it works

After wiring one workflow, execute it manually in n8n and check the
dashboard. If nothing appears, the HTTP Request node's response tells you
why:

| Response | Meaning |
|---|---|
| `{"ok":true,"recorded":{...}}` | Working. `recorded` counts what was stored. |
| `401 unauthorized` | Header Auth credential is wrong or missing `Bearer `. |
| `404 unknown workflow key` | Typo in `workflow` — check the table above. |
| `400 invalid JSON body` | Expression produced malformed JSON. Wrap strings in `JSON.stringify()`. |

The most common mistake is embedding a Claude-written string directly into
the JSON body — a stray quote or newline breaks it. Always
`{{ JSON.stringify($json.field) }}`, never `"{{ $json.field }}"`.
