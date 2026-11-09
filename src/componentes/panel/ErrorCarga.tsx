"use client";
import { mensajeError } from "@/lib/errores";

/** En vez de quedar "Cargando…" para siempre: dice qué falló y deja reintentar. */
export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar: () => void }) {
  return (
    <div className="tarjeta space-y-2 border-red-200 bg-red-50 p-4 text-sm" role="alert">
      <p className="font-medium text-red-800">No se pudo cargar.</p>
      <p className="text-red-700">{mensajeError(error)}</p>
      <button type="button" className="btn-claro w-full" onClick={reintentar}>Reintentar</button>
    </div>
  );
}
