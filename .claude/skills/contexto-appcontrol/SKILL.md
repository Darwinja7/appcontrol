---
name: contexto-appcontrol
description: Ãšsala SIEMPRE al iniciar cualquier sesiÃ³n de trabajo en el repo AppControl (D:\IA CONSTRUCCION\SAS\appcontrol-web) â€” contiene la memoria completa del proyecto: estado, decisiones, credenciales por referencia, bugs corregidos, pendientes y cÃ³mo retomar pruebas con browser-harness.
---

# Memoria del proyecto AppControl

Retomar el hilo de trabajo: este archivo resume todo lo construido y decidido.
Ãšltima actualizaciÃ³n: 2026-08-23.

## QuÃ© es AppControl

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
- Token de GitHub: el usuario lo pegÃ³ en chat (REVOCAR); credencial guardada en
  Windows Credential Manager (git push funciona sin pedir nada)

## Estructura clave

- `api/` â€” endpoints serverless: auth.js (login/usuarios/recuperacion), data.js
  (catalogos/config-save/registro-save/historico), health.js
- `api/_lib/` â€” auth.js (pbkdf2, tokens HMAC), session.js (currentUser compartido),
  sheets.js (API Sheets con reintentos), rate-limit.js, mail.js, model.js (HEADERS:
  Ãºnica fuente de las 11 pestaÃ±as)
- `public/` â€” index.html (landing con dona animada), login.html, app.html (shell ERP
  con iframes), modulos/ (registro, dashboard, configuracion, usuarios), js/app.js
- `scripts/` â€” init-db.mjs (estructura), seed.mjs (datos demo), reset-password.mjs,
  generar-db-base.mjs (genera config/appcontrol-db-base.xlsx), backfill-historico.mjs,
  smoke.mjs (pruebas contra deploy), test-forgot.mjs (flujo recuperacion),
  proteger-password-hash.mjs (protege columna PASSWORD_HASH), leer-contratistas.mjs
  (diagnostico directo de hoja), maestro-variante.mjs (XLSX de prueba para import)
- Hoja de calculo: 11 pestaÃ±as â€” LEEME, EMPRESAS, PROYECTOS, USUARIOS, CAPITULOS,
  ACTIVIDADES, NIVELES, UNIDADES, CONTRATISTAS, CONFIGURACION, REGISTRO, HISTORICO

## Proyectos en la hoja

- **P000 SALGUERO ELITE 1** â€” DEMO (datos de ejemplo, backfill de historico incluido)
- **P001 SALGUERO ELITE 2** â€” PRODUCCION (obra real)
- Empresa: E001 URBANIZADORA JIMENEZ

## Seguridad (hardening v1.5.0 â€” NO retroceder)

- Bootstrap admin SOLO con `ENABLE_BOOTSTRAP=SI` + BOOTSTRAP_EMAIL/PASSWORD por env
  (el usuario ya los ELIMINO de Vercel â€” correcto)
- SESSION_SECRET obligatoria en produccion (fail-closed; sin ella la API da 500)
- El PIN de recuperacion JAMAS va en la respuesta HTTP (solo ALLOW_DEV_PIN=SI en dev)
- Rate limiting en login/forgot (memoria por proceso)
- Aislamiento por empresa/proyecto/torre en /api/data (catalogos, registro, historico)
- ContraseÃ±as: hash pbkdf2 â€” **la columna PASSWORD_HASH de la hoja NUNCA se edita a
  mano** (el usuario la rompio dos veces escribiendo texto plano; causa #1 de "no puedo entrar")
- Escape XSS en todo dato proveniente de hojas (helper `esc()`), CSP en vercel.json
- Errores genericos al cliente (sin e.message)

## Bugs criticos corregidos (historial)

1. `appendRows` sin `:append` en la URL â€” **el registro de avance nunca habia guardado**
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
chrome://inspect NO funciona en este equipo â€” usar Chrome dedicado con puerto:

```powershell
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList `
  '--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\bh-chrome-profile",`
  '--no-first-run','--no-default-browser-check','https://appcontrol-three.vercel.app'
# y en CADA llamada: $env:BU_CDP_URL = "http://127.0.0.1:9222"
# PowerShell no soporta heredoc: escribir el script python a archivo y hacer Get-Content | browser-harness
```

Lecciones de testing: cada llamada `js()` comparte el contexto global del frame (usar
IIFE `(()=>{...})()`); el iframe de modulos tarda en cargar catalogos (hasta 30s por
cuota de Sheets â€” hacer polling, no sleep fijo); no ejecutar config-save con rows vacias
por API (reemplaza TODA la pestana CONFIGURACION, incluido el demo de P000); evitar
rafagas de escrituras/lecturas simultaneas â€” la cuota de Sheets puede vaciar lecturas
(sucedio una vez con HISTORICO; re-ejecutar el script lo repone).

## Pendientes / siguientes pasos

1. ~~Configurar RESEND_API_KEY + MAIL_FROM en Vercel y probar el correo real del
   PIN~~ **RESUELTO 2026-08-23**: variables configuradas, redeploy d6adb15,
   health mailConfigurado:true, flujo E2E completo PASS (ver sesion v1.9.3).
2. Prueba fisica de dictado por voz en Chrome Android (en escritorio ya verificada)
3. Borrar de USUARIOS la fila inactiva prueba.residente@test.com si molesta
4. Roadmap del README: cronograma programado vs ejecutado, costos/fiduciaria,
   entregas y postventa, adapter Supabase
5. CSP actual permite 'unsafe-inline' en scripts (los modulos usan <script> inline);
   migrarlos a /js/*.js para CSP estricta
6. **DESARROLLO EN PAUSA** (decision del usuario): la app queda funcional;
   retomar con los items de este roadmap cuando se reinicie

## Convenciones

- Commits: Conventional Commits en espanol; push directo a main (el usuario ya
  autorizo que el agente commitee y pushee)
- Comentarios y UI: SIEMPRE en espanol natural (skill humanizalo instalada)
- CHANGELOG.md: Keep a Changelog, version actual 1.5.0
- 50 skills instaladas en ~/.claude/skills/ (40 de tododeia + el-arquitecto +
  video-generator + design-md + economia-de-contexto + rtk-ahorro-tokens +
  patrones-llm-apps + evolucion-de-agente + studio-generativo + browser-harness +
  humanizalo)

## Sesion 2026-08-23 (v1.7.0 -> v1.9.0)

- Registro movil tactil: tap cicla estado, long-press selecciona lote, % manual por celda (estado Manual + VALOR), boton realizado.
- Actividades por NIVEL (APLICACION en ACTIVIDADES): backend expande registro de nivel a unidades activas; calcularAvance/dashboard promedian el nivel. ACT004 demo en T2 niv 1-3.
- Usuarios: empresa/proyecto/torre validados; torres-list; DEVELOPER_ADMINS (ya en Vercel) = admin desarrollador; empresas-save/proyectos-save.
- Maestro XLSX export/import con diff previo (v1.8.0).
- Asistente IA (v1.9.0): modulo asistente.html; llaves cifradas AES-GCM (HKDF SESSION_SECRET) en LLM_CONFIG; politica BYOK v1.9.1: SIN llaves de servidor; cada admin paga su consumo con su propia llave cifrada; wizard-chat JSON estricto con sinonimos; voz Web Speech es-CO; estructura-save guiado idempotente. Pestaña LLM_CONFIG se crea sola al primer guardado.
- Demo P000/T2: 23 niveles, 127 unidades (lobby, pk pisos 2-3, aptos 401-2106, amenidades).
- Scripts test: check-inline, relaciones, registro, usuarios-tenant, por-nivel, expansion-nivel, maestro, llm.
- Pendiente E2E con sesion del usuario: matriz completa (crear usuario combos, wizard con llave real, maestro roundtrip, voz en Chrome Android).

## Cierre E2E v1.9.1 (2026-08-23)

- Matriz API completa PASS: login, torres-list, reglas de torre/rol, tenant lock 403, SOLO_DESARROLLADOR, SIN_LLM neutral, BYOK save/test (origen=propia, stealth/ox-alpha), wizard-chat con sinonimo muros->mamposteria y pregunta de clarificacion, estructura-save habilito ACT010/011 T2 niv4-5, registro-save expandio 24 filas por unidad. Export maestro genero XLSX real de 8 hojas.
- Bugs corregidos en el loop: slug OpenRouter (stealth/ox-alpha sin prefijo), appendRows sin importar en auth.js, mensaje SIN_LLM neutral.
- QA: cuenta qa.matrix y fila LLM_CONFIG eliminadas tras las pruebas; quedan registros demo Listo en REGISTRO (T2 niv4-5 ACT010/011) como data de ejemplo.
- Nueva skill compartida: agente-conversacional-modulos (en darwin-dotfiles, junction a ~/.claude/skills) — patron BYOK reutilizable.
- Pendiente: verificacion visual browser-harness (tap cicla colores, voz en Chrome Android) y prueba de import maestro desde la UI.

## Cierre del loop v1.9.2 (2026-08-23) — desarrollo pausado aqui

- Punto 3 (PIN al admin): forgot-start ahora envia el PIN por correo a TODOS los
  ADMIN activos del proyecto via Resend (sendResetPin en mail.js, plantilla
  redactada para el admin con solicitante/empresa/proyecto y vencimiento 15 min).
  Respuesta al solicitante siempre generica (anti-enumeracion); reset-pins queda
  como respaldo visual; login.html dice "Comuniquese con el administrador".
  /api/health expone mailConfigurado (booleano). test-forgot.mjs TODO EN VERDE.
- Punto 4 (PASSWORD_HASH protegida): scripts/proteger-password-hash.mjs creo el
  rango protegido USUARIOS!I:I (warningOnly:false, solo la service account escribe).
  Verificado: la API sigue escribiendo USUARIOS sin error (forgot-start lo ejercita).
- BUG CRITICO encontrado por la verificacion visual (punto 1): el tap en registro
  NO ciclaba estados — la celda era un <label> y el navegador reenvia el clic al
  boton ✓ interno (activacion nativa de labels); ciclar + done se anulaban mutuamente.
  Fix b696462: celda ahora es <div class='cell'> (CSS + template + wireCeldas).
  Re-test completo en produccion: ciclo de 5 taps perfecto Listo->Sin empezar->
  ...->Listo, long-press selecciona/deselecciona, % manual MAN 65% OK, boton
  realizado OK, Deshacer OK. Los cambios quedan en memoria hasta Guardar (no se
  guardo nada durante las pruebas).
- Punto 2 (import maestro desde UI): export descargo XLSX real (75 KB); preview
  diff idempotente (224 filas iguales, 0 cambios en 8 hojas); cancelar OK;
  aplicar OK con escritura real probada via roundtrip C999 (+1 nuevo -> "1 hoja
  actualizada"; restauracion -1 eliminado). data.js omite hojas sin diff ("0 hojas"
  con archivo identico es comportamiento correcto, linea ~309).
- Tecnicas browser-harness aprendidas: iframes same-origin NO aparecen como targets
  (usar contentDocument desde el top page); CSP bloquea eval() pero permite inyectar
  <script> inline para instrumentar confirm()/prompt() del iframe; pasar archivos al
  input #mFile via DataTransfer en fragmentos base64 de 30 KB (mensaje CDP tiene
  limite); la cuota de Sheets (429 read requests per minute) provoca ERROR_INTERNO
  transitorio en maestro-import tras rafagas — esperar 60-75 s y reintentar.
- Estado final: v1.9.2 desplegada y funcional. Unico pendiente bloqueante: llaves de
  Resend en Vercel para el correo real del PIN (pendiente 1 de esta memoria).

## Cierre E2E del correo del PIN (v1.9.3, 2026-08-23)

- El usuario configuro RESEND_API_KEY + MAIL_FROM (onboarding@resend.dev, su gmail
  es dueno de la cuenta Resend) -> redeploy con commit vacio d6adb15 ->
  health mailConfigurado:true.
- Flujo completo probado en la UI real, TODO PASS:
  1. Usuario temporal creado por script: qa.pin@pruebaappcontrol.com (U0002,
     RESIDENTE E001/P000/T2) via scripts/crear-usuario-prueba.mjs.
  2. forgot-start desde /login (panel Olvide mi contrasena): mensaje correcto
     "Solicitud enviada. Comuniquese con el administrador..." + cuenta regresiva 15:00.
  3. Correo REAL recibido en el Gmail del admin (asunto "PIN de recuperacion
     AppControl - E001/P000", plantilla para admin con solicitante y vencimiento).
  4. forgot-confirm desde la UI con el PIN del correo -> "Contrasena cambiada".
  5. Login con las credenciales nuevas -> entro a /app.html sin cambio forzado.
- Limpieza verificada: fila temporal eliminada; USUARIOS queda solo con
  darwingranadosjimenez@gmail.com (ADMIN E001/P000). test-forgot.mjs TODO EN VERDE
  con mailConfigurado:true.
- Nota operativa: /login redirige a /app.html si hay sesion valida — para probar el
  panel de recuperacion hay que cerrar sesion primero (btn-logout del shell).
- Pendiente restante del flujo: nada. Solo voz fisica en Android (pendiente 2).
