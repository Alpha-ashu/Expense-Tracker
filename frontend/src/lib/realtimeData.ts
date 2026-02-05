import { db } from './database';
import { realtimeSyncManager, trackChange } from './realTime';

// Real-time data manager for common operations
export class RealtimeDataManager {
  static async addTransaction(transaction: any) {
    try {
      const id = await db.transactions.add(transaction);
      trackChange('transaction-add', { ...transaction, id });
      return id;
    } catch (error) {
      console.error('Failed to add transaction:', error);
      throw error;
    }
  }

  static async updateTransaction(id: number, updates: any) {
    try {
      await db.transactions.update(id, updates);
      trackChange('transaction-update', { id, updates });
    } catch (error) {
      console.error('Failed to update transaction:', error);
      throw error;
    }
  }

  static async deleteTransaction(id: number) {
    try {
      await db.transactions.delete(id);
      trackChange('transaction-delete', { id });
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      throw error;
    }
  }

  static async addAccount(account: any) {
    try {
      const id = await db.accounts.add(account);
      trackChange('account-add', { ...account, id });
      return id;
    } catch (error) {
      console.error('Failed to add account:', error);
      throw error;
    }
  }

  static async updateAccount(id: number, updates: any) {
    try {
      await db.accounts.update(id, updates);
      trackChange('account-update', { id, updates });
    } catch (error) {
      console.error('Failed to update account:', error);
      throw error;
    }
  }

  static async deleteAccount(id: number) {
    try {
      await db.accounts.delete(id);
      trackChange('account-delete', { id });
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw error;
    }
  }

  static async addLoan(loan: any) {
    try {
      const id = await db.loans.add(loan);
      trackChange('loan-add', { ...loan, id });
      return id;
    } catch (error) {
      console.error('Failed to add loan:', error);
      throw error;
    }
  }

  static async updateLoan(id: number, updates: any) {
    try {
      await db.loans.update(id, updates);
      trackChange('loan-update', { id, updates });
    } catch (error) {
      console.error('Failed to update loan:', error);
      throw error;
    }
  }

  static async addGoal(goal: any) {
    try {
      const id = await db.goals.add(goal);
      trackChange('goal-add', { ...goal, id });
      return id;
    } catch (error) {
      console.error('Failed to add goal:', error);
      throw error;
    }
  }

  static async updateGoal(id: number, updates: any) {
    try {
      await db.goals.update(id, updates);
      trackChange('goal-update', { id, updates });
    } catch (error) {
      console.error('Failed to update goal:', error);
      throw error;
    }
  }

  static async addInvestment(investment: any) {
    try {
      const id = await db.investments.add(investment);
      trackChange('investment-add', { ...investment, id });
      return id;
    } catch (error) {
      console.error('Failed to add investment:', error);
      throw error;
    }
  }

  static async updateInvestment(id: number, updates: any) {
    try {
      await db.investments.update(id, updates);
      trackChange('investment-update', { id, updates });
    } catch (error) {
      console.error('Failed to update investment:', error);
      throw error;
    }
  }

  static async addGroupExpense(expense: any) {
    try {
      const id = await db.groupExpenses.add(expense);
      trackChange('group-expense-add', { ...expense, id });
      return id;
    } catch (error) {
      console.error('Failed to add group expense:', error);
      throw error;
    }
  }

  static async addFriend(friend: any) {
    try {
      const id = await db.friends.add(friend);
      trackChange('friend-add', { ...friend, id });
      return id;
    } catch (error) {
      console.error('Failed to add friend:', error);
      throw error;
    }
  }

  static async updateFriend(id: number, updates: any) {
    try {
      await db.friends.update(id, updates);
      trackChange('friend-update', { id, updates });
    } catch (error) {
      console.error('Failed to update friend:', error);
      throw error;
    }
  }

  static async deleteFriend(id: number) {
    try {
      await db.friends.delete(id);
      trackChange('friend-delete', { id });
    } catch (error) {
      console.error('Failed to delete friend:', error);
      throw error;
    }
  }
}

// Real-time notifications and updates
export class RealtimeNotifier {
  static async checkForUpdates() {
    // In a real app, this would check a backend for updates
    console.log('Checking for updates...');
  }

  static async notifyDataChange(changeType: string, data: any) {
    console.log(`Data changed: ${changeType}`, data);
    // Could trigger notifications here
  }

  static async syncWithBackend() {
    // Implement backend sync logic here
    console.log('Syncing with backend...');
  }
}

export default RealtimeDataManager;
