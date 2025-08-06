/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,svelte}',
  ],
  theme: {
    extend: {
      colors: {
        // 緊急性スコア用のグラデーションカラー
        urgency: {
          low: '#3B82F6',    // blue-500
          medium: '#F59E0B', // amber-500
          high: '#EF4444',   // red-500
        }
      }
    },
  },
  plugins: [],
}