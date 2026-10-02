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

/* ---- Rotura táctil (móvil): al tocar, el vidrio se abre ---- */
const FRACTURE_LIFE = 3000; // Vida de la rotura en ms
const MAX_FRACTURES = 6; // Roturas vivas a la vez (coste por frame acotado)
const FRACTURE_STEP_MS = 26; // Cada cuánto nace un tramo: la grieta se propaga sola
const FRACTURE_REACH = 0.3; // Largo máximo de las grietas, en fracción del lado corto
const FRACTURE_MAX_REACH = 150; // Tope en px para pantallas grandes
const MIN_SPOKES = 5; // Grietas radiales mínimas
const MAX_SPOKES = 7; // Grietas radiales máximas

type FracturePoint = { x: number; y: number };

/** Vértice de un anillo: su posición y en qué tramo nace (ver FRACTURE_STEP_MS). */
type RingVertex = { x: number; y: number; step: number };

type Fracture = {
  x: number;
  y: number;
  bornAt: number;
  /** Grietas radiales; cada punto es un tramo de la propagación (FRACTURE_STEP_MS). */
  spokes: FracturePoint[][];
  /** Anillos quebrados de la "tela de araña". */
  rings: RingVertex[][];
  /** Contorno dentado del epicentro. */
  hole: FracturePoint[];
  /** Pedazos que se desprenden: por ahí se ve la foto a lo grande. */
  shards: FracturePoint[][];
};

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

/**
 * Una rotura de "pantalla": grietas radiales que se propagan desde el punto de
 * impacto, anillos quebrados que las unen (tela de araña), pedazos que se
 * desprenden y el hueco dentado del epicentro. Todo se sortea acá, una sola vez
 * por toque (sortear por frame haría vibrar el dibujo, igual que pasaba con el
 * grano del papel).
 */
function createFracture(x: number, y: number, bornAt: number, reach: number): Fracture {
  const spokeCount = MIN_SPOKES + Math.floor(Math.random() * (MAX_SPOKES - MIN_SPOKES + 1));
  const baseAngle = Math.random() * Math.PI * 2;
  const spokes: FracturePoint[][] = [];

  for (let s = 0; s < spokeCount; s++) {
    // Los radios se reparten en la vuelta y se desfasan: nunca queda una
    // estrella perfecta, que delataría el patrón.
    const angle = baseAngle + (s / spokeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const length = reach * (0.8 + Math.random() * 0.6);
    const steps = Math.max(3, Math.round(length / 10));
    const step = length / steps;
    const points: FracturePoint[] = [{ x, y }];
    let px = x;
    let py = y;
    let drift = (Math.random() - 0.5) * 0.8;

    for (let i = 1; i <= steps; i++) {
      // Deriva lateral acumulada: la grieta avanza torcida, como el vidrio.
      drift += (Math.random() - 0.5) * 0.45;
      px += Math.cos(angle + drift) * step;
      py += Math.sin(angle + drift) * step;
      points.push({ x: px, y: py });
    }

    spokes.push(points);
  }

  // Tela de araña: los anillos unen las grietas a distintas alturas con
  // polilíneas quebradas (el vidrio nunca se rompe en circunferencias).
  const ringRatios = [0.32, 0.58, 0.85];
  const rings: RingVertex[][] = [];

  for (let r = 0; r < ringRatios.length; r++) {
    const ratio = ringRatios[r] * (0.92 + Math.random() * 0.16);
    const ring: RingVertex[] = [];
    const count = spokes.length;

    for (let s = 0; s < count; s++) {
      const spoke = spokes[s];
      const next = spokes[(s + 1) % count];
      const index = Math.min(
        spoke.length - 1,
        Math.max(1, Math.round((spoke.length - 1) * ratio * (0.78 + Math.random() * 0.42))),
      );
      const nextIndex = Math.min(
        next.length - 1,
        Math.max(1, Math.round((next.length - 1) * ratio * (0.9 + Math.random() * 0.2))),
      );

      ring.push({ x: spoke[index].x, y: spoke[index].y, step: index });

      // Vértice intermedio empujado hacia afuera: así el anillo queda dentado.
      const push = 1.04 + Math.random() * 0.3;
      const mx = (spoke[index].x + next[nextIndex].x) / 2;
      const my = (spoke[index].y + next[nextIndex].y) / 2;
      ring.push({
        x: x + (mx - x) * push,
        y: y + (my - y) * push,
        step: Math.max(index, nextIndex),
      });
    }

    rings.push(ring);
  }

  // Epicentro: hueco dentado y irregular (un círculo se leería como la mancha
  // del dedo). Es uno de los dos lugares donde se ve la foto de abajo.
  const holeCount = 11;
  const hole: FracturePoint[] = [];
  for (let h = 0; h < holeCount; h++) {
    const angle = (h / holeCount) * Math.PI * 2;
    const radius = reach * (0.19 + Math.random() * 0.1) * (0.75 + Math.random() * 0.5);
    hole.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
  }

  /** Punto de una grieta a cierta fracción de su largo. */
  const pointAt = (spoke: FracturePoint[], ratio: number): FracturePoint => {
    const index = Math.min(spoke.length - 1, Math.max(1, Math.round((spoke.length - 1) * ratio)));
    return spoke[index];
  };

  // Pedazos desprendidos entre dos grietas vecinas: son los que hacen que la
  // rotura se lea como pantalla partida y no como un abanico.
  const shards: FracturePoint[][] = [];
  const taken = new Set<number>();
  const shardCount = 2 + Math.floor(Math.random() * 2);

  for (let i = 0; i < shardCount; i++) {
    const index = Math.floor(Math.random() * spokes.length);
    if (taken.has(index)) continue;
    taken.add(index);

    const ratio = 0.4 + Math.random() * 0.3;
    const pointFrom = pointAt(spokes[index], ratio);
    const pointTo = pointAt(spokes[(index + 1) % spokes.length], ratio);

    // El borde de afuera se abomba entre las dos grietas: el pedazo queda con
    // un contorno quebrado, nunca un arco prolijo.
    const outer: FracturePoint[] = [];
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const push = 1.15 + Math.random() * 0.25;
      const lx = pointFrom.x + (pointTo.x - pointFrom.x) * t;
      const ly = pointFrom.y + (pointTo.y - pointFrom.y) * t;
      outer.push({ x: x + (lx - x) * push, y: y + (ly - y) * push });
    }

    shards.push([{ x, y }, pointFrom, ...outer, pointTo]);
  }

  return { x, y, bornAt, spokes, rings, hole, shards };
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
    // Roturas de "pantalla" del modo táctil (ver handlePointerDown).
    const fractures: Fracture[] = [];
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

    // En pantallas táctiles el toque ya no deja la mancha redonda: abre una
    // rotura. El arrastre del dedo ya no triza (solo el toque); en PC el trazo
    // sigue al cursor igual que antes. `?tactil=1` fuerza el modo táctil para
    // poder probarlo desde la compu.
    const forzarTactil = new URLSearchParams(window.location.search).get("tactil") === "1";
    const tactilQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    let tactil = forzarTactil || tactilQuery.matches;
    const handleInputMode = () => {
      tactil = forzarTactil || tactilQuery.matches;
    };

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

    /** Acumula el trazo del puntero (solo mouse en PC; en móvil ver handlePointerMove). */
    const samplePointer = (event: PointerEvent) => {
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

    /** Abre una rotura en el punto tocado (solo táctil). */
    const addFracture = (x: number, y: number) => {
      const reach = Math.min(
        FRACTURE_MAX_REACH,
        Math.min(viewWidth, viewHeight) * FRACTURE_REACH,
      );
      fractures.push(createFracture(x, y, performance.now(), reach));

      // Tope de roturas vivas: el coste por frame queda acotado.
      if (fractures.length > MAX_FRACTURES) {
        fractures.splice(0, fractures.length - MAX_FRACTURES);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      // En táctil el arrastre del dedo ya no deja rastro: el trizado solo
      // aparece al tocar la pantalla (ver handlePointerDown). En PC el trazo
      // sigue pegado al cursor, como siempre.
      if (tactil) return;
      samplePointer(event);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!tactil) {
        // Escritorio: el click arranca el trazo de siempre.
        samplePointer(event);
        return;
      }

      // Ojo: el toque NO actualiza pointerX/pointerY a propósito. El trazo
      // dibuja su último tramo hasta el "punto vivo" del puntero; si el toque
      // lo moviera, aparecería una grieta recta desde el rastro anterior hasta
      // el dedo (el mismo artefacto que en PC al hacer click lejos del rastro).

      // Tocar un control (lengueta, diálogo, inputs) no rompe la pantalla.
      const target = event.target;
      if (target instanceof Element && target.closest("button, a, input, select, label, dialog")) {
        return;
      }

      addFracture(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    tactilQuery.addEventListener("change", handleInputMode);

    /**
     * Contorno de una forma de la rotura (epicentro o pedazo desprendido),
     * escalada desde el punto de impacto: `open` 0 = cerrada, 1 = tamaño real.
     * No abre el path, así se pueden agrupar varias formas en un solo trazo.
     */
    const traceShape = (
      shape: FracturePoint[],
      fracture: Fracture,
      open: number,
      offset: number,
    ) => {
      for (let i = 0; i < shape.length; i++) {
        const x = fracture.x + (shape[i].x - fracture.x) * open + offset;
        const y = fracture.y + (shape[i].y - fracture.y) * open - offset;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
    };

    /**
     * Traza una grieta solo hasta donde ya se propagó (`offset` > 0 = borde de
     * luz, `from` > 0 = arranca lejos del impacto para que las grietas no
     * hagan un nudo negro en el centro). Devuelve false si no dibujó nada.
     */
    const traceCrack = (
      points: FracturePoint[],
      age: number,
      offset: number,
      from = 0,
    ): boolean => {
      const start = Math.min(from, points.length - 1);
      ctx.beginPath();
      ctx.moveTo(points[start].x + offset, points[start].y - offset);
      let drawn = 0;

      for (let i = start + 1; i < points.length; i++) {
        if (age < (i - 1) * FRACTURE_STEP_MS) break;
        ctx.lineTo(points[i].x + offset, points[i].y - offset);
        drawn++;
      }

      return drawn > 0;
    };

    /**
     * Traza un anillo de la tela de araña solo hasta donde las grietas ya
     * llegaron. Devuelve cuántos vértices dibujó.
     */
    const traceRing = (ring: RingVertex[], age: number, offset: number): number => {
      ctx.beginPath();
      let started = false;
      let drawn = 0;

      for (let v = 0; v < ring.length; v++) {
        const vertex = ring[v];
        if (age < (vertex.step - 1) * FRACTURE_STEP_MS) {
          started = false;
          continue;
        }

        drawn++;
        if (started) ctx.lineTo(vertex.x + offset, vertex.y - offset);
        else {
          ctx.moveTo(vertex.x + offset, vertex.y - offset);
          started = true;
        }
      }

      // Solo se cierra si el anillo ya está completo (a medio propagar el
      // cierre cruzaría el hueco).
      if (drawn === ring.length) ctx.closePath();

      return drawn;
    };

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

      // 4. Roturas de pantalla (táctil): al tocar, el vidrio se abre y la
      //    fotografía del fondo queda a la vista por la quebradura.
      while (fractures.length > 0 && now - fractures[0].bornAt > FRACTURE_LIFE) {
        fractures.shift();
      }

      if (fractures.length > 0) {
        // 4a. Revelado: el hueco y las grietas se comen el papel (destination-out),
        //     igual que el trazo del mouse.
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.fillStyle = "#000";
        ctx.strokeStyle = "#000";

        for (let f = 0; f < fractures.length; f++) {
          const fracture = fractures[f];
          const age = Math.max(0, now - fracture.bornAt); // el frame puede caer antes del impacto
          const life = 1 - age / FRACTURE_LIFE;
          if (life <= 0) continue;

          // El epicentro abre en ~120ms y se vuelve a cerrar al final.
          const open = Math.min(1, age / 120) * life;

          ctx.beginPath();
          traceShape(fracture.hole, fracture, open, 0);
          ctx.fill();

          // Los pedazos desprendidos abren un poco más tarde que las grietas.
          const shatter = Math.min(1, age / 260) * life;
          for (let s = 0; s < fracture.shards.length; s++) {
            ctx.beginPath();
            traceShape(fracture.shards[s], fracture, shatter, 0);
            ctx.fill();
          }

          // Ancho y propagación: grieta fina (se lee como vidrio, no como una
          // banda gruesa) que "corre" sola desde el impacto.
          ctx.lineWidth = Math.max(1.2, REVEAL_SIZE * 0.1 * life);
          for (let s = 0; s < fracture.spokes.length; s++) {
            if (traceCrack(fracture.spokes[s], age, 0)) ctx.stroke();
          }

          // Los anillos también abren: por ahí se filtra el fondo.
          for (let r = 0; r < fracture.rings.length; r++) {
            if (traceRing(fracture.rings[r], age, 0) >= 2) ctx.stroke();
          }
        }

        ctx.restore();

        // 4b. Bordes de vidrio: mismo lenguaje que el desgarro del papel
        //     (trazo oscuro + fibra de luz desfasada), más los anillos.
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let f = 0; f < fractures.length; f++) {
          const fracture = fractures[f];
          const age = Math.max(0, now - fracture.bornAt); // el frame puede caer antes del impacto
          const life = 1 - age / FRACTURE_LIFE;
          if (life <= 0) continue;

          const appear = Math.min(1, age / 120);
          const alpha = appear * life;
          if (alpha <= 0.01) continue;

          // Tela de araña: los anillos se dibujan hasta donde ya llegó cada
          // grieta y se apagan con el resto de la rotura.
          ctx.strokeStyle = `rgba(30, 15, 35, ${(0.3 * alpha).toFixed(3)})`;
          ctx.lineWidth = 1;
          for (let r = 0; r < fracture.rings.length; r++) {
            if (traceRing(fracture.rings[r], age, 0) >= 3) ctx.stroke();
          }

          // Cantos de vidrio: sombra interior + luz desfasada. El epicentro y
          // todos los pedazos van agrupados en dos trazos (sombra y luz).
          ctx.beginPath();
          traceShape(fracture.hole, fracture, appear, 0);
          const shatter = Math.min(1, age / 260);
          for (let s = 0; s < fracture.shards.length; s++) {
            traceShape(fracture.shards[s], fracture, shatter, 0);
          }
          ctx.strokeStyle = `rgba(20, 10, 25, ${(0.4 * alpha).toFixed(3)})`;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          ctx.beginPath();
          traceShape(fracture.hole, fracture, appear, 1.6);
          for (let s = 0; s < fracture.shards.length; s++) {
            traceShape(fracture.shards[s], fracture, shatter, 1.6);
          }
          ctx.strokeStyle = `rgba(255, 255, 255, ${(0.6 * alpha).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          for (let s = 0; s < fracture.spokes.length; s++) {
            const points = fracture.spokes[s];
            // `from: 1` para no pintar el tramo pegado al impacto: si no, las
            // grietas se juntan en un nudo oscuro en el centro.
            if (!traceCrack(points, age, 0, 1)) continue;

            ctx.strokeStyle = `rgba(20, 10, 25, ${(0.45 * alpha).toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            if (traceCrack(points, age, 1.6, 1)) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${(0.55 * alpha).toFixed(3)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
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
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      tactilQuery.removeEventListener("change", handleInputMode);
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
