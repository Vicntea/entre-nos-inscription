This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Fondos animados (assets pre-renderizados)

Los fondos del hero son imágenes **WebP animadas** con los efectos ya horneados
dentro del archivo (escala de grises + contraste + brillo + glitch), servidas con
`<picture>` y un **GIF estático** de respaldo. Así el navegador ya no aplica
`filter` ni anima `drop-shadow` sobre una capa a pantalla completa, que era lo
que consumía CPU.

Se regeneran con:

```bash
npm run assets:fondos                 # los 5 (webp + gif de respaldo)
python scripts/generar-fondos.py --limit 1
python scripts/generar-fondos.py --quality 55 --frame-ms 150
python scripts/generar-fondos.py --no-gif
```

El script descarga las fotos de Unsplash, las procesa con Pillow y escribe
`public/images/backgrounds/bg-0X.webp|gif`. Las descargas quedan cacheadas en
`.cache/fondos/` (ignorado por git).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
