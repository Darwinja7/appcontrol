# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) · Versionado: semver.

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