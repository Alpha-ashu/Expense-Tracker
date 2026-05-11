import React, { useState, useMemo } from 'react';
import { Search, Building2, CheckCircle2, SkipForward, ChevronRight } from 'lucide-react';

interface BankAccountStepProps {
  data: {
    country: string;
    bankName: string;
    accountHolderName: string;
    currentBalance: string;
  };
  onUpdate: (data: any) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
}

interface BankInfo {
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  initials: string;
  type: string;
}

/*  Per-country bank registry  */
const BANKS_BY_COUNTRY: Record<string, BankInfo[]> = {
  India: [
    { name: 'State Bank of India', shortName: 'SBI', color: '#1a3a6b', textColor: '#fff', initials: 'SBI', type: 'Public Sector' },
    { name: 'HDFC Bank', shortName: 'HDFC', color: '#004C8F', textColor: '#fff', initials: 'HDFC', type: 'Private Sector' },
    { name: 'ICICI Bank', shortName: 'ICICI', color: '#F37021', textColor: '#fff', initials: 'ICICI', type: 'Private Sector' },
    { name: 'Axis Bank', shortName: 'AXIS', color: '#800000', textColor: '#fff', initials: 'AXIS', type: 'Private Sector' },
    { name: 'Kotak Mahindra Bank', shortName: 'Kotak', color: '#EE1C25', textColor: '#fff', initials: 'KMB', type: 'Private Sector' },
    { name: 'Punjab National Bank', shortName: 'PNB', color: '#003366', textColor: '#fff', initials: 'PNB', type: 'Public Sector' },
    { name: 'Bank of Baroda', shortName: 'BOB', color: '#F7941D', textColor: '#fff', initials: 'BOB', type: 'Public Sector' },
    { name: 'Canara Bank', shortName: 'Canara', color: '#0057A8', textColor: '#fff', initials: 'CNR', type: 'Public Sector' },
    { name: 'Union Bank of India', shortName: 'UBI', color: '#003087', textColor: '#fff', initials: 'UBI', type: 'Public Sector' },
    { name: 'IndusInd Bank', shortName: 'IndusInd', color: '#1B3A6B', textColor: '#fff', initials: 'IIB', type: 'Private Sector' },
    { name: 'Yes Bank', shortName: 'YES', color: '#00529B', textColor: '#fff', initials: 'YES', type: 'Private Sector' },
    { name: 'Federal Bank', shortName: 'Federal', color: '#0066CC', textColor: '#fff', initials: 'FBL', type: 'Private Sector' },
    { name: 'IDBI Bank', shortName: 'IDBI', color: '#006341', textColor: '#fff', initials: 'IDBI', type: 'Public Sector' },
    { name: 'RBL Bank', shortName: 'RBL', color: '#E31837', textColor: '#fff', initials: 'RBL', type: 'Private Sector' },
    { name: 'Bank of India', shortName: 'BOI', color: '#003366', textColor: '#fff', initials: 'BOI', type: 'Public Sector' },
    { name: 'South Indian Bank', shortName: 'SIB', color: '#005792', textColor: '#fff', initials: 'SIB', type: 'Private Sector' },
    { name: 'Karnataka Bank', shortName: 'KBL', color: '#1E3A5F', textColor: '#fff', initials: 'KBL', type: 'Private Sector' },
    { name: 'Paytm Payments Bank', shortName: 'Paytm', color: '#00BAF2', textColor: '#fff', initials: 'PTM', type: 'Payments Bank' },
    { name: 'Airtel Payments Bank', shortName: 'Airtel', color: '#E40000', textColor: '#fff', initials: 'APB', type: 'Payments Bank' },
    { name: 'Jio Payments Bank', shortName: 'Jio', color: '#0066CC', textColor: '#fff', initials: 'JPB', type: 'Payments Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  'United States': [
    { name: 'Chase Bank', shortName: 'Chase', color: '#117ACA', textColor: '#fff', initials: 'JPM', type: 'National Bank' },
    { name: 'Bank of America', shortName: 'BofA', color: '#E31837', textColor: '#fff', initials: 'BOA', type: 'National Bank' },
    { name: 'Wells Fargo', shortName: 'Wells', color: '#CD1409', textColor: '#fff', initials: 'WF', type: 'National Bank' },
    { name: 'Citibank', shortName: 'Citi', color: '#003B70', textColor: '#fff', initials: 'CITI', type: 'National Bank' },
    { name: 'Capital One', shortName: 'CapOne', color: '#D03027', textColor: '#fff', initials: 'C1', type: 'National Bank' },
    { name: 'US Bank', shortName: 'USB', color: '#0C2074', textColor: '#fff', initials: 'USB', type: 'National Bank' },
    { name: 'PNC Bank', shortName: 'PNC', color: '#E04B27', textColor: '#fff', initials: 'PNC', type: 'National Bank' },
    { name: 'Goldman Sachs (Marcus)', shortName: 'Marcus', color: '#2C2C2C', textColor: '#fff', initials: 'GS', type: 'National Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  'United Kingdom': [
    { name: 'Barclays', shortName: 'Barclays', color: '#00AEEF', textColor: '#fff', initials: 'BRC', type: 'High Street Bank' },
    { name: 'HSBC UK', shortName: 'HSBC', color: '#DB0011', textColor: '#fff', initials: 'HSBC', type: 'High Street Bank' },
    { name: 'Lloyds Bank', shortName: 'Lloyds', color: '#024731', textColor: '#fff', initials: 'LBG', type: 'High Street Bank' },
    { name: 'NatWest', shortName: 'NatWest', color: '#42145F', textColor: '#fff', initials: 'NW', type: 'High Street Bank' },
    { name: 'Santander UK', shortName: 'Santander', color: '#EC0000', textColor: '#fff', initials: 'SAN', type: 'High Street Bank' },
    { name: 'Monzo', shortName: 'Monzo', color: '#FF5F5D', textColor: '#fff', initials: 'MNZ', type: 'Digital Bank' },
    { name: 'Starling Bank', shortName: 'Starling', color: '#6935D3', textColor: '#fff', initials: 'STR', type: 'Digital Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  Canada: [
    { name: 'RBC Royal Bank', shortName: 'RBC', color: '#005DAA', textColor: '#fff', initials: 'RBC', type: 'Major Bank' },
    { name: 'TD Bank', shortName: 'TD', color: '#00B140', textColor: '#fff', initials: 'TD', type: 'Major Bank' },
    { name: 'Scotiabank', shortName: 'Scotia', color: '#EC111A', textColor: '#fff', initials: 'BNS', type: 'Major Bank' },
    { name: 'BMO Bank of Montreal', shortName: 'BMO', color: '#0079C1', textColor: '#fff', initials: 'BMO', type: 'Major Bank' },
    { name: 'CIBC', shortName: 'CIBC', color: '#C41F3E', textColor: '#fff', initials: 'CIBC', type: 'Major Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  Australia: [
    { name: 'Commonwealth Bank', shortName: 'CBA', color: '#FFCC00', textColor: '#000', initials: 'CBA', type: 'Big Four' },
    { name: 'Westpac', shortName: 'WBC', color: '#DA1710', textColor: '#fff', initials: 'WBC', type: 'Big Four' },
    { name: 'ANZ Bank', shortName: 'ANZ', color: '#007DC5', textColor: '#fff', initials: 'ANZ', type: 'Big Four' },
    { name: 'NAB', shortName: 'NAB', color: '#E61E2D', textColor: '#fff', initials: 'NAB', type: 'Big Four' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  'United Arab Emirates': [
    { name: 'Emirates NBD', shortName: 'ENBD', color: '#FFD700', textColor: '#000', initials: 'ENBD', type: 'National Bank' },
    { name: 'First Abu Dhabi Bank', shortName: 'FAB', color: '#1A3A6B', textColor: '#fff', initials: 'FAB', type: 'National Bank' },
    { name: 'Abu Dhabi Commercial Bank', shortName: 'ADCB', color: '#E31837', textColor: '#fff', initials: 'ADCB', type: 'National Bank' },
    { name: 'Dubai Islamic Bank', shortName: 'DIB', color: '#006B3F', textColor: '#fff', initials: 'DIB', type: 'Islamic Bank' },
    { name: 'Mashreq Bank', shortName: 'Mashreq', color: '#E31837', textColor: '#fff', initials: 'MBK', type: 'National Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  Singapore: [
    { name: 'DBS Bank', shortName: 'DBS', color: '#E60028', textColor: '#fff', initials: 'DBS', type: 'Local Bank' },
    { name: 'OCBC Bank', shortName: 'OCBC', color: '#ED1C24', textColor: '#fff', initials: 'OCBC', type: 'Local Bank' },
    { name: 'United Overseas Bank', shortName: 'UOB', color: '#003087', textColor: '#fff', initials: 'UOB', type: 'Local Bank' },
    { name: 'Other', shortName: 'Other', color: '#6B7280', textColor: '#fff', initials: '', type: 'Other' },
  ],
  Default: [
    { name: 'Primary Local Bank', shortName: 'Local', color: '#6B7280', textColor: '#fff', initials: 'BNK', type: 'Bank' },
    { name: 'International Bank', shortName: 'Intl', color: '#374151', textColor: '#fff', initials: 'INT', type: 'Bank' },
    { name: 'Other', shortName: 'Other', color: '#9CA3AF', textColor: '#fff', initials: '', type: 'Other' },
  ],
};

const BankLogo: React.FC<{ bank: BankInfo; size?: 'sm' | 'md' }> = ({ bank, size = 'md' }) => {
  const dim = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center font-bold flex-shrink-0 shadow-sm`}
      style={{ background: bank.color, color: bank.textColor }}
    >
      {bank.initials}
    </div>
  );
};

export const BankAccountStep: React.FC<BankAccountStepProps> = ({
  data,
  onUpdate,
  onNext,
  onBack,
  onSkip,
}) => {
  const [searchQuery, setSearchQuery] = useState(data.bankName || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allBanks = useMemo(() => {
    return BANKS_BY_COUNTRY[data.country] || BANKS_BY_COUNTRY.Default;
  }, [data.country]);

  const filteredBanks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allBanks;
    return allBanks.filter(
      b =>
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q)
    );
  }, [searchQuery, allBanks]);

  const selectedBank = useMemo(
    () => allBanks.find(b => b.name === data.bankName) || null,
    [data.bankName, allBanks]
  );

  const handleSelectBank = (bank: BankInfo) => {
    onUpdate({ bankName: bank.name });
    setSearchQuery(bank.name);
    setErrors(prev => ({ ...prev, bankName: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!data.bankName) newErrors.bankName = 'Please select a bank';
    if (!data.accountHolderName.trim()) newErrors.accountHolderName = 'Account name is required';
    if (data.currentBalance && isNaN(Number(data.currentBalance)))
      newErrors.currentBalance = 'Please enter a valid amount';
    if (data.currentBalance && Number(data.currentBalance) < 0)
      newErrors.currentBalance = 'Balance cannot be negative';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) onNext();
  };

  const showBankList = !data.bankName || searchQuery !== data.bankName;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Bank Account Setup</h3>
        <p className="text-sm text-gray-500">
          {data.country
            ? `Showing banks available in ${data.country}`
            : 'Set up your primary account for tracking.'}
        </p>
      </div>

      {/* Bank search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>

        {/* Search input */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (data.bankName && e.target.value !== data.bankName) {
                onUpdate({ bankName: '' });
              }
            }}
            placeholder="Search your bank..."
            autoComplete="off"
            className={`w-full pl-9 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.bankName ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
        </div>
        {errors.bankName && <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>}

        {/* Selected bank pill */}
        {selectedBank && (
          <div className="mt-2 flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
            <BankLogo bank={selectedBank} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-900 truncate">{selectedBank.name}</p>
              <p className="text-xs text-blue-600">{selectedBank.type}</p>
            </div>
            <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0" />
          </div>
        )}

        {/* Bank cards grid */}
        {showBankList && filteredBanks.length > 0 && (
          <div className="mt-3 space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {filteredBanks.map(bank => (
              <button
                key={bank.name}
                type="button"
                onClick={() => handleSelectBank(bank)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  data.bankName === bank.name
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <BankLogo bank={bank} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{bank.name}</p>
                  <p className="text-xs text-gray-500">{bank.type}</p>
                </div>
                {data.bankName === bank.name ? (
                  <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {showBankList && filteredBanks.length === 0 && searchQuery && (
          <div className="mt-3 text-center py-4 text-sm text-gray-500">
            No banks found for "{searchQuery}". Try a different name.
          </div>
        )}
      </div>

      {/* Account name */}
      <div>
        <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-700 mb-1">
          Account Name <span className="text-gray-400 font-normal">(as in bank records)</span>
        </label>
        <input
          type="text"
          id="accountHolderName"
          value={data.accountHolderName}
          onChange={e => { onUpdate({ accountHolderName: e.target.value }); setErrors(prev => ({ ...prev, accountHolderName: '' })); }}
          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.accountHolderName ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
          placeholder="e.g. Savings Account, Salary A/C"
        />
        {errors.accountHolderName && <p className="mt-1 text-sm text-red-600">{errors.accountHolderName}</p>}
      </div>

      {/* Balance */}
      <div>
        <label htmlFor="currentBalance" className="block text-sm font-medium text-gray-700 mb-1">
          Current Balance <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
            {data.country === 'India' ? 'INR' : data.country === 'United States' ? '$' : data.country === 'United Kingdom' ? 'GBP' : 'INR'}
          </span>
          <input
            type="number"
            id="currentBalance"
            value={data.currentBalance}
            onChange={e => { onUpdate({ currentBalance: e.target.value }); setErrors(prev => ({ ...prev, currentBalance: '' })); }}
            className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.currentBalance ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="0"
            min="0"
            step="1"
          />
        </div>
        {errors.currentBalance && <p className="mt-1 text-sm text-red-600">{errors.currentBalance}</p>}
        <p className="mt-1 text-xs text-gray-400">Your current account balance for accurate tracking.</p>
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-1">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 bg-gray-100 text-gray-800 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-md border-b-4 border-blue-700 active:border-b-0 active:mt-1"
          >
            Continue
          </button>
        </div>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            <SkipForward size={14} />
            Skip for now - I'll add a bank account later
          </button>
        )}
      </div>
    </form>
  );
};
