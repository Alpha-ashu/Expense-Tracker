import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { SecurityProvider, useSecurity } from '@/contexts/SecurityContext';
import { PINAuth } from '@/app/components/PINAuth';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/Header';
import { BottomNav } from '@/app/components/BottomNav';
import { QuickActionModal } from '@/app/components/QuickActionModal';
import { PWAInstallPrompt } from '@/app/components/PWAInstallPrompt';
import { Dashboard } from '@/app/components/Dashboard';
import { Accounts } from '@/app/components/Accounts';
import { Transactions } from '@/app/components/Transactions';
import { Loans } from '@/app/components/Loans';
import { Goals } from '@/app/components/Goals';
import { Groups } from '@/app/components/Groups';
import { Investments } from '@/app/components/Investments';
import { Reports } from '@/app/components/Reports';
import { Settings } from '@/app/components/Settings';
import { Calendar } from '@/app/components/Calendar';
import { Transfer } from '@/app/components/Transfer';
import { TaxCalculator } from '@/app/components/TaxCalculatorPage';
import { FinanceAdvisor } from '@/app/components/FinanceAdvisorPage';
import { ToDoLists } from '@/app/components/ToDoLists';
import { ToDoListDetail } from '@/app/components/ToDoListDetail';
import { ToDoListShare } from '@/app/components/ToDoListShare';
import { AddAccount } from '@/app/components/AddAccount';
import { EditAccount } from '@/app/components/EditAccount';
import { AddTransaction } from '@/app/components/AddTransaction';
import { AddGoal } from '@/app/components/AddGoal';
import { AddGroup } from '@/app/components/AddGroup';
import { AddInvestment } from '@/app/components/AddInvestment';
import { EditInvestment } from '@/app/components/EditInvestment';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { Toaster } from 'sonner';
import { initializeDemoData } from '@/lib/demoData';
import { initializeNotifications } from '@/lib/notifications';
import { registerServiceWorker, setupPWAInstallPrompt, setupNetworkListener } from '@/lib/pwa';
import { initializeRealtimeSync } from '@/lib/realTime';
import { HealthChecker } from '@/lib/health';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

const AppContent: React.FC = () => {
  const { currentPage, setCurrentPage, currency } = useApp();
  const { isAuthenticated, setAuthenticated } = useSecurity();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);

  useEffect(() => {
    // Initialize app data
    Promise.all([
      initializeDemoData(),
      initializeNotifications(),
    ]).then(() => {
      // Initialize real-time sync
      initializeRealtimeSync();
      
      // Start health checks
      HealthChecker.checkHealth().catch(console.error);
      HealthChecker.startPeriodicCheck(60000).catch(console.error); // Check every minute
      
      setIsInitialized(true);
    });

    // Setup Capacitor plugins for native platforms
    if (Capacitor.isNativePlatform()) {
      setupNativeFeatures();
    }

    // Handle URL parameters for quick actions
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'add-expense') {
      setShowQuickAction(true);
    }

    // Register service worker and setup PWA features
    registerServiceWorker();
    setupPWAInstallPrompt();
    
    // Setup network listener
    const cleanupNetwork = setupNetworkListener(
      () => toast.success('Back online!'),
      () => toast.warning('You are offline. Data will sync when reconnected.')
    );

    return () => {
      cleanupNetwork();
    };
  }, []);

  const setupNativeFeatures = async () => {
    try {
      // Set status bar style
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#2563eb' });

      // Handle back button on Android
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });

      // Handle app state changes
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('App is active');
        }
      });
    } catch (error) {
      console.error('Error setting up native features:', error);
    }
  };

  const handleQuickAction = (action: string) => {
    console.log('Quick action:', action);
    // Handle different quick actions - direct navigation to form pages
    switch (action) {
      case 'add-expense':
        // Navigate directly to add-transaction with expense pre-selected
        localStorage.setItem('quickFormType', 'expense');
        setCurrentPage('add-transaction');
        break;
      case 'add-income':
        // Navigate directly to add-transaction with income pre-selected
        localStorage.setItem('quickFormType', 'income');
        setCurrentPage('add-transaction');
        break;
      case 'pay-emi':
        // Navigate to add transaction with loan payment type
        localStorage.setItem('quickFormType', 'loan-payment');
        setCurrentPage('add-transaction');
        break;
      case 'split-bill':
        setCurrentPage('add-group');
        break;
      case 'add-goal':
        setCurrentPage('add-goal');
        break;
      case 'transfer':
        setCurrentPage('add-transaction');
        localStorage.setItem('quickFormType', 'transfer');
        break;
      case 'voice-entry':
        // Show voice input modal
        setCurrentPage('voice-input');
        break;
      default:
        break;
    }
  };

  // Show PIN authentication if not authenticated
  if (!isAuthenticated) {
    return <PINAuth onAuthenticated={setAuthenticated} />;
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-blue-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading FinanceLife...</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'accounts':
        return <Accounts />;
      case 'add-account':
        return <AddAccount />;
      case 'edit-account':
        // Get account ID from URL or context if needed
        return <EditAccount />;
      case 'transactions':
        return <Transactions />;
      case 'add-transaction':
        return <AddTransaction />;
      case 'loans':
        return <Loans />;
      case 'goals':
        return <Goals />;
      case 'add-goal':
        return <AddGoal />;
      case 'groups':
        return <Groups />;
      case 'add-group':
        return <AddGroup />;
      case 'investments':
        return <Investments />;
      case 'add-investment':
        return <AddInvestment />;
      case 'edit-investment':
        return <EditInvestment />;
      case 'reports':
        return <Reports />;
      case 'calendar':
        return <Calendar />;
      case 'todo-lists':
        return <ToDoLists />;
      case 'todo-list-detail':
        return <ToDoListDetail />;
      case 'todo-list-share':
        return <ToDoListShare />;
      case 'settings':
        return <Settings />;
      case 'transfer':
        return <Transfer />;
      case 'tax-calculator':
        return <TaxCalculator />;
      case 'finance-advisor':
        return <FinanceAdvisor />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden mobile-container">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-hide pb-20 lg:pb-0">
          {renderPage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onQuickAdd={() => setShowQuickAction(true)} />

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={showQuickAction}
        onClose={() => setShowQuickAction(false)}
        onAction={handleQuickAction}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SecurityProvider>
      <AppProvider>
        <AppContent />
        <Toaster position="top-center" richColors closeButton />
      </AppProvider>
    </SecurityProvider>
  );
};

export default App;