"use client";

import { useEffect, useRef } from "react";

type BranchPoint = { x: number; y: number };

type CrackPoint = {
  x: number;
  y: number;
  time: number;
  jitterX: number;
  jitterY: number;
  width: number;
  branches: BranchPoint[][];
};

const MAX_PATH_AGE = 2500; // Duración de las grietas en ms
const MIN_STEP_DISTANCE = 5; // Distancia mínima entre puntos registrados
const REVEAL_SIZE = 42; // Grosor base del revelado
const MAX_POINTS = 260; // Puntos vivos máximos (coste acotado por frame)
const PAPER_COLOR = "#8052a0";
const NOISE_TILE = 640; // Lado del tile de textura del papel
const ALPHA_BUCKETS = 4; // Niveles de opacidad para agrupar trazos

/**
 * Textura del papel pre-renderizada una sola vez (PRNG determinístico):
 * antes se sortearon ~200 rects por frame y el grano "hervía".
 */
function createPaperTexture(): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = NOISE_TILE;
  tile.height = NOISE_TILE;

  const tileCtx = tile.getContext("2d");
  if (!tileCtx) return tile;

  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  tileCtx.globalAlpha = 0.05;
  // Misma densidad que antes (~200 puntos por viewport 1080p), pero generada
  // una sola vez: el grano ya no se vuelve a sortear en cada frame.
  const dots = Math.round((NOISE_TILE * NOISE_TILE) / 10400);

  for (let i = 0; i < dots; i++) {
    tileCtx.fillStyle = random() > 0.5 ? "#ffffff" : "#000000";
    tileCtx.fillRect(random() * NOISE_TILE, random() * NOISE_TILE, 2, 2);
  }

  return tile;
}

/** Un Path2D por nivel de opacidad: menos draw calls por frame. */
function createPathBuckets(): Path2D[] {
  return Array.from({ length: ALPHA_BUCKETS }, () => new Path2D());
}

function bucketIndex(alpha: number): number {
  const index = Math.ceil(alpha * ALPHA_BUCKETS) - 1;
  if (index < 0) return 0;
  return index > ALPHA_BUCKETS - 1 ? ALPHA_BUCKETS - 1 : index;
}

export default function PaperCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // `desynchronized` reduce la latencia entre el cursor y lo dibujado.
    const ctx = canvas.getContext("2d", { desynchronized: true });
    if (!ctx) return;

    const pathHistory: CrackPoint[] = [];
    // Buffer de eventos: el trabajo pesado se hace UNA vez por frame, no por evento.
    const pendingPoints: { x: number; y: number; time: number }[] = [];
    const paperTexture = createPaperTexture();
    let paperPattern: CanvasPattern | null = null;

    let dpr = 1;
    let viewWidth = window.innerWidth;
    let viewHeight = window.innerHeight;
    let animationFrameId = 0;
    let running = true;
    let pointerX = viewWidth / 2;
    let pointerY = viewHeight / 2;
    let hasPointer = false;
    let hasPending = false;

    const resizeCanvas = () => {
      // Se limita el DPR a 2: en pantallas 3x/4x el fill-rate se multiplicaba
      // x9/x16 a pantalla completa y era una de las causas del "arrastre".
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewWidth = window.innerWidth;
      viewHeight = window.innerHeight;
      canvas.width = Math.round(viewWidth * dpr);
      canvas.height = Math.round(viewHeight * dpr);
      canvas.style.width = `${viewWidth}px`;
      canvas.style.height = `${viewHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paperPattern = ctx.createPattern(paperTexture, "repeat");
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const createBranches = (x: number, y: number): BranchPoint[][] => {
      const branches: BranchPoint[][] = [];
      const branchCount = Math.floor(Math.random() * 2) + 1;

      for (let b = 0; b < branchCount; b++) {
        const angle = Math.random() * Math.PI * 2;
        const length = 12 + Math.random() * 28;
        const points: BranchPoint[] = [{ x, y }];

        let bx = x;
        let by = y;
        const subSteps = 2 + Math.floor(Math.random() * 2);

        for (let s = 0; s < subSteps; s++) {
          bx += Math.cos(angle) * (length / subSteps) + (Math.random() - 0.5) * 8;
          by += Math.sin(angle) * (length / subSteps) + (Math.random() - 0.5) * 8;
          points.push({ x: bx, y: by });
        }

        branches.push(points);
      }

      return branches;
    };

    /** Vuelca los eventos acumulados en puntos del trazo (1 vez por frame). */
    const flushPendingPoints = () => {
      if (!hasPending) return;
      hasPending = false;

      for (let i = 0; i < pendingPoints.length; i++) {
        const point = pendingPoints[i];
        const lastPoint = pathHistory[pathHistory.length - 1];

        if (
          lastPoint &&
          Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) <= MIN_STEP_DISTANCE
        ) {
          continue;
        }

        pathHistory.push({
          x: point.x,
          y: point.y,
          time: point.time,
          jitterX: (Math.random() - 0.5) * 6,
          jitterY: (Math.random() - 0.5) * 6,
          // Ancho precalculado: el dibujo ya no llama a Math.random() por frame
          // (eso hacía que el trizado "vibrara" y se viera sucio).
          width: REVEAL_SIZE + Math.random() * 10,
          branches: createBranches(point.x, point.y),
        });
      }

      pendingPoints.length = 0;

      // Tope de puntos vivos: el coste por frame queda acotado.
      if (pathHistory.length > MAX_POINTS) {
        pathHistory.splice(0, pathHistory.length - MAX_POINTS);
      }
    };

    const handlePointerEvent = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      hasPointer = true;

      // getCoalescedEvents devuelve las posiciones intermedias que el navegador
      // agrupa en un solo evento: el trazo queda continuo aunque el mouse corra.
      const samples =
        typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
      const points = samples.length > 0 ? samples : [event];
      const time = performance.now();

      for (let i = 0; i < points.length; i++) {
        const sample = points[i];
        const lastPending = pendingPoints[pendingPoints.length - 1];

        if (
          lastPending &&
          Math.hypot(sample.clientX - lastPending.x, sample.clientY - lastPending.y) < 2
        ) {
          continue;
        }

        pendingPoints.push({ x: sample.clientX, y: sample.clientY, time });
      }

      hasPending = true;
    };

    window.addEventListener("pointermove", handlePointerEvent, { passive: true });
    window.addEventListener("pointerdown", handlePointerEvent, { passive: true });

    const drawPaper = (frameTime: number) => {
      if (!running) return;

      const now = frameTime;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewWidth, viewHeight);

      // 1. Papel morado base + textura pre-renderizada
      //    (antes: 200 rects aleatorios por frame -> centelleo y fill-rate de más).
      ctx.fillStyle = PAPER_COLOR;
      ctx.fillRect(0, 0, viewWidth, viewHeight);

      if (paperPattern) {
        ctx.fillStyle = paperPattern;
        ctx.fillRect(0, 0, viewWidth, viewHeight);
      }

      flushPendingPoints();

      // Limpieza de puntos antiguos
      while (pathHistory.length > 0 && now - pathHistory[0].time > MAX_PATH_AGE) {
        pathHistory.shift();
      }

      if (pathHistory.length > 0) {
        // Punto "vivo": el último tramo se dibuja hasta la posición actual del
        // cursor, así el trizado va pegado al mouse (antes quedaba unos px detrás).
        const live: CrackPoint | null = hasPointer
          ? {
              x: pointerX,
              y: pointerY,
              time: now,
              jitterX: 0,
              jitterY: 0,
              width: REVEAL_SIZE,
              branches: [],
            }
          : null;

        const total = pathHistory.length + (live ? 1 : 0);
        const at = (index: number): CrackPoint => {
          if (live && index >= pathHistory.length) return live;
          return pathHistory[index];
        };
        // 2. Revelar la foto a través del trizado (destination-out).
        //    Se quitó el círculo extra por punto: `lineCap: "round"` ya redondea
        //    el extremo, así que era un draw call redundante por segmento.
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#000";

        for (let i = 0; i < total - 1; i++) {
          const p1 = at(i);
          const p2 = at(i + 1);
          const lifeProgress = 1 - (now - p2.time) / MAX_PATH_AGE;
          if (lifeProgress <= 0) continue;

          ctx.lineWidth = p2.width * lifeProgress;
          ctx.beginPath();
          ctx.moveTo(p1.x + p1.jitterX, p1.y + p1.jitterY);
          ctx.lineTo(p2.x + p2.jitterX, p2.y + p2.jitterY);
          ctx.stroke();
        }

        ctx.restore();

        // 3. Bordes de grietas y ramificaciones.
        //    Se agrupan por opacidad en unos pocos Path2D: antes eran ~2 trazos por
        //    punto + 1 por rama (cientos de draw calls por frame).
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const stemPaths = createPathBuckets();
        const lightPaths = createPathBuckets();
        const branchPaths = createPathBuckets();

        for (let i = 0; i < total - 1; i++) {
          const p1 = at(i);
          const p2 = at(i + 1);
          const lifeProgress = 1 - (now - p2.time) / MAX_PATH_AGE;
          if (lifeProgress <= 0) continue;

          const level = bucketIndex(lifeProgress);
          const x1 = p1.x + p1.jitterX;
          const y1 = p1.y + p1.jitterY;
          const x2 = p2.x + p2.jitterX;
          const y2 = p2.y + p2.jitterY;

          // Sombra y profundidad de grieta
          stemPaths[level].moveTo(x1, y1);
          stemPaths[level].lineTo(x2, y2);

          // Borde de luz / fibra de papel rasgado
          lightPaths[level].moveTo(x1 + 1.5, y1 - 1.5);
          lightPaths[level].lineTo(x2 + 1.5, y2 - 1.5);

          // Ramificaciones (astillas de vidrio)
          for (const branch of p2.branches) {
            const path = branchPaths[level];
            path.moveTo(branch[0].x, branch[0].y);

            for (let b = 1; b < branch.length; b++) {
              path.lineTo(branch[b].x, branch[b].y);
            }
          }
        }

        for (let level = 0; level < ALPHA_BUCKETS; level++) {
          const alpha = (level + 1) / ALPHA_BUCKETS;

          ctx.strokeStyle = `rgba(20, 10, 25, ${(0.85 * alpha).toFixed(3)})`;
          ctx.lineWidth = 2.5;
          ctx.stroke(stemPaths[level]);

          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.4 * alpha).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke(lightPaths[level]);

          ctx.strokeStyle = `rgba(30, 15, 35, ${(0.7 * alpha).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke(branchPaths[level]);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(drawPaper);
    };

    // Con la pestaña oculta el loop se detiene: no quema CPU en background.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(animationFrameId);
        return;
      }

      if (!running) {
        running = true;
        animationFrameId = requestAnimationFrame(drawPaper);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    animationFrameId = requestAnimationFrame(drawPaper);

    // Cleanup al desmontar el componente
    return () => {
      running = false;
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerEvent);
      window.removeEventListener("pointerdown", handlePointerEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-10 h-full w-full"
      aria-hidden="true"
    />
  );
}
