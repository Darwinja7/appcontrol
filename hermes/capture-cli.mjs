import { enviarCaptura } from "./appcontrol-client.mjs";

function leerArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i].replace(/^--/, "");
    out[k] = args[i + 1];
  }
  return out;
}

const args = leerArgs();

if (!args.payload) {
  console.error("Uso: node capture-cli.mjs --sender <id> --key <idem> --payload '<json>'");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(args.payload);
} catch {
  console.error("ERROR: payload no es JSON valido");
  process.exit(1);
}

const resultado = await enviarCaptura(
  { sender: args.sender || "desconocido", payload },
  args.key || `cli:${Date.now()}`
);

console.log(JSON.stringify(resultado));
process.exit(resultado.success ? 0 : 2);
