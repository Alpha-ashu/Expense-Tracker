import React from 'react';
import { 
  AutoContainer, 
  AutoGrid, 
  AutoCard, 
  AutoText, 
  AutoButton, 
  AutoIcon, 
  AutoFlex,
  AutoChart 
} from '@/components/ui/AutoSizing';
import { TrendingUp, Wallet, CreditCard } from 'lucide-react';

export const AutoSizingDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <AutoContainer size="normal">
        <AutoFlex direction="column" align="center" gap="3">
          <AutoText size="3xl" as="h1" className="text-center font-bold text-gray-900">
            Auto-Sizing Demo
          </AutoText>
          <AutoText size="base" as="p" className="text-center text-gray-600 max-w-2xl">
            This demo shows how components automatically resize for all devices without changing layout structure.
          </AutoText>
        </AutoFlex>
      </AutoContainer>

      {/* Stats Cards */}
      <AutoContainer size="normal">
        <AutoGrid density="normal" columns="auto">
          <AutoCard size="normal" height="medium" className="bg-white rounded-lg shadow-md p-6">
            <AutoFlex direction="column" gap="2">
              <AutoIcon size="lg" icon={<TrendingUp className="text-blue-600" />} />
              <AutoText size="lg" as="h3" className="font-semibold text-gray-900">
                Total Balance
              </AutoText>
              <AutoText size="2xl" as="p" className="font-bold text-blue-600">
                $12,450.00
              </AutoText>
              <AutoText size="sm" className="text-gray-500">
                +12.5% from last month
              </AutoText>
            </AutoFlex>
          </AutoCard>

          <AutoCard size="normal" height="medium" className="bg-white rounded-lg shadow-md p-6">
            <AutoFlex direction="column" gap="2">
              <AutoIcon size="lg" icon={<Wallet className="text-green-600" />} />
              <AutoText size="lg" as="h3" className="font-semibold text-gray-900">
                Monthly Income
              </AutoText>
              <AutoText size="2xl" as="p" className="font-bold text-green-600">
                $5,200.00
              </AutoText>
              <AutoText size="sm" className="text-gray-500">
                +8.2% from last month
              </AutoText>
            </AutoFlex>
          </AutoCard>

          <AutoCard size="normal" height="medium" className="bg-white rounded-lg shadow-md p-6">
            <AutoFlex direction="column" gap="2">
              <AutoIcon size="lg" icon={<CreditCard className="text-red-600" />} />
              <AutoText size="lg" as="h3" className="font-semibold text-gray-900">
                Monthly Expenses
              </AutoText>
              <AutoText size="2xl" as="p" className="font-bold text-red-600">
                $3,150.00
              </AutoText>
              <AutoText size="sm" className="text-gray-500">
                -5.1% from last month
              </AutoText>
            </AutoFlex>
          </AutoCard>
        </AutoGrid>
      </AutoContainer>

      {/* Action Buttons */}
      <AutoContainer size="normal">
        <AutoFlex direction="row" justify="center" gap="3" wrap>
          <AutoButton size="normal" variant="primary">
            Add Transaction
          </AutoButton>
          <AutoButton size="normal" variant="secondary">
            View Reports
          </AutoButton>
          <AutoButton size="normal" variant="outline">
            Export Data
          </AutoButton>
        </AutoFlex>
      </AutoContainer>

      {/* Feature Grid */}
      <AutoContainer size="normal">
        <AutoText size="xl" as="h2" className="text-center font-bold text-gray-900 mb-6">
          Auto-Sizing Features
        </AutoText>
        
        <AutoGrid density="compact" columns="auto">
          <AutoCard size="compact" height="min" className="bg-blue-50 rounded-lg p-4">
            <AutoText size="base" as="h3" className="font-semibold text-blue-900 mb-2">
              Fluid Typography
            </AutoText>
            <AutoText size="sm" className="text-blue-700">
              Text scales smoothly using CSS clamp() functions
            </AutoText>
          </AutoCard>

          <AutoCard size="compact" height="min" className="bg-green-50 rounded-lg p-4">
            <AutoText size="base" as="h3" className="font-semibold text-green-900 mb-2">
              Responsive Grids
            </AutoText>
            <AutoText size="sm" className="text-green-700">
              Auto-fit columns that adapt to screen size
            </AutoText>
          </AutoCard>

          <AutoCard size="compact" height="min" className="bg-purple-50 rounded-lg p-4">
            <AutoText size="base" as="h3" className="font-semibold text-purple-900 mb-2">
              Adaptive Heights
            </AutoText>
            <AutoText size="sm" className="text-purple-700">
              Heights based on viewport units
            </AutoText>
          </AutoCard>

          <AutoCard size="compact" height="min" className="bg-orange-50 rounded-lg p-4">
            <AutoText size="base" as="h3" className="font-semibold text-orange-900 mb-2">
              Touch Optimized
            </AutoText>
            <AutoText size="sm" className="text-orange-700">
              Mobile-friendly button sizes
            </AutoText>
          </AutoCard>
        </AutoGrid>
      </AutoContainer>

      {/* Chart Example */}
      <AutoContainer size="normal">
        <AutoText size="xl" as="h2" className="text-center font-bold text-gray-900 mb-6">
          Auto-Sized Chart
        </AutoText>
        
        <AutoCard size="normal" height="large" className="bg-white rounded-lg shadow-md p-6">
          <AutoChart size="normal">
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
              <AutoFlex direction="column" align="center" gap="2">
                <AutoIcon size="xl" icon={<TrendingUp className="text-gray-400" />} />
                <AutoText size="base" className="text-gray-500">
                  Chart Area (Auto-Sized)
                </AutoText>
                <AutoText size="sm" className="text-gray-400">
                  Height: clamp(200px, 40vh, 400px)
                </AutoText>
              </AutoFlex>
            </div>
          </AutoChart>
        </AutoCard>
      </AutoContainer>

      {/* Size Comparison */}
      <AutoContainer size="normal">
        <AutoText size="xl" as="h2" className="text-center font-bold text-gray-900 mb-6">
          Size Comparison
        </AutoText>
        
        <AutoFlex direction="column" gap="4">
          <AutoCard size="compact" className="bg-gray-100 rounded-lg p-4">
            <AutoText size="sm" className="text-gray-600 font-medium">Compact Size</AutoText>
          </AutoCard>
          
          <AutoCard size="normal" className="bg-gray-100 rounded-lg p-4">
            <AutoText size="base" className="text-gray-600 font-medium">Normal Size</AutoText>
          </AutoCard>
          
          <AutoCard size="spacious" className="bg-gray-100 rounded-lg p-4">
            <AutoText size="lg" className="text-gray-600 font-medium">Spacious Size</AutoText>
          </AutoCard>
        </AutoFlex>
      </AutoContainer>
    </div>
  );
};
