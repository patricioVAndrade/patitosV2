import { linkWhatsApp } from "@/lib/formato";
import { negocio } from "@/lib/negocio";
import { IconoWhatsApp } from "@/componentes/ui/Iconos";

export function BotonWhatsApp({ p, compacto = false }: { p: { nombre: string; sku: string; disponibilidad: string; en_oferta: boolean }; compacto?: boolean }) {
  const agotado = p.disponibilidad === "agotado";
  const texto = agotado
    ? `Hola! ¿Les va a volver a entrar ${p.nombre}? (Cód: ${p.sku})`
    : p.en_oferta
      ? `Hola! Me interesa la OFERTA de: ${p.nombre} (Cód: ${p.sku})`
      : `Hola! Quisiera consultar por: ${p.nombre} (Cód: ${p.sku})`;
  return (
    <a
      href={linkWhatsApp(negocio.whatsapp, texto)}
      target="_blank"
      rel="noopener"
      className={`${agotado ? "btn-claro" : "btn-whatsapp"} w-full ${compacto ? "py-1.5 text-sm" : "py-3"}`}
    >
      <IconoWhatsApp className="size-4" />
      {agotado ? "Avisame si vuelve" : "Consultar"}
    </a>
  );
}
