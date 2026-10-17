// Copia el motor de lectura de códigos (WebAssembly) a /public para servirlo desde
// nuestro propio dominio (sin depender de un CDN externo). Corre solo en "npm install".
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
const origen = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
if (existsSync(origen)) {
  mkdirSync("public/zxing", { recursive: true });
  copyFileSync(origen, "public/zxing/zxing_reader.wasm");
  console.log("✔ zxing_reader.wasm copiado a public/zxing/");
}
