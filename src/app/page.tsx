"use client";

import { useEffect, useMemo, useState } from "react";

type Usuario = { id: string; nombre: string; rol: string; proyecto: string; torre: string };
type Row = Record<string, string>;
type Catalogs = { proyectos: Row[]; zonas: Row[]; actividades: Row[]; usuarios: Row[] };

const activo = (v?: string) => (v ?? "").toUpperCase() === "SI";

export default function Home() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loginUsuario, setLoginUsuario] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [cat, setCat] = useState<Catalogs | null>(null);
  const [proyecto, setProyecto] = useState("");
  const [torre, setTorre] = useState("");
  const [nivel, setNivel] = useState("");
  const [zona, setZona] = useState("");
  const [actividad, setActividad] = useState("");
  const [avance, setAvance] = useState("");
  const [observacion, setObservacion] = useState("");
  const [resultado, setResultado] = useState<{ registro_id: string; estado: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setUser(d.usuario))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user && !cat) {
      fetch("/api/catalogos")
        .then((r) => r.json())
        .then((d) => !d.error && setCat(d))
        .catch(() => {});
    }
  }, [user, cat]);

  const proyectos = useMemo(() => {
    if (!cat) return [];
    let list = cat.proyectos.filter((p) => activo(p.ACTIVO));
    if (user && user.rol !== "ADMIN" && user.proyecto) {
      list = list.filter((p) => p.PROYECTO === user.proyecto);
    }
    return list;
  }, [cat, user]);

  const torres = useMemo(() => {
    const p = proyectos.find((x) => x.PROYECTO === proyecto);
    if (!p) return [];
    let list = String(p.TORRES || "").split(",").map((t) => t.trim()).filter(Boolean);
    if (user && user.rol !== "ADMIN" && user.torre && user.torre !== "*") {
      list = list.filter((t) => t === user.torre);
    }
    return list;
  }, [proyectos, proyecto, user]);

  const niveles = useMemo(() => {
    if (!cat) return [];
    const set = new Set(
      cat.zonas
        .filter((z) => z.PROYECTO === proyecto && z.TORRE === torre && activo(z.ACTIVA))
        .map((z) => String(z.NIVEL))
    );
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [cat, proyecto, torre]);

  const zonas = useMemo(() => {
    if (!cat) return [];
    return cat.zonas
      .filter(
        (z) =>
          z.PROYECTO === proyecto &&
          z.TORRE === torre &&
          String(z.NIVEL) === nivel &&
          activo(z.ACTIVA)
      )
      .map((z) => z.ZONA);
  }, [cat, proyecto, torre, nivel]);

  const actividades = useMemo(() => {
    if (!cat) return [];
    return cat.actividades.filter((a) => activo(a.ACTIVA)).map((a) => a.ACTIVIDAD);
  }, [cat]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: loginUsuario, pin: loginPin }),
    });
    const d = await r.json();
    setLoading(false);
    if (!d.success) {
      setLoginError("Credenciales invalidas");
      return;
    }
    const me = await fetch("/api/auth/me").then((x) => x.json());
    if (me.success) setUser(me.usuario);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setCat(null);
    setProyecto(""); setTorre(""); setNivel(""); setZona(""); setActividad("");
    setAvance(""); setObservacion(""); setResultado(null); setError("");
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    const r = await fetch("/api/captura/web", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proyecto,
        torre,
        nivel,
        zona,
        actividad,
        avance: Number(avance),
        observacion,
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.success) {
      setResultado(d);
      setZona("");
      setAvance("");
      setObservacion("");
    } else {
      setError(`${d.codigo}: ${d.mensaje}`);
    }
  };

  const input =
    "w-full border border-gray-300 rounded-lg p-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
  const label = "block text-sm font-medium text-gray-700 mb-1";

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <form onSubmit={login} className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-center">AppControl</h1>
          <p className="text-sm text-gray-500 text-center">Control de obra — ingreso</p>
          <div>
            <label className={label}>Usuario</label>
            <input className={input} value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} placeholder="999000111" />
          </div>
          <div>
            <label className={label}>PIN</label>
            <input className={input} type="password" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} placeholder="****" />
          </div>
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button className="w-full bg-blue-600 text-white rounded-lg p-3 text-base font-semibold disabled:opacity-50" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AppControl</h1>
            <p className="text-sm text-gray-600">{user.nombre} · {user.rol}</p>
          </div>
          <button onClick={logout} className="text-sm text-blue-600 underline">Salir</button>
        </header>

        <form onSubmit={enviar} className="bg-white rounded-2xl shadow p-5 space-y-4">
          <h2 className="text-lg font-semibold">Registrar avance</h2>

          <div>
            <label className={label}>Proyecto</label>
            <select className={input} value={proyecto} onChange={(e) => { setProyecto(e.target.value); setTorre(""); setNivel(""); setZona(""); }}>
              <option value="">Seleccione...</option>
              {proyectos.map((p) => <option key={p.PROYECTO} value={p.PROYECTO}>{p.PROYECTO} — {p.NOMBRE}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Torre</label>
            <select className={input} value={torre} disabled={!proyecto} onChange={(e) => { setTorre(e.target.value); setNivel(""); setZona(""); }}>
              <option value="">Seleccione...</option>
              {torres.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Nivel</label>
            <select className={input} value={nivel} disabled={!torre} onChange={(e) => { setNivel(e.target.value); setZona(""); }}>
              <option value="">Seleccione...</option>
              {niveles.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Zona</label>
            <select className={input} value={zona} disabled={!nivel} onChange={(e) => setZona(e.target.value)}>
              <option value="">Seleccione...</option>
              {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Actividad</label>
            <select className={input} value={actividad} disabled={!cat} onChange={(e) => setActividad(e.target.value)}>
              <option value="">Seleccione...</option>
              {actividades.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Avance (%)</label>
            <input className={input} type="number" min={0} max={100} value={avance} onChange={(e) => setAvance(e.target.value)} placeholder="0-100" />
          </div>

          <div>
            <label className={label}>Observación</label>
            <textarea className={input} rows={3} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resultado && (
            <p className="text-sm text-green-700 font-semibold">
              REGISTRO EXITOSO — ID: {resultado.registro_id} ({resultado.estado})
            </p>
          )}

          <button className="w-full bg-blue-600 text-white rounded-lg p-3 text-base font-semibold disabled:opacity-50" disabled={loading || !zona || !actividad || avance === ""}>
            {loading ? "Guardando..." : "Registrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
