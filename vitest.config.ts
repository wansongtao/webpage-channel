import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom', // 关键：模拟浏览器环境
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,js}']
  }
});
