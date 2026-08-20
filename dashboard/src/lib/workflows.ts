// Central registry of every workflow/automation. This is the source of
// truth the seed script and the /workflows page both read from — add a
// 17th workflow here and it shows up everywhere without touching the DB
// schema.

export type WorkflowCategory =
  | "ops"
  | "ads"
  | "retention"
  | "commerce"
  | "content"
  | "influencers";

export interface WorkflowDef {
  key: string;
  name: string;
  category: WorkflowCategory;
  description: string;
  schedule: string;
  autonomous?: boolean; // can it take real, unattended action (spend money, change prices)?
  monitorOnly?: boolean; // kill switch default — true means "log only" until flipped
}

export const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  ops: "Ops & Briefing",
  ads: "Ads & Testing",
  retention: "Retention & Lifecycle",
  commerce: "Commerce & Pricing",
  content: "Content & Trend",
  influencers: "Influencers"
};

export const WORKFLOWS: WorkflowDef[] = [
  {
    key: "ai-chief-of-staff-briefing",
    name: "AI Chief of Staff — Daily Executive Briefing",
    category: "ops",
    description:
      "Pulls yesterday's Shopify orders, current inventory, and yesterday's Meta Ads performance, merges them, and has Claude write a COO-style briefing: state of business, what's working, what needs attention, and 3 ranked actions for today.",
    schedule: "Daily 7am"
  },
  {
    key: "slack-agent",
    name: '"Talk to Your Business" Slack Agent',
    category: "ops",
    description:
      "On-demand. @-mention with a question and Claude picks which system to query (sales/ads/inventory), pulls real data, and replies in-thread.",
    schedule: "On demand"
  },
  {
    key: "ab-test-reporting",
    name: "A/B Test Reporting",
    category: "ads",
    description:
      "Daily pull of Meta Ads split-test results; Claude writes a plain-English winner, confidence level, and recommendation per test.",
    schedule: "Daily"
  },
  {
    key: "ad-performance-alerts",
    name: "Ad Performance Alerts",
    category: "ads",
    description:
      "Daily check of yesterday's campaign performance; flags low CTR or high cost-per-result, Claude writes a diagnosis + suggested fix. Emails only when something's flagged.",
    schedule: "Daily"
  },
  {
    key: "self-writing-ad-loop",
    name: "Self-Writing, Self-Launching Ad Loop",
    category: "ads",
    description:
      "Reads what's won past A/B tests, has Claude write new ad copy in the winning pattern, and builds a real Meta Campaign + Ad Set with a hard budget cap and end date. Ad set is created paused — needs a human to attach creative/page IDs and flip it live.",
    schedule: "Weekly",
    autonomous: true,
    monitorOnly: true
  },
  {
    key: "abandoned-cart-recovery",
    name: "Abandoned Cart Recovery",
    category: "retention",
    description:
      "Polls Shopify every 15 min for checkouts idle 1-2 hours; sends an SMS (or email fallback) nudge, logs contacted carts so no one gets texted twice.",
    schedule: "Every 15 min"
  },
  {
    key: "back-in-stock-alerts",
    name: "Back-in-Stock Alerts",
    category: "retention",
    description:
      "Customers join a waitlist for sold-out sizes; when inventory restocks, everyone on the waitlist gets an SMS/email automatically.",
    schedule: "Event-driven"
  },
  {
    key: "win-back",
    name: "Win-Back Campaign",
    category: "retention",
    description:
      "Weekly scan of customers inactive 60+ days; sends a discount-code re-engagement offer via SMS/email, logs it so they're not messaged again too soon.",
    schedule: "Weekly"
  },
  {
    key: "ugc-collection",
    name: "UGC Collection",
    category: "retention",
    description:
      "7 days after an order ships, asks the customer to tag the brand on Instagram/TikTok for a discount code; logs who was asked.",
    schedule: "7 days post-ship"
  },
  {
    key: "customer-segmentation-strategist",
    name: "Customer Segmentation Strategist",
    category: "retention",
    description:
      "Weekly auto-segments customers into 5 cohorts (VIP, loyal, bargain hunter, churn-risk, new) by spend/order count/recency. Claude writes a distinct campaign brief per segment. Strategy only — doesn't send anything itself, feeds win-back and VIP lists.",
    schedule: "Weekly"
  },
  {
    key: "dynamic-pricing-engine",
    name: "Autonomous Dynamic Pricing Engine",
    category: "commerce",
    description:
      "Daily sell-through velocity per variant; markdowns on slow movers, bumps on fast sellers. Guardrails: kill switch, hard caps (10% up / 20% down), price floor, anything above auto-approve threshold routes to pending-approval instead of touching Shopify.",
    schedule: "Daily",
    autonomous: true,
    monitorOnly: true
  },
  {
    key: "newsletter-automation",
    name: "Newsletter Automation",
    category: "commerce",
    description:
      "Weekly pull of new Shopify products; Claude writes newsletter copy and creates it as a draft campaign in Mailchimp for manual review and send.",
    schedule: "Weekly"
  },
  {
    key: "trend-hashtag-monitoring",
    name: "Trend & Hashtag Monitoring",
    category: "content",
    description:
      "Daily pull of Instagram hashtag activity (plus TikTok placeholder) around your niche/competitors; Claude writes a digest of emerging trends, competitor moves, and a content idea.",
    schedule: "Daily"
  },
  {
    key: "ai-trend-to-drop-pipeline",
    name: "AI Trend-to-Drop Pipeline",
    category: "content",
    description:
      "Weekly, pulls trend data and the full Shopify catalog side by side; Claude finds the gap between what's trending and what you don't sell yet, and proposes 1-3 product concepts. Labels ideas 'speculative' rather than faking confidence when trend data is thin.",
    schedule: "Weekly"
  },
  {
    key: "influencer-outreach-tracker",
    name: "Influencer Outreach Tracker",
    category: "influencers",
    description:
      "Submit a prospect's Instagram stats via a form; scores engagement rate against thresholds, and if they qualify, Claude drafts a personalized outreach DM to copy-paste and send yourself.",
    schedule: "On demand"
  },
  {
    key: "influencer-discovery",
    name: "Influencer Discovery",
    category: "influencers",
    description:
      "Weekly automated search across Instagram/TikTok (via a paid discovery API) for accounts matching follower/engagement/niche criteria; Claude flags likely audience fit and stores results to a sheet for review.",
    schedule: "Weekly"
  }
];
