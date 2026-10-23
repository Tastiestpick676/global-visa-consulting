// components/ui/BrandLogo.tsx
"use client";

import { useState } from "react";

interface BrandLogoProps {
  className?: string;
  iconOnly?: boolean;
  theme?: "light" | "dark";
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

const LOGO_CANDIDATES = [
  "/Logo.png",
  "/logo.png",
  "/icon.png",
  "/icon.jpg",
  "/logo.svg",
];

export function BrandLogoIcon({
  className = "h-10 w-10",
}: {
  className?: string;
}) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [useVectorFallback, setUseVectorFallback] = useState(false);

  const handleImageError = () => {
    if (candidateIdx < LOGO_CANDIDATES.length - 1) {
      setCandidateIdx((prev) => prev + 1);
    } else {
      setUseVectorFallback(true);
    }
  };

  if (useVectorFallback) {
    return (
      <svg
        viewBox="0 0 120 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <mask id="gvc-fallback-cutout">
            <rect width="120" height="110" fill="white" />
            <path
              d="M 10 74 C 4 95, 36 86, 84 39"
              stroke="black"
              strokeWidth="17"
              strokeLinecap="round"
            />
            <path
              d="M 71 31 L 67 21 L 78 21 L 91 27 L 106 13 C 110 10, 114 14, 111 18 L 97 33 L 103 46 L 95 53 L 84 37 L 78 43 L 80 51 L 73 54 L 69 42 L 60 39 L 63 32 Z"
              fill="black"
              stroke="black"
              strokeWidth="5.5"
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        <g
          mask="url(#gvc-fallback-cutout)"
          stroke="#E11D48"
          strokeWidth="6.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="52" cy="58" r="36" />
          <line x1="52" y1="22" x2="52" y2="94" />
          <path d="M 52 22 C 26 30, 26 86, 52 94" />
          <path d="M 52 22 C 78 30, 78 86, 52 94" />
          <line x1="16" y1="58" x2="88" y2="58" />
          <path d="M 22 39 Q 52 46 82 39" />
          <path d="M 22 77 Q 52 70 82 77" />
        </g>
        <path
          d="M 11.5 64.5 C 4 86, 17 91, 36 80 C 52 71, 68 56, 82 42 C 83.8 40.2, 83.8 37.5, 82 35.8 C 80.2 34, 77.5 34.2, 75.5 36.2 C 61 50.5, 45 64, 30 71.5 C 18.5 77, 13.5 73.5, 14.5 65 C 14.8 63, 12.3 62.5, 11.5 64.5 Z"
          fill="#E11D48"
        />
        <path
          d="M 109.5 13.5 C 111.5 15.5, 110.8 18.8, 108 21.5 L 98 31.5 L 104 47.5 L 98 52.5 L 87.5 38.5 L 79.5 45.5 L 81 53.5 L 76 57.5 L 71.5 47.5 L 61.5 43 L 65.5 38 L 73.5 39.5 L 80.5 31.5 L 66.5 21 L 71.5 15 L 87.5 21 L 97.5 11 C 100.2 8.2, 103.5 7.5, 105.5 9.5 Z"
          fill="#E11D48"
        />
      </svg>
    );
  }

  return (
    <img
      src={LOGO_CANDIDATES[candidateIdx]}
      alt=""
      width={48}
      height={48}
      onError={handleImageError}
      className={`${className} object-contain shrink-0 rounded-lg`}
    />
  );
}

export function BrandLogo({
  className = "",
  iconOnly = false,
  theme = "light",
  subtitle = "CONSULTING",
  size = "md",
}: BrandLogoProps) {
  const titleColor =
    theme === "dark" ? "text-brand-white" : "text-brand-charcoal";
  const subColor =
    theme === "dark" ? "text-white/65" : "text-brand-charcoal/65";

  const iconSizes = {
    sm: "h-9 w-9",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }[size];

  const titleSizes = {
    sm: "text-[15px]",
    md: "text-[18px]",
    lg: "text-[20px]",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
    >
      <BrandLogoIcon className={iconSizes} />
      {!iconOnly && (
        <div className="flex flex-col justify-center">
          <span
            className={`font-display ${titleSizes} font-extrabold tracking-tight leading-none ${titleColor}`}
          >
            GLOBAL VISA
          </span>
          <span
            className={`font-sans text-[9.5px] font-bold tracking-[0.26em] uppercase leading-none mt-1 ${subColor}`}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

export default BrandLogo;