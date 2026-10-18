import type { Metadata } from "next";
import Link from "next/link";
import { negocio } from "@/lib/negocio";
import { env } from "@/lib/env";

// Página pública y estática. La pide Google para publicar el inicio de sesión
// del personal, y además cumple con el aviso de la Ley 25.326 (Argentina).
export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Cómo ${negocio.nombre} trata los datos personales en su catálogo y en su panel interno.`,
  alternates: { canonical: "/privacidad" },
};

const ACTUALIZADA = "18 de octubre de 2026";

export default function Privacidad() {
  const whatsapp = negocio.whatsapp ? `https://wa.me/${negocio.whatsapp}` : null;
  return (
    <article className="tarjeta mx-auto max-w-3xl space-y-6 p-6 leading-relaxed sm:p-10 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_section>*+*]:mt-3 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-tinta/90">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Política de privacidad</h1>
        <p className="text-sm text-suave">Última actualización: {ACTUALIZADA}</p>
      </header>

      <section>
        <h2>1. Quiénes somos</h2>
        <p>
          {negocio.nombre} es una juguetería y comercio de artículos para bebés ubicado en {negocio.direccion}.
          Este sitio ({env.sitioUrl.replace(/^https?:\/\//, "")}) es nuestro catálogo en línea: muestra los
          artículos que tenemos en el local, con sus precios y disponibilidad. <strong>No se venden productos
          por la web</strong>: las consultas y compras se hacen por WhatsApp o en el local.
        </p>
        <p>
          Además, el personal del local usa un panel interno de carga (en el subdominio <em>admin</em>) para
          publicar, editar y ocultar artículos. Para entrar a ese panel se usa el inicio de sesión con Google.
        </p>
      </section>

      <section>
        <h2>2. Si visitás el catálogo</h2>
        <ul>
          <li>No necesitás crear una cuenta ni iniciar sesión.</li>
          <li>No te pedimos datos personales ni usamos cookies de publicidad o de seguimiento.</li>
          <li>
            Nuestro proveedor de alojamiento (Cloudflare) registra datos técnicos de cada visita, como la dirección IP
            y el tipo de navegador, solo para el funcionamiento y la seguridad del sitio.
          </li>
          <li>
            Si nos escribís por WhatsApp desde el botón del catálogo, esa conversación se rige por las políticas de
            WhatsApp. Usamos tus mensajes solo para responder tu consulta.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Si sos parte del personal (inicio de sesión con Google)</h2>
        <p>Cuando alguien del personal ingresa al panel con su cuenta de Google, recibimos de Google únicamente:</p>
        <ul>
          <li>el nombre,</li>
          <li>la dirección de correo electrónico, y</li>
          <li>la foto de perfil (si la cuenta tiene una).</li>
        </ul>
        <p>Usamos esos datos exclusivamente para:</p>
        <ul>
          <li>identificar a la persona y permitirle entrar al panel una vez que un administrador la aprueba;</li>
          <li>definir qué puede hacer (empleado o administrador);</li>
          <li>dejar registro de quién cargó o modificó cada artículo.</li>
        </ul>
        <p>
          No accedemos a tus correos, contactos, archivos ni a ningún otro dato de tu cuenta de Google. No vendemos,
          alquilamos ni compartimos estos datos con terceros para publicidad, y no los usamos con ningún otro fin.
        </p>
        <p>
          El uso que hace {negocio.nombre} de la información recibida de las API de Google cumple con la{" "}
          <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener">
            Política de Datos del Usuario de los Servicios de API de Google
          </a>
          , incluidos los requisitos de Uso Limitado.
        </p>
      </section>

      <section>
        <h2>4. Dónde se guardan los datos</h2>
        <p>Trabajamos con estos proveedores, que procesan los datos solo para prestarnos su servicio:</p>
        <ul>
          <li><strong>Supabase</strong>: base de datos, inicio de sesión y fotos de los artículos (servidores en São Paulo, Brasil).</li>
          <li><strong>Cloudflare</strong>: alojamiento y seguridad del sitio.</li>
          <li><strong>Google</strong>: verificación de identidad al iniciar sesión.</li>
        </ul>
        <p>La información viaja cifrada (HTTPS) y el acceso a los datos internos está restringido al personal autorizado.</p>
      </section>

      <section>
        <h2>5. Cuánto tiempo los conservamos</h2>
        <p>
          Los datos del personal se conservan mientras la persona tenga acceso al panel. Cuando deja de trabajar con
          nosotros, se bloquea su acceso y, si lo pide, se eliminan su nombre, correo y foto. El registro de cambios
          sobre los artículos puede conservarse como historial interno.
        </p>
      </section>

      <section>
        <h2>6. Tus derechos</h2>
        <p>
          Podés pedirnos en cualquier momento acceder a tus datos, corregirlos o eliminarlos, escribiéndonos por los
          medios de contacto de abajo. Respondemos dentro de los plazos que fija la Ley 25.326 de Protección de los
          Datos Personales.
        </p>
        <p className="text-sm text-suave">
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
          gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme
          lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326. La Agencia de Acceso a la Información
          Pública, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias
          y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas
          vigentes en materia de protección de datos personales.
        </p>
      </section>

      <section>
        <h2>7. Cambios en esta política</h2>
        <p>Si cambiamos esta política, publicamos la versión nueva en esta misma página con su fecha de actualización.</p>
      </section>

      <section>
        <h2>8. Contacto</h2>
        <ul>
          <li>En el local: {negocio.direccion} ({negocio.horarios}).</li>
          {whatsapp && <li>Por WhatsApp: <a className="underline" href={whatsapp} target="_blank" rel="noopener">+{negocio.whatsapp}</a>.</li>}
          {negocio.email && <li>Por correo: <a className="underline" href={`mailto:${negocio.email}`}>{negocio.email}</a>.</li>}
        </ul>
      </section>

      <p className="pt-4 text-center"><Link href="/" className="btn-claro">Volver al catálogo</Link></p>
    </article>
  );
}
