import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Escanear } from "@/componentes/panel/Escanear";

export default async function InicioPanel({ searchParams }: { searchParams: Promise<{ escanear?: string }> }) {
  const { escanear } = await searchParams;
  const supabase = await supabaseServidor();
  const { data: r } = await supabase.rpc("resumen_panel");
  const tarjetas = r
    ? [
        { n: r.publicados, t: "Publicados", href: "/panel/articulos" },
        { n: r.hoy, t: "Cargados hoy", href: "/panel/historial" },
        { n: r.agotados, t: "Agotados", href: "/panel/articulos?f=agotados" },
        { n: r.sin_foto, t: "Sin foto", href: "/panel/articulos?f=sinfoto" },
        { n: r.sin_marca, t: "Sin marca", href: "/panel/articulos?f=sinmarca" },
        { n: r.borradores + r.archivados, t: "Ocultos", href: "/panel/articulos?f=ocultos" },
      ]
    : [];
  return (
    <div className="space-y-5">
      <Escanear abrirAlInicio={escanear === "1"} />
      <section aria-label="Resumen" className="grid grid-cols-3 gap-2">
        {tarjetas.map((c) => (
          <Link key={c.t} href={c.href} className="tarjeta p-3 text-center hover:border-coral">
            <p className="text-2xl font-semibold">{c.n.toLocaleString("es-AR")}</p>
            <p className="text-xs text-suave">{c.t}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
