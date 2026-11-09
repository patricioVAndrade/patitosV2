"use client";
import Link from "next/link";
import { usePanel } from "@/componentes/panel/ContextoPanel";
import { herramientasPanel } from "@/componentes/panel/NavPanel";
import { env } from "@/lib/env";
import { IconoFlechaDer } from "@/componentes/ui/Iconos";

export default function PaginaMas() {
  const { perfil } = usePanel();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Más herramientas</h1>
      <ul className="space-y-2">
        {herramientasPanel(perfil).map(({ href, texto, Icono, detalle }) => (
          <li key={href}>
            <Link href={href} className="tarjeta flex items-center gap-3 p-4 hover:border-coral">
              <Icono className="size-6 shrink-0 text-coral" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{texto}</span>
                <span className="block text-sm text-suave">{detalle}</span>
              </span>
              <IconoFlechaDer className="size-5 text-suave" />
            </Link>
          </li>
        ))}
      </ul>
      <a href={`${env.sitioUrl}/`} target="_blank" rel="noopener" className="btn-claro w-full">Ver el catálogo</a>
    </div>
  );
}
