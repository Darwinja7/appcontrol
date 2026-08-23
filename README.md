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

## Base de datos (Google Sheets)

Estructura: 10 pestañas definidas en `api/_lib/model.js` (EMPRESAS, PROYECTOS, USUARIOS, CAPITULOS, ACTIVIDADES, NIVELES, UNIDADES, CONTRATISTAS, CONFIGURACION, REGISTRO).

Puesta a punto desde cero:

1. Crea una hoja vacía en tu Google Drive (llámala `AppControl DB`).
2. Compártela como **Editor** con el correo de la cuenta de servicio (`...@...iam.gserviceaccount.com`).
3. Arma la estructura (idempotente, nunca toca datos existentes):

   ```powershell
   $env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
   $env:SPREADSHEET_ID = "<id-de-tu-hoja>"
   node scripts/init-db.mjs                 # pestañas + cabeceras
   node scripts/init-db.mjs --admin=tu@correo.com   # + ADMIN inicial
   ```

4. Datos demo opcionales (solo pestañas vacías): `node scripts/seed.mjs`
5. Configura en Vercel: `SPREADSHEET_ID`, `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`.

Alternativa sin hoja manual: `node scripts/init-db.mjs --create` la crea vía API (queda en propiedad de la cuenta de servicio; el script imprime el ID).

## Variables de entorno (Vercel)

- `SPREADSHEET_ID`
- `SESSION_SECRET` — **obligatoria en producción** (32+ caracteres aleatorios); sin ella la API se niega a arrancar
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `RESEND_API_KEY` / `MAIL_FROM` — envío del PIN de recuperación

Opcionales (solo entornos de prueba):

- `ENABLE_BOOTSTRAP=SI` — activa el admin de pruebas; requiere además `BOOTSTRAP_EMAIL` y `BOOTSTRAP_PASSWORD`. Nunca dejar activo en producción.
- `ALLOW_DEV_PIN=SI` — devuelve el PIN de recuperación en la respuesta HTTP (solo desarrollo local).

## Seed local

El antiguo endpoint `/api/seed` era público y fue retirado por seguridad. Para sembrar la hoja desde tu máquina:

```powershell
$env:GOOGLE_SERVICE_ACCOUNT_JSON = (Get-Content ruta\service-account.json -Raw)
$env:SPREADSHEET_ID = "<tu-id>"
node scripts/seed.mjs
```

Solo crea hojas vacías; nunca sobrescribe datos existentes.

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