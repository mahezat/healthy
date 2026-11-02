// Copies the barcode reader's WebAssembly file into public/ so the app serves it itself (no CDN).
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/wasm", { recursive: true });
copyFileSync("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", "public/wasm/zxing_reader.wasm");
