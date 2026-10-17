"use client";
import { useCallback, useEffect, useState } from "react";

/** Carga datos en el navegador con estado de "cargando" y una función para recargar. */
export function useCargar<T>(cargar: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(cargar, deps);
  const recargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await ejecutar()); setError(null); } catch (e) { setError(e); } finally { setCargando(false); }
  }, [ejecutar]);
  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, cargando, recargar };
}
