import { moneda } from "@/lib/formato";

/** Etiqueta de oferta con forma de etiqueta de precio colgada (amarilla con borde rojo, como el logo). */
export function EtiquetaPrecio({ precio, anterior, grande = false, balancea = false, retraso = 0 }: {
  precio: number;
  anterior?: number | null;
  grande?: boolean;
  balancea?: boolean;
  retraso?: number;
}) {
  return (
    <span
      className={`etiqueta-precio ${grande ? "grande" : ""} ${balancea ? "balancea" : ""}`}
      style={retraso ? ({ "--retraso": `${retraso}ms` } as React.CSSProperties) : undefined}
    >
      {anterior ? <span className="antes"><span className="sr-only">Antes </span>{moneda(anterior)}</span> : null}
      <span className="monto"><span className="sr-only">Oferta: </span>{moneda(precio)}</span>
    </span>
  );
}
