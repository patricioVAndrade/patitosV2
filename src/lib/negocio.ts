// Datos del negocio en un solo lugar (se usan en el sitio, el SEO y WhatsApp)
import { env } from "./env";

export const negocio = {
  nombre: "Patito's Bebe",
  descripcion: "Juguetería y artículos para bebés en Coronel Moldes, Córdoba.",
  direccion: "Av 9 de Julio 255, Coronel Moldes, Córdoba",
  horarios: "Lunes a Sábado de 9:00 a 13:00 y 17:00 a 21:00",
  whatsapp: env.whatsapp,
  instagram: "https://www.instagram.com/patitosbebe/",
  facebook: "https://www.facebook.com/PatitosBebeOficial/",
  /** Correo de contacto público (opcional): aparece en la política de privacidad si se completa. */
  email: "" as string,
} as const;
