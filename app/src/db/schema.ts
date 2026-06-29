import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'

interface SyncQueueItem {
  id: string
  entity: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: Record<string, unknown>
  queuedAt: string
}

interface FinanceDB extends DBSchema {
  accounts:             { key: string; value: Record<string, unknown> }
  balances:             { key: string; value: Record<string, unknown>; indexes: { byAccount: string } }
  expenses:             { key: string; value: Record<string, unknown>; indexes: { byOccurredAt: string; byCategory: string } }
  income:               { key: string; value: Record<string, unknown>; indexes: { byOccurredAt: string } }
  creditCards:          { key: string; value: Record<string, unknown> }
  creditCardStatements: { key: string; value: Record<string, unknown>; indexes: { byCreditCard: string } }
  investmentPositions:  { key: string; value: Record<string, unknown> }
  investmentEvents:     { key: string; value: Record<string, unknown>; indexes: { byPosition: string } }
  syncQueue:            { key: string; value: SyncQueueItem; indexes: { byQueuedAt: string } }
  meta:                 { key: string; value: string }
  expenseCategories:    { key: string; value: Record<string, unknown> }
  expenseSubcategories: { key: string; value: Record<string, unknown>; indexes: { byCategoryId: string } }
  paymentTypes:         { key: string; value: Record<string, unknown> }
  cities:               { key: string; value: Record<string, unknown> }
  persons:              { key: string; value: Record<string, unknown> }
}

const SEED_CATEGORIES = [
  { id: 'cat-food',           name: 'food' },
  { id: 'cat-transport',      name: 'transport' },
  { id: 'cat-vehicle',        name: 'vehicle' },
  { id: 'cat-streaming',      name: 'streaming' },
  { id: 'cat-housing',        name: 'housing' },
  { id: 'cat-personal',       name: 'personal' },
  { id: 'cat-health',         name: 'health' },
  { id: 'cat-subscriptions',  name: 'subscriptions' },
  { id: 'cat-entertainment',  name: 'entertainment' },
  { id: 'cat-education',      name: 'education' },
  { id: 'cat-other',          name: 'other' },
]

const SEED_SUBCATEGORIES = [
  { id: 'sub-food-bakery',       name: 'bakery',          categoryId: 'cat-food' },
  { id: 'sub-food-lunch',        name: 'lunch',           categoryId: 'cat-food' },
  { id: 'sub-food-groceries',    name: 'groceries',       categoryId: 'cat-food' },
  { id: 'sub-food-snack',        name: 'snack',           categoryId: 'cat-food' },
  { id: 'sub-food-dinner',       name: 'dinner',          categoryId: 'cat-food' },
  { id: 'sub-food-other',        name: 'other',           categoryId: 'cat-food' },
  { id: 'sub-transport-uber',    name: 'uber',            categoryId: 'cat-transport' },
  { id: 'sub-transport-subway',  name: 'subway',          categoryId: 'cat-transport' },
  { id: 'sub-transport-bus',     name: 'bus',             categoryId: 'cat-transport' },
  { id: 'sub-transport-pat',     name: 'patinete',        categoryId: 'cat-transport' },
  { id: 'sub-vehicle-toll',      name: 'toll',            categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-fuel',      name: 'fuel',            categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-parking',   name: 'parking',         categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-maint',     name: 'maintenance',     categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-repair',    name: 'repair',          categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-ipva',      name: 'ipva',            categoryId: 'cat-vehicle' },
  { id: 'sub-vehicle-bike',      name: 'bike',            categoryId: 'cat-vehicle' },
  { id: 'sub-stream-hbo',        name: 'hbo_max',         categoryId: 'cat-streaming' },
  { id: 'sub-stream-netflix',    name: 'netflix',         categoryId: 'cat-streaming' },
  { id: 'sub-stream-deezer',     name: 'deezer',          categoryId: 'cat-streaming' },
  { id: 'sub-stream-amazon',     name: 'amazon_prime',    categoryId: 'cat-streaming' },
  { id: 'sub-stream-paramount',  name: 'paramount',       categoryId: 'cat-streaming' },
  { id: 'sub-stream-spotify',    name: 'spotify',         categoryId: 'cat-streaming' },
  { id: 'sub-stream-youtube',    name: 'youtube',         categoryId: 'cat-streaming' },
  { id: 'sub-housing-rent',      name: 'rent',            categoryId: 'cat-housing' },
  { id: 'sub-housing-water',     name: 'water',           categoryId: 'cat-housing' },
  { id: 'sub-housing-power',     name: 'power',           categoryId: 'cat-housing' },
  { id: 'sub-housing-internet',  name: 'home_internet',   categoryId: 'cat-housing' },
  { id: 'sub-housing-gas',       name: 'gas',             categoryId: 'cat-housing' },
  { id: 'sub-personal-gifts',    name: 'gifts',           categoryId: 'cat-personal' },
  { id: 'sub-personal-shopping', name: 'shopping',        categoryId: 'cat-personal' },
  { id: 'sub-personal-clothing', name: 'clothing',        categoryId: 'cat-personal' },
  { id: 'sub-health-pharmacy',   name: 'pharmacy',        categoryId: 'cat-health' },
  { id: 'sub-health-gym',        name: 'gym',             categoryId: 'cat-health' },
  { id: 'sub-subs-mobile',       name: 'mobile_internet', categoryId: 'cat-subscriptions' },
  { id: 'sub-subs-meli',         name: 'mercado_livre',   categoryId: 'cat-subscriptions' },
  { id: 'sub-subs-ifood',        name: 'ifood',           categoryId: 'cat-subscriptions' },
  { id: 'sub-subs-host',         name: 'host',            categoryId: 'cat-subscriptions' },
  { id: 'sub-enter-cinema',      name: 'cinema',          categoryId: 'cat-entertainment' },
  { id: 'sub-enter-shows',       name: 'shows',           categoryId: 'cat-entertainment' },
  { id: 'sub-enter-games',       name: 'games',           categoryId: 'cat-entertainment' },
  { id: 'sub-enter-football',    name: 'football',        categoryId: 'cat-entertainment' },
  { id: 'sub-edu-course',        name: 'course',          categoryId: 'cat-education' },
  { id: 'sub-edu-books',         name: 'books',           categoryId: 'cat-education' },
  { id: 'sub-other-other',       name: 'other',           categoryId: 'cat-other' },
]

const SEED_PAYMENT_TYPES = [
  { id: 'pt-debit',        name: 'debit',        isVoucher: false },
  { id: 'pt-credit',       name: 'credit',       isVoucher: false },
  { id: 'pt-pix',          name: 'pix',          isVoucher: false },
  { id: 'pt-food-voucher', name: 'food_voucher', isVoucher: true },
  { id: 'pt-meal-voucher', name: 'meal_voucher', isVoucher: true },
]

type UpgradeTx = IDBPTransaction<FinanceDB, ArrayLike<StoreNames<FinanceDB>>, 'versionchange'>

async function seedOptionEntities(tx: UpgradeTx) {
  const now = new Date().toISOString()
  const cats = (tx as IDBPTransaction<FinanceDB, ('expenseCategories')[], 'versionchange'>).objectStore('expenseCategories')
  for (const cat of SEED_CATEGORIES) {
    await cats.put({ ...cat, createdAt: now, updatedAt: now, deletedAt: null })
  }
  const subs = (tx as IDBPTransaction<FinanceDB, ('expenseSubcategories')[], 'versionchange'>).objectStore('expenseSubcategories')
  for (const sub of SEED_SUBCATEGORIES) {
    await subs.put({ ...sub, createdAt: now, updatedAt: now, deletedAt: null })
  }
  const pts = (tx as IDBPTransaction<FinanceDB, ('paymentTypes')[], 'versionchange'>).objectStore('paymentTypes')
  for (const pt of SEED_PAYMENT_TYPES) {
    await pts.put({ ...pt, createdAt: now, updatedAt: now, deletedAt: null })
  }
}

let _db: IDBPDatabase<FinanceDB> | null = null

export async function getDB() {
  if (_db) return _db
  _db = await openDB<FinanceDB>('gonzalo-plata', 1, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('accounts',            { keyPath: 'id' })
        const balances = db.createObjectStore('balances', { keyPath: 'id' })
        balances.createIndex('byAccount', 'accountId')

        const expenses = db.createObjectStore('expenses', { keyPath: 'id' })
        expenses.createIndex('byOccurredAt', 'occurredAt')
        expenses.createIndex('byCategory',   'category')

        const income = db.createObjectStore('income', { keyPath: 'id' })
        income.createIndex('byOccurredAt', 'occurredAt')

        db.createObjectStore('creditCards',          { keyPath: 'id' })
        const stmts = db.createObjectStore('creditCardStatements', { keyPath: 'id' })
        stmts.createIndex('byCreditCard', 'creditCardId')

        db.createObjectStore('investmentPositions',  { keyPath: 'id' })
        const events = db.createObjectStore('investmentEvents', { keyPath: 'id' })
        events.createIndex('byPosition', 'positionId')

        const sq = db.createObjectStore('syncQueue', { keyPath: 'id' })
        sq.createIndex('byQueuedAt', 'queuedAt')

        db.createObjectStore('meta')

        db.createObjectStore('expenseCategories', { keyPath: 'id' })
        const subcats = db.createObjectStore('expenseSubcategories', { keyPath: 'id' })
        subcats.createIndex('byCategoryId', 'categoryId')
        db.createObjectStore('paymentTypes', { keyPath: 'id' })
        db.createObjectStore('cities',       { keyPath: 'id' })

        db.createObjectStore('persons', { keyPath: 'id' })

        // Seed only options (categories, subcategories, payment types) — no accounts.
        seedOptionEntities(tx)
      }
    },
  })
  return _db
}

export type Store = keyof Omit<FinanceDB, 'meta' | 'syncQueue'>
