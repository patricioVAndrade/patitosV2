// Sello "¡Nuevo!": estrella roja de puntas (como la estrella del logo) con borde amarillo.
const PUNTAS = 14;
const puntos = Array.from({ length: PUNTAS * 2 }, (_, i) => {
  const r = i % 2 === 0 ? 49 : 40;
  const a = (Math.PI * i) / PUNTAS - Math.PI / 2;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");

export function SelloNuevo({ grande = false }: { grande?: boolean }) {
  return (
    <span className={`relative grid shrink-0 -rotate-12 place-items-center ${grande ? "size-24" : "size-16 sm:size-[4.5rem]"}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full drop-shadow-[1px_2px_0_rgb(31_42_68/0.25)]" aria-hidden>
        <polygon points={puntos} fill="#c8243a" stroke="#ffe500" strokeWidth="3.5" strokeLinejoin="round" />
      </svg>
      <span className={`relative font-display leading-none text-white ${grande ? "text-[1.15rem]" : "text-[0.78rem] sm:text-[0.86rem]"}`}>¡Nuevo!</span>
    </span>
  );
}
