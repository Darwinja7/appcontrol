# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) · Versionado: semver.

## [1.9.1] - 2026-08-23
### Security
- Política BYOK (Bring Your Own Key): se elimina el respaldo con variables de entorno del servidor. Cada administrador configura y paga su propio consumo de IA; su llave vive cifrada en LLM_CONFIG y jamás se comparte entre empresas.

## [1.9.0] - 2026-08-23
### Added
- Asistente IA opcional por administrador: módulo nuevo con configuración de proveedor (OpenRouter, Hugging Face, OpenCode, OrcaRouter, OpenAI, Anthropic, Groq y Personalizado compatible OpenAI). Llave cifrada con AES-256-GCM derivado de SESSION_SECRET; nunca vuelve al cliente.
- Respaldo de servidor: si el admin no configura llave, se usa la variable del proveedor (ej. OPENROUTER_API_KEY) con modelo stealth ox-alpha en esfuerzo bajo.
- Conversatorio de registro por texto o voz (Web Speech API es-CO): entiende sinónimos ("muros" = mampostería) y devuelve acciones verificables en borrador antes de aplicar.
- Modo guiado sin IA: crea niveles/unidades idempotentemente (rango de pisos, aptos por piso, parqueaderos, especiales).
- Acciones `llm-config-get/save/test`, `wizard-chat` y `estructura-save` con rate limiting.
- Landing actualizada con mensaje de app impulsada por IA.
## [1.8.0] - 2026-08-23
### Added
- Maestro exportar/importar: descarga XLSX con las 8 hojas de estructura+configuración; importación con vista previa de diff (nuevos/modificados/eliminados/duplicados) y confirmación. EMPRESAS/PROYECTOS solo para admin desarrollador.
## [1.7.1] - 2026-08-23
### Fixed
- Actividades por nivel (estructura, movimiento de tierras): el backend expande un registro de nivel a todas sus unidades activas (mismo avance); calcularAvance y dashboard promedian el nivel desde sus unidades. Columna APLICACION en ACTIVIDADES.
- Registro: porcentaje manual 0-100 por celda (estado "Manual") y botón ✓ de realizado; el avance ponderado usa VALOR para manuales.
## [1.7.0] - 2026-08-23
### Added
- Registro móvil táctil: tocar una celda cicla el estado (con color y % al instante), long-press selecciona unidades para aplicar en lote, botón Deshacer y contador de cambios sin guardar.
- Asignación validada de usuarios: selects en cascada empresa > proyecto > torre; torres reales del proyecto (unión NIVELES + UNIDADES) vía acción `torres-list`.
- Rol de admin desarrollador (`DEVELOPER_ADMINS`): puede crear usuarios en cualquier proyecto activo y gestionar organizaciones (`empresas-save`, `proyectos-save`).
- Regla por rol: torre `*` solo para ADMIN/VISUALIZADOR; RESIDENTE exige torre concreta.
- Tabla de usuarios con columnas Empresa y Proyecto.
- Script `enriquecer-demo.mjs`: torre T2 del demo P000 con lobby, zona administrativa, parqueaderos, apartamentos 401–2106 y amenidades (23 niveles, 127 unidades).
### Changed
- Relaciones de catálogos corregidas: actividades filtradas por capítulos del proyecto activo + ACTIVO=SI; contratistas solo ACTIVO=SI.
- Aislamiento por tenant en creación/edición de usuarios (403 fuera del propio proyecto salvo desarrollador).

## [1.6.0] - 2026-08-23
### Changed
- Recuperación de contraseña sin correo: el PIN ya no se envía por email (no se requieren Resend ni dominio propio). El PIN queda visible en el módulo Usuarios para cualquier ADMIN del proyecto, quien lo comparte directamente con el usuario.
- PIN de recuperación vigente por 15 minutos (antes 2) para dar margen a la comunicación con el administrador.
### Added
- Acción `reset-pins` en `/api/auth` (solo ADMIN, aislada por empresa/proyecto) y panel de "PINs de recuperación pendientes" con auto-refresco cada 25 s.
- Columna `RESET_PIN` en USUARIOS (se crea sola en la siguiente escritura; se limpia al usar el PIN o cambiar la contraseña).

## [1.5.0] - 2026-08-22
### Security
- Bootstrap admin desactivado por defecto: requiere `ENABLE_BOOTSTRAP=SI` más `BOOTSTRAP_EMAIL`/`BOOTSTRAP_PASSWORD` por variables de entorno (nunca en código).
- `SESSION_SECRET` obligatoria en producción (fail-closed); sin fallback conocido.
- `/api/seed` eliminado del despliegue → script local `scripts/seed.mjs`.
- El PIN de recuperación ya no viaja en la respuesta HTTP ni se registra en logs (solo con `ALLOW_DEV_PIN=SI`, desarrollo).
- Aislamiento por empresa/proyecto/torre en `/api/data`: catálogos e histórico ya no cruzan tenants.
- Rate limiting en login, forgot-start y forgot-confirm.
- PIN de recuperación con `crypto.randomInt`; contraseñas temporales aleatorias (antes "123456").
- Escape de datos provenientes de hojas (XSS almacenado) + CSP en Vercel.
- Errores internos genéricos al cliente (sin filtrar `e.message`).
### Changed
- Escritura de hojas menos destructiva (`replaceRows` actualiza rango cuando se conoce el conteo previo).
- Reintentos con backoff ante 429/5xx de la API de Sheets; soporte de columnas >26.
- IDs de usuario sin colisiones (máximo existente + 1).
- Whitelist de roles y estados en gestión de usuarios.
- `xlsx` movida a `devDependencies`; `uuid` fijada a `^11.1.1` (advisory transitivo).
### Fixed
- Codificación UTF-8 corrupta en textos visibles (mojibake) en toda la UI.
- Error de sintaxis que rompía el módulo Usuarios; el botón Activar/Desactivar apuntaba a un endpoint inexistente.

## [1.3.0] - 2026-08-23
### Added
- Sistema de toasts y eliminación de `alert()`.
- PWA: manifest, favicon, theme-color (instalable en móvil de obra).
- Página 404 propia y `robots.txt`.
- Headers de seguridad en Vercel.
- CI: quality gates (syntax check + JSON validation).
- README técnico y CHANGELOG.
### Changed
- Manejo de errores global (unhandledrejection → toast).
- Sincronización offline notifica registros enviados.

## [1.2.0] - 2026-08-22
### Added
- Shell ERP (`app.html`) con sidebar y control por roles.
- Módulos en `public/modulos/` (configuración, registro, dashboard).

## [1.1.0] - 2026-08-22
### Added
- Cola offline con `localStorage` y re-sincronización automática.
- Responsive mobile-first para grid y dashboard.

## [1.0.0] - 2026-08-21
### Added
- Primera release: configuración (regla de oro), grid de registro, dashboard ponderado sobre Google Sheets.