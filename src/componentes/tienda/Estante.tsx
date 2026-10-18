import type { ItemCatalogo } from "@/lib/supabase/database.types";
import { TarjetaProducto } from "./TarjetaProducto";
import { Deslizador } from "./Deslizador";

/** Fila que se desliza con el dedo en el celular; en pantallas grandes se ven varias juntas. */
export function Estante({ items, prioridad = false, etiqueta }: { items: ItemCatalogo[]; prioridad?: boolean; etiqueta: string }) {
  return (
    <Deslizador etiqueta={etiqueta}>
      {items.map((p, i) => (
        <li key={p.id} className={`flex w-[44%] shrink-0 sm:w-[200px] lg:w-auto ${i >= 5 ? "lg:hidden" : ""}`}>
          <TarjetaProducto p={p} indice={i} prioridad={prioridad && i < 3} />
        </li>
      ))}
    </Deslizador>
  );
}
