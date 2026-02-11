import React from 'react';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { ResponsiveGrid } from '@/components/ui/ResponsiveGrid';
import { ResponsiveText } from '@/components/ui/ResponsiveText';
import { useResponsive } from '@/hooks/useResponsive';

export const ResponsiveDemo: React.FC = () => {
  const { breakpoint, screenSize, isMobile, isDesktop } = useResponsive();

  return (
    <ResponsiveContainer>
      {/* Current Device Info */}
      <div className="mb-8 p-6 bg-card-bg rounded-lg shadow-md">
        <ResponsiveText size="2xl" weight="bold" align="center">
          Responsive Design Demo
        </ResponsiveText>
        <div className="mt-4 text-center">
          <p className="responsive-text-base">
            Current Breakpoint: <span className="font-bold text-blue-600">{breakpoint}</span>
          </p>
          <p className="responsive-text-sm">
            Screen Size: <span className="font-mono">{screenSize.width} x {screenSize.height}</span>
          </p>
          <div className="mt-2 flex justify-center gap-4">
            <span className={`px-3 py-1 rounded ${isMobile ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
              Mobile: {isMobile ? 'Yes' : 'No'}
            </span>
            <span className={`px-3 py-1 rounded ${isDesktop ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
              Desktop: {isDesktop ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Typography Demo */}
      <div className="mb-8 p-6 bg-card-bg rounded-lg shadow-md">
        <ResponsiveText size="xl" weight="semibold">
          Responsive Typography
        </ResponsiveText>
        <div className="mt-4 space-y-4">
          <ResponsiveText size="3xl">Extra Large Text (3xl)</ResponsiveText>
          <ResponsiveText size="2xl">Large Text (2xl)</ResponsiveText>
          <ResponsiveText size="xl">Extra Large Text (xl)</ResponsiveText>
          <ResponsiveText size="lg">Large Text (lg)</ResponsiveText>
          <ResponsiveText size="base">Base Text (base)</ResponsiveText>
          <ResponsiveText size="sm">Small Text (sm)</ResponsiveText>
          <ResponsiveText size="xs">Extra Small Text (xs)</ResponsiveText>
        </div>
      </div>

      {/* Responsive Grid Demo */}
      <div className="mb-8 p-6 bg-card-bg rounded-lg shadow-md">
        <ResponsiveText size="xl" weight="semibold">
          Responsive Grid Layout
        </ResponsiveText>
        <ResponsiveGrid gap="md" minColWidth="280px">
          {['Card 1', 'Card 2', 'Card 3', 'Card 4'].map((card, index) => (
            <div key={index} className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border border-blue-200">
              <ResponsiveText size="lg" weight="semibold" align="center">
                {card}
              </ResponsiveText>
              <ResponsiveText size="sm" align="center" className="mt-2">
                This card adapts to screen size automatically
              </ResponsiveText>
            </div>
          ))}
        </ResponsiveGrid>
      </div>

      {/* Responsive Spacing Demo */}
      <div className="mb-8 p-6 bg-card-bg rounded-lg shadow-md">
        <ResponsiveText size="xl" weight="semibold">
          Responsive Spacing
        </ResponsiveText>
        <div className="mt-4 space-y-4">
          <div className="responsive-p-2 bg-blue-100 rounded">
            <ResponsiveText>Small padding (responsive-p-2)</ResponsiveText>
          </div>
          <div className="responsive-p-4 bg-green-100 rounded">
            <ResponsiveText>Medium padding (responsive-p-4)</ResponsiveText>
          </div>
          <div className="responsive-p-6 bg-purple-100 rounded">
            <ResponsiveText>Large padding (responsive-p-6)</ResponsiveText>
          </div>
        </div>
      </div>

      {/* Device-Specific Content */}
      <div className="p-6 bg-card-bg rounded-lg shadow-md">
        <ResponsiveText size="xl" weight="semibold">
          Device-Specific Content
        </ResponsiveText>
        
        {/* Mobile Only Content */}
        <div className="mobile-only mt-4 p-4 bg-yellow-100 rounded">
          <ResponsiveText align="center">
            📱 This content only appears on mobile devices
          </ResponsiveText>
        </div>

        {/* Desktop Only Content */}
        <div className="desktop-only mt-4 p-4 bg-indigo-100 rounded">
          <ResponsiveText align="center">
            🖥️ This content only appears on desktop devices
          </ResponsiveText>
        </div>
      </div>

      {/* Safe Area Demo */}
      <div className="mt-8 p-6 bg-card-bg rounded-lg shadow-md safe-area-inset-bottom">
        <ResponsiveText size="xl" weight="semibold">
          Safe Area Support
        </ResponsiveText>
        <ResponsiveText className="mt-4">
          This content respects safe areas on devices with notches (iPhone X+)
        </ResponsiveText>
      </div>
    </ResponsiveContainer>
  );
};

export default ResponsiveDemo;
