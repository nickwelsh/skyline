import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/skyline/",
  plugins: [react(), tailwindcss()],
  server: { port: 4173 },
});
