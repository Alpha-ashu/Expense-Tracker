import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SecurityProvider, useSecurity } from '@/contexts/SecurityContext';
import { AuthPage } from '@/app/components/AuthPage';
import { PINAuth } from '@/app/components/PINAuth';
import { Sidebar } from '@/app/components/Sidebar';
import { Header } from '@/app/components/Header';
import { BottomNav } from '@/app/components/BottomNav';
import { QuickActionModal } from '@/app/components/QuickActionModal';
import { PWAInstallPrompt } from '@/app/components/PWAInstallPrompt';
import { FeatureVisibility } from '@/components/ui/FeatureVisibility';
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
import { VoiceInput } from '@/app/components/VoiceInput';
import { VoiceReview } from '@/app/components/VoiceReview';
import { AuthCallback } from '@/app/components/AuthCallback';
import { AdminDashboard } from '@/app/components/AdminDashboard';
import { AdvisorWorkspace } from '@/app/components/AdvisorWorkspace';
import { AdminFeaturePanel } from '@/app/components/AdminFeaturePanel';
import { AdvisorPanel } from '@/app/components/AdvisorPanel';
import { BookAdvisor } from '@/app/components/BookAdvisor';
import { PayEMI } from '@/app/components/PayEMI';
import { Diagnostics } from '@/app/components/Diagnostics';
import { ExportReports } from '@/app/components/ExportReports';
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
import { AddLoan } from '@/app/components/AddLoan';
import { AddGold } from '@/app/components/AddGold';
import { AddFriends } from '@/app/components/AddFriends';
import { UserProfile } from '@/app/components/UserProfile';
import { Notifications } from '@/app/components/Notifications';
import { SimpleAutoTest } from '@/components/ui/SimpleAutoTest';

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
  const { user, loading: authLoading } = useAuth();
  const { isAuthenticated, setAuthenticated } = useSecurity();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);


  // Static initialization (runs once)
  useEffect(() => {
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
  }, []);

  // User-dependent initialization (runs when user loads)
  useEffect(() => {
    // Check if this is an auth callback from Supabase email verification
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=')) {
      setCurrentPage('auth-callback');
    }

    // Initialize app data
    // Only initialize if user is loaded to support role-based seeding
    if (user) {
      const initTasks = [
        initializeNotifications(),
        // Pass user email to support forcing admin data
        initializeDemoData(user.email)
      ];

      Promise.all(initTasks).then(() => {
        // Initialize real-time sync
        initializeRealtimeSync();

        // Start health checks
        HealthChecker.checkHealth().catch(console.error);
        HealthChecker.startPeriodicCheck(60000).catch(console.error); // Check every minute

        setIsInitialized(true);
      });
    } else if (!authLoading) {
      // If not logged in, just initialize basics (though we likely redirect to auth anyway)
      setIsInitialized(true);
    }

    // Setup network listener
    const cleanupNetwork = setupNetworkListener(
      () => toast.success('Back online!'),
      () => toast.warning('You are offline. Data will sync when reconnected.')
    );

    return () => {
      cleanupNetwork();
    };
  }, [user, authLoading]);

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
        // Navigate to pay EMI page
        setCurrentPage('pay-emi');
        break;
      case 'split-bill':
        setCurrentPage('add-group');
        break;
      case 'add-goal':
        setCurrentPage('add-goal');
        break;
      case 'transfer':
        setCurrentPage('transfer');
        break;
      case 'voice-entry':
        // Show voice input page
        setCurrentPage('voice-input');
        break;
      case 'calendar':
        // Show calendar page
        setCurrentPage('calendar');
        break;
      default:
        break;
    }
  };

  // Loading auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-blue-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not logged in with Supabase
  if (!user) {
    return <AuthPage onAuthSuccess={() => setAuthenticated('true')} />;
  }

  // Show PIN authentication if enabled and not authenticated
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
      case 'auto-sizing-test':
        return <SimpleAutoTest />;
      case 'accounts':
        return <Accounts />;
      case 'transactions':
        return <Transactions />;
      case 'add-account':
        return <AddAccount />;
      case 'edit-account':
        // Get account ID from URL or context if needed
        return <EditAccount />;
      case 'book-advisor':
        return <BookAdvisor />;
      case 'add-transaction':
        return <AddTransaction />;
      case 'loans':
        return <Loans />;
      case 'add-loan':
        return <AddLoan />;
      case 'goals':
        return <Goals />;
      case 'add-goal':
        return <AddGoal />;
      case 'groups':
        return <Groups />;
      case 'add-group':
        return <AddGroup />;
      case 'add-friends':
        return <AddFriends />;
      case 'investments':
        return <Investments />;
      case 'add-investment':
        return <AddInvestment />;
      case 'add-gold':
        return <AddGold />;
      case 'edit-investment':
        return <EditInvestment />;
      case 'reports':
        return <Reports />;
      case 'export-reports':
        return <ExportReports />;
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
      case 'notifications':
        return <Notifications />;
      case 'user-profile':
        return <UserProfile />;
      case 'diagnostics':
        return <Diagnostics />;
      case 'auth-callback':
        return <AuthCallback />;
      case 'admin-feature-panel':
        return <AdminFeaturePanel />;
      case 'advisor-panel':
        return <AdvisorPanel />;
      case 'admin':
        return <AdminDashboard />;
      case 'advisor':
        return <AdvisorWorkspace />;
      case 'voice-input':
        return <VoiceInput />;
      case 'voice-review':
        return <VoiceReview />;
      case 'pay-emi':
        return <PayEMI />;
      case 'transfer':
        return <Transfer />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="w-full min-h-screen flex overflow-x-hidden bg-gray-50 app-container">
      {/* Desktop Sidebar - Fixed Position */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-50 w-28">
        <Sidebar />
      </div>

      {/* Main Content Area - With Sidebar Offset */}
      <div className="flex-1 lg:ml-28 flex flex-col min-h-screen mobile-content">
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0 bg-gray-50 mobile-main">
          {renderPage()}
        </main>
      </div>

      {/* Mobile/Tablet Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 mobile-only mobile-bottom-nav">
        <BottomNav onQuickAdd={() => setShowQuickAction(true)} />
      </div>

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
    <AuthProvider>
      <SecurityProvider>
        <AppProvider>
          <AppContent />
          <Toaster position="top-center" richColors closeButton />
        </AppProvider>
      </SecurityProvider>
    </AuthProvider>
  );
};

export default App;