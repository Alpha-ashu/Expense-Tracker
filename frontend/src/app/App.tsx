import React, { useEffect, useState, Suspense, lazy, useRef } from 'react';
import { AppProvider, useOptionalApp } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SecurityProvider, useSecurity } from '@/contexts/SecurityContext';
import { Toaster } from 'sonner';
import { initializeNotifications } from '@/lib/notifications';
import { registerServiceWorker, setupPWAInstallPrompt, setupNetworkListener } from '@/lib/pwa';
import { HealthChecker } from '@/lib/health';
import { toast } from 'sonner';
import { initializeSmsTransactionDetection } from '@/services/smsTransactionDetectionService';

// ── Shell components (always visible — eager load) ──────────────────────────
import { Sidebar } from '@/app/components/Sidebar';
import { TopBar } from '@/app/components/ui/TopBar';
import { BottomNav } from '@/app/components/BottomNav';
import { QuickActionModal } from '@/app/components/QuickActionModal';
import { PWAInstallPrompt } from '@/app/components/PWAInstallPrompt';
import { LimitedModeBanner } from '@/components/common/LimitedModeBanner';

// ── Auth / Security (shown before app shell — eager load) ────────────────────
import { AuthFlow } from '@/components/auth/AuthFlow';
import { PINAuth } from '@/app/components/PINAuth';

// ── Page components — lazy loaded, each gets its own async chunk ─────────────
const Dashboard = lazy(() => import('@/app/components/Dashboard').then(m => ({ default: m.Dashboard })));
const Accounts = lazy(() => import('@/app/components/Accounts').then(m => ({ default: m.Accounts })));
const Transactions = lazy(() => import('@/app/components/Transactions').then(m => ({ default: m.Transactions })));
const Loans = lazy(() => import('@/app/components/Loans').then(m => ({ default: m.Loans })));
const Goals = lazy(() => import('@/app/components/Goals').then(m => ({ default: m.Goals })));
const GoalDetail = lazy(() => import('@/app/components/GoalDetail').then(m => ({ default: m.GoalDetail })));
const Groups = lazy(() => import('@/app/components/Groups').then(m => ({ default: m.Groups })));
const Investments = lazy(() => import('@/app/components/Investments').then(m => ({ default: m.Investments })));
const Reports = lazy(() => import('@/app/components/Reports').then(m => ({ default: m.Reports })));
const Settings = lazy(() => import('@/app/components/Settings').then(m => ({ default: m.Settings })));
const Calendar = lazy(() => import('@/app/components/Calendar').then(m => ({ default: m.Calendar })));
const Transfer = lazy(() => import('@/app/components/Transfer').then(m => ({ default: m.Transfer })));
const VoiceInput = lazy(() => import('@/app/components/VoiceInput').then(m => ({ default: m.VoiceInput })));
const VoiceReview = lazy(() => import('@/app/components/VoiceReview').then(m => ({ default: m.VoiceReview })));
const AuthCallback = lazy(() => import('@/app/components/AuthCallback').then(m => ({ default: m.AuthCallback })));
const AdminDashboard = lazy(() => import('@/app/components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdvisorWorkspace = lazy(() => import('@/app/components/AdvisorWorkspace').then(m => ({ default: m.AdvisorWorkspace })));
const AdminFeaturePanel = lazy(() => import('@/app/components/AdminFeaturePanel').then(m => ({ default: m.AdminFeaturePanel })));
const AdvisorPanel = lazy(() => import('@/app/components/AdvisorPanel').then(m => ({ default: m.AdvisorPanel })));
const BookAdvisor = lazy(() => import('@/app/components/BookAdvisor').then(m => ({ default: m.BookAdvisor })));
const PayEMI = lazy(() => import('@/app/components/PayEMI').then(m => ({ default: m.PayEMI })));
const Diagnostics = lazy(() => import('@/app/components/Diagnostics').then(m => ({ default: m.Diagnostics })));
const ExportReports = lazy(() => import('@/app/components/ExportReports').then(m => ({ default: m.ExportReports })));
const ToDoLists = lazy(() => import('@/app/components/ToDoLists').then(m => ({ default: m.ToDoLists })));
const ToDoListDetail = lazy(() => import('@/app/components/ToDoListDetail').then(m => ({ default: m.ToDoListDetail })));
const ToDoListShare = lazy(() => import('@/app/components/ToDoListShare').then(m => ({ default: m.ToDoListShare })));
const AddAccount = lazy(() => import('@/app/components/AddAccount').then(m => ({ default: m.AddAccount })));
const EditAccount = lazy(() => import('@/app/components/EditAccount').then(m => ({ default: m.EditAccount })));
const AddTransaction = lazy(() => import('@/app/components/AddTransaction').then(m => ({ default: m.AddTransaction })));
const AddGoal = lazy(() => import('@/app/components/AddGoal').then(m => ({ default: m.AddGoal })));
const AddGroup = lazy(() => import('@/app/components/AddGroup').then(m => ({ default: m.AddGroup })));
const AddInvestment = lazy(() => import('@/app/components/AddInvestment').then(m => ({ default: m.AddInvestment })));
const EditInvestment = lazy(() => import('@/app/components/EditInvestment').then(m => ({ default: m.EditInvestment })));
const AddLoan = lazy(() => import('@/app/components/AddLoan').then(m => ({ default: m.AddLoan })));
const AddGold = lazy(() => import('@/app/components/AddGold').then(m => ({ default: m.AddGold })));
const AddFriends = lazy(() => import('@/app/components/AddFriends').then(m => ({ default: m.AddFriends })));
const UserProfile = lazy(() => import('@/app/components/UserProfile').then(m => ({ default: m.UserProfile })));
const Notifications = lazy(() => import('@/app/components/Notifications').then(m => ({ default: m.Notifications })));
const SimpleAutoTest = lazy(() => import('@/components/ui/SimpleAutoTest').then(m => ({ default: m.SimpleAutoTest })));
const NewUserOnboarding = lazy(() => import('@/components/onboarding/NewUserOnboarding').then(m => ({ default: m.NewUserOnboarding })));

// ── Capacitor (native only) ──────────────────────────────────────────────────
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// ── Minimal page-transition spinner shown while lazy chunk loads ─────────────
const PageLoader = () => (
  <div className="flex items-center justify-center h-48 w-full pt-12">
    <div className="w-8 h-8 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
  </div>
);

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-gray-500 max-w-sm">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const appContext = useOptionalApp();
  if (!appContext) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-500 to-rose-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-base font-medium">Loading Finora…</p>
        </div>
      </div>
    );
  }

  const { currentPage, setCurrentPage } = appContext;
  const { user, loading: authLoading, dataReady, dataSyncing, dataSyncError, triggerDataSync } = useAuth();
  const { isAuthenticated, setAuthenticated } = useSecurity();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);
  const [criticalPagesPrefetched, setCriticalPagesPrefetched] = useState(false);
  const hasModuleReloaded = useRef(false);

  // Static initialization (runs once)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      setupNativeFeatures();
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'add-expense') {
      setShowQuickAction(true);
    }

    registerServiceWorker();
    setupPWAInstallPrompt();
  }, []);

  // Recover from stale cached chunks (service worker or CDN mismatch)
  useEffect(() => {
    const handleModuleFailure = async () => {
      if (hasModuleReloaded.current) return;
      hasModuleReloaded.current = true;

      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      } catch (error) {
        console.warn('Failed to clear SW cache after module error:', error);
      } finally {
        window.location.reload();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = String(event.reason?.message || event.reason || '');
      if (message.includes('Failed to fetch dynamically imported module') ||
          message.includes('Expected a JavaScript-or-Wasm module script')) {
        handleModuleFailure();
      }
    };

    const handleError = (event: ErrorEvent) => {
      const message = String(event.message || '');
      if (message.includes('Failed to fetch dynamically imported module') ||
          message.includes('Expected a JavaScript-or-Wasm module script')) {
        handleModuleFailure();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // User-dependent initialization
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token') && hash.includes('type=')) {
      setCurrentPage('auth-callback');
    }

    if (user) {
      // Render ASAP; run heavy init work in the background
      setIsInitialized(true);

      void Promise.resolve().then(() => initializeNotifications());
      void Promise.resolve().then(() => initializeSmsTransactionDetection());
      HealthChecker.checkHealth().catch(console.error);
      HealthChecker.startPeriodicCheck(60000).catch(console.error);

      if (!criticalPagesPrefetched) {
        // Preload critical pages right after login to avoid first-click lag
        void import('@/app/components/Dashboard');
        void import('@/app/components/Transactions');
        setCriticalPagesPrefetched(true);
      }
    } else if (!authLoading) {
      setIsInitialized(true);
    }

    const cleanupNetwork = setupNetworkListener(
      () => toast.success('Back online!'),
      () => toast.warning('You are offline. Data will sync when reconnected.')
    );
    return () => { cleanupNetwork(); };
  }, [user, authLoading, criticalPagesPrefetched]);

  // Ensure we land on dashboard after login when the URL is a stale auth path
  useEffect(() => {
    if (!user || authLoading) return;
    const staleAuthPaths = new Set(['login', 'signin', 'auth-callback', '']);
    if (staleAuthPaths.has(currentPage)) {
      setCurrentPage('dashboard');
    }
  }, [user, authLoading, currentPage, setCurrentPage]);

  const setupNativeFeatures = async () => {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#2563eb' });
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) CapacitorApp.exitApp();
        else window.history.back();
      });
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) console.log('App is active');
      });
    } catch (error) {
      console.error('Error setting up native features:', error);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-expense':
        localStorage.setItem('quickFormType', 'expense');
        localStorage.setItem('quickBackPage', 'transactions');
        setCurrentPage('add-transaction');
        break;
      case 'add-income':
        localStorage.setItem('quickFormType', 'income');
        localStorage.setItem('quickBackPage', 'transactions');
        setCurrentPage('add-transaction');
        break;
      case 'pay-emi': setCurrentPage('pay-emi'); break;
      case 'split-bill':
        localStorage.setItem('quickFormType', 'expense');
        localStorage.setItem('quickExpenseMode', 'group');
        localStorage.setItem('quickBackPage', 'groups');
        setCurrentPage('add-transaction');
        break;
      case 'add-goal': setCurrentPage('add-goal'); break;
      case 'transfer': setCurrentPage('transfer'); break;
      case 'voice-entry': setCurrentPage('voice-input'); break;
      case 'calendar': setCurrentPage('calendar'); break;
    }
  };

  // ── Loading auth state ──────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-500 to-rose-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-base font-medium">Loading Finora…</p>
        </div>
      </div>
    );
  }

  const hasCompletedOnboarding = localStorage.getItem('onboarding_completed') === 'true';
  const hasProfileData = localStorage.getItem('user_profile') || localStorage.getItem('user_settings');
  const isNewUser = !hasCompletedOnboarding && !hasProfileData;

  if (!user) return <AuthFlow />;

  // Gate 1: Onboarding (BEFORE PIN)
  if (!hasCompletedOnboarding && isNewUser) {
    return (
      <Suspense fallback={<PageLoader />}>
        <NewUserOnboarding />
      </Suspense>
    );
  }

  // Gate 2: PIN authentication
  if (!isAuthenticated) {
    return <PINAuth onAuthenticated={setAuthenticated} />;
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-500 to-rose-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-base font-medium">Loading Finora…</p>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    const bypassDataGatePages = new Set([
      'auth-callback',
    ]);

    if (user && !dataReady && !bypassDataGatePages.has(currentPage)) {
      return (
        <div className="flex items-center justify-center h-[60vh] w-full">
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-700 font-medium">
              {dataSyncing ? 'Syncing your data…' : 'Loading your data…'}
            </p>
            {dataSyncError && (
              <p className="text-xs text-gray-500 mt-1">
                Having trouble reaching the cloud. Using last saved data.
              </p>
            )}
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard': return <Dashboard setCurrentPage={setCurrentPage} />;
      case 'auto-sizing-test': return <SimpleAutoTest />;
      case 'accounts': return <Accounts />;
      case 'transactions': return <Transactions />;
      case 'add-account': return <AddAccount />;
      case 'edit-account': return <EditAccount />;
      case 'book-advisor': return <BookAdvisor />;
      case 'add-transaction': return <AddTransaction />;
      case 'loans': return <Loans />;
      case 'add-loan': return <AddLoan />;
      case 'goals': return <Goals />;
      case 'goal-detail': return <GoalDetail />;
      case 'add-goal': return <AddGoal />;
      case 'groups': return <Groups />;
      case 'add-group': return <AddGroup />;
      case 'add-friends': return <AddFriends />;
      case 'investments': return <Investments />;
      case 'add-investment': return <AddInvestment />;
      case 'add-gold': return <AddGold />;
      case 'edit-investment': return <EditInvestment />;
      case 'reports': return <Reports />;
      case 'export-reports': return <ExportReports />;
      case 'calendar': return <Calendar />;
      case 'todo-lists': return <ToDoLists />;
      case 'todo-list-detail': return <ToDoListDetail />;
      case 'todo-list-share': return <ToDoListShare />;
      case 'settings': return <Settings />;
      case 'notifications': return <Notifications />;
      case 'user-profile': return <UserProfile />;
      case 'diagnostics': return <Diagnostics />;
      case 'auth-callback': return <AuthCallback />;
      case 'admin-feature-panel': return <AdminFeaturePanel />;
      case 'advisor-panel': return <AdvisorPanel />;
      case 'admin': return <AdminDashboard />;
      case 'advisor': return <AdvisorWorkspace />;
      case 'voice-input': return <VoiceInput />;
      case 'voice-review': return <VoiceReview />;
      case 'pay-emi': return <PayEMI />;
      case 'transfer': return <Transfer />;
      default: return <Dashboard setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="w-full min-h-screen flex overflow-x-hidden bg-gray-50 app-container">
      <LimitedModeBanner />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-50 w-28">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-28 flex flex-col min-h-screen mobile-content relative overflow-x-hidden">
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-0 bg-gray-50 mobile-main" style={{ maxWidth: '100%' }}>
          {/* Global alignment envelope — centers content on wide screens */}
          <div className="w-full max-w-[1440px] mx-auto overflow-x-hidden" style={{ isolation: 'isolate' }}>
            {dataSyncError && (
              <div className="px-4 sm:px-6 pt-4">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                  <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div>
                    <p className="font-semibold">Offline or Cloud Unreachable</p>
                    <p className="text-amber-700">
                      Showing last saved data. Changes will sync when the connection is restored.
                    </p>
                    <button
                      type="button"
                      onClick={() => void triggerDataSync()}
                      disabled={dataSyncing}
                      className="mt-2 inline-flex items-center rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {dataSyncing ? 'Syncing…' : 'Re-sync now'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <PageErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                {renderPage()}
              </Suspense>
            </PageErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 mobile-only mobile-bottom-nav">
        <BottomNav onQuickAdd={() => setShowQuickAction(true)} />
      </div>

      <QuickActionModal
        isOpen={showQuickAction}
        onClose={() => setShowQuickAction(false)}
        onAction={handleQuickAction}
      />
      <PWAInstallPrompt />
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <SecurityProvider>
      <AppProvider>
        <AppContent />
        <Toaster position="top-center" richColors closeButton />
      </AppProvider>
    </SecurityProvider>
  </AuthProvider>
);

export default App;
