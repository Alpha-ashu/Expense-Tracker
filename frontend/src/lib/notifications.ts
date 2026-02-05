import { db } from './database';

// Show notification to user (can be implemented with toast library)
export const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void => {
  // In a real app, this would use a toast library like sonner
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // For PWA, we can also show browser notifications if permission is granted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('FinanceLife', {
      body: message,
      icon: '/favicon.ico'
    });
  }
};

export const checkAndCreateNotifications = async () => {
  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Check loans for upcoming due dates
  const loans = await db.loans.filter(l => l.status === 'active' && l.dueDate).toArray();
  
  for (const loan of loans) {
    if (!loan.dueDate) continue;
    
    const dueDate = new Date(loan.dueDate);
    if (dueDate >= today && dueDate <= in7Days) {
      // Check if notification already exists
      const existing = await db.notifications
        .filter(n => n.type === 'loan' && n.relatedId === loan.id)
        .first();
      
      if (!existing) {
        await db.notifications.add({
          type: 'loan',
          title: 'Upcoming Loan Payment',
          message: `${loan.name} payment of ${loan.emiAmount || loan.outstandingBalance} is due on ${dueDate.toLocaleDateString()}`,
          dueDate: dueDate,
          isRead: false,
          relatedId: loan.id,
          createdAt: new Date(),
        });
      }
    }
  }

  // Check goals approaching deadline
  const goals = await db.goals.filter(g => g.currentAmount < g.targetAmount).toArray();
  
  for (const goal of goals) {
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 30 && daysRemaining > 0) {
      const existing = await db.notifications
        .filter(n => n.type === 'goal' && n.relatedId === goal.id)
        .first();
      
      if (!existing) {
        const remaining = goal.targetAmount - goal.currentAmount;
        const monthlyRequired = remaining / Math.max(1, daysRemaining / 30);
        
        await db.notifications.add({
          type: 'goal',
          title: 'Goal Deadline Approaching',
          message: `${goal.name} is ${daysRemaining} days away. You need to save ${monthlyRequired.toFixed(2)} per month to reach your target.`,
          dueDate: targetDate,
          isRead: false,
          relatedId: goal.id,
          createdAt: new Date(),
        });
      }
    }
  }
};

// Run notification check every time the app loads
export const initializeNotifications = () => {
  checkAndCreateNotifications();
  
  // Set up periodic checks (every hour)
  setInterval(() => {
    checkAndCreateNotifications();
  }, 60 * 60 * 1000);
};
