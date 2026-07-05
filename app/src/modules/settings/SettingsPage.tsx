import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getAll, upsert, softDelete } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { surface, border, textPrimary, textSecondary, btnPrimary, btnSecondary, inputStyle, labelStyle } from '../../theme'

type Row = Record<string, unknown>

type EditableSub = { id: string; name: string; isNew: boolean }

const ACCOUNT_TYPES = ['checking', 'savings', 'voucher', 'wallet']

export function SettingsPage() {
  const [categories, setCategories] = useState<Row[]>([])
  const [subcategories, setSubcategories] = useState<Row[]>([])
  const [paymentTypes, setPaymentTypes] = useState<Row[]>([])
  const [cities, setCities] = useState<Row[]>([])
  const [accounts, setAccounts] = useState<Row[]>([])

  const [selectedCat, setSelectedCat] = useState<Row | null>(null)
  const [selectedPaymentType, setSelectedPaymentType] = useState<Row | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Row | null>(null)
  const [selectedCity, setSelectedCity] = useState<Row | null>(null)

  const [newCategory, setNewCategory] = useState('')
  const [newPaymentName, setNewPaymentName] = useState('')
  const [newPaymentIsVoucher, setNewPaymentIsVoucher] = useState(false)
  const [newCity, setNewCity] = useState('')
  const [newAccount, setNewAccount] = useState({ name: '', type: 'checking', institution: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [cats, subs, pts, cs, accs] = await Promise.all([
      getAll('expenseCategories'),
      getAll('expenseSubcategories'),
      getAll('paymentTypes'),
      getAll('cities'),
      getAll('accounts'),
    ])
    setCategories(cats)
    setSubcategories(subs)
    setPaymentTypes(pts)
    setCities(cs)
    setAccounts(accs)
  }

  async function addCategory() {
    if (!newCategory.trim()) return
    const now = new Date().toISOString()
    const rec = { id: uuidv4(), name: newCategory.trim(), createdAt: now, updatedAt: now, deletedAt: null }
    await upsert('expenseCategories', rec)
    setCategories(prev => [...prev, rec])
    setNewCategory('')
  }

  async function addPaymentType() {
    if (!newPaymentName.trim()) return
    const now = new Date().toISOString()
    const rec = { id: uuidv4(), name: newPaymentName.trim(), isVoucher: newPaymentIsVoucher, createdAt: now, updatedAt: now, deletedAt: null }
    await upsert('paymentTypes', rec)
    setPaymentTypes(prev => [...prev, rec])
    setNewPaymentName('')
    setNewPaymentIsVoucher(false)
  }

  async function addCity() {
    if (!newCity.trim()) return
    const now = new Date().toISOString()
    const rec = { id: uuidv4(), name: newCity.trim(), createdAt: now, updatedAt: now, deletedAt: null }
    await upsert('cities', rec)
    setCities(prev => [...prev, rec])
    setNewCity('')
  }

  async function addAccount() {
    if (!newAccount.name.trim() || !newAccount.institution.trim()) return
    const now = new Date().toISOString()
    const rec = { id: uuidv4(), ...newAccount, name: newAccount.name.trim(), institution: newAccount.institution.trim(), notes: null, createdAt: now, updatedAt: now, deletedAt: null }
    await upsert('accounts', rec)
    await enqueue('accounts', rec.id, 'create', rec)
    setAccounts(prev => [...prev, rec])
    setNewAccount({ name: '', type: 'checking', institution: '' })
  }

  const closeAndReload = (fn: (v: null) => void) => () => { fn(null); loadAll() }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Categories */}
      <section>
        <h2 style={sectionTitle}>Categories</h2>
        {categories.map(cat => (
          <div
            key={cat.id as string}
            style={{ ...rowStyle, cursor: 'pointer' }}
            onClick={() => setSelectedCat(cat)}
          >
            <span style={{ color: textPrimary, fontWeight: 600 }}>{cat.name as string}</span>
            <span style={{ color: textSecondary, fontSize: 13 }}>
              {subcategories.filter(s => s.categoryId === cat.id).length}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="New category…" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" style={btnPrimary} onClick={addCategory}>Add</button>
        </div>
      </section>

      {/* Payment Types */}
      <section>
        <h2 style={sectionTitle}>Payment Types</h2>
        {paymentTypes.map(pt => (
          <div
            key={pt.id as string}
            style={{ ...rowStyle, cursor: 'pointer' }}
            onClick={() => setSelectedPaymentType(pt)}
          >
            <span style={{ color: textPrimary, fontWeight: 600 }}>{pt.name as string}</span>
            {(pt.isVoucher as boolean) && <span style={{ color: textSecondary, fontSize: 12 }}>voucher</span>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input value={newPaymentName} onChange={e => setNewPaymentName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPaymentType()} placeholder="New payment type…" style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
          <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 6, color: textSecondary, fontWeight: 400 }}>
            <input type="checkbox" checked={newPaymentIsVoucher} onChange={e => setNewPaymentIsVoucher(e.target.checked)} />
            Voucher
          </label>
          <button type="button" style={btnPrimary} onClick={addPaymentType}>Add</button>
        </div>
      </section>

      {/* Accounts */}
      <section>
        <h2 style={sectionTitle}>Accounts</h2>
        {accounts.map(acc => (
          <div
            key={acc.id as string}
            style={{ ...rowStyle, cursor: 'pointer' }}
            onClick={() => setSelectedAccount(acc)}
          >
            <span style={{ color: textPrimary, fontWeight: 600 }}>{acc.name as string}</span>
            <span style={{ color: textSecondary, fontSize: 12 }}>{acc.type as string} · {acc.institution as string}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <input value={newAccount.name} onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))} placeholder="Name…" style={inputStyle} />
          <input value={newAccount.institution} onChange={e => setNewAccount(a => ({ ...a, institution: e.target.value }))} placeholder="Institution…" style={inputStyle} />
          <select value={newAccount.type} onChange={e => setNewAccount(a => ({ ...a, type: e.target.value }))} style={inputStyle}>
            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          <button type="button" style={btnPrimary} onClick={addAccount}>Add account</button>
        </div>
      </section>

      {/* Cities */}
      <section>
        <h2 style={sectionTitle}>Cities</h2>
        {cities.map(city => (
          <div
            key={city.id as string}
            style={{ ...rowStyle, cursor: 'pointer' }}
            onClick={() => setSelectedCity(city)}
          >
            <span style={{ color: textPrimary, fontWeight: 600 }}>{city.name as string}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={newCity} onChange={e => setNewCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCity()} placeholder="New city…" style={{ ...inputStyle, flex: 1 }} />
          <button type="button" style={btnPrimary} onClick={addCity}>Add</button>
        </div>
      </section>

      {selectedCat && (
        <CategoryEditModal
          category={selectedCat}
          subcategories={subcategories.filter(s => s.categoryId === selectedCat.id)}
          onClose={() => setSelectedCat(null)}
          onSave={closeAndReload(setSelectedCat)}
          onDelete={closeAndReload(setSelectedCat)}
        />
      )}

      {selectedPaymentType && (
        <PaymentTypeEditModal
          paymentType={selectedPaymentType}
          onClose={() => setSelectedPaymentType(null)}
          onSave={closeAndReload(setSelectedPaymentType)}
          onDelete={closeAndReload(setSelectedPaymentType)}
        />
      )}

      {selectedAccount && (
        <AccountEditModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
          onSave={closeAndReload(setSelectedAccount)}
          onDelete={closeAndReload(setSelectedAccount)}
        />
      )}

      {selectedCity && (
        <CityEditModal
          city={selectedCity}
          onClose={() => setSelectedCity(null)}
          onSave={closeAndReload(setSelectedCity)}
          onDelete={closeAndReload(setSelectedCity)}
        />
      )}

    </div>
  )
}

// ── Shared bottom sheet wrapper ──────────────────────────────────────────────

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: surface, borderTop: `1px solid ${border}`, maxHeight: '85dvh', overflowY: 'auto', padding: '8px 16px 40px' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function SheetActions({ onDelete, onSave }: { onDelete: () => void; onSave: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
      {confirmDelete ? (
        <>
          <button type="button" onClick={onDelete} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Confirm delete</button>
          <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Cancel</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete</button>
          <button type="button" onClick={onSave} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Save</button>
        </>
      )}
    </div>
  )
}

// ── Category modal ───────────────────────────────────────────────────────────

function CategoryEditModal({ category, subcategories, onClose, onSave, onDelete }: {
  category: Row; subcategories: Row[]
  onClose: () => void; onSave: () => void; onDelete: () => void
}) {
  const [catName, setCatName] = useState(category.name as string)
  const [subs, setSubs] = useState<EditableSub[]>(
    subcategories.map(s => ({ id: s.id as string, name: s.name as string, isNew: false }))
  )
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [newSub, setNewSub] = useState('')

  function addNewSub() {
    if (!newSub.trim()) return
    setSubs(prev => [...prev, { id: uuidv4(), name: newSub.trim(), isNew: true }])
    setNewSub('')
  }

  function removeSub(sub: EditableSub) {
    setSubs(prev => prev.filter(s => s.id !== sub.id))
    if (!sub.isNew) setDeletedIds(prev => [...prev, sub.id])
  }

  async function save() {
    const now = new Date().toISOString()
    await upsert('expenseCategories', { ...category, name: catName.trim(), updatedAt: now })
    for (const sub of subs.filter(s => !s.isNew)) {
      const original = subcategories.find(s => s.id === sub.id)!
      await upsert('expenseSubcategories', { ...original, name: sub.name.trim(), updatedAt: now })
    }
    for (const sub of subs.filter(s => s.isNew)) {
      await upsert('expenseSubcategories', { id: sub.id, name: sub.name.trim(), categoryId: category.id, createdAt: now, updatedAt: now, deletedAt: null })
    }
    for (const id of deletedIds) await softDelete('expenseSubcategories', id)
    onSave()
  }

  async function handleDelete() {
    await softDelete('expenseCategories', category.id as string)
    for (const sub of subcategories) await softDelete('expenseSubcategories', sub.id as string)
    onDelete()
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <input value={catName} onChange={e => setCatName(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontWeight: 600, fontSize: 15 }} />
      </div>

      <p style={subLabel}>Subcategories</p>
      {subs.map(sub => (
        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${border}`, padding: '8px 0' }}>
          <input value={sub.name} onChange={e => setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, name: e.target.value } : s))} style={{ ...inputStyle, flex: 1 }} />
          <button type="button" style={deleteBtn} onClick={() => removeSub(sub)}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: `1px solid ${border}` }}>
        <input value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNewSub()} placeholder="New subcategory…" style={{ ...inputStyle, flex: 1 }} />
        <button type="button" style={btnPrimary} onClick={addNewSub}>Add</button>
      </div>

      <SheetActions onDelete={handleDelete} onSave={save} />
    </Sheet>
  )
}

// ── Payment type modal ───────────────────────────────────────────────────────

function PaymentTypeEditModal({ paymentType, onClose, onSave, onDelete }: {
  paymentType: Row
  onClose: () => void; onSave: () => void; onDelete: () => void
}) {
  const [name, setName] = useState(paymentType.name as string)
  const [isVoucher, setIsVoucher] = useState(paymentType.isVoucher as boolean)

  async function save() {
    const now = new Date().toISOString()
    await upsert('paymentTypes', { ...paymentType, name: name.trim(), isVoucher, updatedAt: now })
    onSave()
  }

  async function handleDelete() {
    await softDelete('paymentTypes', paymentType.id as string)
    onDelete()
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontWeight: 600, fontSize: 15 }} />
      </div>
      <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, padding: '14px 0', borderBottom: `1px solid ${border}` }}>
        <input type="checkbox" checked={isVoucher} onChange={e => setIsVoucher(e.target.checked)} />
        <span style={{ color: textPrimary, fontSize: 15 }}>Voucher</span>
      </label>
      <SheetActions onDelete={handleDelete} onSave={save} />
    </Sheet>
  )
}

// ── Account modal ────────────────────────────────────────────────────────────

function AccountEditModal({ account, onClose, onSave, onDelete }: {
  account: Row
  onClose: () => void; onSave: () => void; onDelete: () => void
}) {
  const [name, setName] = useState(account.name as string)
  const [institution, setInstitution] = useState(account.institution as string)
  const [type, setType] = useState(account.type as string)

  async function save() {
    const now = new Date().toISOString()
    const rec = { ...account, name: name.trim(), institution: institution.trim(), type, updatedAt: now }
    await upsert('accounts', rec)
    await enqueue('accounts', account.id as string, 'update', rec)
    onSave()
  }

  async function handleDelete() {
    await softDelete('accounts', account.id as string)
    await enqueue('accounts', account.id as string, 'delete', { id: account.id })
    onDelete()
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontWeight: 600, fontSize: 15 }} />
      </div>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <label style={labelStyle}>
          <span>Institution</span>
          <input value={institution} onChange={e => setInstitution(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </label>
      </div>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <label style={labelStyle}>
          <span>Type</span>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}>
            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <SheetActions onDelete={handleDelete} onSave={save} />
    </Sheet>
  )
}

// ── City modal ───────────────────────────────────────────────────────────────

function CityEditModal({ city, onClose, onSave, onDelete }: {
  city: Row
  onClose: () => void; onSave: () => void; onDelete: () => void
}) {
  const [name, setName] = useState(city.name as string)

  async function save() {
    const now = new Date().toISOString()
    await upsert('cities', { ...city, name: name.trim(), updatedAt: now })
    onSave()
  }

  async function handleDelete() {
    await softDelete('cities', city.id as string)
    onDelete()
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ borderBottom: `1px solid ${border}`, padding: '12px 0' }}>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', fontWeight: 600, fontSize: 15 }} />
      </div>
      <SheetActions onDelete={handleDelete} onSave={save} />
    </Sheet>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: textSecondary,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  margin: '0 0 8px 0',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 0', borderBottom: `1px solid ${border}`,
}

const subLabel: React.CSSProperties = {
  fontSize: 11, color: textSecondary, letterSpacing: '0.08em',
  textTransform: 'uppercase', margin: '12px 0 0',
}

const deleteBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: textSecondary,
  fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px',
  flexShrink: 0,
}
