
export interface BankInfo {
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  initials: string;
  type: string;
}

export const BANKS_BY_COUNTRY: Record<string, BankInfo[]> = {
  India: [
    { name: 'State Bank of India', shortName: 'SBI', color: '#2563eb', textColor: '#fff', initials: 'SBI', type: 'Public Sector' },
    { name: 'HDFC Bank', shortName: 'HDFC', color: '#1e40af', textColor: '#fff', initials: 'HDFC', type: 'Private Sector' },
    { name: 'ICICI Bank', shortName: 'ICICI', color: '#ea580c', textColor: '#fff', initials: 'ICICI', type: 'Private Sector' },
    { name: 'Axis Bank', shortName: 'AXIS', color: '#9d174d', textColor: '#fff', initials: 'AXIS', type: 'Private Sector' },
    { name: 'Kotak Mahindra Bank', shortName: 'Kotak', color: '#dc2626', textColor: '#fff', initials: 'KMB', type: 'Private Sector' },
    { name: 'Standard Chartered', shortName: 'StanC', color: '#15803d', textColor: '#fff', initials: 'SC', type: 'Private Sector' },
    { name: 'HSBC India', shortName: 'HSBC', color: '#be123c', textColor: '#fff', initials: 'HSBC', type: 'Private Sector' },
    { name: 'IDFC First Bank', shortName: 'IDFC', color: '#9f1239', textColor: '#fff', initials: 'IDFC', type: 'Private Sector' },
    { name: 'Punjab National Bank', shortName: 'PNB', color: '#831843', textColor: '#fff', initials: 'PNB', type: 'Public Sector' },
    { name: 'Bank of Baroda', shortName: 'BOB', color: '#f97316', textColor: '#fff', initials: 'BOB', type: 'Public Sector' },
    { name: 'Canara Bank', shortName: 'Canara', color: '#0369a1', textColor: '#fff', initials: 'CNB', type: 'Public Sector' },
    { name: 'Union Bank of India', shortName: 'UBI', color: '#1d4ed8', textColor: '#fff', initials: 'UBI', type: 'Public Sector' },
    { name: 'IndusInd Bank', shortName: 'IndusInd', color: '#7c2d12', textColor: '#fff', initials: 'IND', type: 'Private Sector' },
    { name: 'Yes Bank', shortName: 'YES', color: '#2563eb', textColor: '#fff', initials: 'YES', type: 'Private Sector' },
    { name: 'Federal Bank', shortName: 'Federal', color: '#1e40af', textColor: '#fff', initials: 'FED', type: 'Private Sector' },
    { name: 'RBL Bank', shortName: 'RBL', color: '#b91c1c', textColor: '#fff', initials: 'RBL', type: 'Private Sector' },
    { name: 'Paytm Payments Bank', shortName: 'Paytm', color: '#00BAF2', textColor: '#fff', initials: 'PTM', type: 'Payments Bank' },
    { name: 'Airtel Payments Bank', shortName: 'Airtel', color: '#E40000', textColor: '#fff', initials: 'APB', type: 'Payments Bank' },
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
  ],
  'United Kingdom': [
    { name: 'Barclays', shortName: 'Barclays', color: '#00AEEF', textColor: '#fff', initials: 'BRC', type: 'High Street Bank' },
    { name: 'HSBC UK', shortName: 'HSBC', color: '#DB0011', textColor: '#fff', initials: 'HSBC', type: 'High Street Bank' },
    { name: 'Lloyds Bank', shortName: 'Lloyds', color: '#024731', textColor: '#fff', initials: 'LBG', type: 'High Street Bank' },
    { name: 'NatWest', shortName: 'NatWest', color: '#42145F', textColor: '#fff', initials: 'NW', type: 'High Street Bank' },
    { name: 'Santander UK', shortName: 'Santander', color: '#EC0000', textColor: '#fff', initials: 'SAN', type: 'High Street Bank' },
    { name: 'Monzo', shortName: 'Monzo', color: '#FF5F5D', textColor: '#fff', initials: 'MNZ', type: 'Digital Bank' },
    { name: 'Starling Bank', shortName: 'Starling', color: '#6935D3', textColor: '#fff', initials: 'STR', type: 'Digital Bank' },
  ],
  Default: [
    { name: 'Primary Local Bank', shortName: 'Local', color: '#6B7280', textColor: '#fff', initials: 'BNK', type: 'Bank' },
    { name: 'International Bank', shortName: 'Intl', color: '#374151', textColor: '#fff', initials: 'INT', type: 'Bank' },
  ],
};
