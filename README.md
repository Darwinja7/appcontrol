# AppControl

Control de avance de obra sobre Google Sheets: configuración → base depurada → grid de registro → avance ponderado → dashboard.

[![CI](https://github.com/Darwinja7/AppControl/actions/workflows/ci.yml/badge.svg)](https://github.com/Darwinja7/AppControl/actions/workflows/ci.yml)

## Arquitectura


## Regla de oro

Una actividad solo aparece en el Grid si: `APLICA = SI` **y** `ACTIVO = SI` **y** `CONTRATISTA != Sin asignar`.

## Roles

| Rol | Acceso |
|---|---|
| ADMIN | Configuración + Registro + Dashboard |
| RESIDENTE | Registro + Dashboard |
| VISUALIZADOR | Solo Dashboard |

## Estructura

## Variables de entorno (Vercel)

- `SPREADSHEET_ID`
- `SESSION_SECRET`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

## Modo offline

Las escrituras sin conexión se encolan en `localStorage` y se sincronizan automáticamente al recuperar señal (badge de estado + reintentos cada 10 s).

## Convenciones

- Commits: [Conventional Commits](https://www.conventionalcommits.org/).
- CI: syntax check de funciones + validación de JSON en cada push.
- Cambios documentados en `CHANGELOG.md` (Keep a Changelog).
- Cálculos determinísticos: la IA no pondera; pondera la hoja.

## Checklist de release (regla de oro)

1. Actividad activa con contratista → aparece en Grid.
2. Activa sin contratista → no aparece.
3. Inactiva o no aplica → no aparece.
4. Selección múltiple + estado → valor numérico correcto (0/0.1/0.5/0.8/1).
5. Registro conserva contratista y fecha (histórico inmutable).
6. Offline: guarda en cola y sincroniza al recuperar señal.

## Roadmap

- Cronograma programado vs ejecutado.
- Costos / fiduciaria / cruce SincoSoft.
- Entregas y Postventa (módulos nuevos en el shell).
- Adapter Supabase (misma interfaz de datos).