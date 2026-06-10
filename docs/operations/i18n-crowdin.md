# I18N and Crowdin

The web app now has a small Arabic/English translation foundation designed for the Next.js App Router without changing existing URLs.

## Source Files

- English source strings live in `apps/web/messages/en.json`.
- Arabic translations live in `apps/web/messages/ar.json`.
- Runtime helpers live in `apps/web/lib/i18n`.
- The reusable switcher lives in `apps/web/components/i18n/language-switcher.tsx`.
- Crowdin configuration lives in `crowdin.yml`.

Messages are grouped by namespace:

- `common`
- `navigation`
- `customer`
- `cart`
- `status`
- `service`
- `staff`
- `cashier`
- `kitchen`
- `owner`
- `platform`
- `errors`
- `debug`

## Locale Behavior

The first implementation uses a safe cookie/localStorage locale mechanism instead of route-based locale segments. This keeps `/customer`, `/staff`, `/platform`, and smoke URLs unchanged.

- Supported locales: `en`, `ar`
- Default locale: `en`
- Cookie: `balcona_locale`
- Local storage key: `balcona.locale`
- Arabic sets `html lang="ar"` and `dir="rtl"`
- English sets `html lang="en"` and `dir="ltr"`

## Adding a New Key

1. Add the English key to `apps/web/messages/en.json`.
2. Add the same key path to `apps/web/messages/ar.json`.
3. Use `useTranslations("namespace")` in a client component.
4. Prefer namespaced keys such as `common.retry` or `navigation.cart`.
5. Keep placeholders stable across languages:

```json
{
  "customer": {
    "tableLabel": "Table {token}"
  }
}
```

Then call:

```tsx
const t = useTranslations("customer");
t("tableLabel", { token: "T01" });
```

## Crowdin Sync

The `crowdin.yml` file maps:

- source: `/apps/web/messages/en.json`
- Arabic output: `/apps/web/messages/ar.json`

Crowdin API tokens and project secrets must be configured in Crowdin/GitHub secrets or the local Crowdin CLI environment. Do not commit tokens, credentials, or generated private config.

Typical flow:

1. Add or update English source strings.
2. Upload sources with `crowdin upload sources` or the GitHub integration.
3. Translate/review Arabic in Crowdin.
4. Download translations with `crowdin download` back into `apps/web/messages/ar.json`.
5. Run `pnpm --filter @balcona-bar/web typecheck` and `pnpm web:build`.

## Arabic Review Rules

- Keep café operations terms natural for Egyptian/Arabic-speaking staff and customers.
- Avoid translating product IDs, route names, QR tokens, request IDs, branch IDs, order IDs, or API codes.
- Preserve placeholders exactly, including braces: `{token}`.
- Preserve debug and error codes as machine-readable English identifiers.
- Avoid adding broad dictionary content. Translate only product UI keys that exist in the app.

## What Not To Translate

- Secrets, tokens, cookies, API keys, or credentials.
- URLs, endpoint paths, QR tokens, request IDs, order IDs, branch IDs, and payment/provider IDs.
- Raw backend error codes.
- Brand names unless product explicitly chooses an Arabic brand form.
