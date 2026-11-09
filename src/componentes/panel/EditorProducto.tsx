"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { comprimirFoto, subirFoto, borrarFotos, type FotoComprimida, type FotoSubida } from "@/lib/imagenes";
import { esCodigoDeBarras, marcaVisible, nombreVisible, normalizar, urlFoto, urlProducto } from "@/lib/formato";
import { mensajeError } from "@/lib/errores";
import { env } from "@/lib/env";
import { esquemaProducto } from "@/lib/validacion";
import type { Disponibilidad, EstadoProducto, ItemLista, Producto, TipoCodigo } from "@/lib/supabase/database.types";
import { usePanel } from "./ContextoPanel";
import { Escaner } from "./Escaner";
import { CompartirImagen } from "./CompartirImagen";
import { IconoBasura, IconoCamara, IconoEscanear, IconoFlechaDer, IconoFlechaIzq, IconoFotos } from "@/componentes/ui/Iconos";

type CodigoEd = { codigo: string; tipo: TipoCodigo; proveedor_id: number | null };
type FotoEd = { clave: string; existente?: FotoSubida; nueva?: FotoComprimida };
type Opcion = { id: number; nombre: string };

export interface ValoresIniciales {
  producto: Producto | null;
  codigos: CodigoEd[];
  imagenes: { ruta_thumb: string; ruta_full: string; ancho: number | null; alto: number | null }[];
  etiquetas: number[];
  costo: number | null;
  /** Al duplicar: el artículo de origen (se copian sus datos y fotos, no sus códigos) */
  base?: Producto | null;
  prefill?: { nombre?: string; categoria_id?: number; marca_id?: number | null; marcaTexto?: string; proveedor_id?: number | null; precio?: number | null };
}

const EDADES = [
  { v: "", t: "—" }, { v: "0", t: "0 meses" }, { v: "6", t: "6 meses" }, { v: "12", t: "1 año" }, { v: "18", t: "18 meses" },
  { v: "24", t: "2 años" }, { v: "36", t: "3 años" }, { v: "48", t: "4 años" }, { v: "60", t: "5 años" }, { v: "72", t: "6 años" },
  { v: "96", t: "8 años" }, { v: "120", t: "10 años" }, { v: "144", t: "12 años" }, { v: "168", t: "14 años" }, { v: "216", t: "18 años" },
];
const hoyMas = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function EditorProducto({ iniciales, listas, aviso, continuo, verCostos, puedeBorrar }: {
  iniciales: ValoresIniciales;
  listas: { categorias: Opcion[]; marcas: Opcion[]; proveedores: Opcion[]; etiquetas: Opcion[] };
  aviso: string | null;
  continuo: boolean;
  verCostos: boolean;
  puedeBorrar: boolean;
}) {
  const supabase = supabaseNavegador();
  const router = useRouter();
  const { avisar } = usePanel();
  const p = iniciales.producto;
  const b = p ?? iniciales.base ?? null; // de dónde salen los valores iniciales (el mismo artículo o el que se duplica)
  const pre = iniciales.prefill ?? {};

  const ultimaCategoria = () => { try { return Number(localStorage.getItem("ultimaCategoria")) || undefined; } catch { return undefined; } };
  const [nombre, setNombre] = useState(b?.nombre ?? pre.nombre ?? "");
  const [variantes, setVariantes] = useState(b?.variantes ?? "");
  const [descripcion, setDescripcion] = useState(b?.descripcion ?? "");
  const [categoriaId, setCategoriaId] = useState<number>(b?.categoria_id ?? pre.categoria_id ?? listas.categorias.find((c) => c.nombre === "Varios")?.id ?? listas.categorias[0]?.id ?? 0);
  const [marcaTexto, setMarcaTexto] = useState(
    listas.marcas.find((m) => m.id === (b?.marca_id ?? pre.marca_id))?.nombre ?? pre.marcaTexto ?? "",
  );
  const [proveedorId, setProveedorId] = useState<number | null>(b?.proveedor_id ?? pre.proveedor_id ?? null);
  const [precio, setPrecio] = useState(b?.precio?.toString() ?? pre.precio?.toString() ?? "");
  const [precioAnterior, setPrecioAnterior] = useState(b?.precio_anterior?.toString() ?? "");
  const [mostrarPrecio, setMostrarPrecio] = useState(b?.mostrar_precio ?? false);
  const [enOferta, setEnOferta] = useState(b?.en_oferta ?? false);
  const [estado, setEstado] = useState<EstadoProducto>(b?.estado ?? "publicado");
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>(b?.disponibilidad ?? "disponible");
  const [nuevoHasta, setNuevoHasta] = useState(p ? p.nuevo_hasta ?? "" : hoyMas(30));
  const [edadDesde, setEdadDesde] = useState(b?.edad_desde_meses?.toString() ?? "");
  const [edadHasta, setEdadHasta] = useState(b?.edad_hasta_meses?.toString() ?? "");
  const [codigos, setCodigos] = useState<CodigoEd[]>(iniciales.codigos);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [etiquetas, setEtiquetas] = useState<number[]>(iniciales.etiquetas);
  const [costo, setCosto] = useState(iniciales.costo?.toString() ?? "");
  const [fotos, setFotos] = useState<FotoEd[]>(iniciales.imagenes.map((i) => ({ clave: i.ruta_thumb, existente: { ruta_thumb: i.ruta_thumb, ruta_full: i.ruta_full, ancho: i.ancho ?? 0, alto: i.alto ?? 0 } })));
  const [comprimiendo, setComprimiendo] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<ItemLista[]>([]);
  const [masOpciones, setMasOpciones] = useState(!!b);

  // Nuevo artículo: recordar la última categoría usada
  useEffect(() => {
    if (!b && !pre.categoria_id) {
      const u = ultimaCategoria();
      if (u && listas.categorias.some((c) => c.id === u)) setCategoriaId(u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autocompletar desde las listas de proveedores mientras se escribe el nombre (solo artículos nuevos)
  useEffect(() => {
    if (p || nombre.trim().length < 4 || nombre === pre.nombre) { setSugerencias([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("buscar_en_listas", { p_texto: nombre, p_limite: 6 });
      setSugerencias((data ?? []).filter((s) => !s.ya_cargado));
    }, 400);
    return () => clearTimeout(t);
  }, [nombre, p, pre.nombre, supabase]);

  function usarSugerencia(s: ItemLista) {
    setNombre(s.nombre);
    const cat = listas.categorias.find((c) => normalizar(c.nombre) === normalizar(s.categoria ?? ""));
    if (cat) setCategoriaId(cat.id);
    if (s.marca && !marcaTexto) setMarcaTexto(s.marca);
    setProveedorId(s.proveedor_id);
    if (s.precio_sugerido !== null && !precio) setPrecio(String(s.precio_sugerido));
    if (s.costo !== null && !costo) setCosto(String(s.costo));
    if (!codigos.some((c) => c.codigo === s.codigo)) setCodigos((c) => [...c, { codigo: s.codigo, tipo: "proveedor", proveedor_id: s.proveedor_id }]);
    setSugerencias([]);
  }

  async function agregarFotos(lista: FileList | null) {
    if (!lista?.length) return;
    const archivos = Array.from(lista).slice(0, 8);
    setComprimiendo((n) => n + archivos.length);
    for (const f of archivos) {
      try {
        const nueva = await comprimirFoto(f);
        setFotos((fs) => [...fs, { clave: nueva.previa, nueva }]);
      } catch {
        avisar("No se pudo leer una de las fotos", "error");
      } finally {
        setComprimiendo((n) => n - 1);
      }
    }
  }

  function moverFoto(i: number, d: -1 | 1) {
    setFotos((fs) => {
      const c = [...fs];
      const j = i + d;
      if (j < 0 || j >= c.length) return fs;
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  }

  function agregarCodigo(crudo: string) {
    const c = crudo.trim().toUpperCase().replace(/\s+/g, "");
    if (!c) return;
    if (codigos.some((x) => x.codigo === c)) return avisar("Ese código ya está en la lista", "info");
    setCodigos((cs) => [...cs, { codigo: c, tipo: esCodigoDeBarras(c) ? "barras" : "legado", proveedor_id: null }]);
    setNuevoCodigo("");
  }

  async function resolverMarca(): Promise<number | null> {
    const t = marcaTexto.trim();
    if (!t) return null;
    const existente = listas.marcas.find((m) => normalizar(m.nombre) === normalizar(t));
    if (existente) return existente.id;
    const { data, error } = await supabase.from("marcas").insert({ nombre: t.toUpperCase(), slug: "" }).select("id").single();
    if (error) {
      // Otra persona la creó recién: la buscamos
      const { data: otra } = await supabase.from("marcas").select("id,nombre");
      const m = (otra ?? []).find((x) => normalizar(x.nombre) === normalizar(t));
      if (m) return m.id;
      throw error;
    }
    return data.id;
  }

  const sinGuardar = useMemo(() => fotos.some((f) => f.nueva), [fotos]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (sinGuardar && !guardando) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sinGuardar, guardando]);

  async function guardar(siguiente: "quedarse" | "otro") {
    setErrores([]);
    const borrador = {
      nombre: nombre.trim().replace(/\s+/g, " ").toUpperCase(),
      descripcion: descripcion.trim() || null,
      variantes: variantes.trim().replace(/\s+/g, " ") || null,
      categoria_id: categoriaId,
      marca_id: null as number | null,
      proveedor_id: proveedorId,
      precio: num(precio),
      precio_anterior: enOferta ? num(precioAnterior) : null,
      mostrar_precio: mostrarPrecio,
      en_oferta: enOferta,
      estado,
      disponibilidad,
      nuevo_hasta: nuevoHasta || null,
      edad_desde_meses: edadDesde === "" ? null : Number(edadDesde),
      edad_hasta_meses: edadHasta === "" ? null : Number(edadHasta),
      codigos,
      etiquetas,
    };
    const v = esquemaProducto.safeParse(borrador);
    if (!v.success) {
      setErrores(v.error.issues.map((i) => i.message));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setGuardando(true);
    const subidas: FotoSubida[] = [];
    try {
      const marca_id = await resolverMarca();
      // 1) subir fotos nuevas (en paralelo, de a 3)
      const lista: FotoSubida[] = [];
      for (const f of fotos) {
        if (f.existente) lista.push(f.existente);
        else if (f.nueva) {
          const s = await subirFoto(supabase, f.nueva);
          subidas.push(s);
          lista.push(s);
        }
      }
      // 2) guardar todo en una sola transacción
      const datos = { ...v.data, marca_id, id: p?.id ?? null, imagenes: lista, ...(verCostos ? { costo: num(costo) } : {}) };
      const { data, error } = await supabase.rpc("guardar_producto", { datos });
      if (error) throw error;
      // 3) liberar espacio: borrar del storage las fotos que se quitaron
      if (data.fotos_quitadas.length) await borrarFotos(supabase, data.fotos_quitadas);
      try { localStorage.setItem("ultimaCategoria", String(categoriaId)); } catch { /* sin storage */ }
      avisar(p ? "Cambios guardados ✔" : `Publicado ✔ ${data.sku}`);
      if (continuo && !p) router.push("/panel?escanear=1");
      else if (siguiente === "otro") router.push("/panel/articulos/nuevo");
      else if (!p) router.replace(`/panel/articulos/${data.id}`);
      else router.refresh();
      setFotos(lista.map((l) => ({ clave: l.ruta_thumb, existente: l })));
    } catch (e) {
      if (subidas.length) await borrarFotos(supabase, subidas.flatMap((s) => [s.ruta_thumb, s.ruta_full]));
      setErrores([mensajeError(e)]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!p || !confirm(`¿Eliminar definitivamente "${p.nombre}"?\n\nSi solo querés que no se vea, usá "Oculto" o "Archivado" (se puede deshacer).`)) return;
    const { error } = await supabase.from("productos").delete().eq("id", p.id);
    if (error) return avisar(mensajeError(error), "error");
    // Solo se borran del storage las fotos que no usa otro artículo (por ejemplo, un duplicado)
    const rutas = fotos.flatMap((f) => (f.existente ? [f.existente.ruta_thumb, f.existente.ruta_full] : []));
    const { data: sinUso } = await supabase.rpc("fotos_sin_uso", { p_rutas: rutas });
    await borrarFotos(supabase, sinUso ?? []);
    avisar("Artículo eliminado");
    router.push("/panel/articulos");
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar("quedarse"); }} className="space-y-5" noValidate>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{p ? "Editar artículo" : "Nuevo artículo"}</h1>
        {p && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-suave">{p.sku}</span>
            {p.estado === "publicado" && <a href={`${env.sitioUrl}${urlProducto(p)}`} target="_blank" rel="noopener" className="btn-claro px-3 py-1 text-xs">Ver en la web</a>}
            <CompartirImagen
              sku={p.sku}
              link={`${env.sitioUrl}${urlProducto(p)}`}
              datos={{
                nombre: nombreVisible(nombre || p.nombre, marcaTexto),
                marca: marcaTexto.trim() ? marcaVisible(marcaTexto.trim().toUpperCase()) : null,
                foto: fotos[0]?.existente ? urlFoto(fotos[0].existente.ruta_full) : fotos[0]?.nueva?.previa ?? null,
                precio: num(precio),
                precioVisible: mostrarPrecio || enOferta,
                precioAnterior: num(precioAnterior),
                oferta: enOferta,
                nuevo: !!nuevoHasta && nuevoHasta >= new Date().toISOString().slice(0, 10),
                sitio: env.sitioUrl.replace(/^https?:\/\/(www\.)?/, ""),
              }}
            />
            <button type="button" onClick={() => router.push(`/panel/articulos/nuevo?desde=${p.id}`)} className="btn-claro px-3 py-1 text-xs" title="Crear otro artículo con estos datos y fotos (por ejemplo, otro color)">
              Duplicar
            </button>
          </div>
        )}
      </div>

      {iniciales.base && !p && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Copia de <strong>{iniciales.base.sku}</strong>: cambiá lo que haga falta (nombre, color, código) y guardá. Las fotos se comparten, no ocupan espacio de más.
        </p>
      )}
      {aviso && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{aviso}</p>}
      {errores.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errores.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      {/* FOTOS */}
      <section className="tarjeta p-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <div key={f.clave} className="relative aspect-square overflow-hidden rounded-xl border border-borde bg-crema">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.nueva ? f.nueva.previa : urlFoto(f.existente?.ruta_thumb)} alt={`Foto ${i + 1}`} className="size-full object-contain" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-coral px-2 text-[0.65rem] font-semibold text-white">Principal</span>}
              {f.nueva && <span className="absolute right-1 top-1 rounded-full bg-sky-600 px-2 text-[0.65rem] text-white">{Math.round((f.nueva.thumb.size + f.nueva.full.size) / 1024)} KB</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/40 p-1">
                <button type="button" onClick={() => moverFoto(i, -1)} aria-label="Mover a la izquierda" className="text-white disabled:opacity-30" disabled={i === 0}><IconoFlechaIzq className="size-5" /></button>
                <button type="button" onClick={() => setFotos((fs) => fs.filter((_, j) => j !== i))} aria-label="Quitar foto" className="text-white"><IconoBasura className="size-5" /></button>
                <button type="button" onClick={() => moverFoto(i, 1)} aria-label="Mover a la derecha" className="text-white disabled:opacity-30" disabled={i === fotos.length - 1}><IconoFlechaDer className="size-5" /></button>
              </div>
            </div>
          ))}
          {comprimiendo > 0 && <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-borde text-xs text-suave">Comprimiendo…</div>}
          {fotos.length === 0 && comprimiendo === 0 && (
            <div className="col-span-3 grid place-items-center rounded-xl border border-dashed border-borde py-8 text-sm text-suave sm:col-span-4">Sin fotos todavía</div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="btn-primario cursor-pointer py-3">
            <IconoCamara /> Sacar foto
            <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="btn-claro cursor-pointer py-3">
            <IconoFotos /> Galería
            <input type="file" accept="image/*" multiple hidden data-testid="input-galeria" onChange={(e) => { agregarFotos(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </section>

      {/* DATOS PRINCIPALES */}
      <section className="space-y-3">
        <div className="relative">
          <label htmlFor="nombre" className="etiqueta-campo">Nombre *</label>
          <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo uppercase" autoComplete="off" maxLength={200} required />
          {sugerencias.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-borde bg-white shadow-lg" data-testid="sugerencias">
              <li className="bg-crema px-3 py-1 text-xs text-suave">De las listas de proveedores (tocá para completar):</li>
              {sugerencias.map((s) => (
                <li key={`${s.proveedor_id}-${s.codigo}`}>
                  <button type="button" onClick={() => usarSugerencia(s)} className="w-full px-3 py-2 text-left text-sm hover:bg-crema">
                    {s.nombre} <span className="text-suave">· {s.proveedor}{s.costo ? ` · costo $${s.costo.toLocaleString("es-AR")}` : ""}{s.precio_sugerido ? ` · sugerido $${s.precio_sugerido.toLocaleString("es-AR")}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="variantes" className="etiqueta-campo">Colores / modelos <span className="font-normal">(opcional)</span></label>
          <input id="variantes" value={variantes} onChange={(e) => setVariantes(e.target.value)} className="campo" maxLength={300} placeholder="Ej: rojo, azul · modelos surtidos" autoComplete="off" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="categoria" className="etiqueta-campo">Categoría</label>
            <select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(Number(e.target.value))} className="campo">
              {listas.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="marca" className="etiqueta-campo">Marca</label>
            <input id="marca" list="lista-marcas" value={marcaTexto} onChange={(e) => setMarcaTexto(e.target.value)} className="campo uppercase" placeholder="Ej: DURAVIT" autoComplete="off" />
            <datalist id="lista-marcas">{listas.marcas.map((m) => <option key={m.id} value={m.nombre} />)}</datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="precio" className="etiqueta-campo">Precio de venta</label>
            <input id="precio" value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal" className="campo" placeholder="Opcional" />
          </div>
          <div className="flex flex-col justify-end gap-1 pb-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={mostrarPrecio} onChange={(e) => setMostrarPrecio(e.target.checked)} className="size-4 accent-coral" /> Mostrar precio</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={enOferta} onChange={(e) => setEnOferta(e.target.checked)} className="size-4 accent-coral" /> Oferta 🔥</label>
          </div>
        </div>
        {enOferta && (
          <div>
            <label htmlFor="precio-anterior" className="etiqueta-campo">Precio anterior (se muestra tachado)</label>
            <input id="precio-anterior" value={precioAnterior} onChange={(e) => setPrecioAnterior(e.target.value)} inputMode="decimal" className="campo" />
          </div>
        )}

        <div>
          <span className="etiqueta-campo">Stock</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Stock">
            {(["disponible", "pocas", "agotado"] as const).map((d) => (
              <button type="button" key={d} role="radio" aria-checked={disponibilidad === d} onClick={() => setDisponibilidad(d)}
                className={`btn border ${disponibilidad === d ? { disponible: "border-emerald-600 bg-emerald-600 text-white", pocas: "border-amber-500 bg-amber-500 text-white", agotado: "border-red-600 bg-red-600 text-white" }[d] : "border-borde bg-white"}`}>
                {{ disponible: "Disponible", pocas: "Pocas", agotado: "Agotado" }[d]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="etiqueta-campo">En la web</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Visibilidad">
            {(["publicado", "borrador", "archivado"] as const).map((e) => (
              <button type="button" key={e} role="radio" aria-checked={estado === e} onClick={() => setEstado(e)}
                className={`btn border ${estado === e ? "border-tinta bg-tinta text-white" : "border-borde bg-white"}`}>
                {{ publicado: "Visible", borrador: "Oculto", archivado: "Archivado" }[e]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CÓDIGOS */}
      <section className="tarjeta space-y-2 p-3">
        <h2 className="text-sm font-semibold">Códigos con los que se encuentra</h2>
        <ul className="flex flex-wrap gap-2" data-testid="codigos">
          {codigos.map((c) => (
            <li key={c.codigo} className="chip font-mono">
              {c.codigo}
              <span className="font-sans text-[0.65rem] text-suave">{{ barras: "barras", proveedor: "proveedor", legado: "viejo" }[c.tipo]}</span>
              <button type="button" onClick={() => setCodigos((cs) => cs.filter((x) => x.codigo !== c.codigo))} aria-label={`Quitar ${c.codigo}`} className="text-suave hover:text-red-600">×</button>
            </li>
          ))}
          {codigos.length === 0 && <li className="text-sm text-suave">Ninguno (se encuentra por su SKU)</li>}
        </ul>
        <div className="flex gap-2">
          <input value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarCodigo(nuevoCodigo); } }}
            placeholder="Agregar código" aria-label="Agregar código" className="campo font-mono" />
          <button type="button" onClick={() => agregarCodigo(nuevoCodigo)} className="btn-claro">Agregar</button>
          <button type="button" onClick={() => setEscanerAbierto(true)} className="btn-claro" aria-label="Escanear código"><IconoEscanear /></button>
        </div>
      </section>

      {/* MÁS OPCIONES */}
      <details open={masOpciones} onToggle={(e) => setMasOpciones((e.target as HTMLDetailsElement).open)} className="tarjeta p-3">
        <summary className="cursor-pointer text-sm font-semibold">Más datos (descripción, edad, proveedor, etiquetas)</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="descripcion" className="etiqueta-campo">Descripción</label>
            <textarea id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="campo" maxLength={4000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edad-desde" className="etiqueta-campo">Edad desde</label>
              <select id="edad-desde" value={edadDesde} onChange={(e) => setEdadDesde(e.target.value)} className="campo">{EDADES.map((x) => <option key={x.v} value={x.v}>{x.t}</option>)}</select>
            </div>
            <div>
              <label htmlFor="edad-hasta" className="etiqueta-campo">Edad hasta</label>
              <select id="edad-hasta" value={edadHasta} onChange={(e) => setEdadHasta(e.target.value)} className="campo">{EDADES.map((x) => <option key={x.v} value={x.v}>{x.t}</option>)}</select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="proveedor" className="etiqueta-campo">Proveedor</label>
              <select id="proveedor" value={proveedorId ?? ""} onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : null)} className="campo">
                <option value="">—</option>
                {listas.proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="nuevo-hasta" className="etiqueta-campo">&quot;¡Nuevo!&quot; hasta</label>
              <input id="nuevo-hasta" type="date" value={nuevoHasta} onChange={(e) => setNuevoHasta(e.target.value)} className="campo" />
            </div>
          </div>
          {listas.etiquetas.length > 0 && (
            <fieldset>
              <legend className="etiqueta-campo">Etiquetas</legend>
              <div className="flex flex-wrap gap-2">
                {listas.etiquetas.map((e) => (
                  <label key={e.id} className={`chip cursor-pointer ${etiquetas.includes(e.id) ? "chip-activo" : ""}`}>
                    <input type="checkbox" className="sr-only" checked={etiquetas.includes(e.id)} onChange={(ev) => setEtiquetas((xs) => (ev.target.checked ? [...xs, e.id] : xs.filter((x) => x !== e.id)))} />
                    {e.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {verCostos && (
            <div className="rounded-xl border border-dashed border-borde p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-suave">Interno · no se publica</p>
              <label htmlFor="costo" className="etiqueta-campo">Costo</label>
              <div className="flex gap-2">
                <input id="costo" value={costo} onChange={(e) => setCosto(e.target.value)} inputMode="decimal" className="campo" />
                <button type="button" className="btn-claro whitespace-nowrap" onClick={async () => {
                  const c = num(costo);
                  if (c === null) return;
                  const { data } = await supabase.rpc("precio_sugerido", { p_costo: c });
                  if (data !== null && data !== undefined) setPrecio(String(data));
                }}>Sugerir precio</button>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* ACCIONES */}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 -mx-4 flex gap-2 border-t border-borde bg-crema/95 px-4 py-3 backdrop-blur md:bottom-0">
        {p && puedeBorrar && (
          <button type="button" onClick={eliminar} className="btn-claro text-red-600" aria-label="Eliminar"><IconoBasura /></button>
        )}
        {!p && !continuo && (
          <button type="button" onClick={() => guardar("otro")} disabled={guardando || comprimiendo > 0} className="btn-claro flex-1">Guardar y cargar otro</button>
        )}
        <button type="submit" disabled={guardando || comprimiendo > 0} className="btn-primario flex-1 py-3 text-base">
          {guardando ? "Guardando…" : comprimiendo > 0 ? "Procesando fotos…" : p ? "Guardar cambios" : "Publicar"}
        </button>
      </div>

      <Escaner abierto={escanerAbierto} alLeer={(c) => { setEscanerAbierto(false); agregarCodigo(c); }} alCerrar={() => setEscanerAbierto(false)} />
    </form>
  );
}
