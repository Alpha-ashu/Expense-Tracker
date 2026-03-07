import React, { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { db } from "@/lib/database";
import {
  Plus,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  Edit2,
  Trash2,
  X,
  Receipt,
  TrendingUp,
  TrendingDown,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmModal } from "@/app/components/DeleteConfirmModal";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatementImport } from "@/app/components/StatementImport";

type AssetType = "all" | "bank" | "card" | "wallet" | "cash";

export const Accounts: React.FC = () => {
  const { accounts, transactions, currency, setCurrentPage } = useApp();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetType>("all");
  const [statementImportOpen, setStatementImportOpen] = useState<{
    accountId: number;
    accountName: string;
    accountType: string;
  } | null>(null);
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{
    id: number;
    name: string;
    type: string;
    balance: number;
    isActive: boolean;
  } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleEditAccount = (account: typeof accounts[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccount({
      id: account.id!,
      name: account.name,
      type: account.type,
      balance: account.balance,
      isActive: account.isActive ?? true,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    setIsSavingEdit(true);
    try {
      await db.accounts.update(editingAccount.id, {
        name: editingAccount.name,
        type: editingAccount.type as any,
        balance: editingAccount.balance,
        isActive: editingAccount.isActive,
      });
      toast.success('Account updated!');
      setEditModalOpen(false);
      setEditingAccount(null);
    } catch (err) {
      console.error('Failed to update account:', err);
      toast.error('Failed to update account. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isClickScrolling = useRef(false);

  // Filter accounts based on active tab
  const filteredAccounts = useMemo(() => {
    if (activeTab === "all") return accounts;
    return accounts.filter((a) => a.type === activeTab);
  }, [accounts, activeTab]);

  const tabs = [
    { id: "all", label: "All Assets", icon: TrendingUp },
    { id: "bank", label: "Banks", icon: Wallet },
    { id: "card", label: "Cards", icon: CreditCard },
    { id: "wallet", label: "Digital", icon: Smartphone },
    { id: "cash", label: "Cash", icon: Banknote },
  ];

  // Scroll-to-sync: Track active account based on carousel scroll position
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleCarouselScroll = () => {
      if (isClickScrolling.current) return;

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

    carousel.addEventListener("scroll", handleCarouselScroll);
    // Initial check
    setTimeout(handleCarouselScroll, 100);

    return () => {
      carousel.removeEventListener("scroll", handleCarouselScroll);
    };
  }, [filteredAccounts, selectedAccountId]);

  const handleCardClick = (id: number) => {
    isClickScrolling.current = true;
    setSelectedAccountId(id);
    const cardEl = cardRefs.current[id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    // Release scroll listener lock after smooth scroll animation completes
    setTimeout(() => {
      isClickScrolling.current = false;
    }, 600);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
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
      toast.success("Account deleted successfully");
      setDeleteModalOpen(false);
      setAccountToDelete(null);
      if (selectedAccountId === accountToDelete.id) {
        setSelectedAccountId(null);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case "bank":
        return <Wallet size={20} />;
      case "card":
        return <CreditCard size={20} />;
      case "cash":
        return <Banknote size={20} />;
      case "wallet":
        return <Smartphone size={20} />;
      default:
        return <Wallet size={20} />;
    }
  };

  const totalBalance = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance, 0);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter((t) => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-gray-50">
      <div className="max-w-full mx-auto pb-32 lg:pb-8 w-full">
        <div className="px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 lg:pt-8 pb-4 lg:pb-6">
          <PageHeader
            title="Accounts"
            subtitle="Manage your wallets and payment sources"
          >
            <Button
              onClick={() => setCurrentPage("add-account")}
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
                className={`relative flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all duration-300 font-medium whitespace-nowrap text-xs sm:text-sm lg:text-base ${isActive
                  ? "text-white shadow-lg shadow-pink-200"
                  : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPillAccounts"
                    className="absolute inset-0 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                  <Icon
                    size={14}
                    className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]"
                  />
                  <span className="inline">{tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── New User Prompt ── Only shown when no accounts exist */}
        {accounts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 sm:mx-6 lg:mx-8 xl:mx-12 mb-4 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-white p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg">
                  🏦 Set up your first account
                </p>
                <p className="text-sm text-purple-100 mt-1">
                  Add your bank account, wallet, or cash to start tracking your
                  finances.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-purple-100">
                  <li>• Salary / Savings bank account</li>
                  <li>• Credit / Debit card</li>
                  <li>• UPI wallet or Cash</li>
                </ul>
              </div>
              <button
                onClick={() => setCurrentPage("add-account")}
                className="shrink-0 mt-1 bg-white text-purple-700 hover:bg-purple-50 font-semibold text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                + Add Account
              </button>
            </div>
          </motion.div>
        )}

        {/* Mobile: 1 card per row, centered */}
        <div className="lg:hidden">
          <div className={cn(
            "flex gap-4 overflow-x-auto pb-4 px-4 sm:px-6 snap-x snap-mandatory scrollbar-hide scroll-smooth",
            filteredAccounts.length === 1 && "justify-center"
          )}>
            {filteredAccounts.map((account) => {
              const isActive = selectedAccountId === account.id;
              return (
                <div
                  key={account.id}
                  ref={(el) => {
                    if (el) cardRefs.current[account.id!] = el;
                  }}
                  className="snap-center shrink-0 w-full"
                  style={{
                    scrollSnapAlign: "center",
                    scrollSnapStop: "always",
                  }}
                >
                  <div
                    style={{
                      transition: "all 0.3s ease-in-out",
                      transform: isActive ? "scale(1)" : "scale(0.95)",
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    <Card
                      variant="flat"
                      className={cn(
                        "w-full h-[210px] sm:h-[220px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[28px] cursor-pointer group hover:scale-[1.02] outline-none focus:ring-0",
                        isActive
                          ? "bg-gradient-to-br from-[#1a1a3a] via-[#3d2775] to-[#801869] border-0 shadow-[0_15px_35px_rgba(91,33,182,0.35)]"
                          : "bg-white border hover:border-gray-300 shadow-[0_10px_25px_rgba(0,0,0,0.06)] text-gray-900 border-gray-200",
                        !account.isActive && "opacity-60 grayscale",
                      )}
                      onClick={() => handleCardClick(account.id!)}
                      tabIndex={-1} // Prevent keyboard focus
                    >
                      {/* Premium Card Background Effects */}
                      {isActive && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] bg-gradient-to-bl from-pink-500/30 to-purple-600/0 rounded-full blur-2xl" />
                          <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] bg-gradient-to-tr from-blue-500/30 to-indigo-600/0 rounded-full blur-2xl" />
                          <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <path d="M0,50 Q25,20 50,50 T100,50 L100,100 L0,100 Z" fill="url(#card-grad-mobile)" />
                            <defs>
                              <linearGradient id="card-grad-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      )}

                      <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col justify-between">
                        {/* Top row - Icon/Chip + Actions */}
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-8 sm:w-11 sm:h-8 rounded-md flex items-center justify-center relative overflow-hidden shadow-inner",
                              isActive ? "bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 border border-yellow-300/50" : "bg-gray-200 border border-gray-300/50"
                            )}>
                              <div className={cn("absolute w-full h-[1px] top-1/2 -translate-y-1/2", isActive ? "bg-yellow-700/30" : "bg-gray-400/30")} />
                              <div className={cn("absolute h-full w-[1px] left-1/2 -translate-x-1/2", isActive ? "bg-yellow-700/30" : "bg-gray-400/30")} />
                              <div className={cn("absolute w-5 h-3.5 border rounded-sm", isActive ? "border-yellow-700/30" : "border-gray-400/30")} />
                            </div>
                            
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm",
                              isActive ? "bg-white/10 text-white backdrop-blur-md" : "bg-gray-100 text-gray-600"
                            )}>
                              <div className="scale-75">{getAccountIcon(account.type)}</div>
                            </div>
                          </div>

                          {isActive && (
                            <div className="flex items-center gap-2">
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="bg-white/20 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full flex-shrink-0 border border-white/10"
                              >
                                ACTIVE
                              </motion.div>
                              <button
                                onClick={(e) => handleEditAccount(account, e)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all duration-200 active:scale-90 border border-white/10"
                                title="Edit account"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(account.id!, account.name);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/60 hover:bg-red-500 backdrop-blur-md text-white transition-all duration-200 active:scale-90 border border-white/10"
                                title="Delete account"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Middle & Bottom - Balance and Name laying out like a Credit Card */}
                        <div className="flex flex-col mt-auto gap-4 sm:gap-5">
                          <div>
                            <p className={cn(
                              "text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase mb-1 opacity-80",
                              isActive ? "text-white/70" : "text-gray-500"
                            )}>
                              Current Balance
                            </p>
                            <p className={cn(
                              "text-2xl sm:text-3xl font-mono tracking-wider font-bold truncate",
                              isActive ? "text-white" : "text-gray-900"
                            )} style={isActive ? { textShadow: '0 2px 4px rgba(0,0,0,0.2)' } : undefined}>
                              {formatCurrency(account.balance)}
                            </p>
                          </div>

                          <div className="flex justify-between items-end">
                            <div className="min-w-0 pr-2">
                              <p className={cn(
                                "text-[9px] sm:text-[10px] font-semibold tracking-widest uppercase mb-0.5 opacity-80",
                                isActive ? "text-white/70" : "text-gray-500"
                              )}>
                                Account Name
                              </p>
                              <h3 className={cn(
                                "font-medium text-sm sm:text-base tracking-wide truncate max-w-[120px] sm:max-w-[160px]",
                                isActive ? "text-white/90" : "text-gray-800"
                              )}>
                                {account.name}
                              </h3>
                            </div>
                            
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentPage("add-transaction");
                                }}
                                className={cn(
                                  "h-8 px-3 rounded-full text-[10px] sm:text-xs font-medium",
                                  isActive
                                    ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                                )}
                              >
                                <Plus size={12} className="mr-1 hidden sm:block" />
                                <Plus size={14} className="sm:hidden" />
                                <span className="hidden sm:inline">Add</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatementImportOpen({
                                    accountId: account.id!,
                                    accountName: account.name,
                                    accountType: account.type,
                                  });
                                }}
                                className={cn(
                                  "h-8 px-3 rounded-full text-[10px] sm:text-xs font-medium",
                                  isActive
                                    ? "bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-md"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                )}
                              >
                                <Upload size={12} className="mr-1 hidden sm:block" />
                                <Upload size={14} className="sm:hidden" />
                                <span className="hidden sm:inline">Import</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Swipe Guide & Dot Indicators (Mobile) */}
          {filteredAccounts.length > 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center -mt-2 mb-6"
            >
              <div className="flex gap-1.5 justify-center items-center h-4 mb-2">
                {filteredAccounts.map((account) => (
                  <div
                    key={`dot-mobile-${account.id}`}
                    onClick={() => handleCardClick(account.id!)}
                    className={cn(
                      "rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 m-0 p-0",
                      selectedAccountId === account.id 
                        ? "w-4 sm:w-5 h-1.5 sm:h-2 bg-gradient-to-r from-pink-500 to-rose-500" 
                        : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-300 hover:bg-gray-400"
                    )}
                    role="button"
                    style={{
                      minWidth: selectedAccountId === account.id ? "16px" : "6px",
                      minHeight: "6px"
                    }}
                    aria-label={`Go to account ${account.name}`}
                  />
                ))}
              </div>
              <div className="flex items-center text-[10px] text-gray-400 font-medium tracking-widest uppercase">
                <span className="animate-[pulse_2s_ease-in-out_infinite] mr-2">←</span> 
                Swipe to explore 
                <span className="animate-[pulse_2s_ease-in-out_infinite] ml-2">→</span>
              </div>
            </motion.div>
          )}

        </div>

        {/* Desktop: Original carousel layout */}
        <div className="hidden lg:block">
          <div className="relative">
            {/* Carousel Container */}
            <div
              ref={carouselRef}
              className={cn(
                "flex gap-3 md:gap-4 overflow-x-auto pb-4 px-3 sm:px-4 md:px-6 lg:px-8 snap-x snap-mandatory scrollbar-hide scroll-smooth",
                filteredAccounts.length === 1 && "justify-center"
              )}
              style={{
                WebkitOverflowScrolling: "touch",
              }}
            >
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
                          scrollSnapAlign: "center",
                          scrollSnapStop: "always",
                        }}
                      >
                        <div
                          style={{
                            transition: "all 0.3s ease-in-out",
                            transform: isActive ? "scale(1)" : "scale(0.9)",
                            opacity: isActive ? 1 : 0.5,
                          }}
                        >
                          <Card
                            variant="flat"
                            className={cn(
                              "w-[400px] h-[224px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[28px] cursor-pointer group outline-none focus:ring-0",
                              isActive
                                ? "bg-gradient-to-br from-[#1a1a3a] via-[#3d2775] to-[#801869] border-0 shadow-[0_20px_40px_rgba(91,33,182,0.35)]"
                                : "bg-white border hover:border-gray-300 shadow-[0_10px_25px_rgba(0,0,0,0.06)] text-gray-900 border-gray-200",
                              !account.isActive && "opacity-60 grayscale",
                            )}
                            onClick={() => handleCardClick(account.id!)}
                            tabIndex={-1}
                          >
                            {/* Premium Card Background Effects */}
                            {isActive && (
                              <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] bg-gradient-to-bl from-pink-500/30 to-purple-600/0 rounded-full blur-2xl" />
                                <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] bg-gradient-to-tr from-blue-500/30 to-indigo-600/0 rounded-full blur-2xl" />
                                <svg className="absolute inset-0 w-full h-full opacity-[0.12]" viewBox="0 0 100 100" preserveAspectRatio="none">
                                  <path d="M0,50 Q25,20 50,50 T100,50 L100,100 L0,100 Z" fill="url(#card-grad-desktop)" />
                                  <defs>
                                    <linearGradient id="card-grad-desktop" x1="0%" y1="0%" x2="100%" y2="100%">
                                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                              </div>
                            )}

                            <div className="relative z-10 p-[24px] h-full flex flex-col justify-between">
                              {/* Top row - Icon/Chip + Actions */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-12 h-9 rounded-md flex items-center justify-center relative overflow-hidden shadow-inner",
                                    isActive ? "bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 border border-yellow-300/50" : "bg-gray-200 border border-gray-300/50"
                                  )}>
                                    <div className={cn("absolute w-full h-[1px] top-1/2 -translate-y-1/2", isActive ? "bg-yellow-700/30" : "bg-gray-400/30")} />
                                    <div className={cn("absolute h-full w-[1px] left-1/2 -translate-x-1/2", isActive ? "bg-yellow-700/30" : "bg-gray-400/30")} />
                                    <div className={cn("absolute w-6 h-4 border rounded-sm", isActive ? "border-yellow-700/30" : "border-gray-400/30")} />
                                  </div>
                                  
                                  <div className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-sm",
                                    isActive ? "bg-white/10 text-white backdrop-blur-md" : "bg-gray-100 text-gray-600"
                                  )}>
                                    <div className="scale-75">{getAccountIcon(account.type)}</div>
                                  </div>
                                </div>

                                {isActive && (
                                  <div className="flex items-center gap-2">
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10"
                                    >
                                      ACTIVE
                                    </motion.div>
                                    <button
                                      onClick={(e) => handleEditAccount(account, e)}
                                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all duration-200 active:scale-90 border border-white/10"
                                      title="Edit account"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAccount(account.id!, account.name);
                                      }}
                                      className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/60 hover:bg-red-500 backdrop-blur-md text-white transition-all duration-200 active:scale-90 border border-white/10"
                                      title="Delete account"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Middle & Bottom - Balance and Name layout imitating Card Number/Holder */}
                              <div className="flex flex-col mt-auto gap-5">
                                <div>
                                  <p className={cn(
                                    "text-[11px] font-semibold tracking-widest uppercase mb-1 opacity-80",
                                    isActive ? "text-white/70" : "text-gray-500"
                                  )}>
                                    Current Balance
                                  </p>
                                  <p className={cn(
                                    "text-3xl font-mono tracking-wider font-bold truncate",
                                    isActive ? "text-white" : "text-gray-900"
                                  )} style={isActive ? { textShadow: '0 2px 4px rgba(0,0,0,0.2)' } : undefined}>
                                    {formatCurrency(account.balance)}
                                  </p>
                                </div>

                                <div className="flex justify-between items-end">
                                  <div className="min-w-0 pr-4">
                                    <p className={cn(
                                      "text-[11px] font-semibold tracking-widest uppercase mb-0.5 opacity-80",
                                      isActive ? "text-white/70" : "text-gray-500"
                                    )}>
                                      Account Name
                                    </p>
                                    <h3 className={cn(
                                      "font-medium tracking-wide truncate max-w-[180px]",
                                      isActive ? "text-white/90" : "text-gray-800"
                                    )}>
                                      {account.name}
                                    </h3>
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex gap-2 flex-shrink-0">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentPage("add-transaction");
                                      }}
                                      className={cn(
                                        "h-9 px-4 rounded-full text-xs font-medium transition-colors",
                                        isActive
                                          ? "bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md"
                                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                                      )}
                                    >
                                      <Plus size={14} className="mr-1.5" />
                                      Add
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStatementImportOpen({
                                          accountId: account.id!,
                                          accountName: account.name,
                                          accountType: account.type,
                                        });
                                      }}
                                      className={cn(
                                        "h-9 px-4 rounded-full text-xs font-medium transition-colors",
                                        isActive
                                          ? "bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur-md shadow-sm"
                                          : "bg-blue-600 text-white hover:bg-blue-700"
                                      )}
                                    >
                                      <Upload size={14} className="mr-1.5" />
                                      Import
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
            </div>

        {/* Swipe Guide & Dot Indicators */}
        {filteredAccounts.length > 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center -mt-2 mb-6 md:mb-8"
          >
            <div className="flex gap-1.5 justify-center items-center h-4 mb-2">
              {filteredAccounts.map((account) => (
                <div
                  key={`dot-${account.id}`}
                  onClick={() => handleCardClick(account.id!)}
                  className={cn(
                    "rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 m-0 p-0",
                    selectedAccountId === account.id 
                      ? "w-5 h-2 bg-gradient-to-r from-pink-500 to-rose-500" 
                      : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                  )}
                  role="button"
                  style={{
                    minWidth: selectedAccountId === account.id ? "20px" : "8px",
                    minHeight: "8px"
                  }}
                  aria-label={`Go to account ${account.name}`}
                />
              ))}
            </div>
            <div className="flex items-center text-[10px] sm:text-xs text-gray-400 font-medium tracking-widest uppercase">
              <span className="animate-[pulse_2s_ease-in-out_infinite] mr-2">←</span> 
              Swipe to explore 
              <span className="animate-[pulse_2s_ease-in-out_infinite] ml-2">→</span>
            </div>
          </motion.div>
        )}

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
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="hidden md:table-cell px-8 py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {accountTransactions.length > 0 ? (
                            accountTransactions.map((t) => (
                              <tr
                                key={t.id}
                                className="hover:bg-blue-50/50 transition-colors"
                              >
                                <td className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-medium text-gray-500">
                                  {new Date(t.date).toLocaleDateString(
                                    "en-US",
                                    { month: "short", day: "numeric" },
                                  )}
                                </td>
                                <td className="px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-bold text-gray-900">
                                  {t.description}
                                </td>
                                <td className="hidden md:table-cell px-8 py-5">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 shadow-sm">
                                    {t.category}
                                  </span>
                                </td>
                                <td
                                  className={cn(
                                    "px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 text-xs sm:text-sm font-bold text-right",
                                    t.type === "income"
                                      ? "text-emerald-600"
                                      : "text-gray-900",
                                  )}
                                >
                                  {t.type === "income" ? "+" : "-"}
                                  {formatCurrency(t.amount)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 sm:px-4 md:px-8 py-8 sm:py-12 md:py-16 text-center text-gray-500"
                              >
                                <div className="flex flex-col items-center justify-center opacity-50">
                                  <Receipt size={48} className="mb-4" />
                                  <p className="font-medium text-lg">
                                    No transactions found
                                  </p>
                                  <p className="text-sm">
                                    Start spending to see activity here!
                                  </p>
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
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 last:border-none hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.type === "income" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                          >
                            {t.type === "income" ? (
                              <TrendingUp size={18} />
                            ) : (
                              <TrendingDown size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">
                              {t.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t.category} •{" "}
                              {new Date(t.date).toLocaleDateString("en-US", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-semibold text-sm whitespace-nowrap flex-shrink-0 ${t.type === "income" ? "text-green-600" : "text-gray-900"}`}
                        >
                          {t.type === "income" ? "+" : "-"}
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      <Receipt size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="font-medium text-lg">
                        No transactions found
                      </p>
                      <p className="text-sm">
                        Start spending to see activity here!
                      </p>
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

      {/* Edit Account Modal */}
      <AnimatePresence>
        {editModalOpen && editingAccount && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setEditModalOpen(false); setEditingAccount(null); }}
            />
            {/* Sheet */}
            <motion.div
              className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl z-10"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Edit Account</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Update your account details</p>
                </div>
                <button
                  onClick={() => { setEditModalOpen(false); setEditingAccount(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 pb-6 pt-3 space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account Name</label>
                  <input
                    type="text"
                    value={editingAccount.name}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm font-medium text-gray-900 transition-all"
                    placeholder="e.g. HDFC Savings"
                  />
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account Type</label>
                  <select
                    value={editingAccount.type}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, type: e.target.value } : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm font-medium text-gray-900 bg-white transition-all"
                  >
                    <option value="bank">🏦 Bank Account</option>
                    <option value="card">💳 Credit / Debit Card</option>
                    <option value="wallet">📱 Digital Wallet</option>
                    <option value="cash">💵 Cash</option>
                  </select>
                </div>

                {/* Balance */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Balance (₹)</label>
                  <input
                    type="number"
                    value={editingAccount.balance}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, balance: parseFloat(e.target.value) || 0 } : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm font-medium text-gray-900 transition-all"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Active Account</p>
                    <p className="text-xs text-gray-500">Show this account in your portfolio</p>
                  </div>
                  <button
                    onClick={() => setEditingAccount(prev => prev ? { ...prev, isActive: !prev.isActive } : null)}
                    className={cn(
                      "relative w-11 h-6 rounded-full transition-all duration-200",
                      editingAccount.isActive ? "bg-gradient-to-r from-pink-500 to-rose-500" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                        editingAccount.isActive ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setEditModalOpen(false); setEditingAccount(null); }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editingAccount.name.trim()}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-200"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
