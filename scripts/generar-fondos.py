#!/usr/bin/env python3
"""
Genera los fondos animados del sitio a partir de las fotos originales de
Unsplash, con los efectos que hoy aplica el CSS horneados DENTRO del asset:
escala de grises + contraste + brillo + glitch.

Motivo: hoy el navegador pinta dos capas a pantalla completa con
`filter: grayscale(1) contrast(1.35) brightness(0.7)` y anima `.glitch`, que
incluye `drop-shadow` (re-rasteriza la capa entera en cada frame). Eso es lo
que come CPU. Con el fondo pre-renderizado, el navegador solo decodifica un
WebP animado: sin filtros, sin animación de `filter` sobre pantalla completa.

Formato principal: WebP animado (chico, sin banding, con `srcset`/`<picture>`).
Respaldo: GIF animado para navegadores sin WebP animado (casi inexistentes).

Uso:
    python scripts/generar-fondos.py                 # genera los 5 (webp + gif)
    python scripts/generar-fondos.py --limit 1       # solo la primera (para probar)
    python scripts/generar-fondos.py --no-gif        # saltea el GIF de respaldo
    python scripts/generar-fondos.py --quality 65    # baja el peso del WebP

Salida:
    public/images/backgrounds/bg-01.webp ... bg-05.webp
    public/images/backgrounds/bg-01.gif  ... bg-05.gif
"""

from __future__ import annotations

import argparse
import io
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

# --------------------------------------------------------------------- fuentes

IMAGE_IDS = [
    "photo-1488426862026-3ee34a7d66df",
    "photo-1515886657613-9f3515b0c78f",
    "photo-1531123897727-8f129e1688ce",
    "photo-1494790108377-be9c29b29330",
    "photo-1508214751196-bcfd4ca60f91",
]

# w=1920 basta: se reescala a 1440 de ancho. `q=80` baja el peso de la descarga.
SOURCE_QUERY = "?auto=format&fit=crop&w=1920&q=80"

OUT_DIR = os.path.join("public", "images", "backgrounds")
CACHE_DIR = os.path.join(".cache", "fondos")

# Tamano del asset final. El fondo va oscurecido + en gris + con grano y
# scanlines encima, asi que 1280x720 alcanza y pesa bastante menos.
OUT_SIZE = (1280, 720)

# El GIF de respaldo se genera mas chico y sin dither: el dither mete ruido y
# destroza la compresion LZW (era lo que hacia que pesara 10 MB).
GIF_SIZE = (640, 360)
GIF_COLORS = 96

# Calidad del WebP animado. El fondo va oscurecido, en gris y con grano +
# scanlines encima, asi que una calidad moderada no se nota.
WEBP_QUALITY = 62

# El CSS pone la capa al 110% (`inset: -5%`), o sea 5% de margen por lado. El
# glitch nunca llega al borde del contenedor; se replica trabajando sobre un
# "master" 110% mas grande y recortando centrado en cada frame.
OVERSCAN = 1.10

# Efecto base, equivalente al `filter` del CSS: grayscale(1) contrast(1.35) brightness(0.7)
BASE_CONTRAST = 1.35
BASE_BRIGHTNESS = 0.7

# ------------------------------------------------------------------- glitch

# Keyframes tomados del @keyframes glitch actual:
#   progress, tx, ty, skew(grados), contraste, brillo
# Ojo: en el CSS el brillo (0.7) NO esta presente en los keyframes del medio,
# asi que durante el burst la imagen se aclara. Se replica tal cual.
GLITCH_KEYS = [
    (0.00, 0.0, 0.0, 0.0, BASE_CONTRAST, BASE_BRIGHTNESS),
    (0.15, -5.0, 2.0, -1.0, 1.50, 1.0),
    (0.30, 4.0, -2.0, 1.0, 1.40, 1.0),
    (0.45, -2.0, 1.0, 0.0, BASE_CONTRAST, 1.0),
    (0.60, 3.0, -1.0, 0.0, 1.50, 1.0),
    (0.75, -1.0, 0.0, 0.0, BASE_CONTRAST, 1.0),
    (1.00, 0.0, 0.0, 0.0, BASE_CONTRAST, BASE_BRIGHTNESS),
]

BURST_MS = 850          # duracion de un burst (igual que el @keyframes actual)
LOOP_MS = 6000          # el loop del asset dura lo mismo que CHANGE_INTERVAL
BURST_STARTS = (700, 4200)  # dos bursts por loop (cambio + glitch "aleatorio")
GLITCH_FRAME_MS = 200   # muestreo del glitch: mas ms = menos frames = menos peso


# --------------------------------------------------------------------- helpers


def download_image(image_id: str) -> Image.Image:
    """
    Baja una foto de Unsplash y la devuelve como Image RGB.
    Las descargas se cachean en .cache/fondos: re-ejecutar el script para
    ajustar calidad/tamano no vuelve a pegarle a Unsplash.
    """
    cache_path = os.path.join(CACHE_DIR, f"{image_id}.jpg")
    if os.path.exists(cache_path):
        return Image.open(cache_path).convert("RGB")

    url = f"https://images.unsplash.com/{image_id}{SOURCE_QUERY}"
    request = urllib.request.Request(url, headers={"User-Agent": "entre-nos-build/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache_path, "wb") as handle:
        handle.write(data)

    return Image.open(io.BytesIO(data)).convert("RGB")


def build_master(image: Image.Image) -> Image.Image:
    """
    Imagen de trabajo: en escala de grises y un 10% mas grande que la salida.
    El gris va aca; contraste/brillo se aplican por frame (durante el glitch
    cambian). El 10% extra es el margen que en el CSS da `inset: -5%`.
    """
    gray = ImageOps.grayscale(image).convert("RGB")
    master_w = round(OUT_SIZE[0] * OVERSCAN)
    master_h = round(OUT_SIZE[1] * OVERSCAN)
    return ImageOps.fit(gray, (master_w, master_h), Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def add_chroma(image: Image.Image, dx: int) -> Image.Image:
    """
    Franja roja/cian sutil, equivalente visual al `drop-shadow` del CSS: se
    desplaza el canal rojo a un lado y el azul al otro. Con el recorte del
    navegador casi no se ve; es solo para no perder el "sabor" del efecto.
    """
    if dx == 0:
        return image

    arr = np.asarray(image, dtype=np.int16)
    height, width = arr.shape[0], arr.shape[1]

    red = arr[:, :, 0]
    blue = arr[:, :, 2]

    # rojo corrido dx px a la derecha (sin envolver: se replica el borde)
    red_shift = np.pad(red, ((0, 0), (dx, 0)), mode="edge")[:, :width]
    # azul corrido dx px a la izquierda
    blue_shift = np.pad(blue, ((0, 0), (0, dx)), mode="edge")[:, dx:]

    out = arr.copy()
    out[:, :, 0] = red_shift
    out[:, :, 2] = blue_shift
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def render_frame(
    master: Image.Image,
    tx: float,
    ty: float,
    skew_deg: float,
    contrast: float,
    brightness: float,
    chroma_dx: int = 0,
) -> Image.Image:
    """
    Un frame del fondo: recorte centrado del master con el desplazamiento y el
    skew del glitch ya aplicados, mas el contraste/brillo de ese momento.
    """
    master_w, master_h = master.size
    out_w, out_h = OUT_SIZE

    offset_x = (master_w - out_w) / 2
    offset_y = (master_h - out_h) / 2
    shear = math.tan(math.radians(skew_deg))

    # Salida (x, y) -> master (x + offset_x + tx + shear * (y - out_h/2), ...)
    affine = (1, shear, offset_x + tx - shear * (out_h / 2), 0, 1, offset_y + ty)
    frame = master.transform(
        (out_w, out_h), Image.Transform.AFFINE, affine, resample=Image.Resampling.BICUBIC
    )

    if contrast != 1.0:
        frame = ImageEnhance.Contrast(frame).enhance(contrast)
    if brightness != 1.0:
        frame = ImageEnhance.Brightness(frame).enhance(brightness)
    if chroma_dx:
        frame = add_chroma(frame, chroma_dx)

    return frame


# ------------------------------------------------------------------- timeline


def build_timeline():
    """Segmentos (inicio_ms, fin_ms, es_burst) que cubren LOOP_MS sin huecos."""
    segments = []
    cursor = 0
    for start in BURST_STARTS:
        if start > cursor:
            segments.append((cursor, start, False))
        segments.append((start, start + BURST_MS, True))
        cursor = start + BURST_MS
    if cursor < LOOP_MS:
        segments.append((cursor, LOOP_MS, False))
    return segments


def sample_glitch(progress: float):
    """Interpola tx, ty, skew, contraste y brillo entre keyframes del glitch."""
    keys = GLITCH_KEYS
    for i in range(len(keys) - 1):
        p0, p1 = keys[i], keys[i + 1]
        if p0[0] <= progress <= p1[0]:
            span = p1[0] - p0[0]
            k = 0.0 if span == 0 else (progress - p0[0]) / span
            return tuple(a + (b - a) * k for a, b in zip(p0[1:], p1[1:]))
    return keys[-1][1:]


def build_frames(master: Image.Image, glitch_frame_ms: int):
    """Arma la lista [(Image, duracion_ms)] del loop completo."""
    frames = []

    for start, end, is_burst in build_timeline():
        if not is_burst:
            still = render_frame(master, 0, 0, 0, BASE_CONTRAST, BASE_BRIGHTNESS)
            frames.append((still, end - start))
            continue

        span = end - start
        elapsed = 0
        while elapsed < span:
            progress = min(1.0, elapsed / span)
            tx, ty, skew, contrast, brightness = sample_glitch(progress)
            # La franja roja/cian solo en el pico; al final vuelve limpio.
            chroma = 3 if progress < 0.95 else 0
            duration = min(glitch_frame_ms, span - elapsed)
            frames.append(
                (render_frame(master, tx, ty, skew, contrast, brightness, chroma), duration)
            )
            elapsed += duration

    return frames


# ------------------------------------------------------------------- encoders


def save_webp(frames, path: str, quality: int) -> None:
    first, _ = frames[0]
    first.save(
        path,
        format="WEBP",
        save_all=True,
        append_images=[image for image, _ in frames[1:]],
        duration=[duration for _, duration in frames],
        loop=0,
        quality=quality,
        method=6,
        minimize_size=True,
    )


def save_gif(frames, path: str, animated: bool = False) -> None:
    """
    Respaldo para navegadores sin WebP animado (hoy: practicamente ninguno).
    Por defecto se guarda SOLO el frame limpio: el GIF animado de estas fotos
    pesa ~1 MB por imagen y no vale la pena el peso en el repo. Con
    `--gif-animated` se genera la animacion completa (mas liviana: 96 colores
    y sin dither, que es lo que hacia que pesara 10 MB).
    """
    if not animated:
        still = frames[0][0].resize(GIF_SIZE, Image.Resampling.LANCZOS)
        still.quantize(colors=GIF_COLORS, dither=Image.Dither.NONE).save(
            path, format="GIF", optimize=True
        )
        return

    small = [image.resize(GIF_SIZE, Image.Resampling.LANCZOS) for image, _ in frames]
    palette = small[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=GIF_COLORS)
    converted = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in small]
    converted[0].save(
        path,
        format="GIF",
        save_all=True,
        append_images=converted[1:],
        duration=[duration for _, duration in frames],
        loop=0,
        optimize=True,
        disposal=2,
    )


# ----------------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera los fondos animados del sitio.")
    parser.add_argument("--limit", type=int, default=0, help="Procesa solo las primeras N (0 = todas)")
    parser.add_argument("--quality", type=int, default=WEBP_QUALITY, help="Calidad del WebP")
    parser.add_argument("--frame-ms", type=int, default=GLITCH_FRAME_MS, help="Duracion de cada frame del glitch")
    parser.add_argument("--no-gif", action="store_true", help="No genera el GIF de respaldo")
    parser.add_argument(
        "--gif-animated",
        action="store_true",
        help="GIF de respaldo animado (pesa ~1 MB por imagen)",
    )
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)
    ids = IMAGE_IDS[: args.limit] if args.limit > 0 else IMAGE_IDS
    total_bytes = 0
    total_frames = 0

    for index, image_id in enumerate(ids, start=1):
        name = f"bg-{index:02d}"
        print(f"[{index}/{len(ids)}] {name}: bajando de Unsplash...", flush=True)
        master = build_master(download_image(image_id))

        frames = build_frames(master, args.frame_ms)

        outputs = []
        webp_path = os.path.join(OUT_DIR, f"{name}.webp")
        save_webp(frames, webp_path, args.quality)
        outputs.append(webp_path)

        if not args.no_gif:
            gif_path = os.path.join(OUT_DIR, f"{name}.gif")
            save_gif(frames, gif_path, animated=args.gif_animated)
            outputs.append(gif_path)

        size = sum(os.path.getsize(path) for path in outputs)
        total_bytes += size
        total_frames += len(frames)
        detail = ", ".join(f"{os.path.basename(p)} {os.path.getsize(p) // 1024} KB" for p in outputs)
        print(f"[{index}/{len(ids)}] {name}: {len(frames)} frames -> {detail}", flush=True)

    print(f"\nListo: {len(ids)} fondos, {total_frames} frames, {total_bytes // 1024} KB en total.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

