# Personal Finance PWA — Project Brief for Claude Code

## Project overview

Build a mobile-first Progressive Web App for personal finance tracking with a companion REST API. The user is migrating from a markdown-frontmatter file system to this new app. All existing data must be migrated via a CLI script.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | PWA (React + Vite + Workbox) |
| Local persistence | IndexedDB (via idb library) |
| Backend | Node.js with Fastify |
| Database | PostgreSQL (use Prisma as ORM) |
| Sync strategy | Last write wins by `updatedAt` timestamp |

---

## Platform targets

- Android (installable PWA)
- iOS (installable PWA)
- Desktop browser

---

## Functional scope — v1

### Modules included
- Expenses & income (transactions)
- Credit card statements
- Investment portfolio

### Out of scope for v1
- Authentication / multi-user
- Budget planning and goals
- Charts and reports
- Automatic price fetching for investments
- Bank/broker integrations
- Multi-currency conversion

---

## Data model

All entities share these sync fields:
```
id          String    UUID v4 (primary key)
createdAt   DateTime  ISO 8601 UTC
updatedAt   DateTime  ISO 8601 UTC — used for conflict resolution
deletedAt   DateTime? Soft delete — never hard delete
```

All monetary values are stored as **integers in centavos** (BRL × 100).  
All datetimes are stored as **ISO 8601 UTC strings**.

---

### Account
Replaces the raw `origin`/`account` string fields from the old model.

```
id          String
name        String    e.g. "Banco do Brasil", "Banco Inter"
type        Enum      checking | savings | food_voucher | meal_voucher | wallet
institution String    e.g. "Bradesco", "Alelo"
notes       String?
```

Seed accounts on first run:
- Banco do Brasil → checking
- Bradesco → checking
- Banco Inter → checking
- food voucher → food_voucher
- meal voucher → meal_voucher

---

### Balance (snapshot)
```
id            String
accountId     String    FK → Account
date          String    YYYY-MM-DD
amountCents   Int
```

---

### Expense
```
id                      String
occurredAt              DateTime   merged from date + time fields
category                Enum       see category list below
subCategory             String     constrained to subcategory list per category
costCents               Int
accountId               String     FK → Account
paymentType             Enum       debit | credit | pix | food_voucher | meal_voucher
creditCardStatementId   String?    FK → CreditCardStatement — only when paymentType = credit
boughtAt                String?
city                    String?
description             String?
groupingTag             String?
isRecurrent             Boolean
person                  String?
isDelivery              Boolean?   only when category = food; null otherwise
fuelDetails             JSON?      only when subCategory = fuel; null otherwise
                                   { fullTank: boolean, odometerKm: number|null, pricePerLiterCents: integer }
```

#### Categories and subcategories
```
food          → bakery | lunch | groceries | snack | dinner | other
transport     → uber | subway | bus | patinete
vehicle       → toll | fuel | parking | maintenance | repair | ipva | bike
streaming     → hbo_max | netflix | deezer | amazon_prime | paramount | spotify | youtube
housing       → rent | water | power | home_internet | gas
personal      → gifts | shopping | clothing
health        → pharmacy | gym
subscriptions → mobile_internet | mercado_livre | ifood | host
entertainment → cinema | shows | games | football
education     → course | books
other         → other
```

---

### Income
```
id            String
occurredAt    DateTime   merged from date + time; fallback to unix timestamp field
reason        Enum       salary | interest | refund | deposit | self
amountCents   Int
toAccountId   String     FK → Account
fromAccountId String?    FK → Account — null when source is external/unknown
description   String?
```

---

### CreditCard
```
id           String
nickname     String    e.g. "Nanquim"
bank         String    e.g. "Banco do Brasil"
network      String    e.g. "ELO", "Visa", "Mastercard"
closingDay   Int       day of month (1–31)
dueDay       Int       day of month (1–31)
limitCents   Int?
```

---

### CreditCardStatement
```
id             String
creditCardId   String    FK → CreditCard
openDate       String    YYYY-MM-DD
closeDate      String    YYYY-MM-DD
dueDate        String    YYYY-MM-DD
status         Enum      open | closed | paid
totalCents     Int?      null when status = open
```

---

### InvestmentPosition
```
id                   String
name                 String    asset name or ticker — e.g. "PETR4", "Bitcoin"
assetType            Enum      stock | fund | fixed_income | crypto | other
quantity             Float     supports fractional shares/crypto
avgPriceCents        Int       weighted average purchase price
currentPriceCents    Int?      manually updated; null until first update
lastPriceUpdatedAt   DateTime?
notes                String?
```

---

### InvestmentEvent
```
id           String
positionId   String    FK → InvestmentPosition
type         Enum      buy | sell
occurredAt   DateTime
quantity     Float
priceCents   Int       price per unit at time of trade
notes        String?
```

---

## Offline & sync requirements

- All CRUD operations must work fully offline using IndexedDB
- Every mutation sets `updatedAt` client-side (UTC timestamp)
- A `syncQueue` store in IndexedDB tracks pending operations while offline:
  ```
  { id, entity, entityId, operation: 'create'|'update'|'delete', payload, queuedAt }
  ```
- On reconnect, the app flushes the sync queue to the API in chronological order
- Conflict resolution: record with the newer `updatedAt` wins — no user prompt
- A service worker (Workbox) caches static assets and API GET responses
- The UI shows a persistent sync status indicator: synced | pending | error

---

## REST API specification

### Base rules
- All endpoints return `Content-Type: application/json`
- Error responses follow RFC 7807 Problem Details
- All list endpoints support `?since=<ISO8601>` for delta sync
- Soft deletes only — no endpoint permanently deletes records
- CORS enabled for localhost (dev) and the PWA origin (prod)

### Endpoints

#### Sync (implement first — core of offline strategy)
```
POST   /sync            Batch mutations — array of pending queue items
                        Returns server state for each; resolves conflicts by updatedAt
GET    /sync/delta      ?since=:timestamp — returns all changed records since timestamp
```

#### Accounts
```
GET    /accounts
POST   /accounts
PUT    /accounts/:id
DELETE /accounts/:id    soft delete
```

#### Balances
```
GET    /balances              ?accountId=&dateFrom=&dateTo=
POST   /balances
PUT    /balances/:id
DELETE /balances/:id
```

#### Expenses
```
GET    /expenses              ?category=&dateFrom=&dateTo=&accountId=&groupingTag=
POST   /expenses
PUT    /expenses/:id
DELETE /expenses/:id
```

#### Income
```
GET    /income                ?reason=&dateFrom=&dateTo=&accountId=
POST   /income
PUT    /income/:id
DELETE /income/:id
```

#### Credit cards
```
GET    /credit-cards
POST   /credit-cards
PUT    /credit-cards/:id
DELETE /credit-cards/:id

GET    /credit-cards/:id/statements
POST   /credit-cards/:id/statements
PATCH  /credit-cards/:id/statements/:sid    update status / totalCents
```

#### Investments
```
GET    /investments
POST   /investments
PUT    /investments/:id
DELETE /investments/:id

POST   /investments/:id/events
GET    /investments/:id/events
```

---

## Migration script

Write a Node.js CLI (`scripts/migrate.js`) that reads the existing markdown files and seeds the database.

### Source file patterns
```
finance/balance/          B-{YYMMDD}-{ORIGIN_CODE}.md
finance/in/               T-{YYMMDD}-{ACCOUNT_CODE}-{REASON_CODE}.md
finance/out/              E-{YYMMDD}-{HHMM}-{CATCODE}{SUBCATCODE}-{ORIGIN_CODE}-{PERSON_CODE}-{RECURRENT_CODE}-{ID}.md
finance/credit-card-statements/   S-{MONTH}-{BANK_CODE}-{NETWORK}-{CARD_NAME}.md
```

### Migration steps (in order)
1. Parse all statement files → extract unique `bank + network + card-name` combos → create one `CreditCard` per combo
2. Seed the five known `Account` records
3. Migrate statement files → `CreditCardStatement` records (link to CreditCard by combo key)
4. Migrate balance files → `Balance` records (resolve `origin` string → Account UUID)
5. Migrate income files → `Income` records (resolve `account` + `from-account` → Account UUIDs; merge `date + time` into `occurredAt`; fallback to `timestamp` field)
6. Migrate expense files → `Expense` records:
   - Merge `date + time` → `occurredAt`
   - Resolve `origin` string → `accountId`
   - Multiply `cost` × 100 → `costCents`
   - Resolve `credit-card-statement` slug → `creditCardStatementId` UUID
   - Rename `debt` → `debit` in `paymentType`
   - Pack fuel fields into `fuelDetails` JSON object
   - Set `isDelivery = null` for non-food categories

### CLI usage
```
node scripts/migrate.js --source ./finance --api http://localhost:3000
```

---

## Non-functional requirements

- PWA Lighthouse score ≥ 90 on PWA, Performance, and Accessibility audits
- App installable (add to home screen) on Android and iOS
- API responses < 300 ms on local network
- IndexedDB schema versioned with migration support (`db.version(N).stores(...)`)
- All inputs validated on the API — return structured errors (RFC 7807)
- Monetary values always integers (centavos) — never floats
- Spaces and special chars in enum values normalized to snake_case

---

## Suggested project structure

```
/
├── app/                    PWA frontend (React + Vite)
│   ├── src/
│   │   ├── db/             IndexedDB setup and store helpers (idb)
│   │   ├── sync/           Sync queue, conflict resolution, service worker registration
│   │   ├── api/            API client (fetch wrapper)
│   │   ├── modules/
│   │   │   ├── transactions/
│   │   │   ├── credit-cards/
│   │   │   └── investments/
│   │   └── components/
│   └── public/
│       └── sw.js           Workbox service worker
│
├── api/                    Fastify backend
│   ├── src/
│   │   ├── routes/
│   │   ├── plugins/        CORS, error handler, Prisma plugin
│   │   └── sync/           Batch sync logic and delta endpoint
│   └── prisma/
│       └── schema.prisma
│
└── scripts/
    └── migrate.js          Migration CLI
```