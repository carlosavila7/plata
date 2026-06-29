import { PrismaClient } from '@prisma/client'

export async function getDelta(prisma: PrismaClient, userId: string, since: Date) {
  // Data ownership: delta sync only ever returns the caller's own records.
  const where = { userId, updatedAt: { gt: since } }
  const [
    accounts, balances, expenses, income,
    creditCards, creditCardStatements,
    investmentPositions, investmentEvents,
  ] = await Promise.all([
    prisma.account.findMany({ where }),
    prisma.balance.findMany({ where }),
    prisma.expense.findMany({ where }),
    prisma.income.findMany({ where }),
    prisma.creditCard.findMany({ where }),
    prisma.creditCardStatement.findMany({ where }),
    prisma.investmentPosition.findMany({ where }),
    prisma.investmentEvent.findMany({ where }),
  ])

  return {
    accounts,
    balances,
    expenses,
    income,
    creditCards,
    creditCardStatements,
    investmentPositions,
    investmentEvents,
  }
}
