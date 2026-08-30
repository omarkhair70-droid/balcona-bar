export const legacyRouteRedirects = [
  { source: "/customer", destination: "/guest", permanent: false },
  { source: "/customer/:path+", destination: "/guest/:path+", permanent: false },
  { source: "/staff/cashier", destination: "/service/cashier", permanent: false },
  { source: "/staff/waiter", destination: "/service/waiter", permanent: false },
  { source: "/staff/kitchen", destination: "/kitchen", permanent: false },
  { source: "/staff/office", destination: "/office", permanent: false },
  { source: "/staff/menu", destination: "/office/catalog", permanent: false },
  { source: "/staff/inventory", destination: "/office/inventory", permanent: false },
  { source: "/staff/branches", destination: "/office/locations", permanent: false },
  { source: "/staff/team", destination: "/office/team", permanent: false },
  { source: "/staff/money", destination: "/office/money", permanent: false },
  { source: "/staff/experience", destination: "/office/experience", permanent: false },
  { source: "/staff/settings", destination: "/office/settings", permanent: false },
  { source: "/staff/account", destination: "/office/account", permanent: false },
  { source: "/staff/billing", destination: "/office/account", permanent: false },
  { source: "/staff/setup", destination: "/setup", permanent: false },
  { source: "/demo/balkona", destination: "/demo", permanent: false }
];

export const canonicalRouteRewrites = [
  { source: "/guest", destination: "/customer" },
  { source: "/guest/:path+", destination: "/customer/:path+" },
  { source: "/service", destination: "/staff" },
  { source: "/service/cashier", destination: "/staff/cashier" },
  { source: "/service/waiter", destination: "/staff/waiter" },
  { source: "/kitchen", destination: "/staff/kitchen" },
  { source: "/office", destination: "/staff/office" },
  { source: "/office/catalog", destination: "/staff/menu" },
  { source: "/office/inventory", destination: "/staff/inventory" },
  { source: "/office/locations", destination: "/staff/branches" },
  { source: "/office/team", destination: "/staff/team" },
  { source: "/office/money", destination: "/staff/money" },
  { source: "/office/experience", destination: "/staff/experience" },
  { source: "/office/settings", destination: "/staff/settings" },
  { source: "/office/account", destination: "/staff/account" },
  { source: "/setup", destination: "/staff/setup" }
];
