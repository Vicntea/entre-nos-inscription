"use client";

import { useEffect, useRef } from "react";

const INFLUENCE_RADIUS = 220;
const SMOOTHING = 0.12; // Interpolación por frame (0 = quieto, 1 = instantáneo)

export default function Logo() {
  const logoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;

    // Estado suavizado con lerp dentro del rAF (sin transición CSS: la
    // transición sobre un transform actualizado por evento era lo que se
    // sentía "pegajoso" y forzaba un recálculo de estilo por cada movimiento).
    let offsetX = 0;
    let offsetY = 0;
    let rotation = 0;
    let pointerX = 0;
    let pointerY = 0;
    let hasPointer = false;
    let animationFrameId = 0;
    let animating = false;

    // El rect se cachea: leer getBoundingClientRect() en cada pointermove
    // provocaba un layout sincrónico por evento.
    let rect = logo.getBoundingClientRect();

    const measure = () => {
      rect = logo.getBoundingClientRect();
      startLoop();
    };

    const applyTransform = () => {
      logo.style.transform = `translate(calc(-50% + ${offsetX.toFixed(2)}px), calc(-50% + ${offsetY.toFixed(2)}px)) rotate(${rotation.toFixed(3)}deg)`;
    };

    const animate = () => {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = pointerX - centerX;
      const dy = pointerY - centerY;
      const distance = Math.hypot(dx, dy);

      let targetX = 0;
      let targetY = 0;
      let targetRotation = 0;

      // Movimiento sutil hacia el mouse solo cuando está cerca
      if (hasPointer && distance < INFLUENCE_RADIUS) {
        const intensity = (INFLUENCE_RADIUS - distance) / INFLUENCE_RADIUS;
        targetX = dx * intensity * 0.03;
        targetY = dy * intensity * 0.03;
        targetRotation = dx * intensity * 0.012;
      }

      offsetX += (targetX - offsetX) * SMOOTHING;
      offsetY += (targetY - offsetY) * SMOOTHING;
      rotation += (targetRotation - rotation) * SMOOTHING;

      const settled =
        Math.abs(targetX - offsetX) < 0.02 &&
        Math.abs(targetY - offsetY) < 0.02 &&
        Math.abs(targetRotation - rotation) < 0.001;

      if (settled) {
        // Se fija el valor final y el loop se detiene: no queda un rAF vivo
        // gastando batería cuando el logo ya está quieto.
        offsetX = targetX;
        offsetY = targetY;
        rotation = targetRotation;
        applyTransform();
        animating = false;
        return;
      }

      applyTransform();
      animationFrameId = requestAnimationFrame(animate);
    };

    function startLoop() {
      if (animating) return;
      animating = true;
      animationFrameId = requestAnimationFrame(animate);
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointer = true;
      startLoop();
    };

    // En pantallas táctiles no hay puntero que seguir: el logo queda quieto y
    // nos ahorramos el listener y el rAF (batería en el celular).
    const hayPuntero = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (hayPuntero) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      animating = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={logoRef}
      className="logo pointer-events-none fixed left-1/2 top-1/2 z-20 flex aspect-square w-[min(38vw,390px)] min-w-[270px] items-center justify-center bg-[#f4f1eb] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_20px_80px_rgba(0,0,0,0.25)]"
    >
      <h1 className="scale-x-95 text-center font-serif text-[clamp(50px,7vw,92px)] font-black leading-[0.76] tracking-tighter text-black">
        <span>EN</span>
        <span className="block">TRE</span>
        <span className="block">NOS</span>
      </h1>
    </div>
  );
}
