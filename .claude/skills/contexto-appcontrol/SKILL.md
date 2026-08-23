---
name: contexto-appcontrol
description: Úsala SIEMPRE al iniciar cualquier sesión de trabajo en el repo AppControl (D:\IA CONSTRUCCION\SAS\appcontrol-web) — contiene la memoria completa del proyecto: estado, decisiones, credenciales por referencia, bugs corregidos, pendientes y cómo retomar pruebas con browser-harness.
---

# Memoria del proyecto AppControl

Retomar el hilo de trabajo: este archivo resume todo lo construido y decidido.
Última actualización: 2026-08-23.

## Qué es AppControl

Control de avance de obra para Urbanizadora Jimenez (construccion). El residente marca
unidades en un grid (nivel x unidad), elige estado (Sin empezar/En replanteo/En curso/
En remate/Listo = 0/0.1/0.5/0.8/1) y el sistema calcula avance ponderado:
actividad -> capitulo -> proyecto. Todo sobre Google Sheets como base de datos.

- **Stack**: frontend vanilla JS estatico + API serverless Vercel + Google Sheets + Resend (correo)
- **Deploy**: https://appcontrol-three.vercel.app (auto-deploy en cada push a main)
- **Repo**: https://github.com/Darwinja7/appcontrol.git (rama main, Conventional Commits)
- **Local**: D:\IA CONSTRUCCION\SAS\appcontrol-web (Windows, PowerShell)

## Accesos y credenciales (por referencia, NUNCA en codigo)

- Cuenta de servicio Google: `D:\IA CONSTRUCCION\SAS\appcontrol-service-account.json`
- SPREADSHEET_ID: `1r23-aobW1VYyJGGW9bmc6AJoax0UhqFzbNDs8V5pmiw` (tambien en
  `D:\IA CONSTRUCCION\SAS\appcontrol\.env.local`)
- Variables en Vercel: SPREADSHEET_ID, SESSION_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON,
  RESEND_API_KEY + MAIL_FROM (el usuario los iba a configurar; verificar si ya)
- ADMIN real: darwingranadosjimenez@gmail.com (contrasena la creo el usuario al primer
  ingreso; para resetear: `node scripts/reset-password.mjs <correo> <clave>`)
- Token de GitHub: el usuario lo pegó en chat (REVOCAR); credencial guardada en
  Windows Credential Manager (git push funciona sin pedir nada)

## Estructura clave

- `api/` — endpoints serverless: auth.js (login/usuarios/recuperacion), data.js
  (catalogos/config-save/registro-save/historico), health.js
- `api/_lib/` — auth.js (pbkdf2, tokens HMAC), session.js (currentUser compartido),
  sheets.js (API Sheets con reintentos), rate-limit.js, mail.js, model.js (HEADERS:
  única fuente de las 11 pestañas)
- `public/` — index.html (landing con dona animada), login.html, app.html (shell ERP
  con iframes), modulos/ (registro, dashboard, configuracion, usuarios), js/app.js
- `scripts/` — init-db.mjs (estructura), seed.mjs (datos demo), reset-password.mjs,
  generar-db-base.mjs (genera config/appcontrol-db-base.xlsx), backfill-historico.mjs,
  smoke.mjs (pruebas contra deploy)
- Hoja de calculo: 11 pestañas — LEEME, EMPRESAS, PROYECTOS, USUARIOS, CAPITULOS,
  ACTIVIDADES, NIVELES, UNIDADES, CONTRATISTAS, CONFIGURACION, REGISTRO, HISTORICO

## Proyectos en la hoja

- **P000 SALGUERO ELITE 1** — DEMO (datos de ejemplo, backfill de historico incluido)
- **P001 SALGUERO ELITE 2** — PRODUCCION (obra real)
- Empresa: E001 URBANIZADORA JIMENEZ

## Seguridad (hardening v1.5.0 — NO retroceder)

- Bootstrap admin SOLO con `ENABLE_BOOTSTRAP=SI` + BOOTSTRAP_EMAIL/PASSWORD por env
  (el usuario ya los ELIMINO de Vercel — correcto)
- SESSION_SECRET obligatoria en produccion (fail-closed; sin ella la API da 500)
- El PIN de recuperacion JAMAS va en la respuesta HTTP (solo ALLOW_DEV_PIN=SI en dev)
- Rate limiting en login/forgot (memoria por proceso)
- Aislamiento por empresa/proyecto/torre en /api/data (catalogos, registro, historico)
- Contraseñas: hash pbkdf2 — **la columna PASSWORD_HASH de la hoja NUNCA se edita a
  mano** (el usuario la rompio dos veces escribiendo texto plano; causa #1 de "no puedo entrar")
- Escape XSS en todo dato proveniente de hojas (helper `esc()`), CSP en vercel.json
- Errores genericos al cliente (sin e.message)

## Bugs criticos corregidos (historial)

1. `appendRows` sin `:append` en la URL — **el registro de avance nunca habia guardado**
   (fix ce0727e)
2. Dashboard no auto-seleccionaba proyecto -> KPIs en 0 (fix baa6a44)
3. Mojibake / doble codificacion UTF-8 en toda la UI (fix 0806f27)
4. usuarios.html con error de sintaxis + llamada a endpoint inexistente /api/users
5. seed.js publico convertida en script local (scripts/seed.mjs)

## Funcionalidades vigentes

- Grid de registro offline-first (cola localStorage, sync automatica), seleccion
  multiple con estilo landing (borde ambar + glow)
- Dashboard: KPIs, avance por capitulo, **avance por nivel** (ponderado act x cap),
  **grafica de avance en el tiempo** (SVG, snapshots de HISTORICO), matriz nivel x unidad
- Configuracion: regla de oro (HABILITADO = APLICA SI + ACTIVO SI + CONTRATISTA asignado)
- HISTORICO: snapshot diario automatico tras cada registro-save (dedupe por dia);
  ambitos GENERAL / NIVEL:x / UNIDAD:x. Backfill del demo: scripts/backfill-historico.mjs
- Usuarios: crear (contrasena temporal aleatoria mostrada una vez), activar/desactivar,
  reset con cambio obligatorio; roles ADMIN/RESIDENTE/VISUALIZADOR
- Landing: dona SVG animada como unico indicador de avance (sin barra duplicada),
  CTA "Entrar al sistema" en hero (sin duplicados)

## Como retomar pruebas con browser-harness

La skill `browser-harness` esta instalada globalmente (~/.claude/skills/browser-harness)
y la herramienta via `uv tool install browser-harness`. El checkbox de
chrome://inspect NO funciona en este equipo — usar Chrome dedicado con puerto:

```powershell
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList `
  '--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\bh-chrome-profile",`
  '--no-first-run','--no-default-browser-check','https://appcontrol-three.vercel.app'
# y en CADA llamada: $env:BU_CDP_URL = "http://127.0.0.1:9222"
# PowerShell no soporta heredoc: escribir el script python a archivo y hacer Get-Content | browser-harness
```

Lecciones de testing: cada llamada `js()` comparte el contexto global del frame (usar
IIFE `(()=>{...})()`); el iframe de modulos tarda en cargar catalogos (hasta 30s por
cuota de Sheets — hacer polling, no sleep fijo); no ejecutar config-save con rows vacias
por API (reemplaza TODA la pestana CONFIGURACION, incluido el demo de P000); evitar
rafagas de escrituras/lecturas simultaneas — la cuota de Sheets puede vaciar lecturas
(sucedio una vez con HISTORICO; re-ejecutar el script lo repone).

## Pendientes / siguientes pasos

1. Verificar que el usuario configuro RESEND_API_KEY + MAIL_FROM en Vercel (no en
   blanco) y probar el flujo "Olvide mi contrasena" de punta a punta
2. El usuario debe proteger la columna PASSWORD_HASH en Sheets (Datos > Proteger rango)
3. Borrar de USUARIOS la fila inactiva prueba.residente@test.com si molesta
4. Roadmap del README: cronograma programado vs ejecutado, costos/fiduciaria,
   entregas y postventa, adapter Supabase
5. CSP actual permite 'unsafe-inline' en scripts (los modulos usan <script> inline);
   migrarlos a /js/*.js para CSP estricta

## Convenciones

- Commits: Conventional Commits en espanol; push directo a main (el usuario ya
  autorizo que el agente commitee y pushee)
- Comentarios y UI: SIEMPRE en espanol natural (skill humanizalo instalada)
- CHANGELOG.md: Keep a Changelog, version actual 1.5.0
- 50 skills instaladas en ~/.claude/skills/ (40 de tododeia + el-arquitecto +
  video-generator + design-md + economia-de-contexto + rtk-ahorro-tokens +
  patrones-llm-apps + evolucion-de-agente + studio-generativo + browser-harness +
  humanizalo)
