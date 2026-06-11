# Arabic QA Checklist

Use this checklist after downloading Arabic translations from Crowdin and before
merging localization changes.

## Visual RTL Checks

Check Arabic mode in these surfaces:

- language switcher
- customer table open
- customer menu
- customer item detail
- customer cart
- customer order status
- customer service and bill request
- AI waiter chat and proposal cards
- staff login
- cashier dashboard
- kitchen and barista dashboard
- waiter dashboard
- owner dashboard
- platform companies and company detail

Look for:

- `html lang="ar"` and `dir="rtl"`
- controls remain clickable
- icons and badges do not overlap text
- buttons do not clip longer Arabic labels
- numeric values and IDs remain readable
- mixed Arabic/English text still scans naturally

## Functional Checks

Confirm:

- changing locale does not change or break routes
- customer cart and order flow still works
- staff cashier/kitchen/waiter actions still work
- AI language payloads remain `en` and `ar-EG`
- debug report includes the selected locale
- request IDs and debug codes remain visible when expected
- no raw tokens, cookies, passwords, or API keys appear in UI or reports
- raw assistant/customer messages from the backend are not rewritten by the UI

## Commands Before Merge

```bash
pnpm i18n:qa
pnpm i18n:qa:ar
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
pnpm smoke:test
node --check scripts/smoke/staging-smoke.mjs
git diff --check
```

## Post Deploy

Run the clean staging smoke after deploy:

```bash
pnpm smoke:staging:clean-full
```

## Screenshot Checklist

Capture screenshots when reviewing a Crowdin translation PR:

- customer table home in Arabic
- customer menu and item detail in Arabic
- customer cart with totals in Arabic
- AI waiter chat with Arabic prompt chips
- staff cashier order detail in Arabic
- kitchen task board in Arabic
- owner dashboard in Arabic
- platform company detail in Arabic

Do not include tokens, cookies, passwords, or private invite links in screenshots.
