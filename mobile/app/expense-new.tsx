import { useRouter } from 'expo-router'
import { ExpenseForm } from '../src/components/ExpenseForm'

export default function NewExpenseScreen() {
  const router = useRouter()
  return <ExpenseForm onSaved={() => router.back()} />
}
