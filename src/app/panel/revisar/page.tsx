"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { useCargar } from "@/componentes/panel/useCargar";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { mensajeError } from "@/lib/errores";
import { ErrorCarga } from "@/componentes/panel/ErrorCarga";
import { urlFoto } from "@/lib/formato";
import type { Disponibilidad, GrupoFaltante, ItemRevision, ItemSimple } from "@/lib/supabase/database.types";

const DIAS = [30, 60, 90, 180];

const GRUPOS: { g: GrupoFaltante; titulo: string; porque: string }[] = [
  { g: "sin_foto", titulo: "Sin foto", porque: "Con foto se consultan mucho más." },
  { g: "agotado_viejo", titulo: "Agotados hace más de 45 días", porque: "Si no van a volver, conviene ocultarlos de la web." },
  { g: "oferta_sin_antes", titulo: "Ofertas sin precio anterior", porque: "Sin el precio tachado no se nota el descuento." },
  { g: "sin_precio", titulo: "Sin precio", porque: "No se puede mostrar el precio ni ponerlos en oferta." },
  { g: "nombre_corto", titulo: "Nombre muy corto", porque: "Un nombre más completo ayuda a que los encuentren, también en Google." },
  { g: "en_varios", titulo: "En la categoría «Varios»", porque: "¿Van en otra categoría?" },
  { g: "sin_marca", titulo: "Sin marca", porque: "La marca ayuda a encontrarlos y a aumentar precios por marca." },
];

/** "hace 3 meses" */
function hace(fecha: string): string {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses < 12 ? `hace ${meses} ${meses === 1 ? "mes" : "meses"}` : "hace más de un año";
}

function Revisar() {
  const sp = useSearchParams();
  const router = useRouter();
  const pestana = sp.get("ver") === "faltan" ? "faltan" : "sigue";
  const tab = (activo: boolean) => `flex-1 rounded-full px-3 py-2 text-sm ${activo ? "bg-coral text-white" : "bg-white"}`;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Revisar</h1>
      <div className="flex gap-1 rounded-full border border-borde bg-white p-1" role="tablist">
        <button role="tab" aria-selected={pestana === "sigue"} className={tab(pestana === "sigue")} onClick={() => router.replace("/panel/revisar")}>¿Sigue habiendo?</button>
        <button role="tab" aria-selected={pestana === "faltan"} className={tab(pestana === "faltan")} onClick={() => router.replace("/panel/revisar?ver=faltan")}>Datos que faltan</button>
      </div>
      {pestana === "sigue" ? <SigueHabiendo /> : <DatosQueFaltan />}
    </div>
  );
}

function SigueHabiendo() {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [dias, setDias] = useState(60);
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const { datos, error: errorCarga, recargar } = useCargar(async () => {
    const { data, error } = await supabase.rpc("pendientes_revision", { p_dias: dias, p_limite: 60 });
    if (error) throw error;
    setHechos(new Set());
    return data;
  }, [dias]);

  async function resolver(i: ItemRevision, cambio: { disponibilidad?: Disponibilidad; estado?: "borrador" } | null, texto: string) {
    if (cambio) {
      const { error } = await supabase.from("productos").update(cambio).eq("id", i.id);
      if (error) return avisar(mensajeError(error), "error");
    }
    const { error } = await supabase.rpc("marcar_revisado", { p_ids: [i.id] });
    if (error) return avisar(mensajeError(error), "error");
    setHechos((h) => new Set(h).add(i.id));
    avisar(texto);
  }

  const pendientes = (datos?.items ?? []).filter((i) => !hechos.has(i.id));
  const total = Math.max(0, (datos?.total ?? 0) - hechos.size);

  return (
    <section className="space-y-3">
      <p className="text-sm text-suave">
        Artículos publicados que nadie tocó ni confirmó en un tiempo. Revisá si siguen en el local: así la web no muestra cosas que ya no están.
      </p>
      <label className="flex items-center gap-2 text-sm">
        Sin revisar hace más de
        <select className="campo w-auto py-1" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
          {DIAS.map((d) => <option key={d} value={d}>{d} días</option>)}
        </select>
      </label>
      {errorCarga && !datos ? (
        <ErrorCarga error={errorCarga} reintentar={recargar} />
      ) : !datos ? (
        <p className="text-suave">Cargando…</p>
      ) : total === 0 ? (
        <p className="tarjeta p-6 text-center">Todo al día 🎉 No hay artículos sin revisar hace más de {dias} días.</p>
      ) : (
        <>
          <p className="font-medium" aria-live="polite">{total} para revisar</p>
          <ul className="space-y-2" data-testid="revisar">
            {pendientes.map((i) => (
              <li key={i.id} className="tarjeta p-3">
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(i.ruta_thumb)} alt="" className="size-16 shrink-0 rounded-xl bg-crema object-contain" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/panel/articulos/${i.id}`} className="line-clamp-2 font-medium leading-tight hover:underline">{i.nombre}</Link>
                    <p className="text-xs text-suave">{i.sku} · última vez {hace(i.ultima_vez)}{i.disponibilidad !== "disponible" ? ` · ${i.disponibilidad === "pocas" ? "figura «pocas»" : "figura agotado"}` : ""}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
                  <button className="btn border border-emerald-600 bg-emerald-600 px-1 text-white" onClick={() => resolver(i, i.disponibilidad === "disponible" ? null : { disponibilidad: "disponible" }, "Confirmado: sigue habiendo ✔")}>Sí, hay</button>
                  <button className="btn border border-amber-400 px-1 text-amber-800" onClick={() => resolver(i, { disponibilidad: "pocas" }, "Marcado: quedan pocas")}>Pocas</button>
                  <button className="btn border border-red-300 px-1 text-red-700" onClick={() => resolver(i, { disponibilidad: "agotado" }, "Marcado como agotado")}>Agotado</button>
                  <button className="btn-claro px-1" onClick={() => resolver(i, { estado: "borrador" }, "Oculto de la web")}>Ocultar</button>
                </div>
              </li>
            ))}
          </ul>
          {pendientes.length === 0 && <button className="btn-claro w-full" onClick={recargar}>Ver más</button>}
        </>
      )}
    </section>
  );
}

function DatosQueFaltan() {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const { datos, error: errorCarga, recargar } = useCargar(async () => {
    const { data, error } = await supabase.rpc("datos_faltantes", { p_limite: 40 });
    if (error) throw error;
    return data;
  });

  async function ocultarTodos(items: ItemSimple[], total: number) {
    if (!window.confirm(`¿Ocultar de la web ${items.length < total ? `estos ${items.length}` : `los ${total}`} artículos agotados hace más de 45 días? Se pueden volver a mostrar cuando quieras.`)) return;
    const { data, error } = await supabase.rpc("cambiar_productos", { p_ids: items.map((i) => i.id), p_cambios: { estado: "borrador" } });
    if (error) return avisar(mensajeError(error), "error");
    avisar(`${data} artículos ocultos ✔`);
    recargar();
  }

  if (errorCarga && !datos) return <ErrorCarga error={errorCarga} reintentar={recargar} />;
  if (!datos) return <p className="text-suave">Cargando…</p>;
  const grupos = GRUPOS.filter(({ g }) => (datos[g]?.total ?? 0) > 0);
  if (!grupos.length) return <p className="tarjeta p-6 text-center">No falta nada 🎉</p>;

  return (
    <section className="space-y-2" data-testid="faltantes">
      <p className="text-sm text-suave">Tocá un grupo para ver los artículos y completarlos.</p>
      {grupos.map(({ g, titulo, porque }) => {
        const { total, items } = datos[g]!;
        return (
          <details key={g} className="tarjeta group p-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{titulo}</span>
                <span className="block text-sm text-suave">{porque}</span>
              </span>
              <span className="shrink-0 rounded-full bg-crema px-2.5 py-0.5 text-sm font-semibold">{total.toLocaleString("es-AR")}</span>
            </summary>
            <div className="border-t border-borde p-3">
              {g === "agotado_viejo" && (
                <button className="btn-claro mb-2 w-full text-sm" onClick={() => ocultarTodos(items, total)}>Ocultar estos de la web</button>
              )}
              <ul className="divide-y divide-borde">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link href={`/panel/articulos/${i.id}`} className="flex items-center gap-3 py-2 text-sm hover:text-coral">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlFoto(i.ruta_thumb)} alt="" className="size-10 shrink-0 rounded-lg bg-crema object-contain" />
                      <span className="min-w-0 flex-1 truncate">{i.nombre}</span>
                      <span className="shrink-0 text-xs text-suave">{i.sku}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {total > items.length && <p className="pt-2 text-xs text-suave">Mostrando los {items.length} más viejos de {total.toLocaleString("es-AR")}.</p>}
            </div>
          </details>
        );
      })}
    </section>
  );
}

export default function PaginaRevisar() {
  return <Suspense><Revisar /></Suspense>;
}
