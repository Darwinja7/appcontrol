// Limitador de tasa en memoria por proceso (sliding window simple).
// Nota serverless: el conteo es por instancia; no reemplaza un limiter
// distribuido, pero eleva la fricción ante fuerza bruta sin dependencias.

const ventanas = new Map();

// Limpieza periódica para que el mapa no crezca indefinidamente.
function limpiar(msVentana) {
  const ahora = Date.now();
  if (ventanas.size > 5000) {
    for (const [k, v] of ventanas) {
      if (ahora - v.inicio > msVentana) ventanas.delete(k);
    }
  }
}

// true = permitido; false = excedió el límite.
export function limitar(clave, max, msVentana) {
  const ahora = Date.now();
  let v = ventanas.get(clave);
  if (!v || ahora - v.inicio > msVentana) {
    v = { inicio: ahora, n: 0 };
    ventanas.set(clave, v);
    limpiar(msVentana);
  }
  v.n++;
  return v.n <= max;
}

export function ipCliente(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "desconocida";
}
