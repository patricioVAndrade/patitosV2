"use client";
import { createContext, useCallback, useContext, useState } from "react";
import type { Perfil } from "@/lib/supabase/database.types";

type TipoAviso = "ok" | "error" | "info";
interface Aviso { id: number; texto: string; tipo: TipoAviso }

const Ctx = createContext<{ perfil: Perfil; avisar: (texto: string, tipo?: TipoAviso) => void } | null>(null);

export function ProveedorPanel({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: TipoAviso = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 6000 : 2800);
  }, []);
  return (
    <Ctx.Provider value={{ perfil, avisar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === "error" ? "alert" : "status"}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg ${a.tipo === "error" ? "bg-red-600" : a.tipo === "info" ? "bg-slate-700" : "bg-emerald-600"}`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function usePanel() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePanel fuera del panel");
  return c;
}
