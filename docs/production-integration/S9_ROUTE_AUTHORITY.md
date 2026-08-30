# S9 — Canonical Route Authority

Status: IMPLEMENTED ON `closure/route-authority-s9`

## Decision

The approved product surfaces now own these public/runtime namespaces:

| Product surface | Canonical route |
| --- | --- |
| Balcona Guest | `/guest/*` |
| Balcona Service | `/service/*` |
| Balcona Kitchen | `/kitchen` |
| Balcona Office | `/office/*` |
| Balcona Setup | `/setup` |
| Balcona Platform | `/platform/*` |

Platform was already canonical and is unchanged.

Authentication/invitation routes remain under `/staff/login` and `/staff/invite/*`.
`/staff` remains a role-aware authenticated launcher; it is not a product namespace.

## Canonical implementation routes

Guest:
- `/guest`
- `/guest/table/[qrToken]`
- `/guest/session/[sessionId]/*`

Service:
- `/service` role-aware entry
- `/service/cashier`
- `/service/waiter`

Office:
- `/office`
- `/office/catalog`
- `/office/inventory`
- `/office/locations`
- `/office/team`
- `/office/money`
- `/office/experience`
- `/office/settings`
- `/office/account`

Kitchen:
- `/kitchen`

Setup:
- `/setup`

## Compatibility

Legacy customer and staff product URLs redirect to the canonical namespace.
The redirect contract lives in `apps/web/route-authority.mjs`.

`/staff/owner` is the one intentional client compatibility route because URL fragments are not sent to the server. It translates legacy hashes without losing their meaning:

- `#operations` → `/office#operations`
- `#insights` → `/office#insights`
- `#money` → `/office/money`
- `#team` → `/office/team`
- `#experience` → `/office/experience`
- `#settings` → `/office/settings`
- `#account` → `/office/account`
- no hash → `/office`

The old demo launcher `/demo/balkona` redirects to `/demo`.

## Closure rule

Production runtime code must emit canonical routes only.
Legacy paths exist only at the compatibility boundary, never as new navigation targets.

CI runs `node scripts/route-authority-check.mjs` to enforce this contract.
