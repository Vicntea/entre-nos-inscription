"use client";

import { useState } from "react";
import Background, { IMAGE_COUNT } from "./Background";
import JoinTab from "./JoinTab";
import Logo from "./Logo";
import PaperCanvas from "./PaperCanvas";
import PoweredBy from "./PoweredBy";

export default function Landing() {
  const [currentImage, setCurrentImage] = useState(0);

  return (
    <main className="stage relative w-full cursor-crosshair overflow-hidden bg-[#111]">
      {/* Fotografías de fondo en gris con glitch */}
      <Background onImageChange={setCurrentImage} />

      {/* Papel que se rompe siguiendo el cursor */}
      <PaperCanvas />

      {/* Logo central reactivo al mouse */}
      <Logo />

      {/* Header */}
      <header className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+16px)] z-30 flex justify-between gap-3 text-[10px] uppercase tracking-widest text-white mix-blend-difference min-[601px]:left-8 min-[601px]:right-8 min-[601px]:top-[calc(env(safe-area-inset-top,0px)+24px)] min-[601px]:gap-0 min-[601px]:text-xs">
        <div>ENTRE NOS — ARCHIVO FEMINISTA</div>
        <div className="tabular-nums">
          {String(currentImage + 1).padStart(2, "0")} / {String(IMAGE_COUNT).padStart(2, "0")}
        </div>
      </header>

      {/* Footer */}
      <footer className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-4 right-4 z-30 flex items-end justify-between gap-3 text-[9px] uppercase tracking-widest text-white mix-blend-difference min-[601px]:bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] min-[601px]:left-8 min-[601px]:right-8 min-[601px]:gap-0 min-[601px]:text-[10px]">
        <div>
          {/* En el celular no hay cursor: la instrucción cambia a toque */}
          <span className="min-[601px]:hidden">tocá la pantalla</span>
          <span className="hidden min-[601px]:inline">mueve el cursor</span>
          <br />
          rompe el papel
        </div>
        {/* Se ubica arriba de la lengueta "powered by" de la esquina */}
        <div className="mb-[88px] [writing-mode:vertical-rl] rotate-180 min-[601px]:mb-[122px]">
          archivo / manifiesto / memoria
        </div>
      </footer>

      {/* Hojita "powered by" agarrable en la esquina inferior derecha */}
      <PoweredBy />

      {/* Texturas */}
      <div className="scanlines" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {/* Lengueta + diálogo de inscripción */}
      <JoinTab />
    </main>
  );
}
