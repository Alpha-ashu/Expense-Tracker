import { db } from './database';
import { toast } from 'sonner';

// Export all data to JSON
export const exportDataToJSON = async (): Promise<string> => {
  try {
    const data = {
      accounts: await db.accounts.toArray(),
      transactions: await db.transactions.toArray(),
      loans: await db.loans.toArray(),
      loanPayments: await db.loanPayments.toArray(),
      goals: await db.goals.toArray(),
      goalContributions: await db.goalContributions.toArray(),
      groupExpenses: await db.groupExpenses.toArray(),
      investments: await db.investments.toArray(),
      notifications: await db.notifications.toArray(),
      friends: await db.friends.toArray(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

// Export data to CSV
export const exportDataToCSV = async (dataType: 'transactions' | 'accounts' | 'loans' | 'all' = 'all'): Promise<string> => {
  try {
    let csvContent = '';

    if (dataType === 'all' || dataType === 'transactions') {
      const transactions = await db.transactions.toArray();
      csvContent += 'Type,Amount,Account ID,Category,Description,Merchant,Date\n';
      transactions.forEach(t => {
        csvContent += `${t.type},${t.amount},${t.accountId},"${t.category}","${t.description}","${t.merchant || ''}",${new Date(t.date).toISOString()}\n`;
      });
      csvContent += '\n';
    }

    if (dataType === 'all' || dataType === 'accounts') {
      const accounts = await db.accounts.toArray();
      csvContent += 'Name,Type,Balance,Currency,IsActive\n';
      accounts.forEach(a => {
        csvContent += `"${a.name}",${a.type},${a.balance},${a.currency},${a.isActive}\n`;
      });
      csvContent += '\n';
    }

    if (dataType === 'all' || dataType === 'loans') {
      const loans = await db.loans.toArray();
      csvContent += 'Name,Type,Principal Amount,Outstanding Balance,Interest Rate,EMI Amount,Due Date,Status\n';
      loans.forEach(l => {
        csvContent += `"${l.name}",${l.type},${l.principalAmount},${l.outstandingBalance},${l.interestRate || ''},${l.emiAmount || ''},${l.dueDate ? new Date(l.dueDate).toISOString() : ''},${l.status}\n`;
      });
    }

    return csvContent;
  } catch (error) {
    console.error('CSV export failed:', error);
    throw error;
  }
};

// Import data from JSON
export const importDataFromJSON = async (jsonData: string): Promise<void> => {
  try {
    const data = JSON.parse(jsonData);

    // Validate data structure
    if (!data.accounts || !Array.isArray(data.accounts)) {
      throw new Error('Invalid data format: missing accounts');
    }

    // Clear existing data
    await db.accounts.clear();
    await db.transactions.clear();
    await db.loans.clear();
    await db.loanPayments.clear();
    await db.goals.clear();
    await db.goalContributions.clear();
    await db.groupExpenses.clear();
    await db.investments.clear();
    await db.notifications.clear();
    await db.friends.clear();

    // Import data
    if (data.accounts.length > 0) {
      await db.accounts.bulkAdd(data.accounts);
    }
    if (data.transactions?.length > 0) {
      await db.transactions.bulkAdd(data.transactions);
    }
    if (data.loans?.length > 0) {
      await db.loans.bulkAdd(data.loans);
    }
    if (data.loanPayments?.length > 0) {
      await db.loanPayments.bulkAdd(data.loanPayments);
    }
    if (data.goals?.length > 0) {
      await db.goals.bulkAdd(data.goals);
    }
    if (data.goalContributions?.length > 0) {
      await db.goalContributions.bulkAdd(data.goalContributions);
    }
    if (data.groupExpenses?.length > 0) {
      await db.groupExpenses.bulkAdd(data.groupExpenses);
    }
    if (data.investments?.length > 0) {
      await db.investments.bulkAdd(data.investments);
    }
    if (data.notifications?.length > 0) {
      await db.notifications.bulkAdd(data.notifications);
    }
    if (data.friends?.length > 0) {
      await db.friends.bulkAdd(data.friends);
    }

    toast.success('Data imported successfully');
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
};

// Download data to file
export const downloadDataToFile = async (filename: string, dataType: 'json' | 'csv' = 'json'): Promise<void> => {
  try {
    let content: string;
    let mimeType: string;

    if (dataType === 'json') {
      content = await exportDataToJSON();
      mimeType = 'application/json';
      filename = filename.endsWith('.json') ? filename : `${filename}.json`;
    } else {
      content = await exportDataToCSV();
      mimeType = 'text/csv';
      filename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Data exported to ${filename}`);
  } catch (error) {
    console.error('Download failed:', error);
    toast.error('Failed to export data');
    throw error;
  }
};

// Upload data from file
export const uploadDataFromFile = async (file: File): Promise<void> => {
  try {
    const text = await file.text();

    if (file.name.endsWith('.json')) {
      await importDataFromJSON(text);
    } else if (file.name.endsWith('.csv')) {
      // CSV import would need more sophisticated parsing
      toast.error('CSV import not yet implemented');
    } else {
      throw new Error('Unsupported file format');
    }
  } catch (error) {
    console.error('Upload failed:', error);
    toast.error('Failed to import data');
    throw error;
  }
};

// Create automatic backup
export const createBackup = async (): Promise<string> => {
  try {
    const data = await exportDataToJSON();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `finance-life-backup-${timestamp}.json`;

    // Store backup info in settings
    await db.settings.put({
      key: `backup-${timestamp}`,
      value: {
        filename,
        size: data.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    });

    toast.success('Backup created successfully');
    return data;
  } catch (error) {
    console.error('Backup creation failed:', error);
    toast.error('Failed to create backup');
    throw error;
  }
};

// List available backups
export const listBackups = async (): Promise<Array<{ filename: string; size: number; timestamp: string }>> => {
  try {
    const backups = await db.settings
      .where('key')
      .startsWith('backup-')
      .toArray();

    return backups.map(b => b.value).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
};
