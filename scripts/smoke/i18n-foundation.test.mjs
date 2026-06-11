import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const requiredNamespaces = [
  "common",
  "navigation",
  "customer",
  "cart",
  "status",
  "service",
  "staff",
  "cashier",
  "kitchen",
  "owner",
  "platform",
  "errors",
  "debug"
];
const sensitivePattern = /(api[_-]?token|secret|password|authorization|cookie)/i;

async function readText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function flattenKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    return nested && typeof nested === "object" && !Array.isArray(nested)
      ? flattenKeys(nested, nextPrefix)
      : [nextPrefix];
  });
}

function flattenEntries(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    return nested && typeof nested === "object" && !Array.isArray(nested)
      ? flattenEntries(nested, nextPrefix)
      : [[nextPrefix, String(nested)]];
  });
}

function placeholders(value) {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
    .map((match) => match[1])
    .sort();
}

describe("i18n Crowdin foundation", () => {
  it("keeps English and Arabic message namespaces aligned", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const arMessages = await readJson("../../apps/web/messages/ar.json");

    for (const namespace of requiredNamespaces) {
      assert.ok(enMessages[namespace], `missing en namespace ${namespace}`);
      assert.ok(arMessages[namespace], `missing ar namespace ${namespace}`);
    }

    assert.deepEqual(flattenKeys(arMessages).sort(), flattenKeys(enMessages).sort());
  });

  it("keeps English and Arabic placeholders aligned", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const arMessages = await readJson("../../apps/web/messages/ar.json");
    const arEntries = new Map(flattenEntries(arMessages));

    for (const [key, enValue] of flattenEntries(enMessages)) {
      assert.deepEqual(
        placeholders(arEntries.get(key) ?? ""),
        placeholders(enValue),
        `placeholder mismatch for ${key}`
      );
    }
  });

  it("includes the customer ordering namespaces required for Crowdin", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const customer = enMessages.customer;

    for (const namespace of [
      "actions",
      "ai",
      "bill",
      "cart",
      "empty",
      "entry",
      "errors",
      "home",
      "item",
      "menu",
      "quantity",
      "realtime",
      "service",
      "status",
      "tableStart"
    ]) {
      assert.ok(customer[namespace], `missing customer.${namespace}`);
    }
  });

  it("includes the staff workflow namespaces required for Crowdin", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const staff = enMessages.staff;

    for (const namespace of [
      "access",
      "actions",
      "attention",
      "auth",
      "barista",
      "billRequests",
      "cashier",
      "errors",
      "kitchen",
      "navigation",
      "orders",
      "overview",
      "realtime",
      "selectors",
      "shell",
      "tasks",
      "tickets",
      "waiter"
    ]) {
      assert.ok(staff[namespace], `missing staff.${namespace}`);
    }
  });

  it("includes the owner and platform namespaces required for Crowdin", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const owner = enMessages.owner;
    const platform = enMessages.platform;

    for (const namespace of [
      "actions",
      "activity",
      "analytics",
      "attention",
      "branch",
      "dashboard",
      "empty",
      "errors",
      "health",
      "menu",
      "operations",
      "orders",
      "pulse",
      "readiness"
    ]) {
      assert.ok(owner[namespace], `missing owner.${namespace}`);
    }

    for (const namespace of [
      "actions",
      "auth",
      "companies",
      "company",
      "empty",
      "errors",
      "navigation",
      "onboarding",
      "shell",
      "status"
    ]) {
      assert.ok(platform[namespace], `missing platform.${namespace}`);
    }
  });

  it("includes the root product shell and demo launcher namespaces", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const arMessages = await readJson("../../apps/web/messages/ar.json");

    assert.ok(enMessages.home, "missing en.home");
    assert.ok(arMessages.home, "missing ar.home");
    assert.ok(enMessages.demo, "missing en.demo");
    assert.ok(arMessages.demo, "missing ar.demo");
    assert.ok(enMessages.demo.routes.customerQrDemo);
    assert.ok(arMessages.demo.routes.customerQrDemo);
    assert.ok(enMessages.demo.checklist.openCustomerQr);
    assert.ok(arMessages.demo.checklist.openCustomerQr);
    assert.ok(enMessages.demo.proof.tableQrSession);
    assert.ok(arMessages.demo.proof.tableQrSession);
  });

  it("includes the AI waiter namespaces required for Crowdin", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const ai = enMessages.customer.ai;

    for (const namespace of [
      "actions",
      "composer",
      "empty",
      "errors",
      "escalation",
      "language",
      "messages",
      "page",
      "prompts",
      "proposal",
      "status",
      "tools"
    ]) {
      assert.ok(ai[namespace], `missing customer.ai.${namespace}`);
    }
  });

  it("keeps extracted customer ordering strings out of targeted source files", async () => {
    const files = [
      "../../apps/web/features/customer/pages/customer-entry-page.tsx",
      "../../apps/web/features/customer/pages/customer-table-start-page.tsx",
      "../../apps/web/features/customer/pages/customer-session-home-page.tsx",
      "../../apps/web/features/customer/pages/customer-menu-page.tsx",
      "../../apps/web/features/customer/pages/customer-cart-page.tsx",
      "../../apps/web/features/customer/pages/customer-status-page.tsx",
      "../../apps/web/features/customer/pages/customer-service-page.tsx",
      "../../apps/web/features/customer/item-detail-panel.tsx",
      "../../apps/web/features/customer/menu-item-card.tsx",
      "../../apps/web/features/customer/cart-summary.tsx",
      "../../apps/web/features/customer/service-action-card.tsx",
      "../../apps/web/features/customer/status-timeline.tsx"
    ];
    const extractedPhrases = [
      "Start your table experience",
      "Enter or scan a table token",
      "Opening your table session",
      "Your table is live",
      "Choose for the table",
      "Menu could not load",
      "Review before sending",
      "Your cart is empty",
      "Submit order",
      "Follow your table timeline",
      "Orders could not load",
      "Ask the team without leaving your table",
      "We could not request the bill yet",
      "A table-ready selection from the menu.",
      "Add to cart",
      "Prepared for this table experience.",
      "Cart is ready",
      "Your table timeline will appear"
    ];
    const combinedSource = (
      await Promise.all(files.map((file) => readText(file)))
    ).join("\n");

    for (const phrase of extractedPhrases) {
      assert.doesNotMatch(combinedSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps extracted staff workflow strings out of targeted source files", async () => {
    const files = [
      "../../apps/web/features/staff/staff-shell-frame.tsx",
      "../../apps/web/features/staff/components/staff-auth-gate.tsx",
      "../../apps/web/features/staff/components/staff-branch-selector.tsx",
      "../../apps/web/features/staff/components/staff-realtime-status.tsx",
      "../../apps/web/features/staff/pages/staff-login-page.tsx",
      "../../apps/web/features/staff/pages/staff-overview-page.tsx",
      "../../apps/web/features/staff/pages/cashier-dashboard-page.tsx",
      "../../apps/web/features/staff/components/cashier-order-queue.tsx",
      "../../apps/web/features/staff/components/cashier-order-card.tsx",
      "../../apps/web/features/staff/components/cashier-order-detail-panel.tsx",
      "../../apps/web/features/staff/components/cashier-action-bar.tsx",
      "../../apps/web/features/staff/components/bill-request-queue.tsx",
      "../../apps/web/features/staff/components/bill-request-card.tsx",
      "../../apps/web/features/staff/pages/kitchen-dashboard-page.tsx",
      "../../apps/web/features/staff/components/kitchen-task-board.tsx",
      "../../apps/web/features/staff/components/kitchen-task-card.tsx",
      "../../apps/web/features/staff/components/kitchen-task-detail-panel.tsx",
      "../../apps/web/features/staff/components/kitchen-action-bar.tsx",
      "../../apps/web/features/staff/components/kitchen-station-filter.tsx",
      "../../apps/web/features/staff/pages/waiter-dashboard-page.tsx",
      "../../apps/web/features/staff/components/waiter-call-queue.tsx",
      "../../apps/web/features/staff/components/waiter-call-card.tsx",
      "../../apps/web/features/staff/components/waiter-call-detail-panel.tsx",
      "../../apps/web/features/staff/components/attention-queue.tsx",
      "../../apps/web/features/staff/components/attention-card.tsx",
      "../../apps/web/features/staff/components/attention-detail-panel.tsx"
    ];
    const extractedPhrases = [
      "Open staff session",
      "Staff login required",
      "Incoming orders",
      "Order detail",
      "Bill requests",
      "Manual payment",
      "Cashier dashboard",
      "Preparation board",
      "Task detail",
      "Kitchen Display System",
      "Waiter calls",
      "Call detail",
      "Attention queue",
      "Ready orders",
      "Waiter dashboard",
      "Staff command surface"
    ];
    const combinedSource = (
      await Promise.all(files.map((file) => readText(file)))
    ).join("\n");

    for (const phrase of extractedPhrases) {
      assert.doesNotMatch(combinedSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps extracted owner and platform strings out of targeted source files", async () => {
    const files = [
      "../../apps/web/features/platform/platform-shell.tsx",
      "../../apps/web/features/platform/components/platform-auth-gate.tsx",
      "../../apps/web/features/platform/pages/platform-login-page.tsx",
      "../../apps/web/features/platform/pages/platform-dashboard-page.tsx",
      "../../apps/web/features/platform/pages/platform-company-detail-page.tsx",
      "../../apps/web/features/platform/pages/platform-new-company-page.tsx",
      "../../apps/web/features/platform/pages/platform-status-page.tsx",
      "../../apps/web/features/staff/pages/owner-dashboard-page.tsx",
      "../../apps/web/features/staff/components/owner-attention-summary.tsx",
      "../../apps/web/features/staff/components/owner-experience-readiness.tsx",
      "../../apps/web/features/staff/components/owner-health-panel.tsx",
      "../../apps/web/features/staff/components/owner-operations-snapshot.tsx",
      "../../apps/web/features/staff/components/owner-pulse-metrics.tsx",
      "../../apps/web/features/staff/components/owner-recent-activity.tsx"
    ];
    const extractedPhrases = [
      "Platform login required",
      "Open platform session",
      "Platform companies",
      "No cafe workspaces yet",
      "Company workspace created",
      "Create Cafe Workspace",
      "Company detail could not be loaded",
      "Staging status",
      "Railway API metadata",
      "Owner command center",
      "Owner analytics could not load",
      "Tender breakdown",
      "Order timing",
      "Latest paid bill",
      "Top attention risks",
      "Menu / experience readiness",
      "Recent activity",
      "Active orders",
      "Operations snapshot"
    ];
    const combinedSource = (
      await Promise.all(files.map((file) => readText(file)))
    ).join("\n");

    for (const phrase of extractedPhrases) {
      assert.doesNotMatch(combinedSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps extracted product shell and demo launcher strings out of targeted source files", async () => {
    const files = [
      "../../apps/web/app/page.tsx",
      "../../apps/web/app/demo/balkona/page.tsx",
      "../../apps/web/features/demo/balkona-demo.ts",
      "../../apps/web/features/staff/pages/staff-overview-page.tsx",
      "../../apps/web/components/ui/app-shell.tsx",
      "../../apps/web/components/ui/dashboard-shell.tsx"
    ];
    const extractedPhrases = [
      "Premium smart cafe product shell",
      "Full demo launcher",
      "Balkona Bar Full Operating Demo",
      "Open demo surfaces",
      "Customer QR demo",
      "Staff demo credentials",
      "Presentation reminder",
      "Full demo flow checklist",
      "What this demo proves",
      "Local demo diagnostics",
      "Dashboard sections",
      "App sections",
      "Smart cafe OS",
      "Open launcher"
    ];
    const combinedSource = (
      await Promise.all(files.map((file) => readText(file)))
    ).join("\n");

    for (const phrase of extractedPhrases) {
      assert.doesNotMatch(combinedSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps extracted AI waiter strings out of targeted source files", async () => {
    const files = [
      "../../apps/web/features/customer/pages/ai-waiter-page.tsx",
      "../../apps/web/features/customer/ai-chat-shell.tsx",
      "../../apps/web/features/customer/ai-message-composer.tsx",
      "../../apps/web/features/customer/ai-message-bubble.tsx",
      "../../apps/web/features/customer/ai-cart-proposal-card.tsx",
      "../../apps/web/features/customer/ai-escalation-card.tsx",
      "../../apps/web/features/customer/ai-suggested-prompts.tsx",
      "../../apps/web/features/customer/ai-waiter-status-pill.tsx",
      "../../apps/web/features/customer/ai-waiter-helpers.ts"
    ];
    const extractedPhrases = [
      "AI cafe concierge",
      "AI café concierge",
      "AI suggests. You confirm.",
      "Based on branch menu and availability.",
      "Cart validation keeps price authority.",
      "Message AI waiter",
      "Tell the waiter what you like...",
      "Suggestions use this branch menu and availability.",
      "Cart proposal",
      "Apply to cart",
      "Ask a human waiter",
      "Bill request sent",
      "Waiter notified",
      "Order status checked",
      "No messages yet",
      "Message sent. Any cart proposal still needs your confirmation.",
      "Recommend something light",
      "رشحلي حاجة خفيفة"
    ];
    const combinedSource = (
      await Promise.all(files.map((file) => readText(file)))
    ).join("\n");

    for (const phrase of extractedPhrases) {
      assert.doesNotMatch(combinedSource, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("keeps Crowdin configured for English source and Arabic output without secrets", async () => {
    const crowdinConfig = await readText("../../crowdin.yml");

    assert.match(crowdinConfig, /source:\s*apps\/web\/messages\/en\.json/);
    assert.match(
      crowdinConfig,
      /translation:\s*apps\/web\/messages\/%two_letters_code%\.json/
    );
    assert.doesNotMatch(crowdinConfig, /(?:source|translation):\s*\//);
    assert.match(crowdinConfig, /preserve_hierarchy:\s*true/);
    assert.doesNotMatch(crowdinConfig, sensitivePattern);
  });

  it("documents the Crowdin workflow and placeholder rules", async () => {
    const docs = await readText("../../docs/operations/i18n-crowdin.md");

    assert.match(docs, /apps\/web\/messages\/en\.json/);
    assert.match(docs, /crowdin upload sources/);
    assert.match(docs, /placeholders/i);
    assert.match(docs, /\{token\}/);
  });

  it("wires lang, dir, language switching, and debug locale support in shared code", async () => {
    const layoutSource = await readText("../../apps/web/app/layout.tsx");
    const switcherSource = await readText(
      "../../apps/web/components/i18n/language-switcher.tsx"
    );
    const debugReportSource = await readText(
      "../../apps/web/lib/observability/debug-report.ts"
    );

    assert.match(layoutSource, /<html lang=\{locale\} dir=\{getLocaleDirection\(locale\)\}/);
    assert.match(switcherSource, /LANGUAGE_OPTIONS\.map/);
    assert.match(switcherSource, /setLocale\(option\.locale\)/);
    assert.match(debugReportSource, /locale:\s*input\.locale \?\?/);
  });
});
