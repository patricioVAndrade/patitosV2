import Link from "next/link";
import { Logo } from "@/componentes/ui/Logo";
import { negocio } from "@/lib/negocio";

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 rounded-b-3xl bg-white/95 px-4 py-2 shadow-[0_4px_12px_rgba(255,107,107,0.15)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-center">
          <Link href="/" aria-label="Inicio">
            <Logo alto={48} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-4">{children}</main>
      <footer className="border-t border-borde bg-white px-4 py-10 text-center text-suave">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em]">Seguinos en redes</p>
        <div className="mb-6 flex justify-center gap-6 text-sm font-medium">
          <a href={negocio.instagram} className="text-[#E1306C]" target="_blank" rel="noopener">Instagram</a>
          <a href={negocio.facebook} className="text-[#1877F2]" target="_blank" rel="noopener">Facebook</a>
        </div>
        <p className="font-medium text-tinta">📍 Nuestro local</p>
        <p>{negocio.direccion}</p>
        <p className="text-sm">{negocio.horarios}</p>
        <p className="mt-6 text-xs"><Link href="/privacidad" className="underline">Política de privacidad</Link></p>
      </footer>
    </>
  );
}
