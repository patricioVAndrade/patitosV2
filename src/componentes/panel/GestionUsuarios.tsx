"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";
import { mensajeError } from "@/lib/errores";
import { fechaHora } from "@/lib/formato";
import type { EstadoPerfil, Perfil, Rol } from "@/lib/supabase/database.types";
import { usePanel } from "./ContextoPanel";

const ROLES: { v: Rol; t: string; d: string }[] = [
  { v: "cargador", t: "Cargador", d: "Carga y edita artículos" },
  { v: "encargado", t: "Encargado", d: "+ categorías, marcas y precios masivos" },
  { v: "admin", t: "Admin", d: "Todo: usuarios, costos y borrar" },
];

export function GestionUsuarios({ iniciales, miId }: { iniciales: Perfil[]; miId: string }) {
  const supabase = supabaseNavegador();
  const { avisar } = usePanel();
  const [usuarios, setUsuarios] = useState(iniciales);

  async function cambiar(u: Perfil, cambio: { rol?: Rol; estado?: EstadoPerfil }) {
    if (u.id === miId && (cambio.rol && cambio.rol !== "admin" || cambio.estado && cambio.estado !== "activo") && !confirm("Te estás quitando el acceso de administrador a vos mismo. ¿Seguro?")) return;
    const { data, error } = await supabase.from("perfiles").update(cambio).eq("id", u.id).select().single();
    if (error) return avisar(mensajeError(error), "error");
    setUsuarios((us) => us.map((x) => (x.id === u.id ? data : x)));
    avisar("Usuario actualizado ✔");
  }

  const pendientes = usuarios.filter((u) => u.estado === "pendiente");
  const resto = usuarios.filter((u) => u.estado !== "pendiente");

  const Tarjeta = ({ u }: { u: Perfil }) => (
    <li className="tarjeta flex flex-wrap items-center gap-3 p-3" data-email={u.email ?? ""}>
      {u.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.avatar_url} alt="" className="size-10 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid size-10 place-items-center rounded-full bg-crema text-lg">{u.nombre.charAt(0).toUpperCase()}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{u.nombre} {u.id === miId && <span className="text-xs text-suave">(vos)</span>}</p>
        <p className="truncate text-xs text-suave">{u.email} · desde {fechaHora(u.creado)}</p>
      </div>
      {u.estado === "pendiente" ? (
        <div className="flex gap-2">
          <button onClick={() => cambiar(u, { estado: "activo", rol: "cargador" })} className="btn-primario px-3 py-1.5 text-sm">Aprobar</button>
          <button onClick={() => cambiar(u, { estado: "bloqueado" })} className="btn-claro px-3 py-1.5 text-sm">Rechazar</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={u.rol} onChange={(e) => cambiar(u, { rol: e.target.value as Rol })} aria-label={`Rol de ${u.nombre}`} className="campo w-auto py-1 text-sm">
            {ROLES.map((r) => <option key={r.v} value={r.v} title={r.d}>{r.t}</option>)}
          </select>
          {u.estado === "activo"
            ? <button onClick={() => cambiar(u, { estado: "bloqueado" })} className="btn-claro px-3 py-1 text-sm text-red-600">Bloquear</button>
            : <button onClick={() => cambiar(u, { estado: "activo" })} className="btn-claro px-3 py-1 text-sm">Reactivar</button>}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Usuarios</h1>
      <p className="rounded-xl bg-white p-3 text-sm text-suave">
        Para sumar a alguien: que entre a <strong>/ingresar</strong> con su cuenta de Google. Va a aparecer acá como pendiente para que lo apruebes.
      </p>
      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Esperando aprobación ({pendientes.length})</h2>
          <ul className="space-y-2">{pendientes.map((u) => <Tarjeta key={u.id} u={u} />)}</ul>
        </section>
      )}
      <section>
        <h2 className="mb-2 font-semibold">Equipo</h2>
        <ul className="space-y-2">{resto.map((u) => <Tarjeta key={u.id} u={u} />)}</ul>
      </section>
      <details className="text-sm text-suave">
        <summary className="cursor-pointer">¿Qué puede hacer cada rol?</summary>
        <ul className="mt-2 list-disc pl-5">{ROLES.map((r) => <li key={r.v}><strong>{r.t}:</strong> {r.d}</li>)}</ul>
      </details>
    </div>
  );
}
