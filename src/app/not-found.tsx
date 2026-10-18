import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-5xl">🧸</p>
        <h1 className="mt-3 text-xl font-semibold">No encontramos esa página</h1>
        <Link href="/" className="btn-primario mt-4">Ver el catálogo</Link>
      </div>
    </div>
  );
}
