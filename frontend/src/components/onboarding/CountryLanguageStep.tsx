import React, { useState } from 'react';
import { Globe, Languages } from 'lucide-react';

interface CountryLanguageStepProps {
    data: {
        country: string;
        language: string;
    };
    onUpdate: (data: any) => void;
    onNext: () => void;
    onBack: () => void;
}

const COUNTRIES = [
    'India',
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'United Arab Emirates',
    'Singapore',
    'Other',
];

const LANGUAGES = [
    'English',
    'Hindi',
    'Spanish',
    'French',
    'Arabic',
    'Other',
];

export const CountryLanguageStep: React.FC<CountryLanguageStepProps> = ({
    data,
    onUpdate,
    onNext,
    onBack,
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!data.country) {
            newErrors.country = 'Please select a country';
        }

        if (!data.language) {
            newErrors.language = 'Please select a preferred language';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onNext();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                    Region & Language
                </h3>
                <p className="text-sm text-gray-500">
                    Help us customize your experience by setting your location and language.
                </p>
            </div>

            <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Globe size={16} className="text-blue-500" />
                    Country
                </label>
                <select
                    id="country"
                    value={data.country}
                    onChange={(e) => onUpdate({ country: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.country ? 'border-red-500' : 'border-gray-300'
                        }`}
                >
                    <option value="">Select your country</option>
                    {COUNTRIES.map((cty) => (
                        <option key={cty} value={cty}>
                            {cty}
                        </option>
                    ))}
                </select>
                {errors.country && (
                    <p className="mt-1 text-sm text-red-600">{errors.country}</p>
                )}
            </div>

            <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Languages size={16} className="text-blue-500" />
                    Preferred Language
                </label>
                <select
                    id="language"
                    value={data.language}
                    onChange={(e) => onUpdate({ language: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.language ? 'border-red-500' : 'border-gray-300'
                        }`}
                >
                    <option value="">Select your language</option>
                    {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                            {lang}
                        </option>
                    ))}
                </select>
                {errors.language && (
                    <p className="mt-1 text-sm text-red-600">{errors.language}</p>
                )}
            </div>

            <div className="flex space-x-3 mt-8">
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
                    Continue to Bank
                </button>
            </div>
        </form>
    );
};
