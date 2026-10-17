"use client";
// Lector de códigos de barras con la cámara del celular.
// Usa el lector nativo del navegador (Android/Chrome) y, si no existe (iPhone, PC),
// el motor ZXing en WebAssembly servido desde nuestro propio sitio.
import { useEffect, useRef, useState } from "react";
import { IconoCerrar } from "@/componentes/ui/Iconos";

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] as const;

interface Detector { detect(fuente: HTMLVideoElement): Promise<{ rawValue: string }[]> }

async function crearDetector(): Promise<Detector> {
  const nativo = (globalThis as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (nativo) {
    try {
      const soportados = await nativo.getSupportedFormats();
      if (soportados.includes("ean_13")) return new nativo({ formats: FORMATOS.filter((f) => soportados.includes(f)) });
    } catch { /* usa ZXing */ }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? `/zxing/${ruta}` : prefijo + ruta) },
  });
  return new BarcodeDetector({ formats: [...FORMATOS] });
}

export function Escaner({ abierto, alLeer, alCerrar }: { abierto: boolean; alLeer: (codigo: string) => void; alCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [linterna, setLinterna] = useState<null | boolean>(null);
  const pista = useRef<MediaStreamTrack | null>(null);
  const callback = useRef(alLeer);
  callback.current = alLeer; // siempre la última versión, sin reiniciar la cámara

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    let flujo: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout>;
    setError("");

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("sin-camara");
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!activo || !video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        pista.current = flujo.getVideoTracks()[0] ?? null;
        const caps = pista.current?.getCapabilities?.() as { torch?: boolean } | undefined;
        setLinterna(caps?.torch ? false : null);

        const detector = await crearDetector();
        const buscar = async () => {
          if (!activo || !video.current) return;
          try {
            if (video.current.readyState >= 2) {
              const res = await detector.detect(video.current);
              const codigo = res[0]?.rawValue?.trim();
              if (codigo) {
                navigator.vibrate?.(80);
                activo = false;
                callback.current(codigo);
                return;
              }
            }
          } catch { /* cuadro ilegible: sigue */ }
          timer = setTimeout(buscar, 150);
        };
        buscar();
      } catch (e) {
        const nombre = (e as Error).name;
        setError(
          nombre === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones."
            : "No se pudo abrir la cámara. Escribí el código a mano.",
        );
      }
    })();

    return () => {
      activo = false;
      clearTimeout(timer);
      flujo?.getTracks().forEach((t) => t.stop());
      pista.current = null;
    };
  }, [abierto]);

  async function alternarLinterna() {
    if (!pista.current || linterna === null) return;
    try {
      await pista.current.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] });
      setLinterna(!linterna);
    } catch { /* sin linterna */ }
  }

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-label="Escanear código">
      <div className="flex items-center justify-between p-4">
        <span>Apuntá al código de barras</span>
        <button onClick={alCerrar} className="btn bg-white/15 text-white"><IconoCerrar className="size-4" /> Cerrar</button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={video} playsInline muted className="max-h-full w-full object-cover" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-[85%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-coral" />
        </div>
      </div>
      <div className="space-y-3 p-4 text-center text-sm">
        {error ? <p className="rounded-xl bg-red-600/90 p-3">{error}</p> : <p className="opacity-80">Con buena luz y el código derecho lee al instante.</p>}
        {linterna !== null && <button onClick={alternarLinterna} className="btn bg-white/15 text-white">{linterna ? "Apagar linterna" : "Encender linterna"}</button>}
      </div>
    </div>
  );
}
