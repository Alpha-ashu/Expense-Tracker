import React from 'react';

export const FinoraLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Outer yellow border */}
        <circle cx="50" cy="50" r="48" fill="#FDE047" />
        {/* Inner background - lighter yellow on top-left, darker orange on bottom-right */}
        <circle cx="50" cy="50" r="42" fill="#FBBF24" />
        {/* Diagonal darker shading for 3D effect */}
        <path
            d="M20.3 79.7 A 42 42 0 0 0 79.7 20.3 L92 50 A 42 42 0 0 1 50 92 Z"
            fill="#F59E0B"
            clipPath="url(#inner-circle)"
        />
        <clipPath id="inner-circle">
            <circle cx="50" cy="50" r="42" />
        </clipPath>
        <path
            d="M 8 8 L 92 92 L 92 8 L 8 92"
            stroke="none"
            fill="none"
        />
        {/* Diagonal darker orange shadow */}
        <path
            d="M 20.3 20.3 L 79.7 79.7 L 79.7 20.3 Z"
            fill="#EA580C"
            clipPath="url(#inner-circle)"
            opacity="0.8"
        />
        {/* Dollar Sign */}
        <text
            x="50"
            y="54"
            fontFamily="Arial, sans-serif"
            fontSize="58"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            dominantBaseline="middle"
        >
            $
        </text>
    </svg>
);
