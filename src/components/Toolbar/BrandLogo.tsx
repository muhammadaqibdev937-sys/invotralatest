import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  compact = false,
  size = 'md',
}) => {
  const iconDim = size === 'lg' ? 42 : size === 'sm' ? 32 : 36;

  return (
    <span className="inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 text-[#111111] dark:text-[#F5F5F5]">
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 44 44"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Architectural double arch / stationery card silhouette */}
        <path
          d="M8 20C8 11.716 14.268 5 22 5C29.732 5 36 11.716 36 20V37C36 38.105 35.105 39 34 39H10C8.895 39 8 38.105 8 37V20Z"
          stroke="currentColor"
          strokeWidth="1.45"
        />
        <path
          d="M11.2 20.4C11.2 13.7 16.035 8.2 22 8.2C27.965 8.2 32.8 13.7 32.8 20.4V35.8H11.2V20.4Z"
          className="stroke-[#71717A] dark:stroke-[#999999]"
          strokeWidth="0.7"
          strokeOpacity="0.45"
        />

        {/* Sculpted calligraphy nib forming a refined "I" monogram */}
        <path
          d="M22 12.2L27.2 20.6L24.5 29.2H19.5L16.8 20.6L22 12.2Z"
          className="fill-[#52525B] dark:fill-[#C0C0C0]"
        />
        {/* Crisp ink slit & breather hole */}
        <line
          x1="22"
          y1="12.5"
          x2="22"
          y2="21.2"
          className="stroke-white dark:stroke-[#101010]"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <circle cx="22" cy="22.4" r="1.45" className="fill-white dark:fill-[#101010]" />

        {/* Serif base hairline */}
        <line
          x1="17.5"
          y1="31.4"
          x2="26.5"
          y2="31.4"
          className="stroke-[#27272A] dark:stroke-[#E5E5E5]"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>

      {!compact && (
        <span className="inline-flex items-baseline leading-none">
          <span
            className={
              size === 'lg'
                ? 'text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-[#111111] dark:text-[#F5F5F5]'
                : 'text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] text-[#111111] dark:text-[#F5F5F5]'
            }
            style={{
              fontFamily: '"Cormorant Garamond", serif',
            }}
          >
            Invitora
          </span>
        </span>
      )}
    </span>
  );
};
