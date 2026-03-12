import React from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { FileText } from 'lucide-react';

export const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <PageHeader
          title="Terms & Conditions"
          showBack
          backTo="settings"
          icon={<FileText size={24} />}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[30px] overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 shadow-glass p-6 space-y-6"
        >
          <p className="text-sm text-gray-500">Last updated: January 2025</p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Acceptance of Terms</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              By accessing and using this application, you accept and agree to be bound by these
              Terms and Conditions. If you do not agree to these terms, please do not use the app.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Use of the Service</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              This app is provided for personal financial management purposes only. You agree to
              use the service responsibly and not to misuse or attempt to gain unauthorized access
              to any part of the system.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Account Responsibility</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials
              and PIN. You are liable for all actions taken under your account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Financial Data Disclaimer</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              The app provides tools for tracking and analyzing your finances. It does not
              constitute financial advice. Always consult a qualified financial advisor for major
              financial decisions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Limitation of Liability</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We are not liable for any loss or damage arising from your use of the app, including
              but not limited to data loss, financial decisions made based on app data, or service
              interruptions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Changes to Terms</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We reserve the right to update these terms at any time. Continued use of the app
              after changes are posted constitutes your acceptance of the updated terms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Contact</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              For questions about these terms, please contact us through the app's support channel.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
};
