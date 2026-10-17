import type { Disponibilidad, EstadoProducto } from "@/lib/supabase/database.types";

const disp: Record<Disponibilidad, [string, string]> = {
  disponible: ["Disponible", "bg-emerald-100 text-emerald-800"],
  pocas: ["Pocas", "bg-amber-100 text-amber-800"],
  agotado: ["Agotado", "bg-red-100 text-red-800"],
};
const est: Record<EstadoProducto, [string, string] | null> = {
  publicado: null,
  borrador: ["Oculto", "bg-slate-200 text-slate-700"],
  archivado: ["Archivado", "bg-slate-300 text-slate-800"],
};

export function EstadoChips({ estado, disponibilidad, extra }: { estado: EstadoProducto; disponibilidad: Disponibilidad; extra?: React.ReactNode }) {
  const e = est[estado];
  const [t, c] = disp[disponibilidad];
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-[0.7rem] font-semibold">
      <span className={`rounded-full px-2 py-0.5 ${c}`}>{t}</span>
      {e && <span className={`rounded-full px-2 py-0.5 ${e[1]}`}>{e[0]}</span>}
      {extra}
    </div>
  );
}
