"use client";

import { useEffect, useRef } from "react";

const IMAGES = [
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=2200&q=85",
  "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=2200&q=85",
];

export const IMAGE_COUNT = IMAGES.length;

const CHANGE_INTERVAL = 6000;
const GLITCH_DURATION = 850;
const RANDOM_GLITCH_INTERVAL = 4500;

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

    let current = 0;
    let showingA = true;
    const timeouts: number[] = [];

    imageA.style.backgroundImage = `url("${IMAGES[0]}")`;

    const addGlitch = (element: HTMLDivElement, duration = GLITCH_DURATION) => {
      element.classList.add("glitch");
      const timeout = window.setTimeout(() => {
        element.classList.remove("glitch");
      }, duration);
      timeouts.push(timeout);
    };

    const changeImage = () => {
      current = (current + 1) % IMAGES.length;
      const nextImage = showingA ? imageB : imageA;
      const currentImage = showingA ? imageA : imageB;

      nextImage.style.backgroundImage = `url("${IMAGES[current]}")`;

      // Glitch en ambas capas durante la transición
      addGlitch(currentImage);
      addGlitch(nextImage);
      nextImage.classList.remove("next");

      const timeout = window.setTimeout(() => {
        currentImage.classList.add("next");
        showingA = !showingA;
      }, GLITCH_DURATION);
      timeouts.push(timeout);

      onImageChange?.(current);
    };

    const changeInterval = window.setInterval(changeImage, CHANGE_INTERVAL);

    // Glitch aleatorio temporizado sobre la imagen activa
    const randomGlitchInterval = window.setInterval(() => {
      if (Math.random() > 0.5) {
        addGlitch(showingA ? imageA : imageB);
      }
    }, RANDOM_GLITCH_INTERVAL);

    return () => {
      window.clearInterval(changeInterval);
      window.clearInterval(randomGlitchInterval);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [onImageChange]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#111]" aria-hidden="true">
      <div ref={imageARef} className="bg-image" />
      <div ref={imageBRef} className="bg-image next" />
      <div className="bg-vignette" />
    </div>
  );
}
