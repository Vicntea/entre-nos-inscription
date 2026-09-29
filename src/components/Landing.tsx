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
    <main className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-[#111]">
      {/* Fotografías de fondo en gris con glitch */}
      <Background onImageChange={setCurrentImage} />

      {/* Papel que se rompe siguiendo el cursor */}
      <PaperCanvas />

      {/* Logo central reactivo al mouse */}
      <Logo />

      {/* Header */}
      <header className="fixed left-8 right-8 top-6 z-30 flex justify-between text-xs uppercase tracking-widest text-white mix-blend-difference">
        <div>ENTRE NOS — ARCHIVO FEMINISTA</div>
        <div className="tabular-nums">
          {String(currentImage + 1).padStart(2, "0")} / {String(IMAGE_COUNT).padStart(2, "0")}
        </div>
      </header>

      {/* Footer */}
      <footer className="fixed bottom-6 left-8 right-8 z-30 flex items-end justify-between text-[10px] uppercase tracking-widest text-white mix-blend-difference">
        <div>
          mueve el cursor
          <br />
          rompe el papel
        </div>
        {/* Se ubica arriba de la lengueta "powered by" de la esquina */}
        <div className="mb-[68px] [writing-mode:vertical-rl] rotate-180 min-[601px]:mb-[122px]">
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
