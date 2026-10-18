import { negocio } from "@/lib/negocio";
import { linkWhatsApp } from "@/lib/formato";
import { IconoWhatsApp } from "@/componentes/ui/Iconos";

const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.direccion}, Argentina`)}`;

/** Las dos estrellas del logo, como sello del pie. */
function Estrellas() {
  return (
    <svg viewBox="0 0 120 70" className="h-14 w-auto" aria-hidden>
      <path d="M30 4l7.6 15.4 17 2.5-12.3 12 2.9 16.9L30 42.8l-15.2 8 2.9-16.9-12.3-12 17-2.5Z" fill="#00cccb" transform="rotate(-12 30 28)" />
      <path d="M92 26l4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.5L92 50l-9.4 4.9 1.8-10.5-7.6-7.4 10.5-1.5Z" fill="#e8444b" transform="rotate(10 92 40)" />
    </svg>
  );
}

export function Pie() {
  return (
    <footer className="mt-16 bg-patito text-azul">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Estrellas />
          <h2 className="mt-3 font-display text-3xl leading-none">Visitanos en el local</h2>
          <p className="mt-3 text-lg">{negocio.direccion}</p>
          <p>{negocio.horarios}</p>
          <a href={mapa} target="_blank" rel="noopener" className="mt-2 inline-block font-bold underline decoration-2 underline-offset-4">
            Cómo llegar
          </a>
        </div>
        <div>
          <h2 className="font-display text-2xl leading-none">Escribinos</h2>
          <p className="mt-3">¿No encontrás algo? Preguntanos, seguro lo tenemos o lo conseguimos.</p>
          <a
            href={linkWhatsApp(negocio.whatsapp, "Hola! Quería hacer una consulta.")}
            target="_blank"
            rel="noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-azul px-5 py-3 font-bold text-white transition hover:bg-azul/90"
          >
            <IconoWhatsApp className="size-5" /> WhatsApp
          </a>
        </div>
        <div>
          <h2 className="font-display text-2xl leading-none">Seguinos</h2>
          <ul className="mt-3 space-y-2 text-lg font-bold">
            <li><a href={negocio.instagram} target="_blank" rel="noopener" className="underline decoration-2 underline-offset-4">Instagram</a></li>
            <li><a href={negocio.facebook} target="_blank" rel="noopener" className="underline decoration-2 underline-offset-4">Facebook</a></li>
          </ul>
        </div>
      </div>
      <p className="border-t-2 border-azul/15 px-4 py-4 text-center text-sm">{negocio.descripcion}</p>
    </footer>
  );
}
