import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

// Cartoon Entertainment Icon - Movie/Cocktail
export const EntertainmentIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#3D5A80"/>
    <path d="M22 44 L32 24 L42 44 Z" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1"/>
    <ellipse cx="32" cy="44" rx="10" ry="3" fill="#F8FAFC"/>
    <path d="M32 44 L32 48 L35 52" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="26" cy="34" r="3" fill="#F472B6" opacity="0.8"/>
    <circle cx="38" cy="36" r="2" fill="#34D399" opacity="0.8"/>
    <path d="M28 24 Q32 20, 34 16" stroke="#10B981" strokeWidth="2" fill="none"/>
    <ellipse cx="34" cy="15" rx="4" ry="2" fill="#10B981"/>
  </svg>
);

// Cartoon Food Icon - Burger
export const FoodIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#EF4444"/>
    <path d="M18 30 Q18 20, 32 20 Q46 20, 46 30 Z" fill="#FDE047"/>
    <rect x="16" y="30" width="32" height="6" rx="2" fill="#78350F"/>
    <rect x="16" y="36" width="32" height="4" rx="1" fill="#22C55E"/>
    <rect x="16" y="40" width="32" height="4" rx="1" fill="#EF4444"/>
    <path d="M16 44 Q16 50, 32 50 Q48 50, 48 44 Z" fill="#FDE047"/>
    <circle cx="22" cy="25" r="1" fill="#FDE047" opacity="0.6"/>
    <circle cx="28" cy="23" r="1" fill="#FDE047" opacity="0.6"/>
    <circle cx="36" cy="24" r="1" fill="#FDE047" opacity="0.6"/>
    <circle cx="42" cy="26" r="1" fill="#FDE047" opacity="0.6"/>
  </svg>
);

// Cartoon Public Transport Icon - Bus
export const PublicTransportIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F59E0B"/>
    <rect x="18" y="20" width="28" height="24" rx="4" fill="#DC2626"/>
    <rect x="22" y="24" width="6" height="6" rx="1" fill="#93C5FD"/>
    <rect x="36" y="24" width="6" height="6" rx="1" fill="#93C5FD"/>
    <rect x="22" y="34" width="20" height="2" fill="#FFFFFF" opacity="0.3"/>
    <circle cx="24" cy="48" r="4" fill="#1F2937"/>
    <circle cx="40" cy="48" r="4" fill="#1F2937"/>
  </svg>
);

// Cartoon Personal Vehicle Icon - Car
export const PersonalVehicleIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F97316"/>
    <rect x="14" y="30" width="36" height="12" rx="3" fill="#FFFFFF"/>
    <path d="M18 30 L24 20 L40 20 L46 30" fill="#FFFFFF"/>
    <rect x="26" y="22" width="12" height="6" rx="1" fill="#93C5FD"/>
    <circle cx="22" cy="42" r="4" fill="#1F2937"/>
    <circle cx="42" cy="42" r="4" fill="#1F2937"/>
  </svg>
);

// Cartoon Housing Icon - House
export const HomeIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#64748B"/>
    <path d="M16 32 L32 16 L48 32 L48 50 L16 50 Z" fill="#F1F5F9"/>
    <path d="M12 32 L32 12 L52 32" stroke="#475569" strokeWidth="4" fill="none" strokeLinecap="round"/>
    <rect x="28" y="38" width="8" height="12" fill="#475569" rx="1"/>
    <circle cx="24" cy="28" r="2" fill="#94A3B8"/>
    <circle cx="40" cy="28" r="2" fill="#94A3B8"/>
  </svg>
);

// Cartoon Utilities Icon - Light Bulb
export const UtilitiesIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#FBBF24"/>
    <path d="M32 14 Q44 14, 44 30 Q44 38, 38 42 L26 42 Q20 38, 20 30 Q20 14, 32 14" fill="#FEF9C3"/>
    <rect x="26" y="42" width="12" height="4" rx="1" fill="#9CA3AF"/>
    <rect x="27" y="46" width="10" height="2" rx="1" fill="#6B7280"/>
    <rect x="28" y="48" width="8" height="2" rx="1" fill="#4B5563"/>
    <path d="M26 26 L32 34 L38 26" stroke="#FBBF24" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <line x1="32" y1="16" x2="32" y2="10" stroke="#FEF9C3" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Cartoon Healthcare Icon - Medical Cross
export const HealthcareIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#06B6D4"/>
    <rect x="20" y="20" width="24" height="24" rx="4" fill="#FFFFFF"/>
    <rect x="28" y="24" width="8" height="16" rx="1" fill="#EF4444"/>
    <rect x="24" y="28" width="16" height="8" rx="1" fill="#EF4444"/>
  </svg>
);

// Cartoon Shopping Icon - Shopping Bag
export const ShoppingIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#EC4899"/>
    <path d="M18 26 L20 50 L44 50 L46 26 Z" fill="#FDF2F8"/>
    <path d="M24 26 Q24 18, 32 18 Q40 18, 40 26" fill="none" stroke="#1F2937" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="28" cy="36" r="3" fill="#F472B6"/>
    <circle cx="36" cy="36" r="3" fill="#A855F7"/>
  </svg>
);

// Cartoon Insurance Icon - Shield
export const InsuranceIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#0EA5E9"/>
    <path d="M32 16 L48 22 L48 36 Q48 50, 32 54 Q16 50, 16 36 L16 22 Z" fill="#E0F2FE"/>
    <path d="M32 24 L38 32 L32 40 L26 32 Z" fill="#0EA5E9"/>
  </svg>
);

// Cartoon Education Icon - Book/Graduation
export const EducationIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#3B82F6"/>
    <rect x="18" y="22" width="28" height="24" rx="2" fill="#1E40AF"/>
    <rect x="20" y="24" width="24" height="20" rx="1" fill="#FEFCE8"/>
    <line x1="32" y1="24" x2="32" y2="44" stroke="#1E40AF" strokeWidth="2"/>
    <line x1="24" y1="30" x2="30" y2="30" stroke="#94A3B8" strokeWidth="1"/>
    <line x1="24" y1="34" x2="30" y2="34" stroke="#94A3B8" strokeWidth="1"/>
    <line x1="24" y1="38" x2="30" y2="38" stroke="#94A3B8" strokeWidth="1"/>
    <line x1="34" y1="30" x2="40" y2="30" stroke="#94A3B8" strokeWidth="1"/>
    <line x1="34" y1="34" x2="40" y2="34" stroke="#94A3B8" strokeWidth="1"/>
    <line x1="34" y1="38" x2="40" y2="38" stroke="#94A3B8" strokeWidth="1"/>
  </svg>
);

// Cartoon Fitness Icon - Dumbbell
export const FitnessIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#10B981"/>
    <rect x="24" y="28" width="16" height="8" rx="2" fill="#6B7280"/>
    <rect x="14" y="24" width="8" height="16" rx="2" fill="#374151"/>
    <rect x="42" y="24" width="8" height="16" rx="2" fill="#374151"/>
    <rect x="12" y="26" width="4" height="12" rx="1" fill="#1F2937"/>
    <rect x="48" y="26" width="4" height="12" rx="1" fill="#1F2937"/>
  </svg>
);

// Cartoon Travel Icon - Airplane
export const TravelIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#6366F1"/>
    <path d="M32 16 L36 26 L48 30 L36 32 L32 48 L28 32 L16 30 L28 26 Z" fill="#FFFFFF"/>
  </svg>
);

// Cartoon Subscriptions Icon - Play Button
export const SubscriptionIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#8B5CF6"/>
    <rect x="18" y="20" width="28" height="24" rx="4" fill="#FFFFFF"/>
    <path d="M28 26 L40 32 L28 38 Z" fill="#8B5CF6"/>
    <circle cx="22" cy="48" r="2" fill="#FFFFFF"/>
    <circle cx="32" cy="48" r="2" fill="#FFFFFF"/>
    <circle cx="42" cy="48" r="2" fill="#FFFFFF"/>
  </svg>
);

// Cartoon Personal Care Icon - Mirror/Makeup
export const PersonalCareIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F43F5E"/>
    <ellipse cx="32" cy="28" rx="14" ry="16" fill="#FDF2F8"/>
    <ellipse cx="32" cy="28" rx="10" ry="12" fill="#FECDD3"/>
    <rect x="30" y="44" width="4" height="8" fill="#9CA3AF"/>
    <ellipse cx="32" cy="54" rx="8" ry="3" fill="#6B7280"/>
    <circle cx="28" cy="26" r="2" fill="#FFFFFF" opacity="0.8"/>
  </svg>
);

// Cartoon Pets Icon - Paw
export const PetsIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F59E0B"/>
    <ellipse cx="32" cy="38" rx="10" ry="8" fill="#78350F"/>
    <circle cx="22" cy="26" r="5" fill="#78350F"/>
    <circle cx="42" cy="26" r="5" fill="#78350F"/>
    <circle cx="26" cy="18" r="4" fill="#78350F"/>
    <circle cx="38" cy="18" r="4" fill="#78350F"/>
  </svg>
);

// Cartoon Gifts Icon - Gift Box
export const GiftsIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#A855F7"/>
    <rect x="16" y="28" width="32" height="22" rx="2" fill="#EC4899"/>
    <rect x="14" y="24" width="36" height="6" rx="2" fill="#F472B6"/>
    <rect x="30" y="24" width="4" height="26" fill="#FDE047"/>
  </svg>
);

// Cartoon Family Icon - Two People
export const FamilyIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#14B8A6"/>
    <circle cx="24" cy="28" r="6" fill="#FFFFFF"/>
    <path d="M16 48 Q16 38, 24 38 Q32 38, 32 48" fill="#FFFFFF"/>
    <circle cx="40" cy="32" r="5" fill="#CCFBF1"/>
    <path d="M34 48 Q34 40, 40 40 Q46 40, 46 48" fill="#CCFBF1"/>
  </svg>
);

// Cartoon Finance Icon - Wallet/Card
export const FinanceIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#0EA5E9"/>
    <rect x="14" y="22" width="36" height="24" rx="3" fill="#1E3A5F"/>
    <rect x="14" y="28" width="36" height="6" fill="#FDE047"/>
    <rect x="34" y="38" width="12" height="4" rx="1" fill="#94A3B8"/>
    <rect x="18" y="40" width="8" height="2" rx="1" fill="#64748B"/>
  </svg>
);

// Cartoon Work Icon - Briefcase
export const WorkIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#06B6D4"/>
    <rect x="14" y="26" width="36" height="22" rx="3" fill="#78350F"/>
    <rect x="24" y="20" width="16" height="8" rx="2" fill="#92400E"/>
    <rect x="28" y="22" width="8" height="4" rx="1" fill="#06B6D4"/>
    <rect x="30" y="34" width="4" height="8" rx="1" fill="#FDE047"/>
    <line x1="14" y1="38" x2="30" y2="38" stroke="#92400E" strokeWidth="2"/>
    <line x1="34" y1="38" x2="50" y2="38" stroke="#92400E" strokeWidth="2"/>
  </svg>
);

// Cartoon Miscellaneous Icon - Puzzle
export const MiscIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#64748B"/>
    <path d="M24 24 L40 24 L40 40 L24 40 Z" fill="#F8FAFC"/>
    <circle cx="32" cy="32" r="4" fill="#64748B"/>
  </svg>
);

// Cartoon Taxes Icon - Bill with %
export const TaxesIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#7C3AED"/>
    <rect x="20" y="18" width="24" height="32" rx="2" fill="#F5F3FF"/>
    <line x1="24" y1="26" x2="36" y2="26" stroke="#7C3AED" strokeWidth="2"/>
    <line x1="24" y1="32" x2="36" y2="32" stroke="#7C3AED" strokeWidth="2"/>
    <text x="32" y="44" textAnchor="middle" fontSize="12" fill="#7C3AED" fontWeight="black">%</text>
  </svg>
);

// Cartoon Vehicle Maintenance Icon - Wrench
export const VehicleMaintenanceIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F97316"/>
    <path d="M44 20 L32 32 L20 44" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="20" cy="44" r="4" fill="#FFFFFF"/>
    <path d="M40 16 Q48 16, 48 24 Q48 32, 40 32 Q32 32, 32 24 Q32 16, 40 16" fill="#FFFFFF"/>
    <circle cx="40" cy="24" r="4" fill="#F97316"/>
  </svg>
);

// === Income Category Icons ===

// Cartoon Salary Icon - Money Bag
export const SalaryIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#10B981"/>
    <path d="M24 22 Q32 16, 40 22 L42 26 Q42 46, 32 50 Q22 46, 22 26 Z" fill="#FDE047"/>
    <path d="M28 20 Q32 14, 36 20" fill="none" stroke="#CA8A04" strokeWidth="2" strokeLinecap="round"/>
    <text x="32" y="40" textAnchor="middle" fontSize="16" fill="#78350F" fontWeight="bold">$</text>
  </svg>
);

// Cartoon Freelance Icon - Laptop
export const FreelanceIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#3B82F6"/>
    <rect x="16" y="20" width="32" height="22" rx="2" fill="#1F2937"/>
    <rect x="18" y="22" width="28" height="18" rx="1" fill="#60A5FA"/>
    <rect x="12" y="44" width="40" height="4" rx="2" fill="#374151"/>
    <rect x="22" y="28" width="8" height="2" fill="#FFFFFF"/>
    <rect x="22" y="32" width="12" height="2" fill="#FFFFFF"/>
    <rect x="22" y="36" width="6" height="2" fill="#FFFFFF"/>
  </svg>
);

// Cartoon Investment Icon - Chart Up
export const InvestmentIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#F59E0B"/>
    <rect x="16" y="42" width="8" height="8" rx="1" fill="#10B981"/>
    <rect x="28" y="34" width="8" height="16" rx="1" fill="#10B981"/>
    <rect x="40" y="26" width="8" height="24" rx="1" fill="#10B981"/>
    <path d="M18 36 L32 28 L46 18" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M40 18 L46 18 L46 24" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </svg>
);

// Cartoon Business Icon - Building
export const BusinessIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#8B5CF6"/>
    <rect x="20" y="18" width="24" height="32" rx="2" fill="#E0E7FF"/>
    <rect x="24" y="22" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="34" y="22" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="24" y="30" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="34" y="30" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="24" y="38" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="34" y="38" width="6" height="4" rx="1" fill="#6366F1"/>
    <rect x="28" y="44" width="8" height="6" rx="1" fill="#1E1B4B"/>
  </svg>
);

// Cartoon Gift Received Icon - Open Gift
export const GiftReceivedIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#EC4899"/>
    <rect x="18" y="30" width="28" height="20" rx="2" fill="#FDF2F8"/>
    <rect x="30" y="30" width="4" height="20" fill="#F472B6"/>
    <path d="M18 28 L32 16 L46 28" fill="#FECDD3"/>
    <rect x="30" y="16" width="4" height="14" fill="#F472B6"/>
    <circle cx="26" cy="38" r="3" fill="#FDE047"/>
    <circle cx="38" cy="38" r="3" fill="#A855F7"/>
    <circle cx="32" cy="44" r="3" fill="#34D399"/>
  </svg>
);

// Cartoon Other Income Icon - Coins
export const OtherIncomeIcon: React.FC<IconProps> = ({ size = 48, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
    <circle cx="32" cy="32" r="30" fill="#64748B"/>
    <ellipse cx="26" cy="40" rx="10" ry="4" fill="#CA8A04"/>
    <ellipse cx="26" cy="38" rx="10" ry="4" fill="#FDE047"/>
    <ellipse cx="38" cy="34" rx="10" ry="4" fill="#CA8A04"/>
    <ellipse cx="38" cy="32" rx="10" ry="4" fill="#FDE047"/>
    <ellipse cx="32" cy="26" rx="10" ry="4" fill="#CA8A04"/>
    <ellipse cx="32" cy="24" rx="10" ry="4" fill="#FDE047"/>
    <text x="32" y="28" textAnchor="middle" fontSize="8" fill="#78350F" fontWeight="bold">$</text>
  </svg>
);

// Category icon mapping
export const getCategoryCartoonIcon = (categoryName: string, size: number = 32): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    // Expense categories
    'Housing': <HomeIcon size={size} />,
    'Housing / Rent': <HomeIcon size={size} />,
    'Entertainment': <EntertainmentIcon size={size} />,
    'Food & Dining': <FoodIcon size={size} />,
    'Transportation': <PublicTransportIcon size={size} />,
    'Vehicle': <PersonalVehicleIcon size={size} />,
    'Utilities': <UtilitiesIcon size={size} />,
    'Healthcare': <HealthcareIcon size={size} />,
    'Health & Medical': <HealthcareIcon size={size} />,
    'Insurance': <InsuranceIcon size={size} />,
    'Shopping': <ShoppingIcon size={size} />,
    'Education': <EducationIcon size={size} />,
    'Family & Kids': <FamilyIcon size={size} />,
    'Fitness & Sports': <FitnessIcon size={size} />,
    'Travel': <TravelIcon size={size} />,
    'Travel & Vacation': <TravelIcon size={size} />,
    'Subscriptions': <SubscriptionIcon size={size} />,
    'Subscriptions & Digital Services': <SubscriptionIcon size={size} />,
    'Personal Care': <PersonalCareIcon size={size} />,
    'Pets': <PetsIcon size={size} />,
    'Gifts & Donations': <GiftsIcon size={size} />,
    'Donations & Charity': <GiftsIcon size={size} />,
    'Gifts': <GiftsIcon size={size} />,
    'Financial': <FinanceIcon size={size} />,
    'Work & Business': <WorkIcon size={size} />,
    'Business Expenses': <WorkIcon size={size} />,
    'Investments': <InvestmentIcon size={size} />,
    'Taxes & Government': <TaxesIcon size={size} />,
    'Vehicle Maintenance': <VehicleMaintenanceIcon size={size} />,
    'Electronics & Gadgets': <ShoppingIcon size={size} />,
    'Home Maintenance': <HomeIcon size={size} />,
    'Loan / Debt Payments': <FinanceIcon size={size} />,
    'Miscellaneous': <MiscIcon size={size} />,
    'Miscellaneous / Other': <MiscIcon size={size} />,
    // Income categories
    'Salary': <SalaryIcon size={size} />,
    'Freelance & Side Gigs': <FreelanceIcon size={size} />,
    'Investment Returns': <InvestmentIcon size={size} />,
    'Business': <BusinessIcon size={size} />,
    'Gift & Refund': <GiftReceivedIcon size={size} />,
    'Other Income': <OtherIncomeIcon size={size} />,
  };
  
  return iconMap[categoryName] || <MiscIcon size={size} />;
};

// Get background color for category
export const getCategoryColor = (categoryName: string): string => {
  const colorMap: Record<string, string> = {
    'Housing': '#64748B',
    'Housing / Rent': '#64748B',
    'Entertainment': '#3D5A80',
    'Food & Dining': '#EF4444',
    'Transportation': '#F59E0B',
    'Vehicle': '#F97316',
    'Utilities': '#FBBF24',
    'Healthcare': '#06B6D4',
    'Health & Medical': '#06B6D4',
    'Insurance': '#0EA5E9',
    'Shopping': '#EC4899',
    'Education': '#3B82F6',
    'Family & Kids': '#14B8A6',
    'Fitness & Sports': '#10B981',
    'Travel': '#6366F1',
    'Travel & Vacation': '#6366F1',
    'Subscriptions': '#8B5CF6',
    'Subscriptions & Digital Services': '#8B5CF6',
    'Personal Care': '#F43F5E',
    'Pets': '#F59E0B',
    'Gifts & Donations': '#A855F7',
    'Donations & Charity': '#A855F7',
    'Gifts': '#EC4899',
    'Financial': '#0EA5E9',
    'Work & Business': '#06B6D4',
    'Business Expenses': '#06B6D4',
    'Investments': '#F59E0B',
    'Taxes & Government': '#7C3AED',
    'Vehicle Maintenance': '#F97316',
    'Electronics & Gadgets': '#2563EB',
    'Home Maintenance': '#0F766E',
    'Loan / Debt Payments': '#0EA5E9',
    'Miscellaneous': '#64748B',
    'Miscellaneous / Other': '#64748B',
    'Salary': '#10B981',
    'Freelance & Side Gigs': '#3B82F6',
    'Investment Returns': '#F59E0B',
    'Business': '#8B5CF6',
    'Gift & Refund': '#EC4899',
    'Other Income': '#64748B',
  };
  
  return colorMap[categoryName] || '#64748B';
};
