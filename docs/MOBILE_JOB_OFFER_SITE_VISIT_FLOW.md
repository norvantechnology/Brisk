# Mobile — Offer + Job Post + Site Visit Pay Flow

> **Audience:** Customer mobile app developers  
> **Swagger:** `/api-docs` (tags: `Customer / Offers`, `Customer / Jobs`, `Customer / Checkout`, `Customer / Property`)  
> **Live API:** `https://brisk-aclm.onrender.com`  
> **Auth:** `Authorization: Bearer <customer_jwt>` on all endpoints below  
> **Updated:** Sep 2026 — dynamic fees/flags only; no API default amounts or Figma marketing copy; mobile owns UI text

---

## 1. UI screens (Figma) → APIs

| # | Mobile screen | CTA | API |
|---|---------------|-----|-----|
| 1 | Traders Offers list | **Claim Now** | Navigate only → `GET /trader-offers/{id}`. **Do not claim.** |
| 2 | Offer Detail | **Accept Offer** | Optional prefill `POST /trader-offers/{id}/accept` **or** skip and open Post Job with `offerId`. **Does not claim.** |
| 3 | Post a New Job | **Next: Choose Location** | `GET /jobs/form-config` + `POST /jobs` with `offerId` (+ uploads) |
| 4 | Select Location | **Publish Job Post** | `GET /addresses` → `PUT /jobs/{id}/location` → `POST /jobs/{id}/publish` |
| 4b | Choose Location (search) | Add / pick place | `POST /addresses` then select on list |
| 5 | Site Visit & Pay Fee | **Confirm & Pay** | `GET /invoices/{id}` → `POST /payments/intent` → `POST /payments/{id}/confirm` |
| 6 | Payment Successful! | View Job / Home | **Here the offer is claimed (USED)** via confirm; then `GET /jobs/{id}` |

**Entry from Home category (no offer):** same Post Job APIs — call `GET /jobs/form-config?categoryId=&subcategoryId=&entryPoint=HOME_CATEGORY`.

---

## 2. Claim / offer logic (critical)

**No separate claim API for trader offers.** Frontend navigates with `offerId`; backend applies the offer only at the end.

| Step | What happens to offer |
|------|------------------------|
| List **Claim Now** | Navigate only — **no API claim** |
| **Accept Offer** | Optional prefill only (`nextJobPrefill` + `jobFormConfig`). **Does not claim.** `claim` is empty; `claimed` stays `false` |
| **Create draft** `POST /jobs` with `offerId` | Soft-link offer on job. **No claim.** `claimId` not required |
| **Publish** `POST /jobs/{id}/publish` | Creates unpaid invoice when pay is needed. **Still no claim** (offer reusable if user abandons before pay) |
| **Payment Successful** `POST /payments/{id}/confirm` | **Claim → `USED`** (offer locked). This is the only apply step for site-visit / pay flows |
| Publish with **no invoice** (waiting for quotes) | Claim → `USED` when job goes live (no payment step) |

**Abandoned checkout:** Accept / draft / publish / unpaid invoice do **not** burn the offer. After Payment Successful, `claimed: true` / `canApply: false`.

**Offer discount on Site Visit Pay Fee:** Flat/percentage job offers apply to the **eventual service**, not the site-visit facilitation fee (unless offer `FREE_SERVICE` = free visit).

---

## 3. Quote type + budget + site visit fee (flow-wise)

Drive UI from **`jobFormConfig`** — **same shape** from Accept, `GET /jobs/form-config`, and `Job.formConfig`. Do not hardcode show/hide per entry screen.

### Budget / fee matrix (bind to selected `quoteType`)

| Entry | Subcategory | Selected quote | Min/Max Budget | Site Visit Fee badge / Pay Fee |
|-------|-------------|----------------|----------------|--------------------------------|
| Any (`OFFER` / `HOME_*` / `TRADER_PROFILE` / `DIRECT`) | `priceEnabled` + `priceEnteredBy=CUSTOMER` | **REMOTE** | **Show** (`visibilityByQuoteType.REMOTE`) | Hide |
| Any | same | **ONSITE** | **Hide** | **Show** if `siteVisitEnabled` |
| Any | `priceEnabled=false` OR `priceEnteredBy=TRADER` | REMOTE or ONSITE | **Hide** | ONSITE only if site visit on |
| Any | `siteVisitEnabled=false` | ONSITE option | n/a | Option listed with `available: false` — do not select |

**Client rule:** when user taps Remote vs Site Visit, read:

```text
jobFormConfig.visibilityByQuoteType[selectedQuoteType].showMinBudget
jobFormConfig.visibilityByQuoteType[selectedQuoteType].showMaxBudget
jobFormConfig.visibilityByQuoteType[selectedQuoteType].showSiteVisitFee
```

Or use the matching `quoteTypeOptions[]` row (`showMinBudget`, `showSiteVisitFee`, `feeFormatted`).

| UI | Config flags | Notes |
|----|--------------|-------|
| Offer Applied banner | `showOfferBanner`, `offerBanner.discountLabel` | Dynamic discount chip from offer record; title/message empty — app owns banner sentence |
| Remote Quote card | `quoteTypeOptions` key `REMOTE` | No fee |
| Site Visit card | key `ONSITE` + `feeFormatted` | Fee **only** from `subcategory.siteVisitFee` (admin). If unset → `amount: 0` / empty formatted — **no API default €30**. |
| Min / Max Budget | per-quote flags above | Never show on ONSITE |
| Time slots / duration | App-owned | `timeSlotOptions` / `durationOptions` are empty arrays — use app UI lists |
| Images | `showImageUpload`, `imageUploadPurpose: job_photo` | `POST /uploads` then pass URLs in `photoUrls` |
| After location | `nextAfterLocation` / per-quote `nextAfterLocation` | Keys only: `SITE_VISIT_PAY_FEE` or `WAITING_FOR_QUOTES` |

**Amounts are dynamic from DB.** Card fee and Pay Fee use `siteVisitFee.amount` / job snapshot. Do not hardcode fees or marketing copy in the app from API strings — API returns flags + numbers; **all UI labels/CTAs/notes live on mobile** (Figma is visual reference only).

### Response completeness (mobile models)

APIs return **all useful fields every time**. Prefer `""`, `0`, `[]`, `false`, or empty nested objects — **not** `null` / omitted keys — so Codable / data classes stay complete (`Job`, `nextJobPrefill`, `formConfig`, `claim`, `address`, `trader`, `booking`, `offer`).

Label/title/message/CTA fields may be **empty strings** on purpose — mobile owns copy. Dynamic fields: amounts, `discountLabel` from offer record, flags, navigation keys, IDs.

---

## 4. Sequence (site visit + offer)

```mermaid
sequenceDiagram
    actor App as Customer App
    participant API as BRISK API

    App->>API: GET /trader-offers/{id}
    Note over App: Claim Now = navigate only; cache jobFormConfig + nextJobPrefill
    Note over App: Post Job uses cached config — no form-config call on that screen
    App->>API: POST /jobs (quoteType=ONSITE, offerId, photoUrls…)
    API-->>App: draft Job + formConfig + nextSteps
    App->>API: GET /addresses
    App->>API: PUT /jobs/{id}/location { addressId }
    App->>API: POST /jobs/{id}/publish
    API-->>App: job + invoice (purpose SITE_VISIT_FEE, no claim yet)
    App->>API: POST /payments/intent
    App->>API: POST /payments/{id}/confirm
    API-->>App: Payment Successful + offer USED (claimed)
```

---

## 5. Endpoint cheat sheet

### Offers
| Method | Path | Notes |
|--------|------|-------|
| GET | `/trader-offers` | List; each row has `claimed`, `canApply` |
| GET | `/trader-offers/{id}` | Detail + `jobFormConfig` + `nextJobPrefill` (cache for Post Job — no second call) + `actions` |
| POST | `/trader-offers/{id}/accept` | Optional prefill only — **not** a claim |
| POST | `/trader-offers/{id}/claim` | Alias of accept — still **not** a claim |
| GET | `/brisk-offers` | Platform offers |
| POST | `/brisk-offers/{id}/claim` | Platform promo claim (wallet) |

### Jobs
| Method | Path | Notes |
|--------|------|-------|
| GET | `/jobs/form-config` | Query: `categoryId`, `subcategoryId`, `offerId`, `entryPoint` |
| POST | `/jobs` | Create **DRAFT** |
| GET | `/jobs` | List my jobs (`?status=DRAFT`) |
| GET | `/jobs/{id}` | Detail + `nextSteps` |
| PATCH | `/jobs/{id}` | Update draft only |
| PUT | `/jobs/{id}/location` | Body: `{ addressId }` |
| POST | `/jobs/{id}/publish` | Publish + soft claim + invoice |

### Addresses
| Method | Path | Notes |
|--------|------|-------|
| GET | `/addresses` | Select Location list (`label`, `formattedAddress`, `icon`) |
| POST | `/addresses` | Choose Location / add new |

### Checkout
| Method | Path | Notes |
|--------|------|-------|
| GET | `/invoices/{id}` | Site Visit & Pay Fee / Payment Details |
| POST | `/invoices/{id}/apply-promo` | Optional promo on unpaid invoice |
| POST | `/payments/intent` | Stripe intent + billing |
| POST | `/payments/{id}/confirm` | Success → offer USED |
| POST | `/payments/{id}/fail` | Fail screen |
| GET | `/payments/{id}/receipt` | Success screen reload |

---

## 6. Example payloads

### Accept Offer (optional — no body)

```http
POST /trader-offers/{offerId}/accept
Authorization: Bearer …
```

Returns `nextJobPrefill` + `jobFormConfig` + empty `claim` + `claimTiming.claimUsedOnPaymentConfirm=true`.  
**Skip this** if the app already has offer detail + form-config — just `POST /jobs` with `offerId`.

### Create Site Visit draft

```json
{
  "categoryId": "…",
  "subcategoryId": "…",
  "title": "Solar panel check",
  "description": "Parking available. Access via side gate.",
  "scheduledDate": "2026-10-24T00:00:00.000Z",
  "timeSlot": "Afternoon",
  "durationLabel": "1 Hours",
  "phoneNumber": "+353871234567",
  "quoteType": "ONSITE",
  "offerId": "…",
  "traderId": "…",
  "photoUrls": ["https://…/uploads/files/job_photo/…/a.png"]
}
```

### Publish

```json
{ "addressId": "…" }
```

Response includes `data.invoice` with:
- `purpose: "SITE_VISIT_FEE"`
- `screenTitle: "Site Visit & Pay Fee"`
- `confirmPayLabel` / `payNowLabel`
- `siteVisitFee`, `totalAmount`, `trader`, `feeNote`

### Payment intent

```json
{
  "invoiceId": "…",
  "method": "CARD",
  "billingType": "COMPANY",
  "companyName": "Acme Ltd",
  "tinNumber": "DE 123 456 789",
  "billingAddress": {
    "addressLine": "123 Utility Street",
    "city": "Berlin",
    "postalCode": "10115"
  }
}
```

---

## 7. Response flags mobile must use

| Field | Meaning |
|-------|---------|
| `offer.claimed` | `true` only after Payment Successful (`USED`) |
| `offer.canApply` | `false` only after `USED` (or legacy in-progress soft claim) |
| `job.offerApplied` | Job has `offerId` linked — show Offer Applied UI (app copy) |
| `claimTiming.claimRequiredApi` | Always `false` for trader offers — no separate claim call |
| `jobFormConfig.visibilityByQuoteType` | Budget/fee when switching REMOTE ↔ ONSITE |
| `job.nextSteps.nextScreen` | `CHOOSE_LOCATION` \| `PUBLISH` \| `SITE_VISIT_PAY_FEE` |
| `invoice.purpose` | `SITE_VISIT_FEE` vs `SERVICE` |
| `receipt` | Amounts + `purpose`; offer is already `USED` after confirm |

---

## 8. Admin / dynamic fee

- Subcategory: `siteVisitEnabled`, `siteVisitFee` (currency of offer/job), `priceEnabled`, `priceEnteredBy`, `qaFormSchema`
- If `siteVisitEnabled` and `siteVisitFee` is null/unset → API returns **0** (no invented default amount). Admin must set the fee for a paid visit.
- Set `siteVisitFee` on subcategory for whatever amount the Pay Fee screen should charge (same snapshot on the job at create/publish).

---

## 9. Still out of scope (this doc)

- **Multiple site visits / multi-location in one job** — not modeled yet; current flow is **one address + one visit fee**. Extend when multi-visit UI is finalized.
- Full Stripe live keys — intent currently returns mock `clientSecret` until Stripe is wired in env.
- Quote-wise marketplace REMOTE without trader → publish without invoice → `WAITING_FOR_QUOTES`

---

---

## 11. Trader — Create Offers (Description & Terms)

**Screen:** Create Offers → Publish Offer  
**API:** `POST /traders/offers` (Bearer trader JWT)  
**Edit:** `PATCH /traders/offers/{id}`  
**Active/Deactive:** `PATCH /traders/offers/{id}/status` `{ "status": "ACTIVE" | "DISABLED" }`

| UI (Figma) | Body key |
|------------|----------|
| Offer Type % / Flat | `discountType`: `PERCENTAGE` \| `FLAT` |
| Offer Value | `discountValue` |
| Offer Headline | `title` |
| Category / Sub-category | `categoryIds[]` / `subcategoryIds[]` |
| Expiry Date | `validUntil` |
| **Description & Terms** | **`description`** |

```json
{
  "title": "€10 off your first job",
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "description": "Valid for first-time customers only. Explain any conditions here.",
  "validUntil": "2026-10-30T23:59:59.000Z",
  "categoryIds": ["…"],
  "subcategoryIds": ["…"]
}
```

Aliases for the same text box: `fullDescription`, `termsAndConditions`.  
Response echoes: `description`, `fullDescription`, `termsAndConditions` (same value) for customer Offer Detail “Description & Terms”.
