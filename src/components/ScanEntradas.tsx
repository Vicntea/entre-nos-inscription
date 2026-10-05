"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { marcarPresente, type PresenteResponse } from "@/lib/inscripcion";

type Estado = "idle" | "scanning" | "checking" | "result" | "error";

type Panel = {
  tone: "ok" | "warn" | "bad";
  title: string;
  detail: string;
};

/**
 * Revisor de entradas: lee el QR (que contiene el uuid de la inscripción) y
 * marca la fila como presente en la planilla. Pensado para el celular que está
 * en la puerta: cámara trasera, un solo botón y el resultado bien grande.
 */
export default function ScanEntradas() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  // El callback de ZXing se sigue llamando mientras el video vive: esto evita
  // procesar el mismo QR dos veces.
  const procesandoRef = useRef(false);

  const [estado, setEstado] = useState<Estado>("idle");
  const [resultado, setResultado] = useState<PresenteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detenerCamara = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  // Al desmontar (o cambiar de pantalla) siempre se apaga la cámara.
  useEffect(() => detenerCamara, [detenerCamara]);

  const verificar = useCallback(async (uuid: string) => {
    setEstado("checking");
    setResultado(null);
    setError(null);

    try {
      const respuesta = await marcarPresente(uuid);
      setResultado(respuesta);
      setEstado("result");
    } catch {
      setError("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
      setEstado("error");
    }
  }, []);

  const iniciarEscaneo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    detenerCamara();
    procesandoRef.current = false;
    setResultado(null);
    setError(null);
    setEstado("scanning");

    const reader = readerRef.current ?? new BrowserMultiFormatReader();
    readerRef.current = reader;

    try {
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (result) => {
          if (!result || procesandoRef.current) return;
          procesandoRef.current = true;
          detenerCamara();
          void verificar(result.getText().trim());
        }
      );
    } catch {
      setError("No pudimos acceder a la cámara. Revisá los permisos del navegador.");
      setEstado("error");
    }
  }, [detenerCamara, verificar]);

  const detenerYListo = useCallback(() => {
    detenerCamara();
    setEstado("idle");
  }, [detenerCamara]);

  const panel = useMemo<Panel | null>(() => {
    if (estado === "error") {
      return { tone: "bad", title: "No se pudo verificar", detail: error ?? "" };
    }
    if (estado === "result" && resultado) {
      if (resultado.success) {
        return {
          tone: "ok",
          title: "Presencia registrada",
          detail: resultado.message ?? "Presencia registrada correctamente",
        };
      }
      if (resultado.presente) {
        return {
          tone: "warn",
          title: "Ya estaba presente",
          detail: resultado.message ?? "La persona ya está marcada como presente",
        };
      }
      return {
        tone: "bad",
        title: "Entrada no válida",
        detail: resultado.error ?? resultado.message ?? "UUID no encontrado",
      };
    }
    return null;
  }, [estado, resultado, error]);

  const escaneando = estado === "scanning";

  return (
    <main className="scan-root">
      <header className="scan-header">
        <span className="scan-eyebrow">ENTRE NOS — REVISOR DE ENTRADAS</span>
        <h1 className="scan-title">Escaneá la entrada</h1>
        <p className="scan-sub">Cine UACH · 30 de octubre</p>
      </header>

      <div className={`scan-stage ${escaneando ? "is-active" : ""}`}>
        <video ref={videoRef} className="scan-video" muted playsInline />
        {escaneando ? (
          <div className="scan-frame" aria-hidden="true" />
        ) : (
          <div className="scan-placeholder" aria-hidden="true">
            <span className="scan-placeholder-mark">▣</span>
            <span>Cámara apagada</span>
          </div>
        )}
      </div>

      {escaneando && <p className="scan-hint">Apuntá la cámara al código QR de la entrada</p>}
      {estado === "checking" && <p className="scan-hint">Verificando…</p>}
      {estado === "idle" && (
        <p className="scan-hint">Tocá «Escanear» y permití el uso de la cámara.</p>
      )}

      {panel && (
        <div className={`scan-panel is-${panel.tone}`} role="status">
          <p className="scan-panel-title">{panel.title}</p>
          <p className="scan-panel-detail">{panel.detail}</p>
        </div>
      )}

      <div className="scan-actions">
        {escaneando ? (
          <button type="button" className="scan-button" onClick={detenerYListo}>
            Detener
          </button>
        ) : (
          <button
            type="button"
            className="scan-button"
            onClick={iniciarEscaneo}
            disabled={estado === "checking"}
          >
            {estado === "checking" ? "Verificando…" : panel ? "Escanear otra entrada" : "Escanear"}
          </button>
        )}
      </div>
    </main>
  );
}
