import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleSwitchProps {
  compact?: boolean;
}

export const ThemeToggleSwitch: React.FC<ThemeToggleSwitchProps> = ({ compact = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-md border border-[#E4E4E7] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515] hover:bg-[#E4E4E7] dark:hover:bg-[#252525] hover:border-[#A1A1AA] dark:hover:border-[#C0C0C0] cursor-pointer transition-colors shrink-0 whitespace-nowrap ${
        compact ? 'h-8 px-2' : 'h-10 sm:h-9 px-2.5'
      }`}
    >
      <Sun
        className={`w-3.5 h-3.5 transition-colors ${
          !isDark ? 'text-[#111111]' : 'text-[#737373]'
        }`}
        aria-hidden="true"
      />
      <span
        className={`relative inline-flex items-center w-8 h-4 rounded-full transition-colors duration-150 ${
          isDark ? 'bg-[#3A3A3A]' : 'bg-[#D4D4D8]'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 rounded-full bg-[#18181B] dark:bg-[#F5F5F5] transform transition-transform duration-150 ${
            isDark ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <Moon
        className={`w-3.5 h-3.5 transition-colors ${
          isDark ? 'text-[#F5F5F5]' : 'text-[#71717A]'
        }`}
        aria-hidden="true"
      />
      {!compact && (
        <span className="hidden xl:inline text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
};
