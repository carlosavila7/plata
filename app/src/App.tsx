import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './modules/home/HomePage'
import { TransactionsPage } from './modules/transactions/TransactionsPage'
import { ExpenseFormPage } from './modules/transactions/ExpenseFormPage'
import { IncomePage } from './modules/income/IncomePage'
import { IncomeFormPage } from './modules/income/IncomeFormPage'
import { BalancesPage } from './modules/balances/BalancesPage'
import { BalanceFormPage } from './modules/balances/BalanceFormPage'
import { SummaryPage } from './modules/summary/SummaryPage'
import { CreditCardsPage } from './modules/credit-cards/CreditCardsPage'
import { CardFormPage } from './modules/credit-cards/CardFormPage'
import { CardDetailPage } from './modules/credit-cards/CardDetailPage'
import { StatementFormPage } from './modules/credit-cards/StatementFormPage'
import { StatementExpensesPage } from './modules/credit-cards/StatementExpensesPage'
import { UnlinkedStatementsPage } from './modules/credit-cards/UnlinkedStatementsPage'
import { LinkStatementPage } from './modules/credit-cards/LinkStatementPage'
import { InvestmentsPage } from './modules/investments/InvestmentsPage'
import { InvestmentFormPage } from './modules/investments/InvestmentFormPage'
import { PositionDetailPage } from './modules/investments/PositionDetailPage'
import { EventFormPage } from './modules/investments/EventFormPage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { registerSync } from './sync/register'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { AuthForm } from './auth/AuthForm'

registerSync()

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/register" element={<AuthForm mode="register" />} />
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
          <Route path="expenses" element={<TransactionsPage />} />
          <Route path="expenses/new" element={<ExpenseFormPage />} />
          <Route path="expenses/:id/edit" element={<ExpenseFormPage />} />
          <Route path="income" element={<IncomePage />} />
          <Route path="income/new" element={<IncomeFormPage />} />
          <Route path="income/:id/edit" element={<IncomeFormPage />} />
          <Route path="balances" element={<BalancesPage />} />
          <Route path="balances/new" element={<BalanceFormPage />} />
          <Route path="balances/:id/edit" element={<BalanceFormPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="cards" element={<CreditCardsPage />} />
          <Route path="cards/new" element={<CardFormPage />} />
          <Route path="cards/:id" element={<CardDetailPage />} />
          <Route path="cards/:id/edit" element={<CardFormPage />} />
          <Route path="cards/statements/unlinked" element={<UnlinkedStatementsPage />} />
          <Route path="cards/statements/unlinked/:sid/link" element={<LinkStatementPage />} />
          <Route path="cards/:id/statements/new" element={<StatementFormPage />} />
          <Route path="cards/:id/statements/:sid/edit" element={<StatementFormPage />} />
          <Route path="cards/:id/statements/:sid/expenses" element={<StatementExpensesPage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="investments/events/new" element={<EventFormPage />} />
          <Route path="investments/:id" element={<PositionDetailPage />} />
          <Route path="investments/:id/edit" element={<InvestmentFormPage />} />
          <Route path="investments/:id/events/new" element={<EventFormPage />} />
          <Route path="investments/:id/events/:eid/edit" element={<EventFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
