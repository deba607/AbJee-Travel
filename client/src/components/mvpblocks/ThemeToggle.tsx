import React from 'react';

export default function ThemeToggle() {
  const toggleTheme = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');

    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="rounded px-4 py-2 bg-gray-300 dark:bg-gray-700 text-black dark:text-white m-20"
    >
      Toggle Theme
    </button>
  );
}
