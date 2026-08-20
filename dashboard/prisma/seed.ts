// Seeds the workflow registry (all 16 automations) and, unless you pass
// --registry-only, a few days of realistic sample output so the dashboard
// is populated before any real n8n run has happened.
//
//   npm run seed                  registry + sample data
//   npm run seed -- --registry-only   registry only (use before going live)
//
// Safe to re-run: workflows are upserted by key, and sample data is
// cleared and rebuilt each time.

import { PrismaClient } from "@prisma/client";
import { WORKFLOWS } from "../src/lib/workflows";

const prisma = new PrismaClient();

const registryOnly = process.argv.includes("--registry-only");

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function main() {
  console.log("Seeding workflow registry…");

  for (const [index, w] of WORKFLOWS.entries()) {
    await prisma.workflow.upsert({
      where: { key: w.key },
      update: {
        name: w.name,
        category: w.category,
        description: w.description,
        schedule: w.schedule,
        autonomous: w.autonomous ?? false,
        sortOrder: index
      },
      create: {
        key: w.key,
        name: w.name,
        category: w.category,
        description: w.description,
        schedule: w.schedule,
        autonomous: w.autonomous ?? false,
        monitorOnly: w.monitorOnly ?? true,
        sortOrder: index
      }
    });
  }
  console.log(`  ${WORKFLOWS.length} workflows registered.`);

  if (registryOnly) {
    console.log("Registry-only mode — skipping sample data.");
    return;
  }

  console.log("Clearing existing sample data…");
  // Order matters: children before parents.
  await prisma.alert.deleteMany();
  await prisma.digest.deleteMany();
  await prisma.action.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.run.deleteMany();
  await prisma.contactLog.deleteMany();
  await prisma.chatQuery.deleteMany();

  const byKey = new Map(
    (await prisma.workflow.findMany()).map((w) => [w.key, w.id] as const)
  );
  const idFor = (key: string) => {
    const id = byKey.get(key);
    if (!id) throw new Error(`workflow "${key}" missing from registry`);
    return id;
  };

  console.log("Seeding sample runs…");

  // --- Chief of Staff briefing -------------------------------------
  const briefingRun = await prisma.run.create({
    data: {
      workflowId: idFor("ai-chief-of-staff-briefing"),
      status: "success",
      summary: "42 orders / $3,847 revenue · 6 low-stock variants · $612 ad spend",
      startedAt: hoursAgo(3)
    }
  });

  await prisma.digest.create({
    data: {
      runId: briefingRun.id,
      workflowKey: "ai-chief-of-staff-briefing",
      title: "Morning Briefing",
      createdAt: hoursAgo(3),
      body: `## State of the business
Yesterday did $3,847 across 42 orders — your best Tuesday this month and about 18% above your trailing four-week Tuesday average. Ad spend was $612, so you're running roughly a 6.3x blended return. The growth is real, but it's concentrated: two products drove more than half of it, and one of them is nearly out of stock.

## What's working
- **Cargo Pant (Washed Black)** moved 14 units, your single best product day on it.
- **Boxy Logo Tee** added another 11 units, up from 7 the prior Tuesday.
- **Retargeting - Warm 30d** returned $8.10 per dollar at a $1.42 CPC — your most efficient campaign right now.

## Needs attention
- **Cargo Pant (Washed Black) size M is down to 3 units.** At yesterday's rate that's gone before the weekend, and it's the product carrying your revenue.
- **Prospecting - Broad 18-24** spent $187 with a 0.71% CTR — below your 1% floor for the third straight day.
- Six variants total are at or under your reorder point of 10.

## Today's 3 actions
1. **Reorder Cargo Pant (Washed Black) in M, L, and XL today.** M is 3 units from a stockout on your top revenue driver — this is the only action here that costs you money by waiting.
2. **Pause Prospecting - Broad 18-24.** Three consecutive days under a 0.71% CTR at $187/day is $561 you can move to the warm retargeting campaign that's returning 8.1x.
3. **Push the Boxy Logo Tee to your VIP list.** It's trending up two weeks running and you have inventory depth on it — unlike the cargo pant, you can actually absorb the demand.`
    }
  });

  // --- Ad performance alerts ---------------------------------------
  const adRun = await prisma.run.create({
    data: {
      workflowId: idFor("ad-performance-alerts"),
      status: "flagged",
      summary: "2 campaigns flagged",
      startedAt: hoursAgo(5)
    }
  });

  await prisma.alert.createMany({
    data: [
      {
        runId: adRun.id,
        workflowKey: "ad-performance-alerts",
        severity: "critical",
        title: "Prospecting - Broad 18-24: CTR 0.71%",
        message:
          "Third consecutive day below your 1% CTR floor, at $187/day. Diagnosis: creative fatigue — frequency is 3.4 against the same cold audience. Suggested fix: pause and reallocate to Retargeting - Warm 30d, which is returning 8.1x at a $1.42 CPC.",
        createdAt: hoursAgo(5)
      },
      {
        runId: adRun.id,
        workflowKey: "ad-performance-alerts",
        severity: "warning",
        title: "Spring Drop - Lookalike 3%: cost per result $41.20",
        message:
          "Cost per purchase is 2.1x your $19.50 target. Diagnosis: the lookalike seed is your all-buyers list, which skews toward one-time bargain buyers. Suggested fix: rebuild the seed from the VIP segment instead.",
        createdAt: hoursAgo(5)
      }
    ]
  });

  // --- Inventory alert from the briefing ---------------------------
  await prisma.alert.create({
    data: {
      runId: briefingRun.id,
      workflowKey: "ai-chief-of-staff-briefing",
      severity: "critical",
      title: "Cargo Pant (Washed Black) / M — 3 units left",
      message:
        "Top revenue driver yesterday (14 units). At current velocity this stocks out in under 2 days.",
      createdAt: hoursAgo(3)
    }
  });

  // --- Dynamic pricing engine (monitor mode) -----------------------
  const pricingRun = await prisma.run.create({
    data: {
      workflowId: idFor("dynamic-pricing-engine"),
      status: "success",
      summary: "4 changes logged (monitor-only), 1 routed for approval",
      startedAt: hoursAgo(8)
    }
  });

  await prisma.action.createMany({
    data: [
      {
        runId: pricingRun.id,
        workflowKey: "dynamic-pricing-engine",
        type: "price_change",
        target: "Oversized Hoodie (Sand) / L",
        before: { price: 89 },
        after: { price: 76 },
        status: "executed",
        reason: "Sell-through 4% over 21 days — slow mover. 14.6% markdown, inside the 20% cap.",
        createdAt: hoursAgo(8)
      },
      {
        runId: pricingRun.id,
        workflowKey: "dynamic-pricing-engine",
        type: "price_change",
        target: "Cargo Pant (Washed Black) / M",
        before: { price: 98 },
        after: { price: 104 },
        status: "executed",
        reason: "Sell-through 71% over 7 days with 3 units left. 6.1% increase, inside the 10% cap.",
        createdAt: hoursAgo(8)
      },
      {
        runId: pricingRun.id,
        workflowKey: "dynamic-pricing-engine",
        type: "price_change",
        target: "Puffer Vest (Olive) / S",
        before: { price: 145 },
        after: { price: 112 },
        status: "pending_approval",
        reason:
          "Sell-through 1% over 45 days. A 22.8% markdown exceeds your 20% auto-approve cap, so it was routed here instead of applied.",
        createdAt: hoursAgo(8)
      }
    ]
  });

  // --- Customer segmentation ---------------------------------------
  const segRun = await prisma.run.create({
    data: {
      workflowId: idFor("customer-segmentation-strategist"),
      status: "success",
      summary: "1,284 customers across 5 segments",
      startedAt: daysAgo(2)
    }
  });

  await prisma.segment.createMany({
    data: [
      {
        runId: segRun.id,
        workflowKey: "customer-segmentation-strategist",
        name: "VIP",
        memberCount: 87,
        criteria: { lifetimeSpend: ">= 500" },
        briefTitle: "Early access, not discounts",
        briefBody:
          "These 87 people already pay full price — discounting to them burns margin you don't need to spend. Give them first access to the next drop 24 hours early, framed as membership rather than a promotion. Channel: email, since they read it. Offer: early access window, no code.",
        createdAt: daysAgo(2)
      },
      {
        runId: segRun.id,
        workflowKey: "customer-segmentation-strategist",
        name: "Loyal / Repeat",
        memberCount: 213,
        criteria: { orderCount: ">= 3" },
        briefTitle: "Bundle the second item",
        briefBody:
          "Three-plus orders means the product works for them; the constraint is basket size, not trust. Push a two-item bundle at a modest 10% rather than a sitewide discount. Channel: email plus SMS for the ones with phone numbers.",
        createdAt: daysAgo(2)
      },
      {
        runId: segRun.id,
        workflowKey: "customer-segmentation-strategist",
        name: "Bargain Hunter",
        memberCount: 402,
        criteria: { orderCount: 1, boughtOnDiscount: true },
        briefTitle: "Only reachable on markdown",
        briefBody:
          "One order, and it was on discount. Don't spend full-price campaigns here. Hold this list for genuine clearance moments — the Puffer Vest markdown pending your approval is exactly the kind of thing this segment responds to.",
        createdAt: daysAgo(2)
      },
      {
        runId: segRun.id,
        workflowKey: "customer-segmentation-strategist",
        name: "Churn Risk",
        memberCount: 341,
        criteria: { daysInactive: ">= 60" },
        briefTitle: "Hand off to win-back",
        briefBody:
          "341 people inactive 60+ days. This is the list your win-back workflow should be running against — check the contact log first so anyone already messaged in the last 14 days is excluded.",
        createdAt: daysAgo(2)
      },
      {
        runId: segRun.id,
        workflowKey: "customer-segmentation-strategist",
        name: "New",
        memberCount: 241,
        criteria: { joinedWithinDays: 30 },
        briefTitle: "Earn the second order",
        briefBody:
          "The single highest-leverage moment in the lifecycle. Send the brand story plus a styling angle on what they already bought — not a discount, which trains them into the bargain-hunter segment.",
        createdAt: daysAgo(2)
      }
    ]
  });

  // --- Trend monitoring --------------------------------------------
  const trendRun = await prisma.run.create({
    data: {
      workflowId: idFor("trend-hashtag-monitoring"),
      status: "success",
      summary: "Digest written",
      startedAt: hoursAgo(6)
    }
  });

  await prisma.digest.create({
    data: {
      runId: trendRun.id,
      workflowKey: "trend-hashtag-monitoring",
      title: "Trend Digest",
      createdAt: hoursAgo(6),
      body: `## Emerging
**Washed/faded black** keeps climbing — #washedblack is up meaningfully week over week, and it is the same finish driving your own Cargo Pant sales. This is the clearest signal in today's pull.

**Wide-leg silhouettes** continue to gain against tapered fits in the accounts your audience follows.

## Competitor moves
Two competitors in your niche posted drop teasers this week using the same washed-black finish. You have the product; they are marketing it harder.

## Content idea
Shoot the Cargo Pant against a plain background with a fade close-up. The washed finish is the thing trending — most brands are showing full-body fits and burying the detail that's actually driving interest.`
    }
  });

  // --- Trend-to-drop pipeline --------------------------------------
  const dropRun = await prisma.run.create({
    data: {
      workflowId: idFor("ai-trend-to-drop-pipeline"),
      status: "success",
      summary: "2 product concepts proposed",
      startedAt: daysAgo(1)
    }
  });

  await prisma.digest.create({
    data: {
      runId: dropRun.id,
      workflowKey: "ai-trend-to-drop-pipeline",
      title: "Trend-to-Drop: 2 concepts",
      createdAt: daysAgo(1),
      body: `## Concept 1 — Washed Black Wide-Leg Denim
**Why now:** Washed black is your strongest-selling finish and it is trending independently of you. Wide-leg is gaining in your audience's feed. You sell neither combination today — the gap is specific, not speculative.

**Price point:** $118 — above the cargo pant at $98, justified by denim weight.

**Tagline:** "The fade you already own, cut the way it's going."

## Concept 2 — Washed Black Work Jacket *(speculative)*
**Why now:** Outerwear in the same finish would round out the drop, but the trend data behind this one is thin — I am inferring from the pant signal rather than seeing jacket-specific movement. Labeling it speculative rather than dressing it up.

**Price point:** $165, unvalidated.

**Recommendation:** Build concept 1. Hold concept 2 until there is real outerwear signal.`
    }
  });

  // --- A/B test reporting ------------------------------------------
  const abRun = await prisma.run.create({
    data: {
      workflowId: idFor("ab-test-reporting"),
      status: "success",
      summary: "1 test concluded",
      startedAt: daysAgo(1)
    }
  });

  await prisma.digest.create({
    data: {
      runId: abRun.id,
      workflowKey: "ab-test-reporting",
      title: "A/B Test: Hook variant — concluded",
      createdAt: daysAgo(1),
      body: `**Winner: Variant B** (product-detail close-up) at 1.84% CTR vs Variant A (full-body fit) at 1.12%.

**Confidence: high** — 64% lift over 8 days and ~24,000 impressions per arm. This is not noise.

**Recommendation:** Make the detail-close-up opener your default hook for this product category. It also matches what the trend monitor is seeing: the fade detail is the thing people respond to, and most competitor creative buries it.`
    }
  });

  // --- Customer messaging workflows --------------------------------
  const cartRun = await prisma.run.create({
    data: {
      workflowId: idFor("abandoned-cart-recovery"),
      status: "success",
      summary: "3 carts nudged",
      startedAt: hoursAgo(1)
    }
  });

  await prisma.contactLog.createMany({
    data: [
      {
        workflowKey: "abandoned-cart-recovery",
        customerRef: "+15551234567",
        channel: "sms",
        kind: "cart_recovery",
        createdAt: hoursAgo(1)
      },
      {
        workflowKey: "abandoned-cart-recovery",
        customerRef: "jordan.reyes@example.com",
        channel: "email",
        kind: "cart_recovery",
        createdAt: hoursAgo(2)
      },
      {
        workflowKey: "abandoned-cart-recovery",
        customerRef: "+15559876543",
        channel: "sms",
        kind: "cart_recovery",
        createdAt: hoursAgo(4)
      },
      {
        workflowKey: "win-back",
        customerRef: "sam.chen@example.com",
        channel: "email",
        kind: "winback",
        createdAt: daysAgo(3)
      },
      {
        workflowKey: "win-back",
        customerRef: "+15552223333",
        channel: "sms",
        kind: "winback",
        createdAt: daysAgo(3)
      },
      {
        workflowKey: "back-in-stock-alerts",
        customerRef: "alex.morgan@example.com",
        channel: "email",
        kind: "back_in_stock",
        createdAt: daysAgo(4)
      },
      {
        workflowKey: "ugc-collection",
        customerRef: "+15554445555",
        channel: "sms",
        kind: "ugc_ask",
        createdAt: daysAgo(5)
      },
      {
        workflowKey: "ugc-collection",
        customerRef: "riley.patel@example.com",
        channel: "email",
        kind: "ugc_ask",
        createdAt: daysAgo(6)
      }
    ]
  });

  await prisma.action.create({
    data: {
      runId: cartRun.id,
      workflowKey: "abandoned-cart-recovery",
      type: "sms_sent",
      target: "3 idle checkouts",
      status: "executed",
      reason: "Checkouts idle 1-2 hours; all 3 passed the cross-workflow contact check.",
      createdAt: hoursAgo(1)
    }
  });

  // --- Slack agent --------------------------------------------------
  await prisma.chatQuery.createMany({
    data: [
      {
        question: "what's about to sell out?",
        toolUsed: "inventory",
        answer:
          "Six variants are at or under 10 units. The one that matters: Cargo Pant (Washed Black) / M at 3 units — it moved 14 units yesterday, so it's roughly two days from a stockout on your best seller. L and XL are at 8 and 9.",
        askedBy: "mahdi",
        createdAt: hoursAgo(2)
      },
      {
        question: "why did sales dip Tuesday?",
        toolUsed: "sales",
        answer:
          "They didn't — Tuesday was up. $3,847 across 42 orders, about 18% above your trailing four-week Tuesday average. If you're thinking of a specific dip, it was the Sunday before: $1,204, which lines up with the day you paused the retargeting campaign.",
        askedBy: "mahdi",
        createdAt: daysAgo(1)
      }
    ]
  });

  // --- A couple of routine successful runs for the activity feed ----
  await prisma.run.createMany({
    data: [
      {
        workflowId: idFor("newsletter-automation"),
        status: "success",
        summary: "Draft campaign created in Mailchimp — awaiting your review",
        startedAt: daysAgo(2)
      },
      {
        workflowId: idFor("influencer-discovery"),
        status: "success",
        summary: "11 accounts matched criteria, written to sheet",
        startedAt: daysAgo(4)
      },
      {
        workflowId: idFor("back-in-stock-alerts"),
        status: "success",
        summary: "1 restock notified to 6 waitlisted customers",
        startedAt: daysAgo(4)
      }
    ]
  });

  const counts = {
    workflows: await prisma.workflow.count(),
    runs: await prisma.run.count(),
    alerts: await prisma.alert.count(),
    digests: await prisma.digest.count(),
    actions: await prisma.action.count(),
    segments: await prisma.segment.count(),
    contacts: await prisma.contactLog.count()
  };
  console.log("Done:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
