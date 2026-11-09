"use client";
import { useMemo, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { useCargar } from "@/componentes/panel/useCargar";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { mensajeError } from "@/lib/errores";
import { fechaHora, moneda } from "@/lib/formato";
import type { ItemAjuste, ResultadoAjuste } from "@/lib/supabase/database.types";

type Por = "marca" | "proveedor" | "categoria";
const POR: { v: Por; t: string; campo: "marca_id" | "proveedor_id" | "categoria_id" }[] = [
  { v: "marca", t: "Marca", campo: "marca_id" },
  { v: "proveedor", t: "Proveedor", campo: "proveedor_id" },
  { v: "categoria", t: "Categoría", campo: "categoria_id" },
];
const RAPIDOS = [5, 10, 15, 20, 30];
const REDONDEOS = [1, 10, 50, 100, 500];

/** La base devuelve de a 1000 filas: se piden por páginas para contar bien. */
async function todosLosProductos() {
  const supabase = supabaseNavegador();
  const filas: { marca_id: number | null; proveedor_id: number | null; categoria_id: number }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("productos").select("marca_id,proveedor_id,categoria_id")
      .neq("estado", "archivado").order("id").range(desde, desde + 999);
    if (error) throw error;
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: filas };
}

export default function PaginaPrecios() {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [por, setPor] = useState<Por>("marca");
  const [elegido, setElegido] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [rebaja, setRebaja] = useState(false);
  const [conCosto, setConCosto] = useState(false);
  const [redondeo, setRedondeo] = useState(100);
  const [previa, setPrevia] = useState<ResultadoAjuste | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const { datos } = useCargar(async () => {
    const [m, p, c, prods, cfg] = await Promise.all([
      supabase.from("marcas").select("id,nombre").order("nombre"),
      supabase.from("proveedores").select("id,nombre").order("nombre"),
      supabase.from("categorias").select("id,nombre").order("orden"),
      todosLosProductos(),
      supabase.from("config").select("valor").eq("clave", "redondeo").maybeSingle(),
    ]);
    if (typeof cfg.data?.valor === "number") setRedondeo(cfg.data.valor);
    const contar = (campo: "marca_id" | "proveedor_id" | "categoria_id") => {
      const n = new Map<number, number>();
      for (const r of prods.data ?? []) if (r[campo] != null) n.set(r[campo]!, (n.get(r[campo]!) ?? 0) + 1);
      return n;
    };
    const conCantidad = (lista: { id: number; nombre: string }[] | null, campo: "marca_id" | "proveedor_id" | "categoria_id") => {
      const n = contar(campo);
      return (lista ?? []).map((x) => ({ ...x, cantidad: n.get(x.id) ?? 0 })).filter((x) => x.cantidad > 0);
    };
    return {
      marca: conCantidad(m.data, "marca_id").sort((a, b) => b.cantidad - a.cantidad),
      proveedor: conCantidad(p.data, "proveedor_id"),
      categoria: conCantidad(c.data, "categoria_id"),
    };
  });

  const { datos: ajustes, recargar: recargarAjustes } = useCargar(async () => {
    const { data } = await supabase.from("ajustes_precio").select("*").order("fecha", { ascending: false }).limit(15);
    return data ?? [];
  });

  const numero = Number(porcentaje.replace(",", "."));
  const pct = rebaja ? -numero : numero;
  const valido = elegido !== "" && Number.isFinite(numero) && numero > 0 && numero <= (rebaja ? 90 : 300);
  const campo = POR.find((x) => x.v === por)!.campo;
  const criterio = useMemo(() => ({ [campo]: Number(elegido) }), [campo, elegido]);
  const nombreElegido = datos?.[por].find((x) => String(x.id) === elegido)?.nombre ?? "";

  function cambio() { setPrevia(null); }

  async function verPrevia() {
    setTrabajando(true);
    const { data, error } = await supabase.rpc("ajustar_precios", { p_criterio: criterio, p_porcentaje: pct, p_redondeo: redondeo, p_tambien_costo: conCosto });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    setPrevia(data);
  }

  async function aplicar() {
    if (!previa) return;
    const texto = `${rebaja ? "Rebajar" : "Aumentar"} ${numero}% ${conCosto ? "el precio y el costo de" : "el precio de"} ${previa.cantidad} artículos de ${nombreElegido}?\n\nSe puede deshacer después.`;
    if (!window.confirm(texto)) return;
    setTrabajando(true);
    const { data, error } = await supabase.rpc("ajustar_precios", { p_criterio: criterio, p_porcentaje: pct, p_redondeo: redondeo, p_tambien_costo: conCosto, p_aplicar: true });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Listo: ${data.cantidad} artículos actualizados ✔`);
    setPrevia(null);
    setPorcentaje("");
    recargarAjustes();
  }

  async function deshacer(id: number, descripcion: string) {
    if (!window.confirm(`¿Deshacer "${descripcion}"? Cada artículo vuelve al precio que tenía antes.`)) return;
    const { data, error } = await supabase.rpc("revertir_ajuste", { p_ajuste: id });
    if (error) return avisar(mensajeError(error), "error");
    avisar(
      `Deshecho: ${data.revertidos} volvieron al precio anterior.` +
        (data.respetados ? ` ${data.respetados} se dejaron como están porque alguien los cambió después.` : ""),
    );
    recargarAjustes();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Aumentos de precios</h1>
        <p className="text-sm text-suave">Subí o bajá en porcentaje todos los artículos de una marca, un proveedor o una categoría.</p>
      </div>

      <section className="tarjeta space-y-4 p-4">
        <div className="flex gap-2" role="radiogroup" aria-label="Aplicar a">
          {POR.map((x) => (
            <button key={x.v} type="button" role="radio" aria-checked={por === x.v}
              onClick={() => { setPor(x.v); setElegido(""); cambio(); }}
              className={`rounded-full border px-4 py-1.5 text-sm ${por === x.v ? "border-coral bg-coral text-white" : "border-borde bg-white"}`}>
              {x.t}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">{POR.find((x) => x.v === por)!.t}</span>
          <select className="campo" value={elegido} onChange={(e) => { setElegido(e.target.value); cambio(); }} aria-label={POR.find((x) => x.v === por)!.t}>
            <option value="">Elegí…</option>
            {(datos?.[por] ?? []).map((x) => (
              <option key={x.id} value={x.id}>{x.nombre} ({x.cantidad})</option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium">Porcentaje</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-borde text-sm">
              <button type="button" onClick={() => { setRebaja(false); cambio(); }} aria-pressed={!rebaja} className={`px-3 py-1.5 ${!rebaja ? "bg-coral text-white" : "bg-white"}`}>Aumento</button>
              <button type="button" onClick={() => { setRebaja(true); cambio(); }} aria-pressed={rebaja} className={`px-3 py-1.5 ${rebaja ? "bg-coral text-white" : "bg-white"}`}>Rebaja</button>
            </div>
            <div className="flex items-center gap-1">
              <input inputMode="decimal" className="campo w-24 text-right" value={porcentaje} placeholder="0"
                onChange={(e) => { setPorcentaje(e.target.value.replace(/[^\d.,]/g, "")); cambio(); }} aria-label="Porcentaje" />
              <span className="text-lg">%</span>
            </div>
            {RAPIDOS.map((n) => (
              <button key={n} type="button" onClick={() => { setPorcentaje(String(n)); cambio(); }} className="rounded-full border border-borde bg-white px-3 py-1 text-sm hover:border-coral">{n}%</button>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-coral" checked={conCosto} onChange={(e) => { setConCosto(e.target.checked); cambio(); }} />
          <span>Cambiar también el <strong>costo</strong> (por ejemplo, cuando el proveedor aumentó su lista)</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Redondear a
          <select className="campo w-auto py-1" value={redondeo} onChange={(e) => { setRedondeo(Number(e.target.value)); cambio(); }}>
            {REDONDEOS.map((r) => <option key={r} value={r}>{r === 1 ? "sin redondear" : `$${r}`}</option>)}
          </select>
        </label>

        <button type="button" className="btn-claro w-full" disabled={!valido || trabajando} onClick={verPrevia}>
          {trabajando && !previa ? "Calculando…" : "Ver cómo quedan los precios"}
        </button>
      </section>

      {previa && (
        <section className="tarjeta space-y-3 p-4" data-testid="vista-previa">
          {previa.cantidad === 0 ? (
            <p>No hay artículos con precio en {nombreElegido}.</p>
          ) : (
            <>
              <p className="font-medium">
                {previa.cantidad} artículo{previa.cantidad === 1 ? "" : "s"} de {nombreElegido} · {rebaja ? "−" : "+"}{numero}%
                {redondeo > 1 ? ` · redondeado a $${redondeo}` : ""}
              </p>
              <ul className="max-h-[50vh] divide-y divide-borde overflow-y-auto rounded-xl border border-borde text-sm">
                {previa.items.map((i) => <FilaPrevia key={i.id} i={i} conCosto={conCosto} />)}
              </ul>
              <button type="button" className="btn-primario w-full" disabled={trabajando} onClick={aplicar}>
                {trabajando ? "Aplicando…" : `${rebaja ? "Rebajar" : "Aumentar"} ${previa.cantidad} artículos`}
              </button>
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Últimos ajustes</h2>
        {!ajustes?.length && <p className="text-sm text-suave">Todavía no se hizo ninguno.</p>}
        <ul className="space-y-2" data-testid="ajustes">
          {ajustes?.map((a) => (
            <li key={a.id} className="tarjeta flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${a.revertido ? "text-suave line-through" : ""}`}>{a.descripcion}</p>
                <p className="text-xs text-suave">{fechaHora(a.fecha)} · {a.cantidad} artículos{a.revertido ? " · deshecho" : ""}</p>
              </div>
              {!a.revertido && <button type="button" className="btn-claro px-3 py-1 text-xs" onClick={() => deshacer(a.id, a.descripcion)}>Deshacer</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilaPrevia({ i, conCosto }: { i: ItemAjuste; conCosto: boolean }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate">{i.nombre}</p>
        <p className="text-xs text-suave">{i.sku}{i.estado === "borrador" ? " · oculto" : ""}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        {i.precio_antes !== null ? (
          <p><span className="text-suave">{moneda(i.precio_antes)}</span> → <strong>{moneda(i.precio_nuevo!)}</strong></p>
        ) : <p className="text-suave">sin precio</p>}
        {conCosto && i.costo_antes !== null && (
          <p className="text-xs text-suave">costo {moneda(i.costo_antes)} → {moneda(i.costo_nuevo!)}</p>
        )}
      </div>
    </li>
  );
}
