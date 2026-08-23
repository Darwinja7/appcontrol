const fs = require("fs");
let fallo = false;
for (const f of process.argv.slice(2)) {
  const html = fs.readFileSync(f, "utf8");
  const bloques = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  if (!bloques.length) { console.log(`${f}: sin scripts inline`); continue; }
  bloques.forEach((m, i) => {
    try { new Function(m[1]); console.log(`${f} [inline ${i + 1}] OK`); }
    catch (e) { console.log(`${f} [inline ${i + 1}] ERROR: ${e.message}`); fallo = true; }
  });
}
process.exitCode = fallo ? 1 : 0;
