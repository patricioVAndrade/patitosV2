import { linkWhatsApp } from "@/lib/formato";
import { negocio } from "@/lib/negocio";
import { IconoWhatsApp } from "@/componentes/ui/Iconos";

/** El mensaje lleva el nombre tal como está cargado y el código, para que en el local lo encuentren al toque. */
export function BotonWhatsApp({ p, compacto = false }: { p: { nombre: string; sku: string; disponibilidad: string; en_oferta: boolean }; compacto?: boolean }) {
  const agotado = p.disponibilidad === "agotado";
  const texto = agotado
    ? `Hola! ¿Les va a volver a entrar ${p.nombre}? (Cód: ${p.sku})`
    : p.en_oferta
      ? `Hola! Me interesa la OFERTA de: ${p.nombre} (Cód: ${p.sku})`
      : `Hola! Quisiera consultar por: ${p.nombre} (Cód: ${p.sku})`;
  const clase = compacto
    ? agotado ? "btn-consultar border-linea text-gris hover:border-azul hover:bg-azul" : "btn-consultar"
    : agotado ? "btn-whatsapp-grande bg-azul hover:bg-azul/90" : "btn-whatsapp-grande";
  return (
    <a href={linkWhatsApp(negocio.whatsapp, texto)} target="_blank" rel="noopener" className={clase}>
      <IconoWhatsApp className={compacto ? "size-4" : "size-5"} />
      {agotado ? "Avisame si vuelve" : compacto ? "Consultar" : "Consultar por WhatsApp"}
    </a>
  );
}
