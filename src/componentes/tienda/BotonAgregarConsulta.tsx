"use client";
import { consulta, useConsulta, type ItemConsulta } from "@/lib/tienda/consulta";
import { IconoCheck, IconoListaMas } from "@/componentes/ui/Iconos";

/** Agrega o saca un artículo de "Mi consulta". Compacto (tarjeta) = botón redondo; grande (ficha) = botón con texto. */
export function BotonAgregarConsulta({ item, grande = false }: { item: ItemConsulta; grande?: boolean }) {
  const lista = useConsulta();
  const agregado = lista.some((i) => i.sku === item.sku);
  const alternar = () => (agregado ? consulta.quitar(item.sku) : consulta.agregar(item));

  if (grande) {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-pressed={agregado}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full border-2 px-5 py-3 font-bold transition active:scale-[0.98] ${
          agregado ? "border-azul bg-azul text-white" : "border-azul bg-white text-azul hover:bg-azul/5"
        }`}
      >
        {agregado ? <IconoCheck className="size-5" /> : <IconoListaMas className="size-5" />}
        {agregado ? "Está en tu consulta (tocá para sacarlo)" : "Agregar a mi consulta"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={agregado}
      aria-label={agregado ? "Sacar de mi consulta" : "Agregar a mi consulta"}
      title={agregado ? "Sacar de mi consulta" : "Agregar a mi consulta"}
      className={`grid size-9 shrink-0 place-items-center rounded-full border-2 transition active:scale-95 ${
        agregado ? "border-azul bg-azul text-white" : "border-azul bg-white text-azul hover:bg-azul/5"
      }`}
    >
      {agregado ? <IconoCheck className="size-[1.1rem]" /> : <IconoListaMas className="size-[1.1rem]" />}
    </button>
  );
}
