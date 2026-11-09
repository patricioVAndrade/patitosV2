// Íconos SVG propios (sin dependencias externas)
type P = { className?: string };
const base = (className?: string) => ({ className: className ?? "size-5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true });

export const IconoBuscar = ({ className }: P) => (<svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const IconoEscanear = ({ className }: P) => (<svg {...base(className)}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 8v8M10 8v8M13 8v8M17 8v8" /></svg>);
export const IconoFotos = ({ className }: P) => (<svg {...base(className)}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m21 17-5-5-8 8" /></svg>);
export const IconoCamara = ({ className }: P) => (<svg {...base(className)}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const IconoLista = ({ className }: P) => (<svg {...base(className)}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
export const IconoReloj = ({ className }: P) => (<svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconoUsuarios = ({ className }: P) => (<svg {...base(className)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>);
export const IconoInicio = ({ className }: P) => (<svg {...base(className)}><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></svg>);
export const IconoMas = ({ className }: P) => (<svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconoCerrar = ({ className }: P) => (<svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconoOjo = ({ className }: P) => (<svg {...base(className)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconoOjoTachado = ({ className }: P) => (<svg {...base(className)}><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>);
export const IconoBasura = ({ className }: P) => (<svg {...base(className)}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" /></svg>);
export const IconoFlechaIzq = ({ className }: P) => (<svg {...base(className)}><path d="M15 18l-6-6 6-6" /></svg>);
export const IconoFlechaDer = ({ className }: P) => (<svg {...base(className)}><path d="m9 18 6-6-6-6" /></svg>);
export const IconoSalir = ({ className }: P) => (<svg {...base(className)}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3" /></svg>);
export const IconoWhatsApp = ({ className }: P) => (
  <svg className={className ?? "size-5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.7.1-.8.9-.9 1.1-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5c0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .9 2.7.9 3.7.8a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.4ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.2 23.8l6-1.6A11.8 11.8 0 1 0 12 .2Z" />
  </svg>
);
export const IconoCheck = ({ className }: P) => (<svg {...base(className)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconoListaMas = ({ className }: P) => (<svg {...base(className)}><path d="M4 6h11M4 12h8M4 18h7M18 13v8M14 17h8" /></svg>);
export const IconoCompartir = ({ className }: P) => (<svg {...base(className)}><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>);
export const IconoDescargar = ({ className }: P) => (<svg {...base(className)}><path d="M12 3v12M8 11l4 4 4-4M5 19h14" /></svg>);
export const IconoEtiqueta = ({ className }: P) => (<svg {...base(className)}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>);
export const IconoUnir = ({ className }: P) => (<svg {...base(className)}><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>);
export const IconoFactura = ({ className }: P) => (<svg {...base(className)}><path d="M6 3h9l4 4v14l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V4a1 1 0 0 1 1-1Z" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>);
