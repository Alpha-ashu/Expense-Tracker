import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Plus, Wallet, CreditCard, Banknote, Smartphone, Edit2, Trash2, X, Receipt, TrendingUp, TrendingDown, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DeleteConfirmModal } from '@/app/components/DeleteConfirmModal';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { StatementImport } from '@/app/components/StatementImport';

type AssetType = 'all' | 'bank' | 'card' | 'wallet' | 'cash';

export const Accounts: React.FC = () => {
  const { accounts, transactions, currency, setCurrentPage } = useApp();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetType>('all');
  const [statementImportOpen, setStatementImportOpen] = useState<{ accountId: number; accountName: string; accountType: string } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Filter accounts based on active tab
  const filteredAccounts = useMemo(() => {
    if (activeTab === 'all') return accounts;
    return accounts.filter(a => a.type === activeTab);
  }, [accounts, activeTab]);

  const tabs = [
    { id: 'all', label: 'All Assets', icon: TrendingUp },
    { id: 'bank', label: 'Banks', icon: Wallet },
    { id: 'card', label: 'Cards', icon: CreditCard },
    { id: 'wallet', label: 'Digital', icon: Smartphone },
    { id: 'cash', label: 'Cash', icon: Banknote },
  ];

  // Scroll-to-sync: Track active account based on carousel scroll position
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleCarouselScroll = () => {
      const carouselRect = carousel.getBoundingClientRect();
      const carouselCenter = carouselRect.left + carouselRect.width / 2;

      let closestCard: { id: number; distance: number } | null = null;

      filteredAccounts.forEach((account) => {
        const cardEl = cardRefs.current[account.id!];
        if (!cardEl) return;

        const cardRect = cardEl.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - carouselCenter);

        if (!closestCard || distance < closestCard.distance) {
          closestCard = { id: account.id!, distance };
        }
      });

      if (closestCard && closestCard.id !== selectedAccountId) {
        setSelectedAccountId(closestCard.id);
      }
    };

    carousel.addEventListener('scroll', handleCarouselScroll);
    // Initial check
    setTimeout(handleCarouselScroll, 100);

    return () => {
      carousel.removeEventListener('scroll', handleCarouselScroll);
    };
  }, [filteredAccounts, selectedAccountId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleDeleteAccount = (id: number, name: string) => {
    setAccountToDelete({ id, name });
    setDeleteModalOpen(true);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      await db.accounts.delete(accountToDelete.id);
      toast.success('Account deleted successfully');
      setDeleteModalOpen(false);
      setAccountToDelete(null);
      if (selectedAccountId === accountToDelete.id) {
        setSelectedAccountId(null);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return <Wallet size={20} />;
      case 'card': return <CreditCard size={20} />;
      case 'cash': return <Banknote size={20} />;
      case 'wallet': return <Smartphone size={20} />;
      default: return <Wallet size={20} />;
    }
  };

  const totalBalance = accounts.filter(a => a.isActive).reduce((sum, a) => sum + a.balance, 0);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(t => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gray-50">
      <div className="max-w-full mx-auto pb-32 lg:pb-8 w-full">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 lg:pt-8 pb-4 lg:pb-6">
          <PageHeader title="Accounts" subtitle="Manage your wallets and payment sources">
            <Button
              onClick={() => setCurrentPage('add-account')}
              className="rounded-full h-10 px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-sm"
            >
              <Plus size={16} className="mr-2" />
              Add Account
            </Button>
          </PageHeader>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide pb-4 px-4 sm:px-6 lg:px-8 xl:px-12 mb-4 lg:mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AssetType)}
                className={`relative flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2.5 lg:py-3 rounded-full transition-all duration-300 font-medium whitespace-nowrap text-xs sm:text-sm lg:text-base ${
                  isActive ? 'text-white shadow-lg shadow-pink-200' : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPillAccounts"
                    className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                  <Icon size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
                  <span className="inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile: 2 cards per row, centered */}
        <div className="lg:hidden">
          <div className="flex gap-3 overflow-x-auto pb-8 px-3 sm:px-4 md:px-6 snap-x snap-mandatory scrollbar-hide scroll-smooth">
            {filteredAccounts.map((account) => {
              const isActive = selectedAccountId === account.id;
              return (
                <div
                  key={account.id}
                  ref={(el) => {
                    if (el) cardRefs.current[account.id!] = el;
                  }}
                  className="snap-center shrink-0"
                  style={{
                    scrollSnapAlign: 'center',
                    scrollSnapStop: 'always',
                    width: 'calc(50% - 6px)',
                  }}
                >
                  <div
                    style={{
                      transition: 'all 0.3s ease-in-out',
                      transform: isActive ? 'scale(1)' : 'scale(0.9)',
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    <Card
                      variant={isActive ? "glass" : "glass"}
                      className={cn(
                        "w-full h-[180px] sm:h-[190px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[20px] cursor-pointer group hover:scale-[1.02]",
                        isActive
                          ? "border-2 border-blue-600 shadow-[0_15px_35px_rgba(37,99,235,0.15)] bg-white"
                          : "border-white/40 hover:border-white/80 shadow-[0_10px_25px_rgba(0,0,0,0.06)] bg-white",
                        !account.isActive && "opacity-60 grayscale"
                      )}
                      onClick={() => setSelectedAccountId(account.id!)}
                    >
                      <div className="p-4 h-full flex flex-col justify-between">
                        {/* Top row - icon + badge */}
                        <div className="flex justify-between items-start">
                          <div
                            className={cn(
                              "w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm flex-shrink-0",
                              isActive ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-600"
                            )}
                          >
                            {getAccountIcon(account.type)}
                          </div>
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            >
                              ACTIVE
                            </motion.div>
                          )}
                        </div>

                        {/* Middle row - name + balance */}
                        <div className="flex flex-col justify-center space-y-1">
                          <h3 className="font-medium text-gray-600 text-xs sm:text-sm truncate">
                            {account.name}
                          </h3>
                          <p className="text-lg sm:text-xl font-display font-bold text-gray-900 truncate">
                            {formatCurrency(account.balance)}
                          </p>
                        </div>

                        {/* Bottom row - buttons */}
                        <div className="flex gap-2 items-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentPage('add-transaction');
                            }}
                            className="h-8 px-3 rounded-full text-xs font-medium flex-shrink-0"
                          >
                            <Plus size={10} className="mr-1" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatementImportOpen({
                                accountId: account.id!,
                                accountName: account.name,
                                accountType: account.type
                              });
                            }}
                            className="h-8 px-3 rounded-full text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 flex-shrink-0"
                          >
                            <Upload size={10} className="mr-1" />
                            Upload
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: Original carousel layout */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Carousel Container */}
            <div
              ref={carouselRef}
              className="flex gap-3 md:gap-4 overflow-x-auto pb-8 px-3 sm:px-4 md:px-6 lg:px-8 snap-x snap-mandatory scrollbar-hide"
              style={{
                scrollBehavior: 'smooth',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AnimatePresence>
                <motion.div className="flex gap-3 md:gap-4">
                  {filteredAccounts.map((account) => {
                    const isActive = selectedAccountId === account.id;
                    return (
                      <div
                        key={account.id}
                        ref={(el) => {
                          if (el) cardRefs.current[account.id!] = el;
                        }}
                        className="snap-center shrink-0"
                        style={{
                          scrollSnapAlign: 'center',
                          scrollSnapStop: 'always',
                        }}
                      >
                        <div
                          style={{
                            transition: 'all 0.3s ease-in-out',
                            transform: isActive ? 'scale(1)' : 'scale(0.9)',
                            opacity: isActive ? 1 : 0.5,
                          }}
                        >
                          <Card
                            variant="glass"
                            className={cn(
                              "w-[400px] h-[175px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[20px]",
                              isActive
                                ? "border-2 border-blue-600 shadow-[0_15px_35px_rgba(37,99,235,0.15)] bg-white"
                                : "border-white/40 hover:border-white/80 shadow-[0_10px_25px_rgba(0,0,0,0.06)] bg-white",
                              !account.isActive && "opacity-60 grayscale"
                            )}
                          >
                            <div className="p-[16px] h-full grid grid-rows-[44px_1fr_40px]">
                              {/* Top row - icon + badge */}
                              <div className="flex justify-between items-center">
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                                    isActive ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-600"
                                  )}
                                >
                                  {getAccountIcon(account.type)}
                                </div>
                                {isActive && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full"
                                  >
                                    ACTIVE
                                  </motion.div>
                                )}
                              </div>

                              {/* Middle row - name + balance */}
                              <div className="flex flex-col justify-center">
                                <h3 className="font-medium text-gray-600 text-sm truncate mb-1">
                                  {account.name}
                                </h3>
                                <p className="text-2xl font-display font-bold text-gray-900">
                                  {formatCurrency(account.balance)}
                                </p>
                              </div>

                              {/* Bottom row - buttons */}
                              <div className="flex gap-2.5 items-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCurrentPage('add-transaction')}
                                  className="h-9 px-4 rounded-full text-xs font-medium"
                                >
                                  <Plus size={12} className="mr-1.5" />
                                  Add Transaction
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => setStatementImportOpen({
                                    accountId: account.id!,
                                    accountName: account.name,
                                    accountType: account.type
                                  })}
                                  className="h-9 px-4 rounded-full text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  <Upload size={12} className="mr-1.5" />
                                  Upload Statement
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Transaction History - Subscribed to Carousel Scroll */}
            <AnimatePresence mode="wait">
              {selectedAccount && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mt-4 max-w-5xl mx-auto px-2 sm:px-0"
                >
                  <Card className="bg-white/80 backdrop-blur-xl border-white/60 overflow-hidden shadow-2xl">
                    <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                          <tr>
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="hidden md:table-cell px-8 py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {accountTransactions.length > 0 ? (
                            accountTransactions.map((t) => (
                              <tr key={t.id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-medium text-gray-500">
                                  {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-bold text-gray-900">
                                  {t.description}
                                </td>
                                <td className="hidden md:table-cell px-8 py-5">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 shadow-sm">
                                    {t.category}
                                  </span>
                                </td>
                                <td className={cn(
                                  "px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-bold text-right",
                                  t.type === 'income' ? "text-emerald-600" : "text-gray-900"
                                )}>
                                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-3 sm:px-4 md:px-8 py-8 sm:py-12 md:py-16 text-center text-gray-500">
                                <div className="flex flex-col items-center justify-center opacity-50">
                                  <Receipt size={48} className="mb-4" />
                                  <p className="font-medium text-lg">No transactions found</p>
                                  <p className="text-sm">Start spending to see activity here!</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile Transaction History */}
        <div className="lg:hidden px-4 sm:px-6 lg:px-8 xl:px-12 mt-6">
          {selectedAccount && (
            <Card className="bg-white/80 backdrop-blur-xl border-white/60 overflow-hidden shadow-2xl">
              <div className="max-h-[400px] overflow-y-auto">
                <div className="block lg:hidden">
                  {accountTransactions.length > 0 ? (
                    accountTransactions.slice(0, 10).map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 last:border-none hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{t.description}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t.category} • {new Date(t.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>
                        <span className={`font-semibold text-sm whitespace-nowrap flex-shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      <Receipt size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="font-medium text-lg">No transactions found</p>
                      <p className="text-sm">Start spending to see activity here!</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Account"
        message="This account will be permanently deleted. All associated transaction records will remain unchanged."
        itemName={accountToDelete?.name}
        isLoading={isDeleting}
        onConfirm={confirmDeleteAccount}
        onCancel={() => {
          setDeleteModalOpen(false);
          setAccountToDelete(null);
        }}
      />

      {/* Statement Import Modal */}
      {statementImportOpen && (
        <StatementImport
          accountId={statementImportOpen.accountId}
          accountName={statementImportOpen.accountName}
          accountType={statementImportOpen.accountType}
          onSuccess={() => {
            setStatementImportOpen(null);
            window.location.reload();
          }}
          onCancel={() => setStatementImportOpen(null)}
        />
      )}
    </div>
  );
};