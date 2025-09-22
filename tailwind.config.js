/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {},
  },
  // Disable preflight to avoid conflicts with Ionic's CSS reset
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
