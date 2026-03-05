import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface TermsOfServiceProps {
    onBack: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
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

                <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>

                <div className="prose prose-blue max-w-none text-gray-700 space-y-4">
                    <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Agreement to Terms</h2>
                    <p>
                        By accessing or using Finora, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, then you may not access our service.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
                    <p>
                        Finora is a personal financial management platform that allows users to track expenses, manage budgets, set financial goals, and monitor investments. We offer tools designed to help you organize your financial life securely.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
                    <p>
                        When you create an account with us, you must provide information that is accurate, complete, and current. You are responsible for safeguarding the password and the Security PIN you use to access the service. You agree not to disclose your passwords to any third party.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. Intellectual Property</h2>
                    <p>
                        The Service and its original content, features, and functionality are and will remain the exclusive property of Finora and its licensors. The service is protected by copyright, trademark, and other laws.
                    </p>

                    <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. Disclaimer</h2>
                    <p>
                        Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We provide information for tracking purposes and do not offer professional financial advice. Always consult with a certified financial advisor before making significant financial decisions.
                    </p>
                </div>
            </div>
        </div>
    );
};
