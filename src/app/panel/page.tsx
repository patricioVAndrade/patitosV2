"use client";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { Escanear } from "@/componentes/panel/Escanear";
import { useCargar } from "@/componentes/panel/useCargar";

function Inicio() {
  const abrir = useSearchParams().get("escanear") === "1";
  const { datos: r } = useCargar(async () => (await supabaseNavegador().rpc("resumen_panel")).data);
  const { datos: aRevisar } = useCargar(async () => (await supabaseNavegador().rpc("pendientes_revision", { p_dias: 60, p_limite: 1 })).data?.total ?? 0);
  const tarjetas = r
    ? [
        { n: r.publicados, t: "Publicados", href: "/panel/articulos" },
        { n: r.hoy, t: "Cargados hoy", href: "/panel/articulos" },
        { n: r.agotados, t: "Agotados", href: "/panel/articulos?f=agotados" },
        { n: r.sin_foto, t: "Sin foto", href: "/panel/articulos?f=sinfoto" },
        { n: r.sin_marca, t: "Sin marca", href: "/panel/articulos?f=sinmarca" },
        { n: r.borradores + r.archivados, t: "Ocultos", href: "/panel/articulos?f=ocultos" },
      ]
    : [];
  return (
    <div className="space-y-5">
      <Escanear abrirAlInicio={abrir} />
      <section aria-label="Resumen" className="grid grid-cols-3 gap-2">
        {tarjetas.map((c) => (
          <Link key={c.t} href={c.href} className="tarjeta p-3 text-center hover:border-coral">
            <p className="text-2xl font-semibold">{c.n.toLocaleString("es-AR")}</p>
            <p className="text-xs text-suave">{c.t}</p>
          </Link>
        ))}
      </section>
      {!!aRevisar && (
        <Link href="/panel/revisar" className="tarjeta flex items-center gap-3 border-amber-300 bg-amber-50 p-4 hover:border-coral">
          <span className="text-2xl" aria-hidden>🔎</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{aRevisar.toLocaleString("es-AR")} artículos para revisar</span>
            <span className="block text-sm text-suave">Nadie los tocó en 2 meses: ¿siguen habiendo?</span>
          </span>
        </Link>
      )}
    </div>
  );
}

export default function PaginaInicio() {
  return <Suspense><Inicio /></Suspense>;
}
