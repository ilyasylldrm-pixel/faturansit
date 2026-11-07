import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isHmrDisabled
        ? [
            {
              name: 'disable-vite-client-ws',
              enforce: 'post' as const,
              transform(code: string, id: string) {
                if (id.includes('vite/dist/client/client.mjs')) {
                  return {
                    code: code.replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* HMR websocket disabled */'
                    ),
                    map: null,
                  };
                }
              },
            },
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
