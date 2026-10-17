import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";
import { GestionUsuarios } from "@/componentes/panel/GestionUsuarios";

export default async function PaginaUsuarios() {
  const sesion = await obtenerSesion();
  if (!puede.administrarUsuarios(sesion?.perfil?.rol)) redirect("/panel");
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("perfiles").select("*").order("estado").order("creado", { ascending: false });
  return <GestionUsuarios iniciales={data ?? []} miId={sesion!.usuarioId} />;
}
