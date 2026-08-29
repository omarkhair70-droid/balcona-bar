# Balcona Guest — Visual Benchmark Audit

Status: EVIDENCE PASS COMPLETE — IMPLEMENTATION REVISION REQUIRED
Date: 2026-08-28

## Purpose

This document replaces the earlier text-only Guest reference proof with a screen-by-screen visual benchmark pass.

The current Guest prototype before this audit is treated as **V0**, not final visual direction.

## Sources inspected visually

### me&u — Order & Pay
Official product:
https://www.meandu.com/serve/order-pay

Official guest-facing/help screenshots inspected:
- Venue/menu landing with venue image, venue identity, Dine-in + Table context, Browse menu, Start group order, and photo-led category tiles:
  https://help.meandu.com/hc/article_attachments/13097476857871
- Item detail with large food photography, item name/description/price, special instructions, quantity, and Add to order:
  https://help.meandu.com/hc/article_attachments/11238599625743
- Item detail with contextual upsell rows:
  https://help.meandu.com/hc/article_attachments/12399248223503
- Compact menu list with sticky categories and image-backed rows:
  https://cdn.prod.website-files.com/655a8cebcb1ae6c081bb704c/668e1356d0d6e2e81d1197cb_3.webp

Observed strengths:
- hospitality identity is visible before utility chrome
- table context is obvious but not dominant
- food photography carries the experience
- menu browsing is dense enough to scan
- category navigation remains close to content
- item detail owns modifiers/notes
- upsell/personalisation appears contextually, not as a separate app section

Do not copy:
- me&u account/profile ecosystem
- group-tab features not currently represented in Balcona backend
- network-level personalised taste profile behavior

### Toast — Mobile Order & Pay
Official guest flow:
https://support.toasttab.com/en/article/Guest-Experience-for-Toast-Mobile-Order-Pay

Official screenshot inspected:
- mobile menu + category tabs + compact item rows with thumbnails and plus action
- persistent Pay my tab banner
- persistent Continue to place order CTA
- order review with contextual meal recommendations
  https://dwvhey99m5tyy.cloudfront.net/images/ka2PV000000IRhOYAW/0EM4W0000079FdM

Official supporting docs:
https://support.toasttab.com/en/article/Setting-Up-Toast-Mobile-Order-and-Pay
https://support.toasttab.com/en/article/Toast-Mobile-Order-and-Pay-FAQs

Observed strengths:
- ordering CTA remains visible while browsing
- open-tab/bill state is surfaced inside menu flow
- list rows are faster than large e-commerce tiles for long restaurant menus
- featured/popular content is separated from the core list
- checkout/reorder behavior remains session-aware

Do not copy:
- Toast account/pre-auth model unless Balcona backend explicitly supports it
- loyalty / account / group-order surfaces
- automatic recommendation claims unsupported by Balcona

### Lightspeed — Order Anywhere
Official customer flow:
https://resto-support.lightspeedhq.com/hc/en-us/articles/4411456554267-How-customers-use-Order-Anywhere

Official screenshots inspected:
- item detail modal with quantity and Add to cart
  https://resto-support.lightspeedhq.com/hc/article_attachments/4411587581595
- mobile menu + sticky total/item count + View cart → Checkout
  https://resto-support.lightspeedhq.com/hc/article_attachments/6667427886363/order-anywhere-mobile-view-cart-checkout.png
- table-order payment choice and Place order CTA
  https://resto-support.lightspeedhq.com/hc/article_attachments/4411587901723/order-anywhere-on-premises-place-order.png

Observed strengths:
- straightforward menu → item → cart → checkout chain
- primary action anchored to bottom on mobile
- business/venue context stays restrained
- payment/order confirmation language is explicit

Do not copy:
- pickup/delivery profile controls into the dine-in Guest surface
- provider-specific Apple/Google Pay promises without configured Balcona provider support

## Backend truth checked against Balcona

Guest-visible jobs are supported by existing backend:
- QR/table sessions
- branch-effective menu
- item detail
- cart add/update/remove/clear/validate
- selected modifiers
- item notes up to 500 chars
- order submission with optional customer note
- customer order status + timeline
- waiter calls
- bill requests
- AI Waiter session/messages
- AI cart proposals + apply/reject
- AI escalation to human
- customer online-payment intents
- customer payment intent status

## V0 visual gaps

### G1 Menu
V0 problem:
- oversized dark greeting card
- two-column product grid reads like generic commerce
- synthetic gradient placeholders dominate
- category browse is visually secondary
- menu density is too low for realistic restaurant use

Revision:
- compact venue/session header
- optional venue media strip
- category navigation close to menu
- Featured section only because Balcona menu supports featured items
- core menu becomes scan-friendly rows with thumbnail + name + description + price + add
- persistent cart CTA

### G2 Item detail / modifiers
V0 strengths:
- bottom sheet
- strong add CTA

Missing:
- backend-supported item notes
- clearer modifier group semantics
- quantity control

Revision:
- full-width media
- price/name before modifiers
- required-style modifier selection
- quantity
- optional notes
- sticky Add to cart total

### G3 Cart
V0 strengths:
- quantities + subtotal + submit

Missing:
- order-level note supported by backend
- stronger edit/checkout hierarchy

Revision:
- add order note
- preserve item modifiers/notes
- bottom submit action remains stable

### G4 AI
V0 problem:
- one canned recommendation reads like demo content

Revision:
- AI remains contextual
- show prompt chips
- show explicit cart proposal card
- Apply / reject
- Human waiter escalation
- no claim of user-profile personalisation

### G5 Order status
V0 direction is valid.

Refinement:
- reduce prototype/demo language in primary hierarchy
- explicit live restaurant status
- make current state dominant
- preserve submitted → accepted → preparing → ready → served

### G6 Service
V0 direction is valid.

Refinement:
- existing call state must be obvious
- bill request state must move guest naturally into Bill
- AI escalation lives here as a secondary helper, not equal navigation

### G7 Bill / payment
V0 direction is strong.

Keep:
- requested → presented → paying → paid
- unknown is not failed
- warning not to repay while status is unknown

Refine:
- payment status takes visual priority over invoice line items when unresolved
- no reconciliation/provider internals

## Revised synthesis

**Guest Menu**
me&u hospitality/media hierarchy
+ Toast session/tab visibility
+ Lightspeed cart action clarity
+ Balcona featured/menu/AI truth

**Item / Cart**
me&u item-detail richness
+ Lightspeed step clarity
+ Balcona modifier/note/cart contracts

**Order / Service**
Toast continuity
+ Balcona realtime status/waiter-call truth

**Bill / Payment**
Lightspeed action clarity
+ Balcona payment-state safety

## Acceptance gate after revision

Guest cannot be marked visually closed until:
1. Menu no longer reads as generic e-commerce.
2. Venue/table context is visible without becoming a hero.
3. Core menu rows scan quickly.
4. Featured content is subordinate to browse.
5. item detail supports quantity + modifiers + notes.
6. cart supports order note.
7. AI proposal is contextual and explicit.
8. waiter-call and bill-request states are visible.
9. payment unknown is visually distinct from failed.
10. Arabic / RTL remains natural.
