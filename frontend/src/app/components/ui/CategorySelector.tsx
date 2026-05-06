import React, { useMemo } from 'react';
import {
  Banknote,
  Car,
  Clapperboard,
  CreditCard,
  HeartPulse,
  Home,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  Soup,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getSubcategoriesForCategory,
  normalizeCategorySelection,
} from '@/lib/expenseCategories';
import { SearchableDropdown, type DropdownOption } from './SearchableDropdown';

type CategoryType = 'expense' | 'income';

interface CategorySelectorProps {
  type: CategoryType;
  category: string;
  subcategory?: string;
  onChange: (next: { category: string; subcategory: string }) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  Housing: <Home size={16} />,
  Utilities: <Zap size={16} />,
  'Food & Dining': <Soup size={16} />,
  Transportation: <Car size={16} />,
  Vehicle: <Car size={16} />,
  'Health & Medical': <HeartPulse size={16} />,
  Shopping: <ShoppingBag size={16} />,
  Subscriptions: <ReceiptText size={16} />,
  Travel: <Car size={16} />,
  'Business Expenses': <Banknote size={16} />,
  Education: <ReceiptText size={16} />,
  Entertainment: <Clapperboard size={16} />,
  'Loan / Debt Payments': <CreditCard size={16} />,
  Investments: <TrendingUp size={16} />,
  Salary: <Banknote size={16} />,
  'Investment Returns': <PiggyBank size={16} />,
  'Gift & Refund': <Banknote size={16} />,
};

const buildOptions = (type: CategoryType): DropdownOption[] => {
  const categories = type === 'income'
    ? Object.values(INCOME_CATEGORIES).map((item) => item.name)
    : Object.values(EXPENSE_CATEGORIES).map((item) => item.name);

  return categories.flatMap((category) => {
    const subcategories = getSubcategoriesForCategory(category, type);
    const baseOption: DropdownOption = {
      value: `${category}::`,
      label: category,
      icon: iconMap[category] ?? <MoreHorizontal size={16} />,
      description: 'Main category',
      group: category,
    };

    return [
      baseOption,
      ...subcategories.map((subcategory) => ({
        value: `${category}::${subcategory}`,
        label: subcategory,
        icon: iconMap[category] ?? <MoreHorizontal size={16} />,
        description: category,
        group: category,
      })),
    ];
  });
};

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  type,
  category,
  subcategory = '',
  onChange,
  label = 'Category',
  placeholder = 'Search category or subcategory',
  error,
  disabled,
  required,
  className,
}) => {
  const options = useMemo(() => buildOptions(type), [type]);
  const canonicalCategory = normalizeCategorySelection(category, type);
  const value = `${canonicalCategory}::${subcategory || ''}`;
  const hasExactOption = options.some((option) => option.value === value);
  const selectedValue = hasExactOption ? value : `${canonicalCategory}::`;

  return (
    <SearchableDropdown
      options={options}
      value={selectedValue}
      onChange={(nextValue) => {
        const [nextCategory = '', nextSubcategory = ''] = nextValue.split('::');
        onChange({
          category: normalizeCategorySelection(nextCategory, type),
          subcategory: nextSubcategory,
        });
      }}
      label={label}
      placeholder={placeholder}
      searchPlaceholder="Search meals, fuel, bill, EMI..."
      error={error}
      grouped
      disabled={disabled}
      required={required}
      className={className}
    />
  );
};
