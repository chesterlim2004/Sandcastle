import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import clsx from 'clsx';

import {
  Category,
  Transaction,
  User,
  createCategory,
  createTransaction,
  deleteCategory,
  deleteMyData,
  disconnectGmail,
  fetchBudget,
  fetchCategories,
  fetchMe,
  fetchTransactions,
  getLoginUrl,
  importGmail,
  logout,
  moveTransaction,
  updateBudget,
  updateCategory,
  updateTransaction,
} from './lib/api';

type ViewState =
  | { type: 'unsorted' }
  | { type: 'categories' }
  | { type: 'budget' }
  | { type: 'category'; id: string };

const isAmountDraft = (rawValue: string) => {
  if (rawValue.includes('-') || rawValue.includes('+')) {
    return false;
  }
  return rawValue === '' || /^(0(\.\d{0,2})?|[1-9]\d*(\.\d{0,2})?)$/.test(rawValue);
};

const parsePositiveAmount = (rawValue: string) => {
  if (!/^(0\.(?:[1-9]\d?|0[1-9])|[1-9]\d*(\.\d{1,2})?)$/.test(rawValue)) {
    return null;
  }
  const next = Number(rawValue);
  return Number.isFinite(next) && next > 0 ? next : null;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState(0);
  const [view, setView] = useState<ViewState>({ type: 'unsorted' });
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const toastIdRef = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const pushToast = (message: string) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2400);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetchMe();
        setUser(me);
        const [cats, budgetData] = await Promise.all([fetchCategories(), fetchBudget()]);
        setCategories(cats);
        setBudget(budgetData.monthlyTotal || 0);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      if (view.type === 'unsorted') {
        const list = await fetchTransactions('unsorted');
        setTransactions(list);
      } else if (view.type === 'category') {
        const list = await fetchTransactions(view.id);
        setTransactions(list);
      } else if (view.type === 'budget') {
        const list = await fetchTransactions(null);
        setTransactions(list);
      } else {
        setTransactions([]);
      }
    };

    load();
  }, [user, view]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c._id, c])), [categories]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const transactionId = active.id.toString().replace('txn-', '');
    const dropTarget = over.id.toString();
    if (!dropTarget.startsWith('category-')) return;

    const categoryId = dropTarget.replace('category-', '');
    const nextCategoryId = categoryId === 'unsorted' ? null : categoryId;
    const current = transactions.find((item) => item._id === transactionId);
    if (!current || current.categoryId === nextCategoryId) return;

    const prev = transactions;
    setTransactions((items) => items.filter((item) => item._id !== transactionId));

    try {
      await moveTransaction(transactionId, nextCategoryId);
    } catch (err) {
      setTransactions(prev);
    }
  };

  const handleCreateCategory = async () => {
    const name = window.prompt('Category name');
    if (!name) return;
    const color = window.prompt('Hex color', '#e66b4f') || '#e66b4f';
    const created = await createCategory({ name, color });
    setCategories((prev) => [...prev, created]);
    pushToast('Category added.');
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    setCategories((prev) => prev.filter((item) => item._id !== id));
    pushToast('Category deleted.');
  };

  const handleBudgetChange = async (value: number) => {
    const updated = await updateBudget(value);
    setBudget(updated.monthlyTotal || 0);
  };

  const handleUpdateTransaction = async (id: string, payload: Partial<Transaction>) => {
    const updated = await updateTransaction(id, payload);
    setTransactions((prev) => prev.map((item) => (item._id === id ? updated : item)));
    return updated;
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await importGmail();
      if (view.type === 'unsorted') {
        const list = await fetchTransactions('unsorted');
        setTransactions(list);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (loading) {
    return <div className="p-10 text-lg">Loading Sandcastle...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-surface rounded-3xl p-10 max-w-lg text-center shadow-float fade-in">
          <h1 className="font-display text-4xl mb-4">Sandcastle</h1>
          <p className="text-slate-600 mb-6">
            Your Gmail-synced budget sanctuary. Track, sort, and stay ahead of every PayNow.
          </p>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 bg-tide text-white px-6 py-3 rounded-full font-semibold shadow"
          >
            Connect with Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="min-h-screen flex">
        {toasts.length > 0 && (
          <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="bg-ink text-white text-sm px-4 py-2 rounded-full shadow-lg"
              >
                {toast.message}
              </div>
            ))}
          </div>
        )}
        <Sidebar
          user={user}
          categories={categories}
          view={view}
          onViewChange={setView}
          onAdd={() => setComposeOpen(true)}
          onAddCategory={handleCreateCategory}
        />
        <div className="flex-1 flex flex-col">
          <Topbar
            user={user}
            onLogout={handleLogout}
            onDisconnect={disconnectGmail}
            onDeleteData={deleteMyData}
          />
          <main className="flex-1 p-8">
            {view.type === 'unsorted' && (
              <TransactionPanel
                title="Unsorted"
                subtitle="Recent Gmail imports live here until you categorize them."
                transactions={transactions}
                categories={categories}
                onUpdate={handleUpdateTransaction}
                onImport={handleImport}
                importing={importing}
              />
            )}
            {view.type === 'category' && (
              <TransactionPanel
                title={categoryMap.get(view.id)?.name || 'Category'}
                subtitle="Drag items here from Unsorted or edit inline."
                transactions={transactions}
                categories={categories}
                onUpdate={handleUpdateTransaction}
              />
            )}
            {view.type === 'categories' && (
              <CategoryManager
                categories={categories}
                onCreate={handleCreateCategory}
                onUpdate={async (id, payload) => {
                  const updated = await updateCategory(id, payload);
                  setCategories((prev) => prev.map((item) => (item._id === id ? updated : item)));
                }}
                onDelete={handleDeleteCategory}
              />
            )}
            {view.type === 'budget' && (
              <BudgetPanel
                budget={budget}
                onUpdate={handleBudgetChange}
                transactions={transactions}
                categories={categories}
              />
            )}
          </main>
        </div>
        {isComposeOpen && (
          <ComposeModal
            categories={categories}
            onClose={() => setComposeOpen(false)}
            onSubmit={async (payload) => {
              await createTransaction(payload);
              pushToast('Transaction added.');
              if (view.type === 'unsorted' || view.type === 'category') {
                const list = await fetchTransactions(
                  view.type === 'category' ? view.id : 'unsorted'
                );
                setTransactions(list);
              }
              setComposeOpen(false);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}

function Topbar({
  user,
  onLogout,
  onDisconnect,
  onDeleteData,
}: {
  user: User;
  onLogout: () => void;
  onDisconnect: () => void;
  onDeleteData: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-white/60 backdrop-blur">
      <div>
        <h1 className="font-display text-2xl">Sandcastle</h1>
        <p className="text-sm text-slate-500">Automated budget tracking</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-full border border-slate-300 text-sm"
            onClick={() => {
              if (window.confirm('Disconnect Gmail? You can reconnect anytime.')) {
                onDisconnect();
              }
            }}
          >
            Disconnect Gmail
          </button>
          <button
            className="px-3 py-1.5 rounded-full border border-slate-300 text-sm"
            onClick={() => {
              if (window.confirm('Delete all Sandcastle data? This cannot be undone.')) {
                onDeleteData();
              }
            }}
          >
            Delete my data
          </button>
          <button
            className="px-4 py-1.5 rounded-full bg-ink text-white text-sm"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  user,
  categories,
  view,
  onViewChange,
  onAdd,
  onAddCategory,
}: {
  user: User;
  categories: Category[];
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onAdd: () => void;
  onAddCategory: () => void;
}) {
  return (
    <aside className="w-72 p-6 border-r border-white/50 flex flex-col gap-6">
      <button
        className="bg-coral text-white rounded-2xl py-3 text-center font-semibold shadow-float"
        onClick={onAdd}
      >
        Add Transaction
      </button>
      <div className="space-y-3">
        <SidebarItem
          label="Unsorted"
          active={view.type === 'unsorted'}
          onClick={() => onViewChange({ type: 'unsorted' })}
          droppableId="category-unsorted"
        />
        <div className="mt-4">
          <button
            className="text-xs uppercase tracking-[0.2em] text-slate-500"
            onClick={() => onViewChange({ type: 'categories' })}
          >
            Categories
          </button>
          <div className="mt-3 space-y-2">
            {categories.map((category) => (
              <SidebarItem
                key={category._id}
                label={category.name}
                color={category.color}
                active={view.type === 'category' && view.id === category._id}
                onClick={() => onViewChange({ type: 'category', id: category._id })}
                droppableId={`category-${category._id}`}
              />
            ))}
            <button
              className="text-sm text-slate-500 hover:text-slate-700"
              onClick={onAddCategory}
            >
              + Add category
            </button>
          </div>
        </div>
        <SidebarItem
          label="Budgeting"
          active={view.type === 'budget'}
          onClick={() => onViewChange({ type: 'budget' })}
        />
      </div>
      <div className="mt-auto text-xs text-slate-500">Signed in as {user.email}</div>
    </aside>
  );
}

function SidebarItem({
  label,
  color,
  active,
  onClick,
  droppableId,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onClick: () => void;
  droppableId?: string;
}) {
  return (
    <Droppable id={droppableId || `static-${label}`}>
      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition',
          active ? 'bg-white shadow' : 'hover:bg-white/60'
        )}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: color || '#cbd5f5' }}
        />
        <span className="text-sm font-medium">{label}</span>
      </button>
    </Droppable>
  );
}

function TransactionPanel({
  title,
  subtitle,
  transactions,
  categories,
  onUpdate,
  onImport,
  importing,
}: {
  title: string;
  subtitle: string;
  transactions: Transaction[];
  categories: Category[];
  onUpdate: (id: string, payload: Partial<Transaction>) => Promise<Transaction>;
  onImport?: () => void;
  importing?: boolean;
}) {
  return (
    <section className="card-surface rounded-3xl p-6 shadow-float fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {onImport && (
          <button
            className="px-4 py-2 rounded-full border border-slate-300 text-sm"
            onClick={onImport}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Gmail'}
          </button>
        )}
      </div>
      <div className="space-y-3">
        {transactions.length === 0 && (
          <p className="text-sm text-slate-500">No transactions yet.</p>
        )}
        {transactions.map((txn) => (
          <TransactionRow key={txn._id} txn={txn} categories={categories} onUpdate={onUpdate} />
        ))}
      </div>
    </section>
  );
}

function TransactionRow({
  txn,
  categories,
  onUpdate,
}: {
  txn: Transaction;
  categories: Category[];
  onUpdate: (id: string, payload: Partial<Transaction>) => Promise<Transaction>;
}) {
  const [local, setLocal] = useState(txn);
  const [amountInput, setAmountInput] = useState(String(txn.amount));
  const handleEnterBlur = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  useEffect(() => {
    setLocal(txn);
    setAmountInput(String(txn.amount));
  }, [txn]);

  const update = async (patch: Partial<Transaction>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    if (patch.amount !== undefined) {
      setAmountInput(String(patch.amount));
    }
    await onUpdate(txn._id, patch);
  };

  return (
    <Draggable id={`txn-${txn._id}`}>
      <div className="bg-white/80 rounded-2xl p-4 flex flex-col gap-3 border border-white/70">
        <div className="grid md:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ name: local.name })}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            value={amountInput}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!isAmountDraft(nextValue)) return;
              setAmountInput(nextValue);
              const parsed = parsePositiveAmount(nextValue);
              if (parsed !== null) {
                setLocal({ ...local, amount: parsed });
              }
            }}
            onKeyDown={handleEnterBlur}
            onBlur={() => {
              const parsed = parsePositiveAmount(amountInput);
              if (parsed === null) {
                setAmountInput(String(local.amount));
                return;
              }
              void update({ amount: parsed });
            }}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            value={new Date(local.occurredAt).toISOString().slice(0, 16)}
            type="datetime-local"
            onChange={(e) => setLocal({ ...local, occurredAt: e.target.value })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ occurredAt: local.occurredAt })}
          />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2"
            value={local.categoryId || ''}
            onChange={(e) => update({ categoryId: e.target.value || null })}
          >
            <option value="">Unsorted</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid md:grid-cols-[1fr_1fr] gap-3">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            placeholder="Merchant / recipient"
            value={local.merchant || ''}
            onChange={(e) => setLocal({ ...local, merchant: e.target.value })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ merchant: local.merchant })}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            placeholder="Notes"
            value={local.notes || ''}
            onChange={(e) => setLocal({ ...local, notes: e.target.value })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ notes: local.notes })}
          />
        </div>
      </div>
    </Draggable>
  );
}

function CategoryManager({
  categories,
  onCreate,
  onUpdate,
  onDelete,
}: {
  categories: Category[];
  onCreate: () => void;
  onUpdate: (id: string, payload: Partial<Category>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="card-surface rounded-3xl p-6 shadow-float fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">Category Management</h2>
          <p className="text-sm text-slate-500">Rename, recolor, or clean up categories.</p>
        </div>
        <button
          className="px-4 py-2 rounded-full border border-slate-300 text-sm"
          onClick={onCreate}
        >
          Add Category
        </button>
      </div>
      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryRow
            key={category._id}
            category={category}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryRow({
  category,
  onUpdate,
  onDelete,
}: {
  category: Category;
  onUpdate: (id: string, payload: Partial<Category>) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(category);
  const handleEnterBlur = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  useEffect(() => {
    setLocal(category);
  }, [category]);

  return (
    <div className="bg-white/80 rounded-2xl p-4 border border-white/70">
      <div className="grid md:grid-cols-[2fr_1fr_auto] gap-3 items-center">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2"
          value={local.name}
          onChange={(e) => setLocal({ ...local, name: e.target.value })}
          onKeyDown={handleEnterBlur}
          onBlur={() => onUpdate(category._id, { name: local.name })}
        />
        <input
          className="border border-slate-200 rounded-lg px-3 py-2"
          type="color"
          value={local.color}
          onChange={(e) => setLocal({ ...local, color: e.target.value })}
          onKeyDown={handleEnterBlur}
          onBlur={() => onUpdate(category._id, { color: local.color })}
        />
        <button
          className="px-3 py-2 rounded-full border border-slate-300 text-sm"
          onClick={() => onDelete(category._id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function BudgetPanel({
  budget,
  onUpdate,
  transactions,
  categories,
}: {
  budget: number;
  onUpdate: (value: number) => void;
  transactions: Transaction[];
  categories: Category[];
}) {
  const [value, setValue] = useState(budget);
  const [valueInput, setValueInput] = useState(budget ? String(budget) : '');

  const spent = transactions.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(value - spent, 0);
  const percent = value > 0 ? Math.min((spent / value) * 100, 100) : 0;
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item._id, item])), [
    categories,
  ]);
  const breakdown = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; total: number }>();

    transactions.forEach((item) => {
      if (item.amount <= 0 || !item.categoryId) return;
      const category = categoryMap.get(item.categoryId);
      if (!category) return;
      const current = totals.get(item.categoryId);
      totals.set(item.categoryId, {
        name: category.name,
        color: category.color,
        total: (current?.total || 0) + item.amount,
      });
    });

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [transactions, categoryMap]);
  const totalSpent = breakdown.reduce((sum, item) => sum + item.total, 0);

  useEffect(() => {
    setValue(budget);
    setValueInput(budget ? String(budget) : '');
  }, [budget]);

  const parsedBudget = parsePositiveAmount(valueInput);

  return (
    <section className="card-surface rounded-3xl p-6 shadow-float fade-in text-base">
      <h2 className="font-display text-3xl mb-2">Monthly Budget</h2>
      <p className="text-base text-slate-500 mb-6">Adjust anytime. We auto-track remaining funds.</p>
      <div className="flex items-center gap-3 mb-6">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 w-40"
          type="number"
          value={valueInput}
          inputMode="decimal"
          min="0.01"
          step="0.01"
          onChange={(e) => {
            const nextValue = e.target.value;
            if (!isAmountDraft(nextValue)) return;
            setValueInput(nextValue);
            const parsed = parsePositiveAmount(nextValue);
            if (parsed !== null) {
              setValue(parsed);
            }
          }}
          onBlur={() => {
            if (parsedBudget === null) {
              setValueInput(value ? String(value) : '');
              return;
            }
            setValue(parsedBudget);
            setValueInput(String(parsedBudget));
          }}
        />
        <button
          className="px-4 py-2 rounded-full bg-leaf text-white text-sm"
          onClick={() => onUpdate(value)}
          disabled={parsedBudget === null}
        >
          Update budget
        </button>
      </div>
      <div className="bg-white/70 rounded-2xl p-5 border border-white/70">
        <div className="flex items-center justify-between text-base mb-2">
          <span>Spent: SGD {spent.toFixed(2)}</span>
          <span>Remaining: SGD {remaining.toFixed(2)}</span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-tide" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-sm text-slate-500 mt-2">{percent.toFixed(1)}% used</p>
      </div>
      <div className="bg-white/70 rounded-2xl p-5 border border-white/70 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Spending by category</h3>
          <span className="text-sm text-slate-500">Total SGD {totalSpent.toFixed(2)}</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative w-72 h-72 shrink-0">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <circle cx="100" cy="100" r="90" fill="none" stroke="#e2e8f0" strokeWidth="22" />
              {(() => {
                const radius = 90;
                const circumference = 2 * Math.PI * radius;
                let offset = 0;
                return breakdown.map((item) => {
                  const sliceLength = totalSpent > 0 ? (item.total / totalSpent) * circumference : 0;
                  const strokeDasharray = `${sliceLength} ${circumference - sliceLength}`;
                  const circle = (
                    <circle
                      key={item.name}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth="22"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={-offset}
                      strokeLinecap="butt"
                      transform="rotate(-90 100 100)"
                    />
                  );
                  offset += sliceLength;
                  return circle;
                });
              })()}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-base font-semibold text-slate-600">
              {totalSpent > 0 ? `${totalSpent.toFixed(2)} SGD` : 'No spend'}
            </div>
          </div>
          <div className="flex-1 grid gap-2 text-base">
            {breakdown.length === 0 ? (
              <p className="text-slate-500">No categorized spending yet.</p>
            ) : (
              breakdown.map((item) => {
                const share = totalSpent > 0 ? (item.total / totalSpent) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-slate-500">
                      {share.toFixed(1)}% · SGD {item.total.toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ComposeModal({
  categories,
  onClose,
  onSubmit,
}: {
  categories: Category[];
  onClose: () => void;
  onSubmit: (payload: Partial<Transaction>) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    amount: '',
    occurredAt: new Date().toISOString().slice(0, 16),
    categoryId: '',
  });

  const parsedAmount = parsePositiveAmount(form.amount);
  const canSubmit = form.name && parsedAmount && form.categoryId;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="card-surface rounded-3xl p-6 w-full max-w-xl shadow-float">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl">Add a transaction</h3>
          <button onClick={onClose} className="text-slate-500">
            Close
          </button>
        </div>
        <div className="space-y-3">
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 w-full"
            placeholder="Name or merchant"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 w-full"
            type="number"
            placeholder="Amount"
            value={form.amount}
            inputMode="decimal"
            min="0.01"
            step="0.01"
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!isAmountDraft(nextValue)) return;
              setForm({ ...form, amount: nextValue });
            }}
            onBlur={(e) => {
              const parsed = parsePositiveAmount(e.target.value);
              if (parsed === null) {
                setForm((prev) => ({ ...prev, amount: '' }));
              }
            }}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 w-full"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
          />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 w-full"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-end gap-3 mt-6">
          <button className="px-4 py-2 rounded-full border border-slate-300" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-full bg-tide text-white"
            onClick={() => {
              if (!parsedAmount) return;
              onSubmit({ ...form, amount: parsedAmount });
            }}
            disabled={!canSubmit}
          >
            Add transaction
          </button>
        </div>
      </div>
    </div>
  );
}

function Draggable({ children, id }: { children: React.ReactNode; id: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function Droppable({ children, id }: { children: React.ReactNode; id: string }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? 'ring-2 ring-tide/60 rounded-xl' : ''}>
      {children}
    </div>
  );
}

export default App;
