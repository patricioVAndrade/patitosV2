"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { comprimirFoto, subirFoto, borrarFotos, type FotoComprimida, type FotoSubida } from "@/lib/imagenes";
import { esCodigoDeBarras, normalizar } from "@/lib/formato";
import { mensajeError } from "@/lib/errores";
import { usePanel } from "./ContextoPanel";
import { Escaner } from "./Escaner";
import { IconoCerrar, IconoEscanear, IconoFotos } from "@/componentes/ui/Iconos";
import { AvisoRepetidos } from "./AvisoRepetidos";

type Estado = "comprimiendo" | "listo" | "subiendo" | "ok" | "error";
interface Borrador { id: string; foto?: FotoComprimida; nombre: string; codigo: string; precio: string; estado: Estado; mensaje?: string }

export function CargaMasiva({ categorias, marcas }: { categorias: { id: number; nombre: string }[]; marcas: { id: number; nombre: string }[] }) {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [categoriaId, setCategoriaId] = useState(categorias.find((c) => c.nombre === "Varios")?.id ?? categorias[0]?.id ?? 0);
  const [marcaTexto, setMarcaTexto] = useState("");
  const [visible, setVisible] = useState(true);
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [publicando, setPublicando] = useState(false);
  const [escaneando, setEscaneando] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try { const u = Number(localStorage.getItem("ultimaCategoria")); if (categorias.some((c) => c.id === u)) setCategoriaId(u); } catch { /* */ }
  }, [categorias]);

  useEffect(() => {
    const pendientes = borradores.some((b) => b.estado === "listo" || b.estado === "error");
    const h = (e: BeforeUnloadEvent) => { if (pendientes) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [borradores]);

  const actualizar = (id: string, cambio: Partial<Borrador>) => setBorradores((bs) => bs.map((b) => (b.id === id ? { ...b, ...cambio } : b)));

  async function elegir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const nuevos: Borrador[] = Array.from(archivos).map(() => ({ id: crypto.randomUUID(), nombre: "", codigo: "", precio: "", estado: "comprimiendo" }));
    setBorradores((bs) => [...bs, ...nuevos]);
    const lista = Array.from(archivos);
    for (let i = 0; i < lista.length; i++) {
      const b = nuevos[i]!;
      try {
        actualizar(b.id, { foto: await comprimirFoto(lista[i]!), estado: "listo" });
      } catch {
        actualizar(b.id, { estado: "error", mensaje: "No se pudo leer la foto" });
      }
    }
    setTimeout(() => refs.current[nuevos[0]!.id]?.focus(), 50);
  }

  async function marcaId(): Promise<number | null> {
    const t = marcaTexto.trim();
    if (!t) return null;
    const m = marcas.find((x) => normalizar(x.nombre) === normalizar(t));
    if (m) return m.id;
    const { data, error } = await supabase.from("marcas").insert({ nombre: t.toUpperCase(), slug: "" }).select("id").single();
    if (error) throw error;
    marcas.push({ id: data.id, nombre: t.toUpperCase() });
    return data.id;
  }

  async function publicar() {
    setPublicando(true);
    let ok = 0, mal = 0, sinNombre = 0;
    let marca_id: number | null = null;
    try { marca_id = await marcaId(); } catch (e) { avisar(mensajeError(e), "error"); setPublicando(false); return; }
    try { localStorage.setItem("ultimaCategoria", String(categoriaId)); } catch { /* */ }

    for (const b of borradores) {
      if (!(b.estado === "listo" || (b.estado === "error" && b.foto))) continue;
      const nombre = b.nombre.trim().replace(/\s+/g, " ").toUpperCase();
      if (nombre.length < 2) { sinNombre++; actualizar(b.id, { estado: "error", mensaje: "Falta el nombre" }); continue; }
      actualizar(b.id, { estado: "subiendo", mensaje: undefined });
      let subida: FotoSubida | null = null;
      try {
        subida = await subirFoto(supabase, b.foto!);
        const codigo = b.codigo.trim().toUpperCase();
        const precio = b.precio.trim() === "" ? null : Number(b.precio.replace(",", "."));
        const { data, error } = await supabase.rpc("guardar_producto", {
          datos: {
            nombre, categoria_id: categoriaId, marca_id, precio,
            estado: visible ? "publicado" : "borrador",
            imagenes: [subida],
            codigos: codigo ? [{ codigo, tipo: esCodigoDeBarras(codigo) ? "barras" : "legado" }] : [],
          },
        });
        if (error) throw error;
        await supabase.rpc("guardar_huellas", { p_datos: [{ ruta_thumb: subida.ruta_thumb, huella: b.foto!.huella }] });
        ok++;
        actualizar(b.id, { estado: "ok", mensaje: `Publicado ${data.sku}` });
      } catch (e) {
        mal++;
        if (subida) await borrarFotos(supabase, [subida.ruta_thumb, subida.ruta_full]);
        actualizar(b.id, { estado: "error", mensaje: mensajeError(e) });
      }
    }
    setPublicando(false);
    avisar(`${ok} publicados${mal ? ` · ${mal} con error` : ""}${sinNombre ? ` · ${sinNombre} sin nombre` : ""}`, mal || sinNombre ? "error" : "ok");
  }

  const pendientes = borradores.filter((b) => b.estado === "listo" || (b.estado === "error" && b.foto)).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Carga masiva</h1>
      <section className="tarjeta space-y-3 p-4">
        <p className="text-sm text-suave">Sacá todas las fotos primero, elegilas juntas acá, escribí los nombres (Enter pasa al siguiente) y publicá todo de una vez.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="m-cat" className="etiqueta-campo">Categoría para todos</label>
            <select id="m-cat" value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))} className="campo">
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="m-marca" className="etiqueta-campo">Marca para todos</label>
            <input id="m-marca" list="m-marcas" value={marcaTexto} onChange={(e) => setMarcaTexto(e.target.value)} className="campo uppercase" placeholder="Opcional" />
            <datalist id="m-marcas">{marcas.map((m) => <option key={m.id} value={m.nombre} />)}</datalist>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="size-4 accent-coral" /> Publicar visibles en la web
        </label>
        <label className="btn-primario w-full cursor-pointer py-3">
          <IconoFotos /> Elegir fotos
          <input type="file" accept="image/*" multiple hidden data-testid="input-masiva" onChange={(e) => { elegir(e.target.files); e.target.value = ""; }} />
        </label>
      </section>

      <ul className="space-y-2" data-testid="borradores">
        {borradores.map((b, i) => (
          <li key={b.id} data-estado={b.estado} className={`flex gap-3 rounded-2xl border bg-white p-2 ${b.estado === "ok" ? "border-emerald-400 bg-emerald-50" : b.estado === "error" ? "border-red-300" : "border-borde"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.foto?.previa ?? "/sin-foto.svg"} alt="" className="size-24 shrink-0 rounded-xl bg-crema object-contain" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input
                ref={(el) => { refs.current[b.id] = el; }}
                value={b.nombre}
                onChange={(e) => actualizar(b.id, { nombre: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const sig = borradores[i + 1]; if (sig) refs.current[sig.id]?.focus(); } }}
                placeholder="Nombre *"
                aria-label={`Nombre del artículo ${i + 1}`}
                className="campo py-1.5 uppercase"
                disabled={b.estado === "ok" || b.estado === "subiendo"}
                enterKeyHint="next"
              />
              <div className="flex gap-1.5">
                <input value={b.codigo} onChange={(e) => actualizar(b.id, { codigo: e.target.value })} placeholder="Código (opc.)" aria-label={`Código del artículo ${i + 1}`} className="campo py-1.5 font-mono" disabled={b.estado === "ok"} />
                <button type="button" onClick={() => setEscaneando(b.id)} className="btn-claro px-2" aria-label="Escanear" disabled={b.estado === "ok"}><IconoEscanear className="size-4" /></button>
              </div>
              <div className="flex items-center gap-1.5">
                <input value={b.precio} onChange={(e) => actualizar(b.id, { precio: e.target.value })} placeholder="Precio (opc.)" aria-label={`Precio del artículo ${i + 1}`} inputMode="decimal" className="campo py-1.5" disabled={b.estado === "ok"} />
                {b.estado !== "ok" && (
                  <button type="button" onClick={() => setBorradores((bs) => bs.filter((x) => x.id !== b.id))} className="btn-claro px-2 text-red-600" aria-label="Quitar"><IconoCerrar className="size-4" /></button>
                )}
              </div>
              {b.estado !== "ok" && (
                <AvisoRepetidos compacto nombre={b.nombre} huellas={b.foto ? [b.foto.huella] : []} />
              )}
              <p className={`text-xs ${b.estado === "error" ? "text-red-600" : "text-suave"}`} data-testid="estado-borrador">
                {b.estado === "comprimiendo" ? "Comprimiendo…" : b.estado === "subiendo" ? "Subiendo…" : b.mensaje ?? (b.foto ? `${Math.round((b.foto.thumb.size + b.foto.full.size) / 1024)} KB` : "")}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {pendientes > 0 && (
        <button onClick={publicar} disabled={publicando} className="btn w-full bg-emerald-600 py-3 text-base text-white hover:bg-emerald-700">
          {publicando ? "Publicando…" : `Publicar ${pendientes} artículo${pendientes === 1 ? "" : "s"}`}
        </button>
      )}

      <Escaner abierto={!!escaneando} alCerrar={() => setEscaneando(null)} alLeer={(c) => { if (escaneando) actualizar(escaneando, { codigo: c.trim().toUpperCase() }); setEscaneando(null); }} />
    </div>
  );
}
