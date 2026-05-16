import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'happy-dom', // 关键：模拟浏览器环境
    globals: true,
    include: [
      'src/**/*.{test,spec}.{ts,js}',
      'test/**/*.{test,spec}.{ts,js}'
    ]
  }
});
