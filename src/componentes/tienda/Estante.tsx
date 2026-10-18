import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { TarjetaProducto } from "./TarjetaProducto";

/** Fila que se desliza con el dedo en el celular; en pantallas grandes se ven varias juntas. */
export function Estante({ items, prioridad = false }: { items: ItemCatalogo[]; prioridad?: boolean }) {
  return (
    <ul className="estante -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
      {items.map((p, i) => (
        <li key={p.id} className={`flex w-[44%] shrink-0 sm:w-[200px] lg:w-auto ${i >= 5 ? "lg:hidden" : ""}`}>
          <TarjetaProducto p={p} indice={i} prioridad={prioridad && i < 3} />
        </li>
      ))}
    </ul>
  );
}
