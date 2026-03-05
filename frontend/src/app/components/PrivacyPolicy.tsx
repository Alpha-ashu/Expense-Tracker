import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
    onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <button
                    onClick={onBack}
                    className="flex items-center text-blue-600 hover:text-blue-800 mb-6 font-medium"
                >
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                </button>

                <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

                <div className="prose prose-blue max-w-none text-gray-700 space-y-4">
                    <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
                    <p>
                        At Finora, we collect information that you directly provide to us when creating an account, including your name, email address, and encrypted financial data (such as transactions, budgets, and accounts).
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. How We Use Your Information</h2>
                    <p>
                        We use the information we collect to provide, maintain, and improve our services. Your financial data is securely encrypted, and we prioritize your privacy to ensure that only you can access your personal financial information.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Data Security</h2>
                    <p>
                        We implement advanced encryption standard (AES) algorithms to secure your data both in transit and at rest. Your Security PIN acts as an encryption key, meaning we cannot read your sensitive financial data without it.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Sharing of Information</h2>
                    <p>
                        We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information regarding visitors and users with our business partners.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us at privacy@finora.app.
                    </p>
                </div>
            </div>
        </div>
    );
};
