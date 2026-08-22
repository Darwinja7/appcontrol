# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es/1.1.0/) · Versionado: semver.

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