import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { db } from '@/lib/database';
import { Plus, Wallet, CreditCard, Banknote, Smartphone, Edit2, Trash2, X, Receipt, TrendingUp, Upload } from 'lucide-react';
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

  // Function to scroll a card to center
  const scrollToCenter = useCallback((accountId: number) => {
    const carousel = carouselRef.current;
    const cardEl = cardRefs.current[accountId];
    if (!carousel || !cardEl) return;

    const carouselRect = carousel.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    
    // Calculate the scroll position to center the card
    const cardCenterOffset = cardEl.offsetLeft + cardRect.width / 2;
    const carouselVisibleCenter = carouselRect.width / 2;
    const scrollTo = cardCenterOffset - carouselVisibleCenter;

    carousel.scrollTo({
      left: scrollTo,
      behavior: 'smooth'
    });
  }, []);

  // Handle card selection with scroll to center
  const handleCardSelect = useCallback((accountId: number) => {
    setSelectedAccountId(accountId);
    // Small delay to ensure refs are updated
    setTimeout(() => scrollToCenter(accountId), 50);
  }, [scrollToCenter]);

  // Filter accounts based on active tab
  const filteredAccounts = useMemo(() => {
    if (activeTab === 'all') return accounts;
    return accounts.filter(a => a.type === activeTab);
  }, [accounts, activeTab]);

  // Auto-select and center first card when tab changes or filtered accounts change
  useEffect(() => {
    if (filteredAccounts.length > 0) {
      const firstAccount = filteredAccounts[0];
      setSelectedAccountId(firstAccount.id!);
      // Delay to ensure DOM is updated with new filtered accounts
      setTimeout(() => scrollToCenter(firstAccount.id!), 100);
    } else {
      setSelectedAccountId(null);
    }
  }, [activeTab, filteredAccounts.length, scrollToCenter]);

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
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-6 lg:py-10 max-w-[1600px] mx-auto space-y-8 pb-24">
      <PageHeader title="Accounts" subtitle="Manage your wallets and payment sources">
        <Button
          onClick={() => setCurrentPage('add-account')}
          className="rounded-full h-10 px-4 shadow-lg bg-black text-white hover:bg-gray-900 transition-transform active:scale-95 text-sm"
        >
          <Plus size={16} className="mr-2" />
          Add Account
        </Button>
      </PageHeader>

      {/* Tab Navigation */}
      <div className="flex items-center justify-center gap-3 overflow-x-auto scrollbar-hide pb-4 px-4 sm:px-6 lg:px-8 mb-4 lg:mb-6">
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

      {/* Center-Focused Carousel with Scroll-to-Sync (All Devices) */}
      <div className="relative">
        {/* Carousel Container */}
        <div
          ref={carouselRef}
          className="overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollBehavior: 'smooth',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <AnimatePresence>
            <motion.div 
              className="flex gap-5 md:gap-7 lg:gap-8 w-max"
              style={{
                // Add padding to allow first and last cards to be centered
                paddingLeft: 'calc(50vw - 160px)',
                paddingRight: 'calc(50vw - 160px)',
              }}
            >
              {filteredAccounts.map((account) => {
                const isActive = selectedAccountId === account.id;
                // Dynamic gradient based on account type
                const getCardGradient = (type: string, active: boolean) => {
                  if (!active) return 'bg-gradient-to-br from-gray-100 to-gray-200';
                  switch (type) {
                    case 'bank': return 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700';
                    case 'card': return 'bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600';
                    case 'cash': return 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700';
                    case 'wallet': return 'bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500';
                    default: return 'bg-gradient-to-br from-slate-500 to-slate-700';
                  }
                };
                return (
                  <motion.div
                    key={account.id}
                    ref={(el) => {
                      if (el) cardRefs.current[account.id!] = el;
                    }}
                    className="snap-center shrink-0 cursor-pointer"
                    style={{
                      scrollSnapAlign: 'center',
                      scrollSnapStop: 'always',
                    }}
                    onClick={() => handleCardSelect(account.id!)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      animate={{
                        scale: isActive ? 1 : 0.92,
                        opacity: isActive ? 1 : 0.6,
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                      <div
                        className={cn(
                          "w-[320px] sm:w-[340px] h-[200px] relative overflow-hidden shrink-0 rounded-[24px] transition-all duration-300",
                          getCardGradient(account.type, isActive),
                          isActive
                            ? "shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-4 ring-white/30"
                            : "shadow-[0_10px_30px_rgba(0,0,0,0.1)]",
                          !account.isActive && "opacity-50 grayscale"
                        )}
                      >
                        {/* Decorative circles */}
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
                        <div className="absolute -right-4 top-16 w-20 h-20 rounded-full bg-white/5" />
                        <div className="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-black/10" />

                        <div className="p-5 h-full flex flex-col justify-between relative z-10">
                          {/* Top row - icon + type badge + actions */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-colors",
                                  isActive ? "bg-white/20 text-white" : "bg-white/80 text-gray-600"
                                )}
                              >
                                {getAccountIcon(account.type)}
                              </div>
                              <div>
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                  isActive ? "bg-white/20 text-white" : "bg-gray-300 text-gray-600"
                                )}>
                                  {account.type}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {isActive && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="bg-white text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full mr-1"
                                >
                                  SELECTED
                                </motion.div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  localStorage.setItem('editAccountId', String(account.id));
                                  setCurrentPage('edit-account');
                                }}
                                className={cn(
                                  "p-2 rounded-full transition-all",
                                  isActive ? "hover:bg-white/20 text-white/80 hover:text-white" : "hover:bg-white text-gray-500 hover:text-blue-600"
                                )}
                                title="Edit account"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(account.id!, account.name);
                                }}
                                className={cn(
                                  "p-2 rounded-full transition-all",
                                  isActive ? "hover:bg-white/20 text-white/80 hover:text-white" : "hover:bg-white text-gray-500 hover:text-red-600"
                                )}
                                title="Delete account"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Middle - name + balance */}
                          <div className="flex-1 flex flex-col justify-center py-2">
                            <h3 className={cn(
                              "font-semibold text-base truncate mb-1",
                              isActive ? "text-white/80" : "text-gray-600"
                            )}>
                              {account.name}
                            </h3>
                            <p className={cn(
                              "text-3xl font-display font-bold tracking-tight",
                              isActive ? "text-white" : "text-gray-800"
                            )}>
                              {formatCurrency(account.balance)}
                            </p>
                          </div>

                          {/* Bottom row - action buttons */}
                          <div className="flex gap-2 items-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurrentPage('add-transaction');
                              }}
                              className={cn(
                                "h-8 px-3 rounded-full text-xs font-semibold border-0 transition-all",
                                isActive 
                                  ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm" 
                                  : "bg-white text-gray-700 hover:bg-gray-100"
                              )}
                            >
                              <Plus size={12} className="mr-1" />
                              Transaction
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
                              className={cn(
                                "h-8 px-3 rounded-full text-xs font-semibold border-0 transition-all",
                                isActive 
                                  ? "bg-white text-blue-600 hover:bg-white/90" 
                                  : "bg-gray-800 text-white hover:bg-gray-900"
                              )}
                            >
                              <Upload size={12} className="mr-1" />
                              Import
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
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