// Copia a /public los archivos que el navegador carga aparte, para servirlos desde nuestro
// propio dominio (sin depender de un CDN externo). Corre solo en "npm install".
//  · lector de códigos de barras (WebAssembly)
//  · "worker" de pdf.js, que lee las facturas en PDF
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const copias = [
  ["node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", "public/zxing", "zxing_reader.wasm"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdfjs", "pdf.worker.min.mjs"],
];
for (const [origen, carpeta, nombre] of copias) {
  if (!existsSync(origen)) continue;
  mkdirSync(carpeta, { recursive: true });
  copyFileSync(origen, `${carpeta}/${nombre}`);
  console.log(`✔ ${nombre} copiado a ${carpeta}/`);
}
