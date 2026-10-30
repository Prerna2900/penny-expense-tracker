import { ChangeDetectionStrategy, Component, computed, effect, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
}

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly categories = ['Housing', 'Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Other'];
  protected readonly storageKey = 'expense-tracker-expenses';
  protected readonly search = signal('');
  protected readonly categoryFilter = signal('All');
  protected readonly expenses = signal<Expense[]>(this.loadExpenses());

  protected readonly total = computed(() => this.expenses().reduce((sum, expense) => sum + expense.amount, 0));
  protected readonly average = computed(() => {
    const items = this.expenses();
    return items.length ? this.total() / items.length : 0;
  });
  protected readonly largestExpense = computed(() => this.expenses().reduce((largest, expense) => Math.max(largest, expense.amount), 0));
  protected readonly categoryTotals = computed(() => {
    const totals = new Map<string, number>();
    for (const expense of this.expenses()) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    }
    return [...totals.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  });
  protected readonly recentExpenses = computed(() => [...this.expenses()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4));
  protected readonly filteredExpenses = computed(() => {
    const query = this.search().trim().toLowerCase();
    const category = this.categoryFilter();
    return [...this.expenses()].filter((expense) => {
      const matchesSearch = !query || `${expense.title} ${expense.category}`.toLowerCase().includes(query);
      const matchesCategory = category === 'All' || expense.category === category;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => b.date.localeCompare(a.date));
  });

  protected readonly expenseForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
    amount: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.01)] }),
    category: new FormControl('Food', { nonNullable: true, validators: Validators.required }),
    date: new FormControl(this.today(), { nonNullable: true, validators: Validators.required })
  });

  constructor() {
    effect(() => localStorage.setItem(this.storageKey, JSON.stringify(this.expenses())));
  }

  protected addExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const value = this.expenseForm.getRawValue();
    const expense: Expense = {
      id: crypto.randomUUID(),
      title: value.title.trim(),
      amount: Number(value.amount),
      category: value.category,
      date: value.date
    };
    this.expenses.update((items) => [expense, ...items]);
    this.expenseForm.reset({ title: '', amount: null, category: 'Food', date: this.today() });
  }

  protected deleteExpense(id: string): void {
    this.expenses.update((items) => items.filter((expense) => expense.id !== id));
  }

  protected scrollToExpenseForm(): void {
    document.getElementById('add-expense')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(`${date}T00:00:00`));
  }

  protected getInitials(category: string): string {
    return category.slice(0, 2).toUpperCase();
  }

  protected categoryBarWidth(total: number): number {
    const maximum = Math.max(...this.categoryTotals().map((item) => item.total), 1);
    return Math.max(4, total / maximum * 100);
  }

  protected today(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  private loadExpenses(): Expense[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) as Expense[] : [];
    } catch {
      return [];
    }
  }
}
