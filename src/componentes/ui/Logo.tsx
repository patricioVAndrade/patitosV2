"use client";
import { useEffect, useRef, useState } from "react";
import { negocio } from "@/lib/negocio";

/** Muestra /logo.png; si todavía no se copió el archivo, muestra el nombre del negocio. */
export function Logo({ alto = 48 }: { alto?: number }) {
  const [falla, setFalla] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Si la imagen falló antes de que React se activara, onError no se dispara: lo revisamos al montar
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFalla(true);
  }, []);
  if (falla) return <span className="text-2xl font-semibold text-coral">{negocio.nombre} 🐣</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} src="/logo.png" alt={negocio.nombre} style={{ height: alto }} className="w-auto" onError={() => setFalla(true)} />;
}
