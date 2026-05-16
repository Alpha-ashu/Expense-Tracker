import { db, Transaction } from "@/lib/database";
import { startOfMonth, subMonths, endOfMonth, isWithinInterval } from "date-fns";

export interface BudgetInsight {
  type: 'warning' | 'info' | 'success';
  category: string;
  message: string;
  savingPotential?: number;
  percentageChange?: number;
}

export const BudgetCoachService = {
  /**
   * Analyzes spending for a specific category and returns an insight
   */
  async getCategoryInsight(category: string, newAmount: number): Promise<BudgetInsight | null> {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    // Get transactions for this month and last month for the category
    const transactions = await db.transactions
      .where('category')
      .equals(category)
      .and(t => t.type === 'expense')
      .toArray();

    const currentMonthTotal = transactions
      .filter(t => t.date >= currentMonthStart)
      .reduce((sum, t) => sum + t.amount, 0) + newAmount;

    const lastMonthTotal = transactions
      .filter(t => t.date >= lastMonthStart && t.date <= lastMonthEnd)
      .reduce((sum, t) => sum + t.amount, 0);

    if (lastMonthTotal === 0) return null;

    const diff = currentMonthTotal - lastMonthTotal;
    const percentage = (diff / lastMonthTotal) * 100;

    if (percentage > 20) {
      return {
        type: 'warning',
        category,
        message: `Your ${category} spending is ${Math.round(percentage)}% higher than last month.`,
        percentageChange: percentage,
        savingPotential: diff > 0 ? diff * 0.15 : 0 // Suggest 15% reduction
      };
    } else if (percentage < -10) {
        return {
            type: 'success',
            category,
            message: `Great job! You've spent ${Math.round(Math.abs(percentage))}% less on ${category} this month.`,
            percentageChange: percentage
        };
    }

    return null;
  },

  /**
   * Generates general coaching advice based on overall patterns
   */
  async getGeneralCoachingAdvice(): Promise<BudgetInsight[]> {
    const insights: BudgetInsight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentTransactions = await db.transactions
      .where('date')
      .above(thirtyDaysAgo)
      .and(t => t.type === 'expense')
      .toArray();

    // Group by category
    const categoryTotals: Record<string, number> = {};
    recentTransactions.forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    // Find top categories
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a);

    if (sortedCategories.length > 0) {
        const [topCat, amount] = sortedCategories[0];
        if (amount > 1000) {
            insights.push({
                type: 'info',
                category: topCat,
                message: `${topCat} is your highest expense this month. Reducing it by 10% could save you ₹${Math.round(amount * 0.1)}.`
            });
        }
    }

    // Check for unusual spikes
    // ... more logic here ...

    return insights;
  }
};
