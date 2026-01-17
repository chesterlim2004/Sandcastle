import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  reorderCategories,
  updateBudget,
  updateCategory,
  updateTransaction,
} from './lib/api';

type ViewState =
  | { type: 'unsorted' }
  | { type: 'categories' }
  | { type: 'budget' }
  | { type: 'category'; id: string };

const toLocalDatetimeInput = (value: string | Date) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState(0);
  const [view, setView] = useState<ViewState>({ type: 'unsorted' });
  const [isComposeOpen, setComposeOpen] = useState(false);
  const [isCategoryComposerOpen, setCategoryComposerOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

    if (active.id.toString().startsWith('category-')) {
      const activeId = active.id.toString();
      const overId = over.id.toString();
      if (activeId === overId) return;

      const oldIndex = categories.findIndex((item) => `category-${item._id}` === activeId);
      const newIndex = categories.findIndex((item) => `category-${item._id}` === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      const next = arrayMove(categories, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index,
      }));
      const prev = categories;
      setCategories(next);
      try {
        await reorderCategories(next.map((item, index) => ({ id: item._id, order: index })));
      } catch (err) {
        setCategories(prev);
      }
      return;
    }

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

  const handleCreateCategory = async (payload: Pick<Category, 'name' | 'color'>) => {
    const created = await createCategory(payload);
    setCategories((prev) => [...prev, created]);
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    setCategories((prev) => prev.filter((item) => item._id !== id));
  };

  const handlePreviewCategory = (id: string, patch: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((item) => (item._id === id ? { ...item, ...patch } : item))
    );
  };

  const handleBudgetChange = async (value: number) => {
    const updated = await updateBudget(value);
    setBudget(updated.monthlyTotal || 0);
  };

  const handleUpdateTransaction = async (id: string, payload: Partial<Transaction>) => {
    const updated = await updateTransaction(id, payload);
    setTransactions((prev) => {
      if (view.type === 'unsorted') {
        if (updated.categoryId) {
          return prev.filter((item) => item._id !== id);
        }
        return prev.map((item) => (item._id === id ? updated : item));
      }
      if (view.type === 'category') {
        if (updated.categoryId !== view.id) {
          return prev.filter((item) => item._id !== id);
        }
        return prev.map((item) => (item._id === id ? updated : item));
      }
      return prev.map((item) => (item._id === id ? updated : item));
    });
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

  const openCategoryComposer = () => {
    setView({ type: 'categories' });
    setCategoryComposerOpen(true);
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
        <Sidebar
          user={user}
          categories={categories}
          view={view}
          onViewChange={setView}
          onAdd={() => setComposeOpen(true)}
          onAddCategory={openCategoryComposer}
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
                onPreview={handlePreviewCategory}
                createOpen={isCategoryComposerOpen}
                onOpenCreate={() => setCategoryComposerOpen(true)}
                onCloseCreate={() => setCategoryComposerOpen(false)}
              />
            )}
            {view.type === 'budget' && (
              <BudgetPanel budget={budget} onUpdate={handleBudgetChange} transactions={transactions} />
            )}
          </main>
        </div>
        {isComposeOpen && (
          <ComposeModal
            categories={categories}
            onClose={() => setComposeOpen(false)}
            onSubmit={async (payload) => {
              await createTransaction(payload);
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
        <p className="text-sm text-slate-500">Gmail-style budget tracking</p>
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
            <SortableContext
              items={categories.map((category) => `category-${category._id}`)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((category) => (
                <SortableCategoryItem
                  key={category._id}
                  category={category}
                  active={view.type === 'category' && view.id === category._id}
                  onClick={() => onViewChange({ type: 'category', id: category._id })}
                />
              ))}
            </SortableContext>
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

function SortableCategoryItem({
  category,
  active,
  onClick,
}: {
  category: Category;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `category-${category._id}`,
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isOver ? 'ring-2 ring-tide/60 rounded-xl' : ''}
    >
      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition',
          active ? 'bg-white shadow' : 'hover:bg-white/60'
        )}
        {...attributes}
        {...listeners}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
        <span className="text-sm font-medium">{category.name}</span>
      </button>
    </div>
  );
}

function TransactionPanel({
  title,
  subtitle,
  transactions,
  onUpdate,
  onImport,
  importing,
}: {
  title: string;
  subtitle: string;
  transactions: Transaction[];
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
          <TransactionRow key={txn._id} txn={txn} onUpdate={onUpdate} />
        ))}
      </div>
    </section>
  );
}

function TransactionRow({
  txn,
  onUpdate,
}: {
  txn: Transaction;
  onUpdate: (id: string, payload: Partial<Transaction>) => Promise<Transaction>;
}) {
  const [local, setLocal] = useState(txn);
  const handleEnterBlur = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const update = async (patch: Partial<Transaction>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
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
            value={local.amount}
            onChange={(e) => setLocal({ ...local, amount: Number(e.target.value) })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ amount: local.amount })}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2"
            value={toLocalDatetimeInput(local.occurredAt)}
            type="datetime-local"
            onChange={(e) => setLocal({ ...local, occurredAt: e.target.value })}
            onKeyDown={handleEnterBlur}
            onBlur={() => update({ occurredAt: local.occurredAt })}
          />
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
  onPreview,
  createOpen,
  onOpenCreate,
  onCloseCreate,
}: {
  categories: Category[];
  onCreate: (payload: Pick<Category, 'name' | 'color'>) => void;
  onUpdate: (id: string, payload: Partial<Category>) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string, payload: Partial<Category>) => void;
  createOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
}) {
  const [draft, setDraft] = useState({ name: '', color: '#e66b4f' });

  useEffect(() => {
    if (createOpen) {
      setDraft({ name: '', color: '#e66b4f' });
    }
  }, [createOpen]);

  return (
    <section className="card-surface rounded-3xl p-6 shadow-float fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">Category Management</h2>
          <p className="text-sm text-slate-500">Rename, recolor, or clean up categories.</p>
        </div>
        <button
          className="px-4 py-2 rounded-full border border-slate-300 text-sm"
          onClick={onOpenCreate}
        >
          Add Category
        </button>
      </div>
      {createOpen && (
        <div className="bg-white/80 rounded-2xl p-4 border border-white/70 mb-6">
          <div className="grid md:grid-cols-[2fr_1fr_auto] gap-3 items-center">
            <input
              className="border border-slate-200 rounded-lg px-3 py-2"
              placeholder="Category name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 h-11"
              type="color"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-full bg-tide text-white text-sm"
                onClick={() => {
                  if (!draft.name.trim()) return;
                  onCreate({ name: draft.name.trim(), color: draft.color });
                  onCloseCreate();
                }}
              >
                Save
              </button>
              <button
                className="px-3 py-2 rounded-full border border-slate-300 text-sm"
                onClick={onCloseCreate}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryRow
            key={category._id}
            category={category}
            onUpdate={onUpdate}
            onPreview={onPreview}
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
  onPreview,
  onDelete,
}: {
  category: Category;
  onUpdate: (id: string, payload: Partial<Category>) => void;
  onPreview: (id: string, payload: Partial<Category>) => void;
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
          onChange={(e) => {
            const next = { ...local, name: e.target.value };
            setLocal(next);
            onPreview(category._id, { name: next.name });
          }}
          onKeyDown={handleEnterBlur}
          onBlur={() => onUpdate(category._id, { name: local.name })}
        />
        <input
          className="border border-slate-200 rounded-lg px-3 py-2"
          type="color"
          value={local.color}
          style={{ backgroundColor: local.color }}
          onChange={(e) => {
            const next = { ...local, color: e.target.value };
            setLocal(next);
            onPreview(category._id, { color: next.color });
          }}
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
}: {
  budget: number;
  onUpdate: (value: number) => void;
  transactions: Transaction[];
}) {
  const [value, setValue] = useState(budget);

  const spent = transactions.reduce((sum, item) => sum + item.amount, 0);
  const remaining = Math.max(value - spent, 0);
  const percent = value > 0 ? Math.min((spent / value) * 100, 100) : 0;

  useEffect(() => {
    setValue(budget);
  }, [budget]);

  return (
    <section className="card-surface rounded-3xl p-6 shadow-float fade-in">
      <h2 className="font-display text-2xl mb-2">Monthly Budget</h2>
      <p className="text-sm text-slate-500 mb-6">Adjust anytime. We auto-track remaining funds.</p>
      <div className="flex items-center gap-3 mb-6">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 w-40"
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <button
          className="px-4 py-2 rounded-full bg-leaf text-white text-sm"
          onClick={() => onUpdate(value)}
        >
          Update budget
        </button>
      </div>
      <div className="bg-white/70 rounded-2xl p-5 border border-white/70">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>Spent: SGD {spent.toFixed(2)}</span>
          <span>Remaining: SGD {remaining.toFixed(2)}</span>
        </div>
        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-tide" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">{percent.toFixed(1)}% used</p>
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
    amount: 0,
    occurredAt: toLocalDatetimeInput(new Date()),
    categoryId: '',
  });

  const canSubmit = form.name && form.amount > 0 && form.categoryId;

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
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
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
            onClick={() => onSubmit(form)}
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
