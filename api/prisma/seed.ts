import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Ids mirror app/src/db/schema.ts so server and client rows converge under
// last-write-wins sync. No accounts are seeded — users create their own.
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

async function main() {
  const existing = await prisma.expenseCategory.count({ where: { deletedAt: null } })
  if (existing > 0) {
    console.log('Categories already seeded, skipping.')
    return
  }

  const now = new Date()
  for (const cat of SEED_CATEGORIES) {
    await prisma.expenseCategory.create({
      data: { ...cat, createdAt: now, updatedAt: now },
    })
  }
  for (const sub of SEED_SUBCATEGORIES) {
    await prisma.expenseSubcategory.create({
      data: { ...sub, createdAt: now, updatedAt: now },
    })
  }
  for (const pt of SEED_PAYMENT_TYPES) {
    await prisma.paymentType.create({
      data: { ...pt, createdAt: now, updatedAt: now },
    })
  }
  console.log(
    `Seeded ${SEED_CATEGORIES.length} categories, ${SEED_SUBCATEGORIES.length} subcategories, ${SEED_PAYMENT_TYPES.length} payment types.`,
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
