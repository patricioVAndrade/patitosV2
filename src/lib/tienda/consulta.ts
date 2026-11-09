"use client";
// "Armá tu consulta": la lista vive solo en el navegador del cliente (no se guarda nada en el
// servidor ni datos personales). Se comparte entre pestañas con el evento "storage".
import { useSyncExternalStore } from "react";

export type ItemConsulta = { sku: string; nombre: string; slug: string; ruta_thumb: string | null; agotado: boolean; marca?: string | null };

const CLAVE = "patitos.consulta";
const MAXIMO = 30;
const oyentes = new Set<() => void>();
let cache: ItemConsulta[] | null = null;
const VACIA: ItemConsulta[] = [];

function leer(): ItemConsulta[] {
  if (cache) return cache;
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    cache = Array.isArray(crudo) ? crudo.filter((i) => i && typeof i.sku === "string").slice(0, MAXIMO) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function guardar(lista: ItemConsulta[]) {
  cache = lista;
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* modo privado: queda solo en memoria */ }
  oyentes.forEach((o) => o());
}

function suscribir(o: () => void) {
  oyentes.add(o);
  const alCambiarOtraPestana = (e: StorageEvent) => { if (e.key === CLAVE) { cache = null; o(); } };
  window.addEventListener("storage", alCambiarOtraPestana);
  return () => { oyentes.delete(o); window.removeEventListener("storage", alCambiarOtraPestana); };
}

export function useConsulta() {
  return useSyncExternalStore(suscribir, leer, () => VACIA);
}

export const consulta = {
  agregar(item: ItemConsulta) {
    const lista = leer();
    if (lista.some((i) => i.sku === item.sku)) return;
    guardar([...lista, item].slice(-MAXIMO));
  },
  quitar(sku: string) { guardar(leer().filter((i) => i.sku !== sku)); },
  vaciar() { guardar([]); },
};

/** Un solo mensaje con todos los artículos (nombre tal como está cargado + código, para encontrarlos rápido). */
export function mensajeConsulta(lista: ItemConsulta[]): string {
  const lineas = lista.map((i, n) => `${n + 1}. ${i.nombre} (Cód: ${i.sku})${i.agotado ? " — figura agotado, ¿vuelve a entrar?" : ""}`);
  return `Hola! Quisiera consultar por estos artículos:\n${lineas.join("\n")}`;
}
