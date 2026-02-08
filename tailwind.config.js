/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'tet-red': '#D72638',
                'tet-gold': '#FFD700',
                'tet-yellow': '#F4D35E',
                'tet-dark-red': '#8B0000',
            }
        },
    },
    plugins: [],
}
