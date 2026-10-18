"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Perfil } from "@/lib/supabase/database.types";
import { puede } from "@/lib/permisos";
import { env } from "@/lib/env";
import { IconoFotos, IconoInicio, IconoLista, IconoReloj, IconoSalir, IconoUsuarios } from "@/componentes/ui/Iconos";

export function NavPanel({ perfil }: { perfil: Perfil }) {
  const ruta = usePathname();
  const items = [
    { href: "/panel", texto: "Inicio", Icono: IconoInicio, exacto: true },
    { href: "/panel/articulos", texto: "Artículos", Icono: IconoLista },
    { href: "/panel/masiva", texto: "Masiva", Icono: IconoFotos },
    ...(puede.verHistorial(perfil.rol) ? [{ href: "/panel/historial", texto: "Historial", Icono: IconoReloj }] : []),
    ...(puede.administrarUsuarios(perfil.rol) ? [{ href: "/panel/usuarios", texto: "Usuarios", Icono: IconoUsuarios }] : []),
  ];
  const activo = (href: string, exacto?: boolean) => (exacto ? ruta === href : ruta.startsWith(href));

  return (
    <>
      {/* Escritorio: barra lateral */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-borde bg-white p-4 md:flex">
        <Link href="/panel" className="mb-6 text-lg font-semibold">🐣 Panel</Link>
        <nav className="flex flex-col gap-1">
          {items.map(({ href, texto, Icono, exacto }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${activo(href, exacto) ? "bg-coral text-white" : "hover:bg-crema"}`}>
              <Icono /> {texto}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-borde pt-4 text-sm">
          <p className="font-medium">{perfil.nombre}</p>
          <p className="mb-2 text-xs capitalize text-suave">{perfil.rol}</p>
          <div className="flex gap-2">
            <a href={`${env.sitioUrl}/`} target="_blank" rel="noopener" className="btn-claro px-3 py-1 text-xs">Ver catálogo</a>
            <form action="/auth/salir" method="post"><button className="btn-claro px-3 py-1 text-xs" title="Salir"><IconoSalir className="size-4" /></button></form>
          </div>
        </div>
      </aside>

      {/* Celular: barra superior + pestañas abajo */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-borde bg-white px-4 py-2.5 md:hidden">
        <span className="font-semibold">🐣 Panel</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="max-w-32 truncate">{perfil.nombre}</span>
          <form action="/auth/salir" method="post"><button aria-label="Salir" className="p-1 text-suave"><IconoSalir className="size-5" /></button></form>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borde bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items.map(({ href, texto, Icono, exacto }) => (
          <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.7rem] ${activo(href, exacto) ? "font-semibold text-coral" : "text-suave"}`}>
            <Icono className="size-6" />
            {texto}
          </Link>
        ))}
      </nav>
    </>
  );
}
