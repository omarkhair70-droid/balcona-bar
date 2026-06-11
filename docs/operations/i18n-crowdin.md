# I18N and Crowdin Runbook

Balcona uses English as the source catalog and Arabic as the Crowdin-managed
target catalog for the Next.js web app. The runtime keeps existing URLs intact:
locale is stored in a cookie/localStorage pair, and Arabic switches the document
to `lang="ar"` and `dir="rtl"`.

## Source Of Truth

- English source: `apps/web/messages/en.json`
- Arabic target: `apps/web/messages/ar.json`
- Runtime helpers: `apps/web/lib/i18n`
- Language switcher: `apps/web/components/i18n/language-switcher.tsx`
- Crowdin config: `crowdin.yml`

Crowdin must upload only `apps/web/messages/en.json` as source. It must write
Arabic to `apps/web/messages/ar.json` through the configured
`%two_letters_code%` mapping.

The paths in `crowdin.yml` are intentionally relative, not `/`-prefixed, so the
Crowdin CLI can match files in the GitHub Actions checkout.

## Local Commands

Run these before opening or merging an i18n PR:

```bash
pnpm i18n:qa
pnpm i18n:qa:ar
pnpm i18n:crowdin:preflight
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
pnpm smoke:test
node --check scripts/smoke/staging-smoke.mjs
git diff --check
```

Crowdin sync commands are available when the Crowdin CLI is installed and the
required environment variables are present:

```bash
pnpm i18n:crowdin:upload
pnpm i18n:crowdin:download
pnpm i18n:crowdin:sync
```

If the Crowdin CLI is missing, the helper fails with a clear setup message. The
repo does not vendor the CLI.

The helper wraps the same manual Crowdin CLI flow operators can run directly:
`crowdin upload sources` to publish English source strings and
`crowdin download translations` to retrieve Arabic translations.
It writes a temporary Crowdin config in the repo root so relative source and
translation paths resolve against the checked-out repository.
The GitHub/Crowdin integration stores these files under the Crowdin branch named
`main`; the helper passes `--branch main` by default for upload and download.
Set `CROWDIN_BRANCH` only when intentionally syncing another Crowdin branch.
Downloads use `CROWDIN_LANGUAGE`, default `ar`, and pass `--all` so missing
source/export mismatches do not silently hide translations. During this setup
stage, the helper does not pass `--export-only-approved`; unreviewed Crowdin
translations can still download for QA cleanup. Before the real download, the
helper runs this safe diagnostic check:

```bash
crowdin download translations --branch main --language ar --all --dryrun --tree
```

After the real download, it prints safe diagnostics, compares the before/after
`apps/web/messages/ar.json` hash, lists likely wrong output paths, and fails if
`ar.json` did not change. That prevents a green workflow from silently skipping
the localization PR.

## Required Secrets

Crowdin upload/download/sync requires:

- `CROWDIN_PROJECT_ID`
- `CROWDIN_PERSONAL_TOKEN`

Optional:

- `CROWDIN_BRANCH`, default `main`
- `CROWDIN_LANGUAGE`, default `ar`
- `ALLOW_EMPTY_CROWDIN_DOWNLOAD`, default unset. Set to `true` only for
  diagnostics when investigating Crowdin branch, language, or export-path
  issues.

Put these in:

- local environment variables for local sync
- GitHub Actions secrets for the manual workflow

Never put them in:

- `crowdin.yml`
- `.env.example`
- source code
- docs with real values
- PR comments or screenshots

The scripts print only whether each variable is present. They never print the
token value.

## Manual First Run Setup

1. Create a Crowdin project outside the repo.
2. Add `CROWDIN_PROJECT_ID` and `CROWDIN_PERSONAL_TOKEN` locally.
3. Install the Crowdin CLI outside the repo.
4. Run `pnpm i18n:crowdin:preflight`.
5. Upload source with `pnpm i18n:crowdin:upload`, which uses Crowdin branch
   `main` unless `CROWDIN_BRANCH` is set.
6. Translate and review Arabic in Crowdin.
7. Download Arabic with `pnpm i18n:crowdin:download` from the same Crowdin
   branch. The helper runs `crowdin download translations --language ar --all`
   by default, with `CROWDIN_LANGUAGE` available for intentional overrides.
8. If the download fails because `apps/web/messages/ar.json` did not change,
   check the Crowdin branch, Arabic language mapping, and export path. Use
   `ALLOW_EMPTY_CROWDIN_DOWNLOAD=true` only to gather diagnostics.
9. Run `pnpm i18n:qa` and `pnpm i18n:qa:ar`.
10. Run web build and smoke tests.
11. Open a PR for the downloaded Arabic catalog changes.

## GitHub Actions Sync

`.github/workflows/i18n-crowdin.yml` is manual-only through
`workflow_dispatch`. It:

1. Checks out the repo.
2. Installs pnpm dependencies.
3. Installs the Crowdin CLI.
4. Uses GitHub secrets for Crowdin credentials.
5. Uploads English source to `CROWDIN_BRANCH`, default `main`.
6. Runs a safe Crowdin dry run for `download translations --language ar --all`.
7. Downloads Arabic translations from `CROWDIN_BRANCH`, default `main`, and
   `CROWDIN_LANGUAGE`, default `ar`.
8. Fails if Crowdin download succeeds but `apps/web/messages/ar.json` is
   unchanged, unless `ALLOW_EMPTY_CROWDIN_DOWNLOAD=true` is explicitly set for
   diagnostics.
9. Runs `pnpm i18n:qa`.
10. Opens a localization PR if files changed.

If the workflow reports that `ar.json` did not change, inspect the printed
diagnostics for:

- `git status --short`
- before/after `ar.json` SHA-256 hashes
- obvious English strings still present in `ar.json`
- newly created files under `apps/web/messages`
- common wrong output paths such as `apps/web/messages/ar-EG.json`,
  `apps/web/messages/en/ar.json`, `translations/**`, or `build/**`

This workflow should not be scheduled until the Crowdin project is stable.

## Adding A New Key

1. Add a semantic English key in `apps/web/messages/en.json`.
2. Add the same key path in `apps/web/messages/ar.json`.
3. Use `useTranslations("namespace")` from the existing i18n provider.
4. Keep placeholders identical across languages.

Good keys:

- `customer.cart.submitOrder`
- `staff.cashier.acceptOrder`
- `platform.companies.createCompany`

Avoid visual or positional keys:

- `button1`
- `leftCardText`
- `pageTextTop`

## Placeholder Rules

Placeholders must match exactly across English and Arabic:

```json
{
  "customer": {
    "tableLabel": "Table {token}"
  }
}
```

Do not rename, remove, translate, or add placeholders unless the code changes
at the same time. Examples that must remain exact:

- `{count}`
- `{price}`
- `{name}`
- `{status}`
- `{token}`
- `{requestId}`

## What Not To Translate

Do not translate or catalog:

- real secrets, tokens, cookies, passwords, or API keys
- request IDs, order IDs, branch IDs, company IDs, QR tokens
- backend enum values and raw error/debug codes
- action/debug codes such as `ai_waiter_close` or `customer_ai_waiter`
- API route names
- AI tool names sent to the backend
- raw assistant/customer messages returned by the backend
- source code identifiers

Some customer-visible labels necessarily mention concepts like password fields
or table QR tokens. Those labels are allowed. Secret values are not.

## Arabic QA

Use `pnpm i18n:qa:ar` to print a coverage report:

- total strings
- strings containing Arabic script
- strings still identical to English
- placeholder-only strings
- suspicious untranslated samples

Coverage is informational for now. The build does not fail only because Arabic
still mirrors English; Crowdin review is responsible for gradually replacing
those values.

See `docs/operations/arabic-qa.md` for the visual and functional QA checklist.
