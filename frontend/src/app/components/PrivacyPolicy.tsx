import React from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { Shield } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <PageHeader
          title="Privacy Policy"
          showBack
          backTo="settings"
          onBack={onBack}
          icon={<Shield size={24} />}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass p-6 space-y-6"
        >
          <p className="text-sm text-gray-500">Last updated: January 2025</p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Information We Collect</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We collect information you provide directly to us when creating an account, including
              your name, email address, and encrypted financial data such as transactions, budgets,
              and accounts.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. How We Use Your Information</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Your financial data is used solely to power the app's features — expense tracking,
              budget analysis, loan management, and goal tracking. We do not sell or share your
              personal financial information with third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Data Security</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We implement industry-standard encryption to secure your data both in transit and at
              rest. Your Security PIN acts as an encryption key, meaning we cannot read your
              sensitive financial data without it.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Sharing of Information</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We do not sell, trade, or rent your personal information to others. Aggregated,
              anonymised statistics may be used to improve the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Data Retention</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We retain your data for as long as your account is active. You can delete your data
              at any time via Settings → Data Management.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Contact</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              If you have questions about this privacy policy, please contact us through the app's
              support channel.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
};
