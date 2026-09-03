import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const AMBIGUOUS = Symbol('ambiguous')

// Best-effort backfill for CreditCard.settlementAccountId (see issue #2): links
// each unlinked card to the Account whose name exactly matches its `bank` string,
// scoped per user. Every card left unresolved is reported, not silently skipped
// — whether because no Account matches, or because Account.name isn't unique per
// user and more than one does (an ambiguous match is reported, never guessed).
// Idempotent: only considers cards without a settlementAccountId yet, and never
// touches `bank`. Bumps `updatedAt` on cards it links, so the change reaches
// clients through the existing `/sync/delta?since=` watermark.
async function main() {
  const cards = await prisma.creditCard.findMany({
    where: { deletedAt: null, settlementAccountId: null },
  })
  const accounts = await prisma.account.findMany({ where: { deletedAt: null } })

  const accountIdByUserAndName = new Map<string, string | typeof AMBIGUOUS>()
  for (const account of accounts) {
    const key = `${account.userId}::${account.name}`
    accountIdByUserAndName.set(key, accountIdByUserAndName.has(key) ? AMBIGUOUS : account.id)
  }

  const unlinked: Array<{ id: string; nickname: string; bank: string; reason: string }> = []
  let linked = 0

  for (const card of cards) {
    const match = accountIdByUserAndName.get(`${card.userId}::${card.bank}`)
    if (match === undefined) {
      unlinked.push({ id: card.id, nickname: card.nickname, bank: card.bank, reason: 'no matching Account name' })
      continue
    }
    if (match === AMBIGUOUS) {
      unlinked.push({ id: card.id, nickname: card.nickname, bank: card.bank, reason: 'more than one Account has this name' })
      continue
    }
    await prisma.creditCard.update({
      where: { id: card.id },
      data: { settlementAccountId: match, updatedAt: new Date() },
    })
    linked++
  }

  console.log(`Linked ${linked} of ${cards.length} credit card(s) to a settlement account.`)
  if (unlinked.length > 0) {
    console.log(`Could not link ${unlinked.length} credit card(s):`)
    for (const card of unlinked) {
      console.log(`  - "${card.nickname}" (${card.id}): bank="${card.bank}" — ${card.reason}`)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
