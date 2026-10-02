"use client";

import { useEffect, useRef } from "react";

/**
 * Fondos pre-renderizados con `scripts/generar-fondos.py`: el asset ya trae
 * horneados el gris, el contraste, el brillo y el glitch, así que el navegador
 * NO aplica `filter` ni anima `drop-shadow` sobre una capa a pantalla completa
 * (que era lo que comía CPU). El WebP animado es el formato principal; el GIF
 * es el respaldo para navegadores sin WebP animado.
 */
const BACKGROUNDS = ["bg-01", "bg-02", "bg-03", "bg-04", "bg-05"];

export const IMAGE_COUNT = BACKGROUNDS.length;

const CHANGE_INTERVAL = 6000;

const webpSrc = (name: string) => `/images/backgrounds/${name}.webp`;
const gifSrc = (name: string) => `/images/backgrounds/${name}.gif`;

type BackgroundProps = {
  onImageChange?: (index: number) => void;
};

export default function Background({ onImageChange }: BackgroundProps) {
  const imageARef = useRef<HTMLDivElement | null>(null);
  const imageBRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const imageA = imageARef.current;
    const imageB = imageBRef.current;
    if (!imageA || !imageB) return;

    // Cambia el fondo de una capa: el `<source>` elige el WebP animado y el
    // `<img>` queda como respaldo para navegadores sin WebP animado.
    const setSource = (layer: HTMLDivElement, name: string) => {
      const picture = layer.firstElementChild;
      if (!(picture instanceof HTMLPictureElement)) return;
      const source = picture.querySelector<HTMLSourceElement>("source");
      const img = picture.querySelector<HTMLImageElement>("img");
      if (source) source.srcset = webpSrc(name);
      if (img) img.src = gifSrc(name);
    };

    // Precalienta el cache (con retraso, para no competir con la primera
    // pintura). Sin esto, la primera vuelta completa muestra un salto.
    const preloadTimer = window.setTimeout(() => {
      const supportsWebp = document
        .createElement("canvas")
        .toDataURL("image/webp")
        .startsWith("data:image/webp");

      BACKGROUNDS.forEach((name) => {
        const preload = new Image();
        preload.src = supportsWebp ? webpSrc(name) : gifSrc(name);
      });
    }, 1500);

    let current = 0;
    let showingA = true;

    const changeImage = () => {
      current = (current + 1) % BACKGROUNDS.length;

      // La capa que entra trae el fondo nuevo; la que sale se desvanece.
      // (Ojo: la capa entrante siempre se pinta encima o debajo según cuál
      // sea, y en ambos casos el cruce de `opacity` da el crossfade.)
      const incoming = showingA ? imageB : imageA;
      const outgoing = showingA ? imageA : imageB;

      setSource(incoming, BACKGROUNDS[current]);
      incoming.classList.remove("next");
      outgoing.classList.add("next");
      showingA = !showingA;

      onImageChange?.(current);
    };

    const interval = window.setInterval(changeImage, CHANGE_INTERVAL);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(preloadTimer);
    };
  }, [onImageChange]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#111]" aria-hidden="true">
      <div ref={imageARef} className="bg-image">
        <picture>
          <source type="image/webp" srcSet={webpSrc(BACKGROUNDS[0])} />
          <img src={gifSrc(BACKGROUNDS[0])} alt="" />
        </picture>
      </div>

      <div ref={imageBRef} className="bg-image next">
        <picture>
          <source type="image/webp" srcSet={webpSrc(BACKGROUNDS[1])} />
          <img src={gifSrc(BACKGROUNDS[1])} alt="" />
        </picture>
      </div>

      <div className="bg-vignette" />
    </div>
  );
}
