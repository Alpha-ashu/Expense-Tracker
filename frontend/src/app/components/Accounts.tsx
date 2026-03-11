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
  ArrowUpRight,
  ArrowDownLeft,
  Repeat2,
} from "lucide-react";

import { toast } from "sonner";
import { DeleteConfirmModal } from "@/app/components/DeleteConfirmModal";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { StatementImport } from "@/app/components/StatementImport";
import { formatLocalDate } from "@/lib/dateUtils";

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
  const [showTransactionTypeModal, setShowTransactionTypeModal] = useState(false);
  const [activeCardAccountId, setActiveCardAccountId] = useState<number | null>(null);
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
  const mobileCarouselRef = useRef<HTMLDivElement>(null);
  // Separate ref maps so mobile and desktop don't overwrite each other
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});        // desktop
  const mobileCardRefs = useRef<Record<number, HTMLDivElement | null>>({});  // mobile
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

  // Auto-select first account on load and when the filtered list changes
  useEffect(() => {
    if (filteredAccounts.length > 0 && (
      selectedAccountId === null ||
      !filteredAccounts.find(a => a.id === selectedAccountId)
    )) {
      setSelectedAccountId(filteredAccounts[0].id!);
    }
  }, [filteredAccounts]);

  // Keep a ref so scroll handlers can read selectedAccountId without re-subscribing
  const selectedAccountIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
  }, [selectedAccountId]);

  // ── Desktop scroll listener ──
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      if (isClickScrolling.current) return;
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      let closest: { id: number; dist: number } | null = null;
      filteredAccounts.forEach((account) => {
        const el = cardRefs.current[account.id!];
        if (!el) return;
        const dist = Math.abs((el.offsetLeft + el.offsetWidth / 2) - center);
        if (!closest || dist < closest.dist) closest = { id: account.id!, dist };
      });
      if (closest && closest.id !== selectedAccountIdRef.current) {
        setSelectedAccountId(closest.id);
      }
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    const t = setTimeout(handleScroll, 150);
    return () => { carousel.removeEventListener("scroll", handleScroll); clearTimeout(t); };
  }, [filteredAccounts]);

  // ── Mobile scroll listener (index-based — stride = full clientWidth) ──
  useEffect(() => {
    const carousel = mobileCarouselRef.current;
    if (!carousel) return;

    const handleMobileScroll = () => {
      if (isClickScrolling.current) return;
      // Each card slot is exactly one clientWidth wide (w-screen wrapper, no gap)
      const stride = carousel.clientWidth;
      if (stride === 0) return;
      const idx = Math.round(carousel.scrollLeft / stride);
      const clamped = Math.max(0, Math.min(filteredAccounts.length - 1, idx));
      const account = filteredAccounts[clamped];
      if (account && account.id !== selectedAccountIdRef.current) {
        setSelectedAccountId(account.id!);
      }
    };

    carousel.addEventListener("scroll", handleMobileScroll, { passive: true });
    const t = setTimeout(handleMobileScroll, 150);
    return () => { carousel.removeEventListener("scroll", handleMobileScroll); clearTimeout(t); };
  }, [filteredAccounts]);

  const handleCardClick = (id: number) => {
    isClickScrolling.current = true;
    setSelectedAccountId(id);
    const index = filteredAccounts.findIndex(a => a.id === id);

    // Mobile: each slot is exactly one clientWidth, so stride = clientWidth
    const mobileCarousel = mobileCarouselRef.current;
    if (mobileCarousel) {
      mobileCarousel.scrollTo({ left: index * mobileCarousel.clientWidth, behavior: "smooth" });
    }

    // Desktop: scroll the card element into view
    const cardEl = cardRefs.current[id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    setTimeout(() => { isClickScrolling.current = false; }, 700);
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

  // Smart bank/card brand logo renderer based on account name
  const getBankCardLogo = (name: string, isActive: boolean, size: 'sm' | 'md' = 'md') => {
    const n = name.toLowerCase();
    const w = size === 'sm' ? 52 : 64;
    const h = size === 'sm' ? 32 : 40;
    const textSm = size === 'sm' ? '9' : '11';
    const textMd = size === 'sm' ? '11' : '14';
    const textLg = size === 'sm' ? '13' : '16';

    // ── Indian Banks ──
    if (n.includes('sbi') || n.includes('state bank')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex flex-col items-center justify-center rounded-lg overflow-hidden bg-[#22408C]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#22408C" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">SBI</text>
            <text x="30" y="28" textAnchor="middle" fill="#a0b4e0" fontSize={textSm} fontFamily="Arial">State Bank</text>
          </svg>
        </div>
      );
    }
    if (n.includes('hdfc')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#004C8F]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#004C8F" />
            <text x="30" y="14" textAnchor="middle" fill="#00AEEF" fontWeight="800" fontSize={textLg} fontFamily="Arial">HDFC</text>
            <text x="30" y="27" textAnchor="middle" fill="#80c6f7" fontSize={textSm} fontFamily="Arial">BANK</text>
          </svg>
        </div>
      );
    }
    if (n.includes('icici')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#B02A2A]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#B02A2A" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textMd} fontFamily="Arial">ICICI</text>
            <text x="30" y="27" textAnchor="middle" fill="#f0a0a0" fontSize={textSm} fontFamily="Arial">BANK</text>
          </svg>
        </div>
      );
    }
    if (n.includes('axis')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#97144D]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#97144D" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">AXIS</text>
          </svg>
        </div>
      );
    }
    if (n.includes('kotak')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#ED1C24]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#ED1C24" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">KOTAK</text>
            <text x="30" y="27" textAnchor="middle" fill="#ffa0a4" fontSize={textSm} fontFamily="Arial">MAHINDRA</text>
          </svg>
        </div>
      );
    }
    if (n.includes('pnb') || n.includes('punjab national')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#003366]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#003366" />
            <text x="30" y="22" textAnchor="middle" fill="#FFD700" fontWeight="bold" fontSize={textLg} fontFamily="Arial">PNB</text>
          </svg>
        </div>
      );
    }
    if (n.includes('bob') || n.includes('bank of baroda')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#E87722]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#E87722" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">BOB</text>
          </svg>
        </div>
      );
    }
    if (n.includes('canara')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#034694]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#034694" />
            <text x="30" y="22" textAnchor="middle" fill="#FFD700" fontWeight="bold" fontSize={textSm} fontFamily="Arial">CANARA</text>
          </svg>
        </div>
      );
    }
    if (n.includes('union bank')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#003087]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#003087" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">UNION</text>
          </svg>
        </div>
      );
    }
    if (n.includes('idbi')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#3D9A42]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#3D9A42" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">IDBI</text>
          </svg>
        </div>
      );
    }
    if (n.includes('yes bank')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#00539B]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#00539B" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">YES</text>
          </svg>
        </div>
      );
    }
    if (n.includes('indusind')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#7B2D8B]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#7B2D8B" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">IndusInd</text>
          </svg>
        </div>
      );
    }
    if (n.includes('idfc')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#009FE3]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#009FE3" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">IDFC</text>
          </svg>
        </div>
      );
    }

    // ── International Banks ──
    if (n.includes('chase') || n.includes('jpmorgan')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#117ACA]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#117ACA" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">Chase</text>
          </svg>
        </div>
      );
    }
    if (n.includes('bank of america') || n.includes('bofa')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#E31937]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#E31937" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Bank of</text>
            <text x="30" y="27" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">America</text>
          </svg>
        </div>
      );
    }
    if (n.includes('citi') || n.includes('citibank')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#003B8E]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#003B8E" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">Citi</text>
          </svg>
        </div>
      );
    }
    if (n.includes('wells fargo')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#CC0000]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#CC0000" />
            <text x="30" y="15" textAnchor="middle" fill="#FFD700" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Wells</text>
            <text x="30" y="27" textAnchor="middle" fill="#FFD700" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Fargo</text>
          </svg>
        </div>
      );
    }
    if (n.includes('hsbc')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#DB0011]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#DB0011" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">HSBC</text>
          </svg>
        </div>
      );
    }
    if (n.includes('barclays')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#00AEEF]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#00AEEF" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Barclays</text>
          </svg>
        </div>
      );
    }
    if (n.includes('standard chartered') || n.includes('stanchart')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#0A7F4F]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#0A7F4F" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Stan Chart</text>
          </svg>
        </div>
      );
    }

    // ── Card Networks ──
    if (n.includes('visa')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#1A1F71]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#1A1F71" />
            <text x="30" y="24" textAnchor="middle" fill="#fff" fontWeight="800" fontSize={size === 'sm' ? '18' : '22'} fontFamily="Arial" fontStyle="italic">VISA</text>
          </svg>
        </div>
      );
    }
    if (n.includes('mastercard') || n.includes('master card')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#252525]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#252525" />
            <circle cx="22" cy="18" r="11" fill="#EB001B" />
            <circle cx="38" cy="18" r="11" fill="#F79E1B" />
            <ellipse cx="30" cy="18" rx="5" ry="11" fill="#FF5F00" />
          </svg>
        </div>
      );
    }
    if (n.includes('amex') || n.includes('american express')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#007BC1]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#007BC1" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">AMERICAN</text>
            <text x="30" y="27" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">EXPRESS</text>
          </svg>
        </div>
      );
    }
    if (n.includes('rupay')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-gradient-to-r from-orange-600 to-green-600")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="transparent" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textLg} fontFamily="Arial">RuPay</text>
          </svg>
        </div>
      );
    }

    // ── Digital Wallets ──
    if (n.includes('phonepe') || n.includes('phone pe')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#5F259F]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#5F259F" />
            <text x="30" y="15" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Phone</text>
            <text x="30" y="28" textAnchor="middle" fill="#CBB5F7" fontWeight="bold" fontSize={textSm} fontFamily="Arial">Pe</text>
          </svg>
        </div>
      );
    }
    if (n.includes('gpay') || n.includes('google pay')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-white border border-gray-200")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#fff" />
            <text x="7" y="24" fill="#4285F4" fontWeight="bold" fontSize={textLg} fontFamily="Arial">G</text>
            <text x="20" y="24" fill="#34A853" fontWeight="bold" fontSize={textLg} fontFamily="Arial">P</text>
            <text x="32" y="24" fill="#FBBC04" fontWeight="bold" fontSize={textLg} fontFamily="Arial">a</text>
            <text x="43" y="24" fill="#EA4335" fontWeight="bold" fontSize={textLg} fontFamily="Arial">y</text>
          </svg>
        </div>
      );
    }
    if (n.includes('paytm')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#00BAF2]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#00BAF2" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textMd} fontFamily="Arial">Paytm</text>
          </svg>
        </div>
      );
    }
    if (n.includes('paypal')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#003087]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#003087" />
            <text x="30" y="22" textAnchor="middle" fill="#009CDE" fontWeight="bold" fontSize={textMd} fontFamily="Arial">PayPal</text>
          </svg>
        </div>
      );
    }
    if (n.includes('amazon pay')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#232F3E]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#232F3E" />
            <text x="30" y="15" textAnchor="middle" fill="#FF9900" fontWeight="bold" fontSize={textSm} fontFamily="Arial">amazon</text>
            <text x="30" y="28" textAnchor="middle" fill="#fff" fontSize={textSm} fontFamily="Arial">pay</text>
          </svg>
        </div>
      );
    }
    if (n.includes('mobikwik')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-[#E8203A]")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="#E8203A" />
            <text x="30" y="22" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">MobiKwik</text>
          </svg>
        </div>
      );
    }
    if (n.includes('cash') || n.includes('petty cash')) {
      return (
        <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', "flex items-center justify-center rounded-lg overflow-hidden bg-gradient-to-br from-emerald-500 to-green-700")}>
          <svg viewBox="0 0 60 36" width={w} height={h}>
            <rect width="60" height="36" fill="transparent" />
            <text x="30" y="15" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={textSm} fontFamily="Arial">💵</text>
            <text x="30" y="28" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={textSm} fontFamily="Arial">CASH</text>
          </svg>
        </div>
      );
    }

    // ── Fallback: beautiful initials logo ──
    const initials = name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
    const fallbackThemes = [
      { bgClass: 'bg-[#1e3a5f]', textClass: 'text-[#4a9ede]' },
      { bgClass: 'bg-[#3d1f5c]', textClass: 'text-[#a855f7]' },
      { bgClass: 'bg-[#1f4d2f]', textClass: 'text-[#4ade80]' },
      { bgClass: 'bg-[#5c1f1f]', textClass: 'text-[#f87171]' },
      { bgClass: 'bg-[#1f3d5c]', textClass: 'text-[#38bdf8]' },
      { bgClass: 'bg-[#5c4a1f]', textClass: 'text-[#fbbf24]' },
    ];
    const colorIdx = name.charCodeAt(0) % fallbackThemes.length;
    const theme = fallbackThemes[colorIdx];
    return (
      <div className={cn(size === 'sm' ? 'w-[52px] h-8' : 'w-16 h-10', 'flex items-center justify-center rounded-lg', theme.bgClass)}>
        <span className={cn(theme.textClass, size === 'sm' ? 'text-[15px]' : 'text-[18px]', 'font-extrabold font-sans tracking-[0.06em]')}>{initials}</span>
      </div>
    );
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

        {/* Mobile carousel — w-screen slot pattern */}
        <div className="lg:hidden">
          <div
            ref={mobileCarouselRef}
            className="flex overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide touch-scroll"
          >
            {filteredAccounts.map((account) => {
              const isActive = selectedAccountId === account.id;
              return (
                /* Each slot is exactly one viewport width — card fills slot with px-4 padding */
                <div
                  key={account.id}
                  ref={(el) => { if (el) mobileCardRefs.current[account.id!] = el; }}
                  className="snap-start shrink-0 w-screen px-4 [scroll-snap-stop:always]"
                >
                  <div
                    className={cn(
                      'transition-all duration-300 ease-in-out',
                      isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-70'
                    )}
                  >
                    <Card
                      variant="flat"
                      className={cn(
                        "w-full h-[200px] sm:h-[215px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[24px] cursor-pointer outline-none focus:ring-0",
                        isActive
                          ? "border-0 shadow-[0_20px_50px_rgba(91,33,182,0.4)]"
                          : "bg-white border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.07)]",
                        !account.isActive && "opacity-60 grayscale",
                      )}
                      onClick={() => handleCardClick(account.id!)}
                      tabIndex={-1}
                    >
                      {/* Card gradient background */}
                      {isActive && (
                        <div className="absolute inset-0">
                          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
                          {/* Glowing orbs */}
                          <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl" />
                          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-600/25 rounded-full blur-3xl" />
                          <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-pink-500/20 rounded-full blur-2xl" />
                          {/* Shimmer diagonal lines */}
                          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 210" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                            <line x1="-50" y1="280" x2="350" y2="-80" stroke="white" strokeOpacity="0.04" strokeWidth="40" />
                            <line x1="50" y1="280" x2="450" y2="-80" stroke="white" strokeOpacity="0.03" strokeWidth="30" />
                          </svg>
                        </div>
                      )}

                      <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col">
                        {/* Top row */}
                        <div className="flex justify-between items-start mb-auto">
                          {/* Bank/Card logo */}
                          <div className="flex items-center gap-2.5">
                            <div className="drop-shadow-md rounded-lg overflow-hidden">
                              {getBankCardLogo(account.name, isActive, 'sm')}
                            </div>
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center",
                              isActive ? "bg-white/10 text-white/80" : "bg-gray-100 text-gray-500"
                            )}>
                              <div className="scale-[0.7]">{getAccountIcon(account.type)}</div>
                            </div>
                          </div>

                          {/* Right: actions or network logo */}
                          <div className="flex items-center gap-1.5">
                            {isActive ? (
                              <>
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="text-[9px] font-bold tracking-widest text-emerald-300 border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 rounded-full"
                                >
                                  ● ACTIVE
                                </motion.span>
                                <button
                                  onClick={(e) => handleEditAccount(account, e)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 border border-white/10"
                                  aria-label={`Edit ${account.name} account`}
                                  title="Edit"
                                ><Edit2 size={11} /></button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id!, account.name); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/40 hover:bg-red-500/70 text-white transition-all active:scale-90 border border-red-400/20"
                                  aria-label={`Delete ${account.name} account`}
                                  title="Delete"
                                ><Trash2 size={11} /></button>
                              </>
                            ) : (
                              /* Mastercard-style rings for inactive */
                              <div className="flex -space-x-2 opacity-40">
                                <div className="w-7 h-7 rounded-full border-2 border-gray-400 bg-gray-300" />
                                <div className="w-7 h-7 rounded-full border-2 border-gray-400 bg-gray-200" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Balance section */}
                        <div className="mt-3">
                          <p className={cn(
                            "text-[9px] font-semibold tracking-[0.2em] uppercase mb-0.5",
                            isActive ? "text-white/50" : "text-gray-400"
                          )}>Balance</p>
                          <p className={cn(
                            "text-2xl sm:text-[28px] font-bold tracking-tight leading-none",
                            isActive ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]" : "text-gray-900"
                          )}>
                            {formatCurrency(account.balance)}
                          </p>
                        </div>

                        {/* Bottom: name + buttons */}
                        <div className="flex justify-between items-end mt-auto pt-3">
                          <div className="min-w-0 pr-2">
                            <p className={cn(
                              "text-[8px] font-semibold tracking-[0.15em] uppercase mb-0.5",
                              isActive ? "text-white/50" : "text-gray-400"
                            )}>Account Holder</p>
                            <h3 className={cn(
                              "font-semibold text-sm tracking-wide truncate max-w-[110px] sm:max-w-[150px]",
                              isActive ? "text-white" : "text-gray-800"
                            )}>{account.name}</h3>
                          </div>

                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCardAccountId(account.id!);
                                setShowTransactionTypeModal(true);
                              }}
                              className="inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none font-display tracking-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xl shadow-lg bg-black text-white hover:bg-gray-900 text-xs h-8 px-3">
                              <Plus size={11} className="mr-0.5" />Add
                            </Button>
                            <Button size="sm"
                              onClick={(e) => { e.stopPropagation(); setStatementImportOpen({ accountId: account.id!, accountName: account.name, accountType: account.type }); }}
                              className={cn(
                                "h-7 px-2.5 rounded-full text-[10px] font-semibold",
                                isActive
                                  ? "bg-white/20 hover:bg-white/30 text-white border border-white/20"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              )}>
                              <Upload size={11} className="mr-0.5" />Import
                            </Button>
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
              className="flex flex-col items-center justify-center -mt-1 mb-5"
            >
              <div className="flex gap-2 justify-center items-center h-5 mb-1.5">
                {filteredAccounts.map((account) => (
                  <button
                    key={`dot-mobile-${account.id}`}
                    onClick={() => handleCardClick(account.id!)}
                    className={cn(
                      "appearance-none border-0 outline-none shadow-none rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 m-0 p-0 min-w-0 min-h-0 leading-none",
                      selectedAccountId === account.id 
                        ? "!w-10 !h-2.5 bg-gradient-to-r from-pink-500 to-rose-500"
                        : "!w-2.5 !h-2.5 bg-gray-300 hover:bg-gray-400"
                    )}
                    type="button"
                    aria-label={`Go to account ${account.name}`}
                    title={`Go to account ${account.name}`}
                  />
                ))}
              </div>
              <div className="flex items-center text-[10px] text-gray-400 font-medium tracking-[0.22em] uppercase">
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
              className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide scroll-smooth touch-scroll [scroll-padding-left:50%] [scroll-padding-right:50%]"
            >
              {/* Left spacer — allows first card to snap to center */}
              <div
                className="shrink-0 w-[calc(50%-210px)] min-w-8"
                aria-hidden
              />
                  {filteredAccounts.map((account) => {
                    const isActive = selectedAccountId === account.id;
                    return (
                      <div
                        key={account.id}
                        ref={(el) => {
                          if (el) cardRefs.current[account.id!] = el;
                        }}
                        className="snap-center shrink-0 [scroll-snap-align:center] [scroll-snap-stop:always]"
                      >
                        <div
                          className={cn(
                            'transition-all duration-300 ease-in-out',
                            isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-50'
                          )}
                        >
                          <Card
                            variant="flat"
                            className={cn(
                              "w-[420px] h-[230px] relative overflow-hidden shrink-0 transition-all duration-300 rounded-[24px] cursor-pointer group outline-none focus:ring-0",
                              isActive
                                ? "border-0 shadow-[0_24px_60px_rgba(91,33,182,0.4)]"
                                : "bg-white border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.07)]",
                              !account.isActive && "opacity-60 grayscale",
                            )}
                            onClick={() => handleCardClick(account.id!)}
                            tabIndex={-1}
                          >
                            {/* Gradient background */}
                            {isActive && (
                              <div className="absolute inset-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
                                <div className="absolute -top-16 -right-16 w-56 h-56 bg-purple-500/25 rounded-full blur-3xl" />
                                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl" />
                                <div className="absolute top-1/2 right-1/3 w-28 h-28 bg-pink-500/15 rounded-full blur-2xl" />
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 420 230" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                                  <line x1="-60" y1="330" x2="400" y2="-100" stroke="white" strokeOpacity="0.04" strokeWidth="50" />
                                  <line x1="60" y1="330" x2="520" y2="-100" stroke="white" strokeOpacity="0.03" strokeWidth="35" />
                                </svg>
                              </div>
                            )}

                            <div className="relative z-10 p-6 h-full flex flex-col">
                              {/* Top row */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  {/* Bank/Card logo */}
                                  <div className="drop-shadow-lg rounded-lg overflow-hidden">
                                    {getBankCardLogo(account.name, isActive, 'md')}
                                  </div>

                                  <div className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center",
                                    isActive ? "bg-white/10 text-white/80" : "bg-gray-100 text-gray-500"
                                  )}>
                                    <div className="scale-75">{getAccountIcon(account.type)}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isActive ? (
                                    <>
                                      <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-[10px] font-bold tracking-widest text-emerald-300 border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 rounded-full"
                                      >
                                        ● ACTIVE
                                      </motion.span>
                                      <button
                                        onClick={(e) => handleEditAccount(account, e)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 border border-white/10"
                                        aria-label={`Edit ${account.name} account`}
                                        title="Edit"
                                      ><Edit2 size={13} /></button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteAccount(account.id!, account.name); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/40 hover:bg-red-500/70 text-white transition-all active:scale-90 border border-red-400/20"
                                        aria-label={`Delete ${account.name} account`}
                                        title="Delete"
                                      ><Trash2 size={13} /></button>
                                    </>
                                  ) : (
                                    <div className="flex -space-x-3 opacity-30">
                                      <div className="w-9 h-9 rounded-full border-2 border-gray-400 bg-gray-300" />
                                      <div className="w-9 h-9 rounded-full border-2 border-gray-400 bg-gray-200" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Balance */}
                              <div className="mt-4">
                                <p className={cn(
                                  "text-[10px] font-semibold tracking-[0.22em] uppercase mb-1",
                                  isActive ? "text-white/45" : "text-gray-400"
                                )}>Balance</p>
                                <p className={cn(
                                  "text-[32px] font-bold tracking-tight leading-none",
                                  isActive ? "text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]" : "text-gray-900"
                                )}>
                                  {formatCurrency(account.balance)}
                                </p>
                              </div>

                              {/* Bottom: name + buttons */}
                              <div className="flex justify-between items-end mt-auto">
                                <div className="min-w-0 pr-4">
                                  <p className={cn(
                                    "text-[9px] font-semibold tracking-[0.18em] uppercase mb-0.5",
                                    isActive ? "text-white/45" : "text-gray-400"
                                  )}>Account Holder</p>
                                  <h3 className={cn(
                                    "font-semibold tracking-wide truncate max-w-[170px]",
                                    isActive ? "text-white" : "text-gray-800"
                                  )}>{account.name}</h3>
                                </div>

                                <div className="flex gap-2 flex-shrink-0">
                                  <Button size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveCardAccountId(account.id!);
                                      setShowTransactionTypeModal(true);
                                    }}
                                    className="inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none font-display tracking-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xl shadow-lg bg-black text-white hover:bg-gray-900 text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4">
                                    <Plus size={13} className="mr-1" />Add
                                  </Button>
                                  <Button size="sm"
                                    onClick={(e) => { e.stopPropagation(); setStatementImportOpen({ accountId: account.id!, accountName: account.name, accountType: account.type }); }}
                                    className={cn(
                                      "h-8 px-4 rounded-full text-xs font-semibold",
                                      isActive
                                        ? "bg-white/20 hover:bg-white/30 text-white border border-white/20"
                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                    )}>
                                    <Upload size={13} className="mr-1" />Import
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
              {/* Right spacer — allows last card to snap to center */}
              <div
                className="shrink-0 w-[calc(50%-210px)] min-w-8"
                aria-hidden
              />
            </div>

        {/* Swipe Guide & Dot Indicators */}
        {filteredAccounts.length > 1 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center -mt-1 mb-6 md:mb-8"
          >
            <div className="flex gap-2 justify-center items-center h-5 mb-1.5">
              {filteredAccounts.map((account) => (
                <button
                  key={`dot-${account.id}`}
                  onClick={() => handleCardClick(account.id!)}
                  className={cn(
                    "appearance-none border-0 outline-none shadow-none rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 m-0 p-0 min-w-0 min-h-0 leading-none",
                    selectedAccountId === account.id 
                      ? "!w-10 !h-2.5 bg-gradient-to-r from-pink-500 to-rose-500" 
                      : "!w-2.5 !h-2.5 bg-gray-300 hover:bg-gray-400"
                  )}
                  type="button"
                  aria-label={`Go to account ${account.name}`}
                  title={`Go to account ${account.name}`}
                />
              ))}
            </div>
            <div className="flex items-center text-[10px] sm:text-xs text-gray-400 font-medium tracking-[0.22em] uppercase">
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
                                  {formatLocalDate(t.date, "en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
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
                              {formatLocalDate(t.date, "en-US", {
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
                  aria-label="Close edit account modal"
                  title="Close edit account modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 pb-6 pt-3 space-y-4">
                {/* Account Name */}
                <div>
                  <label htmlFor="edit-account-name" className="block text-xs font-semibold text-gray-600 mb-1.5">Account Name</label>
                  <input
                    id="edit-account-name"
                    type="text"
                    value={editingAccount.name}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm font-medium text-gray-900 transition-all"
                    placeholder="e.g. HDFC Savings"
                  />
                </div>

                {/* Account Type */}
                <div>
                  <label htmlFor="edit-account-type" className="block text-xs font-semibold text-gray-600 mb-1.5">Account Type</label>
                  <select
                    id="edit-account-type"
                    value={editingAccount.type}
                    onChange={(e) => setEditingAccount(prev => prev ? { ...prev, type: e.target.value } : null)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-100 outline-none text-sm font-medium text-gray-900 bg-white transition-all"
                    aria-label="Account type"
                    title="Account type"
                  >
                    <option value="bank">🏦 Bank Account</option>
                    <option value="card">💳 Credit / Debit Card</option>
                    <option value="wallet">📱 Digital Wallet</option>
                    <option value="cash">💵 Cash</option>
                  </select>
                </div>

                {/* Balance */}
                <div>
                  <label htmlFor="edit-account-balance" className="block text-xs font-semibold text-gray-600 mb-1.5">Current Balance (₹)</label>
                  <input
                    id="edit-account-balance"
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
                    aria-label={editingAccount.isActive ? 'Deactivate account' : 'Activate account'}
                    title={editingAccount.isActive ? 'Deactivate account' : 'Activate account'}
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

      {/* Transaction Type Picker Modal */}
      {showTransactionTypeModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6"
          onClick={() => setShowTransactionTypeModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={(event) => event.stopPropagation()}
            className="bg-white rounded-[28px] p-6 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl border border-white/20"
          >
            <h3 className="text-xl font-display font-bold mb-1">New Transaction</h3>
            <p className="text-gray-500 text-sm mb-6">What kind of transaction is this?</p>

            <div className="space-y-3">
              {[
                { type: 'expense', label: 'Expense', desc: 'Money spent', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100', icon: ArrowDownLeft },
                { type: 'income',  label: 'Income',  desc: 'Money received', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', icon: ArrowUpRight },
                { type: 'transfer', label: 'Transfer', desc: 'Move between accounts', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100', icon: Repeat2 },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    setShowTransactionTypeModal(false);
                    if (activeCardAccountId) {
                      localStorage.setItem('quickAccountId', String(activeCardAccountId));
                    }
                    if (opt.type === 'transfer') {
                      setCurrentPage('transfer');
                    } else {
                      localStorage.setItem('quickFormType', opt.type);
                      setCurrentPage('add-transaction');
                    }
                  }}
                  className={cn(
                    "w-full p-4 flex items-center gap-4 rounded-2xl transition-all border border-transparent hover:scale-[1.02] active:scale-[0.98]",
                    opt.color
                  )}
                >
                  <div className="w-11 h-11 bg-white/60 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <opt.icon size={22} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{opt.label}</p>
                    <p className="text-sm opacity-75 font-medium">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              className="w-full mt-5 rounded-xl hover:bg-gray-100 text-gray-500"
              onClick={() => setShowTransactionTypeModal(false)}
            >
              Cancel
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

