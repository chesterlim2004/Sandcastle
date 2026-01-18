import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export type User = {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
};

export type Category = {
  _id: string;
  name: string;
  color: string;
};

export type Transaction = {
  _id: string;
  name: string;
  merchant?: string;
  recipient?: string;
  amount: number;
  currency: string;
  occurredAt: string;
  categoryId: string | null;
  notes?: string;
  source: 'manual' | 'gmail';
};

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.user as User;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchCategories() {
  const res = await api.get('/api/categories');
  return res.data.categories as Category[];
}

export async function createCategory(payload: Partial<Category>) {
  const res = await api.post('/api/categories', payload);
  return res.data.category as Category;
}

export async function updateCategory(id: string, payload: Partial<Category>) {
  const res = await api.patch(`/api/categories/${id}`, payload);
  return res.data.category as Category;
}

export async function deleteCategory(id: string) {
  await api.delete(`/api/categories/${id}`);
}

export async function reorderCategories(order: Array<{ id: string; order: number }>) {
  await api.post('/api/categories/reorder', { order });
}

export async function fetchTransactions(categoryId: string | 'unsorted' | null) {
  const params = categoryId ? { categoryId } : undefined;
  const res = await api.get('/api/transactions', { params });
  return res.data.transactions as Transaction[];
}

export async function createTransaction(payload: Partial<Transaction>) {
  const normalized =
    payload.amount !== undefined
      ? {
          ...payload,
          amount: typeof payload.amount === 'string' ? Number(payload.amount) : payload.amount,
        }
      : payload;
  const res = await api.post('/api/transactions', normalized);
  return res.data.transaction as Transaction;
}

export async function updateTransaction(id: string, payload: Partial<Transaction>) {
  const normalized =
    payload.amount !== undefined
      ? {
          ...payload,
          amount: typeof payload.amount === 'string' ? Number(payload.amount) : payload.amount,
        }
      : payload;
  const res = await api.patch(`/api/transactions/${id}`, normalized);
  return res.data.transaction as Transaction;
}

export async function deleteTransaction(id: string) {
  await api.delete(`/api/transactions/${id}`);
}

export async function moveTransaction(id: string, categoryId: string | null) {
  const res = await api.post(`/api/transactions/${id}/move`, { categoryId });
  return res.data.transaction as Transaction;
}

export async function fetchBudget() {
  const res = await api.get('/api/budget');
  return res.data.budget as { monthlyTotal: number; categoryCaps?: Record<string, number> };
}

export async function updateBudget(payload: {
  monthlyTotal?: number;
  categoryCaps?: Record<string, number>;
}) {
  const res = await api.put('/api/budget', payload);
  return res.data.budget as { monthlyTotal: number; categoryCaps?: Record<string, number> };
}

export async function importGmail() {
  const res = await api.post('/api/import');
  return res.data as { imported: number };
}

export async function disconnectGmail() {
  await api.delete('/api/account/gmail');
}

export async function deleteMyData() {
  await api.delete('/api/account/data');
}

export function getLoginUrl() {
  return `${import.meta.env.VITE_API_URL}/auth/google`;
}
