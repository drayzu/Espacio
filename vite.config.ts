import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        laboratorio: 'laboratorio.html',
        estudio: 'estudio.html',
        mundos: 'mundos.html',
        transicion: 'transicion.html',
        ascenso: 'ascenso.html',
      },
    },
  },
});
