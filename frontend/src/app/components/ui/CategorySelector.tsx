import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Search, Sparkles, Check, 
  MoreHorizontal, X, ArrowLeft
} from 'lucide-react';
import { 
  EXPENSE_CATEGORIES, 
  INCOME_CATEGORIES, 
  getSubcategoriesForCategory, 
  normalizeCategorySelection 
} from '@/lib/expenseCategories';
import { getCategoryCartoonIcon, getCategoryColor } from './CartoonCategoryIcons';
import { cn } from '@/lib/utils';
import { useMobile } from '@/app/components/ui/use-mobile';
import { SearchableDropdown } from './SearchableDropdown';

type CategoryType = 'expense' | 'income' | 'transfer';

interface CategorySelectorProps {
  type: CategoryType;
  category: string;
  subcategory?: string;
  onChange: (next: { category: string; subcategory: string }) => void;
  description?: string;
  autoMatchResult?: { category: string; subcategory: string; confidence: number } | null;
  className?: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  type,
  category,
  subcategory = '',
  onChange,
  description = '',
  autoMatchResult,
  className
}) => {
  const isMobile = useMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState(0);
  const [showSubcategories, setShowSubcategories] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    if (type === 'transfer') return [];
    const source = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return Object.values(source).map(cat => cat.name);
  }, [type]);

  const subcategories = useMemo(() => {
    if (!category || type === 'transfer') return [];
    return getSubcategoriesForCategory(category, type as any);
  }, [category, type]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    const lowerQuery = searchQuery.toLowerCase();
    return categories.filter(cat => 
      cat.toLowerCase().includes(lowerQuery) || 
      getSubcategoriesForCategory(cat, type as any).some(sub => sub.toLowerCase().includes(lowerQuery))
    );
  }, [categories, searchQuery, type]);

  // Mobile Grid View (3x5)
  if (isMobile && type !== 'transfer') {
    if (showSubcategories && category) {
      return (
        <div className={cn("space-y-4 animate-in fade-in slide-in-from-right-4", className)}>
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setShowSubcategories(false)}
              className="flex items-center gap-2 text-slate-500 font-bold text-sm"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                {getCategoryCartoonIcon(category, 20)}
              </div>
              <span className="text-sm font-black text-slate-800">{category}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                onChange({ category, subcategory: '' });
                setShowSubcategories(false);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                !subcategory 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                  : "bg-slate-100 text-slate-600"
              )}
            >
              General
            </button>
            {subcategories.map(sub => (
              <button
                key={sub}
                onClick={() => {
                  onChange({ category, subcategory: sub });
                  setShowSubcategories(false);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  subcategory === sub 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      );
    }

    const itemsPerPage = 15; // 3 columns * 5 rows
    const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
    const paginatedCategories = filteredCategories.slice(
      activePage * itemsPerPage,
      (activePage + 1) * itemsPerPage
    );

    return (
      <div className={cn("space-y-4", className)}>
        {/* Search Bar for Categories */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActivePage(0);
            }}
            placeholder="Search categories or sub-items..."
            className="w-full bg-slate-100/50 border-none rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        {/* Grid Container */}
        <div className="relative">
          <div 
            ref={scrollRef}
            className="grid grid-cols-3 gap-2 min-h-[300px]"
          >
            {paginatedCategories.map((cat) => {
              const isSelected = category === cat;
              const isAIRecommended = autoMatchResult?.category === cat;
              
              return (
                <button
                  key={cat}
                  onClick={() => {
                    onChange({ category: cat, subcategory: '' });
                    if (getSubcategoriesForCategory(cat, type as any).length > 0) {
                      setShowSubcategories(true);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-2xl transition-all relative overflow-hidden",
                    isSelected 
                      ? "bg-white shadow-lg ring-2 ring-indigo-500 scale-95" 
                      : "bg-white border border-slate-100 active:scale-95"
                  )}
                >
                  {isAIRecommended && !isSelected && (
                    <div className="absolute top-1 right-1">
                      <Sparkles size={10} className="text-indigo-500 animate-pulse" />
                    </div>
                  )}
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-transform",
                    isSelected ? "scale-110" : ""
                  )}>
                    {getCategoryCartoonIcon(cat, 32)}
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold text-center leading-tight line-clamp-2",
                    isSelected ? "text-indigo-600" : "text-slate-600"
                  )}>
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <button 
                onClick={() => setActivePage(p => Math.max(0, p - 1))}
                disabled={activePage === 0}
                className="p-2 rounded-full bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      activePage === i ? "w-4 bg-indigo-500" : "bg-slate-300"
                    )}
                  />
                ))}
              </div>
              <button 
                onClick={() => setActivePage(p => Math.min(totalPages - 1, p + 1))}
                disabled={activePage === totalPages - 1}
                className="p-2 rounded-full bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop View: Searchable Dropdown (Refined for both)
  const options = categories.flatMap(cat => {
    const subs = getSubcategoriesForCategory(cat, type as any);
    return [
      { value: `${cat}::`, label: cat, icon: getCategoryCartoonIcon(cat, 20), group: cat },
      ...subs.map(sub => ({
        value: `${cat}::${sub}`,
        label: sub,
        icon: getCategoryCartoonIcon(cat, 20),
        group: cat
      }))
    ];
  });

  const selectedValue = subcategory ? `${category}::${subcategory}` : `${category}::`;

  return (
    <div className={cn("space-y-4", className)}>
      <SearchableDropdown
        options={options}
        value={selectedValue}
        onChange={(val) => {
          const [cat, sub] = val.split('::');
          onChange({ category: cat, subcategory: sub || '' });
        }}
        placeholder="Search category or sub-category..."
        className="h-14"
        grouped
      />
    </div>
  );
};
