"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconoBuscar } from "@/componentes/ui/Iconos";

export function Buscador({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (texto.trim()) p.set("q", texto.trim()); else p.delete("q");
      p.delete("pag");
      router.replace(`${ruta}${p.size ? `?${p}` : ""}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <form role="search" className="sticky top-[68px] z-20 mb-3" onSubmit={(e) => e.preventDefault()}>
      <label className="flex items-center gap-2 rounded-full border border-borde bg-white px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-sky-200">
        <IconoBuscar className="size-5 text-suave" />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar artículo…"
          aria-label="Buscar artículo"
          className="w-full bg-transparent text-base outline-none"
          enterKeyHint="search"
        />
      </label>
    </form>
  );
}
