"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";

/** Arrastre necesario para desplegar del todo, en fracción del ancho de la hoja */
const PULL_SPAN_RATIO = 0.62;
/** Al agarrar, la lengueta arranca ya levantada (el :hover del CSS hace lo mismo) */
const GRAB_PEEL = 0.16;

export default function PoweredBy() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, span: 220 });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root || event.button !== 0) return;

    // Única lectura de layout: cuánto hay que arrastrar para el despliegue total.
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      span: Math.max(140, root.offsetWidth * PULL_SPAN_RATIO),
    };

    // `--peel` (0 → 1) es lo único que se toca desde el arrastre: el CSS arma
    // con eso el doblez, el revés del papel y las sombras. Sin estado de React.
    root.classList.add("is-pulling");
    root.style.setProperty("--peel", GRAB_PEEL.toFixed(3));
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    const { active, startX, startY, span } = dragRef.current;
    if (!root || !active) return;

    // Se tira hacia arriba y hacia la izquierda: el doblez corre en diagonal.
    const pull = Math.max(0, (startX - event.clientX) + (startY - event.clientY) * 0.55);
    root.style.setProperty("--peel", Math.min(1, pull / span).toFixed(3));
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    dragRef.current.active = false;
    if (!root) return;

    if (root.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }

    // Al soltar se borra el valor inline: la esquina se vuelve a doblar sola
    // (o se queda apenas levantada si el mouse sigue encima).
    root.classList.remove("is-pulling");
    root.style.removeProperty("--peel");
  };

  return (
    <div
      ref={rootRef}
      className="powered-corner"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {/* La página de abajo: lo que se descubre al tirar de la lengueta */}
      <div className="powered-under">
        <span className="powered-under-label">Powered by</span>
        <span className="powered-under-mark">
          <Image
            className="powered-under-logo"
            src="/images/OkiToki.png"
            alt="OkiToki"
            width={1254}
            height={1254}
            sizes="114px"
          />
        </span>
      </div>

      {/* La hoja de arriba: transparente, comparte el fondo grande del
          sitio; su esquina queda cortada por el doblez */}
      <div className="powered-sheet-shadow">
        <div className="powered-sheet" />
      </div>

      {/* Guía de arrastre: fuera de la hoja (que recorta con clip-path) y
          por debajo de la lengueta */}
      <span className="powered-hint">tirá de la esquina</span>

      {/* El revés del papel doblado: la lengueta que se agarra */}
      <div className="powered-flap-shadow">
        <span className="powered-flap" aria-hidden="true" />
      </div>
    </div>
  );
}
