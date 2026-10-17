"use client";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/cliente";

export function BotonGoogle({ volver }: { volver: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function ingresar() {
    setCargando(true);
    setError("");
    const { error } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?volver=${encodeURIComponent(volver)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setError("No se pudo conectar con Google.");
      setCargando(false);
    }
  }

  return (
    <>
      <button onClick={ingresar} disabled={cargando} className="btn-claro w-full py-3 text-base shadow-sm">
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 24 12a11.9 11.9 0 0 1 8.4 3.3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5Z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12a11.9 11.9 0 0 1 8.4 3.3l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
          <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5Z" />
        </svg>
        {cargando ? "Abriendo Google…" : "Ingresar con Google"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
