# Plata

Personal finance tracking for a single user: what was spent, what came in, what
each account holds, and what is invested. One API, and clients that talk to it.

## Language

**Account**:
A place the user's money sits — a bank account, a wallet, or a voucher balance.
_Avoid_: Origin, source

**Snapshot**:
A manually recorded statement of what an Account held on a given day. The trusted
starting point that later transactions are applied to.
_Avoid_: Balance (ambiguous — see Derived balance)

**Derived balance**:
What an Account holds according to the system: its most recent Snapshot, plus
Income, minus non-credit Expenses, transfers out, closed or paid Statements, and
net investment cash — all counted from the Snapshot's date onward. Inferred, never
observed, and only as good as the last Snapshot.
_Avoid_: Current balance, projected balance

**Settlement account**:
The Account that absorbs a Credit card's statements when they close. A standing
relationship between a card and an account, not a per-transaction link — which is
why it is named apart from the `accountId` that appears on Expenses, Snapshots and
Investment positions.
_Avoid_: Bank (a card's bank is an institution; its settlement account is the user's)

**Credit card**:
A card whose spending is not deducted when the Expense happens, but when the
Statement it belongs to closes.

**Statement**:
One billing cycle of a Credit card, from its open date to its close date, payable
on its due date. Only `closed` and `paid` statements affect an Account's money.
