import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  canonicalRouteRewrites,
  legacyRouteRedirects
} from "../apps/web/route-authority.mjs";

const expectedRedirects = new Map([
  ["/customer", "/guest"],
  ["/customer/:path+", "/guest/:path+"],
  ["/staff/cashier", "/service/cashier"],
  ["/staff/waiter", "/service/waiter"],
  ["/staff/kitchen", "/kitchen"],
  ["/staff/office", "/office"],
  ["/staff/menu", "/office/catalog"],
  ["/staff/inventory", "/office/inventory"],
  ["/staff/branches", "/office/locations"],
  ["/staff/team", "/office/team"],
  ["/staff/money", "/office/money"],
  ["/staff/experience", "/office/experience"],
  ["/staff/settings", "/office/settings"],
  ["/staff/account", "/office/account"],
  ["/staff/billing", "/office/account"],
  ["/staff/setup", "/setup"],
  ["/demo/balkona", "/demo"]
]);

const expectedRewrites = new Map([
  ["/guest", "/customer"],
  ["/guest/:path+", "/customer/:path+"],
  ["/service", "/staff"],
  ["/service/cashier", "/staff/cashier"],
  ["/service/waiter", "/staff/waiter"],
  ["/kitchen", "/staff/kitchen"],
  ["/office", "/staff/office"],
  ["/office/catalog", "/staff/menu"],
  ["/office/inventory", "/staff/inventory"],
  ["/office/locations", "/staff/branches"],
  ["/office/team", "/staff/team"],
  ["/office/money", "/staff/money"],
  ["/office/experience", "/staff/experience"],
  ["/office/settings", "/staff/settings"],
  ["/office/account", "/staff/account"],
  ["/setup", "/staff/setup"]
]);

function assertMapping(actual, expected, label) {
  const seen = new Set();

  for (const entry of actual) {
    if (seen.has(entry.source)) {
      throw new Error(`${label}: duplicate source ${entry.source}`);
    }
    seen.add(entry.source);

    const expectedDestination = expected.get(entry.source);
    if (!expectedDestination) {
      throw new Error(`${label}: unexpected source ${entry.source}`);
    }
    if (entry.destination !== expectedDestination) {
      throw new Error(
        `${label}: ${entry.source} must resolve to ${expectedDestination}, got ${entry.destination}`
      );
    }
  }

  for (const source of expected.keys()) {
    if (!seen.has(source)) {
      throw new Error(`${label}: missing source ${source}`);
    }
  }
}

assertMapping(legacyRouteRedirects, expectedRedirects, "legacy redirects");
assertMapping(canonicalRouteRewrites, expectedRewrites, "canonical rewrites");

const forbiddenRuntimeRoots = [
  "/customer",
  "/staff/cashier",
  "/staff/waiter",
  "/staff/kitchen",
  "/staff/office",
  "/staff/owner",
  "/staff/menu",
  "/staff/inventory",
  "/staff/branches",
  "/staff/team",
  "/staff/money",
  "/staff/experience",
  "/staff/settings",
  "/staff/account",
  "/staff/billing",
  "/staff/setup",
  "/demo/balkona"
];

async function filesUnder(target) {
  const info = await stat(target);
  if (info.isFile()) {
    return [target];
  }

  const entries = await readdir(target);
  const nested = await Promise.all(
    entries.map((entry) => filesUnder(path.join(target, entry)))
  );
  return nested.flat();
}

const runtimeFiles = (
  await Promise.all(
    ["apps/web/app", "apps/web/features", "apps/web/lib"].map(filesUnder)
  )
).flat().filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file));

const violations = [];
for (const file of runtimeFiles) {
  const source = await readFile(file, "utf8");

  for (const legacyRoot of forbiddenRuntimeRoots) {
    const escaped = legacyRoot.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
    const routeLiteral = new RegExp(
      "([\\\"'\\`])" + escaped + "(?=\\\\/|#|\\\\?|[\\\"'\\`])",
      "g"
    );

    if (routeLiteral.test(source)) {
      violations.push(`${file}: ${legacyRoot}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Runtime code still emits legacy product routes:\n${violations.join("\n")}`
  );
}

console.log(
  `S9 route authority OK: ${legacyRouteRedirects.length} redirects, ${canonicalRouteRewrites.length} canonical rewrites, no legacy runtime links.`
);
