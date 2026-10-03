# Arquitectura — AppFamiliar

## 0. Análisis: problemas y ambigüedades detectadas en el encargo

| # | Tema | Cómo lo resolví (cámbialo si no te gusta) |
|---|------|------------------------------------------|
| 1 | "Ingreso de máquina" vs "agregar saldo": ¿un ingreso de máquina ya es saldo de alguien? | **No.** Un ingreso de máquina es un hecho de mamá (`incomes`) y no toca ningún saldo hasta que ella lo **asigna** a una o ambas cuentas (monto distinto para cada una). Lo no asignado queda "sin asignar". "Agregar saldo" es la vía directa a un hijo, sin pasar por una máquina. |
| 2 | "Transferencia" ¿entra o sale? | Mamá **envía dinero real** al hijo por fuera de la app; en la app eso **baja** su saldo (dinero que ya le pagó). Mamá la llama "realizada"; el hijo la ve como "recibida". Es el mismo movimiento. |
| 3 | "Total recibido" en la pantalla de John | = suma de transferencias recibidas (dinero que ya le llegó). "Total ingresos" = lo que se le ha acreditado (máquinas + saldo agregado). |
| 4 | Editar un ingreso de $150k a $180k cuando ya se asignó | Si la asignación cubría todo el ingreso, **sigue al nuevo monto**. Si el reparto era parcial/múltiple, se conservan los montos y se valida que no superen el nuevo total (si no, mamá debe reasignar). |
| 5 | ¿Puede la transferencia dejar saldo negativo? | **Se bloquea** por defecto; mamá puede autorizar explícitamente (`p_allow_overdraft`). Editar hacia abajo un ingreso sí puede dejar negativo (se muestra alerta en la UI, fase 7). |
| 6 | "Origen: Máquina" en saldo directo vs ingreso de máquina | El saldo directo con origen "Máquina" solo **etiqueta**; los totales "generados por máquinas" del dashboard cuentan solo `incomes`, para no duplicar. |
| 7 | Hermano "no puede ver información privada de mamá" | Los hijos no leen `incomes`, `audit_logs` ni perfiles ajenos. Ven solo el **nombre** de las máquinas que aparecen en sus propios movimientos. Los ingresos se ocultan porque revelarían el reparto entre hermanos (ej. ingreso $150k − lo mío = lo del otro). |
| 8 | Tabla `transfers` pedida | No existe como tabla separada: una transferencia **es** un movimiento `kind='transfer'` (signo negativo) con su comprobante. Una tabla aparte duplicaría datos y abriría la puerta a inconsistencias. |
| 9 | Moneda | Pesos enteros (`bigint`), sin decimales: evita errores de redondeo. |

### Decisiones que debes confirmar (tengo un valor por defecto en todas)
1. Sobregiro bloqueado en transferencias (#5). 2. Un hijo no ve la tabla de ingresos (#7). 3. Nombres/correos reales de las 3 cuentas para el provisionamiento.

---
## A. Arquitectura propuesta

**React Native + Expo (TypeScript, expo-router) + Supabase (Postgres + Auth + Storage).** La evalué contra alternativas y la mantengo:

| Opción | Seguridad/privacidad | Costo | Mantenimiento | Veredicto |
|---|---|---|---|---|
| **Expo + Supabase** | RLS en Postgres: la regla de privacidad vive en la BD | Plan gratis cubre 3 usuarios | Sin servidor propio; un solo lenguaje (TS) | **Elegida** |
| Firebase | Reglas de Firestore sin SQL; saldos agregados son incómodos (NoSQL) y recalcular es frágil | Gratis | Medio | Descartada: un libro contable pide SQL |
| API propia (Node/Nest) + Postgres | Buena, pero hay que programar y hostear la seguridad | $5–10/mes + mantenimiento | Alto para una app de 3 personas | Descartada: sobreingeniería |
| PWA/web solo | Igual de segura | Gratis | Bajo | Descartada: pediste móvil; igual Expo permite **web** después (§27) |

Principios:
1. **La BD es la autoridad.** La app es solo una pantalla; ocultar botones es cosmético.
2. **Lectura = tablas con RLS. Escritura = funciones RPC** (`security definer`, validan que sea mamá). Los clientes no tienen `INSERT/UPDATE/DELETE` sobre ninguna tabla.
3. **Saldo derivado**, nunca almacenado: `balance = opening_balance + Σ signed_amount (activos)`.
4. **Auditoría y notificaciones por trigger**: ninguna vía de escritura se las salta.
5. Expo web reutiliza el 100 % del código para la versión de mamá (§27). Exportación CSV/Excel/PDF (fase 2) = consultas sobre las mismas tablas.

## B. Diagrama de funcionamiento

```
 ┌──────────── App Expo (móvil / web futura) ────────────┐
 │  login · rutas protegidas por rol · pantallas         │
 └──────────────┬─────────────────────────────┬──────────┘
        lecturas│(supabase-js, JWT del usuario)│escrituras (rpc)
                ▼                              ▼
 ┌───────────────────────────── Supabase ─────────────────────────────┐
 │ Auth (3 usuarios, sin registro público)                             │
 │ Postgres                                                            │
 │   SELECT ──► RLS ──► solo filas permitidas por auth.uid()/rol       │
 │   RPC ─────► is_admin()? ──► valida ► INSERT/UPDATE ──► TRIGGERS:   │
 │                                         ├─ _touch (updated_*)       │
 │                                         ├─ _audit  → audit_logs     │
 │                                         └─ _notify → notifications  │
 │ Storage bucket privado "receipts" (RLS por ruta/receipts)           │
 └─────────────────────────────────────────────────────────────────────┘
```

## C. Modelo de base de datos (`supabase/migrations/0001_schema.sql`)

```
auth.users 1─1 profiles(role admin|user, display_name)
profiles   1─1 accounts(owner_key john|brother, opening_balance)      ← una cuenta por hijo
accounts   1─N account_movements(kind, origin, signed_amount, …)      ← LIBRO MAYOR
machines   1─N incomes(amount, date)  1─N account_movements(income_id) ← asignación a cuentas
account_movements 1─N receipts(storage_path, mime, size)
profiles   1─N notifications            ·   (todas las tablas) → audit_logs
```
| Tabla | Clave / relaciones | Notas |
|---|---|---|
| `profiles` | PK = `auth.users.id` | índice único parcial: **una sola admin** |
| `accounts` | `user_id` único → profiles | solo hijos; `owner_key` único |
| `machines` | PK uuid | nombre único (sin distinguir mayúsculas); `active` |
| `incomes` | `machine_id` → machines | `status` calculado (active/deleted); soft delete |
| `account_movements` | `account_id` → accounts; `income_id` → incomes (único por cuenta) | `signed_amount ≠ 0`; CHECKs: signo coherente con el tipo, origen coherente, ingreso ↔ `income_id` |
| `receipts` | `movement_id` → movements | solo JPG/PNG/PDF, ≤ 10 MB; soft delete |
| `notifications` | `user_id` → profiles | creadas por trigger |
| `audit_logs` | (`table_name`,`record_id`) | `old_data`/`new_data` JSON, `actor_id`, `reason` |

Tipos de movimiento: `machine_income` (+), `credit` (+, "saldo agregado"), `transfer` (−), `correction` (±, identificable). Auditoría en cada tabla: `created_by/at`, `updated_by/at`, `deleted_by/at`.

## D. Roles y permisos

| Recurso | Mamá (admin) | Hijo (user) |
|---|---|---|
| Su cuenta / movimientos activos | ✔ (todas) | ✔ solo la suya |
| Movimientos eliminados | ✔ | ✘ |
| Cuenta del otro hijo | ✔ | ✘ (RLS: 0 filas; RPC: "No autorizado") |
| `incomes`, `audit_logs` | ✔ | ✘ |
| Máquinas | ✔ todas / crear / editar | solo nombre de las de sus movimientos |
| Comprobantes (tabla y archivo) | ✔ | solo los de sus movimientos activos |
| Notificaciones | las suyas | las suyas (solo puede marcar `read_at`) |
| Escribir (RPC) | ✔ | ✘ |

Verificado con pruebas: `supabase/tests/30_cases_6_to_8_privacy.sql`.

## E. Pantallas
**Común:** Login · Recuperar contraseña · Restablecer contraseña · Más (perfil, cerrar sesión, ajustes) · Notificaciones.
**Mamá:** Inicio (dashboard + filtros de período) · Ingresos (lista + registrar/editar ingreso con asignación) · Agregar saldo · Transferir dinero (con comprobante) · Cuentas (lista) → Detalle de cuenta (John / Hermano, con origen del saldo) · Máquinas (lista, crear/editar/desactivar, historial por máquina) · Historial (filtros y orden) · Detalle de movimiento (editar, eliminar con confirmación, auditoría) · Más.
**Hijo (idéntica para ambos):** Inicio ("Hola, John", saldo, resumen) · Historial (filtros) · Comprobantes · Mi cuenta (origen del saldo, tocar categoría → detalle) · Detalle de movimiento · Más.

## F. Flujo de navegación
- `app/index` decide: sin sesión → `/login`; con sesión → lee `profiles.role` → `/admin` o `/user`.
- Un hijo que intente abrir `/admin/…` es redirigido (y de todos modos la BD no le entregaría datos).
- **Mamá (tabs):** Inicio · Ingresos · Transferencias · Cuentas · Máquinas · Historial · Más. **Hijo (tabs):** Inicio · Historial · Comprobantes · Mi cuenta · Más.
- Acciones rápidas del Inicio de mamá: Registrar ingreso · Agregar saldo · Transferir.

## G. Lógica de cálculo de saldos
```
saldo(cuenta) = accounts.opening_balance
              + Σ account_movements.signed_amount   WHERE account_id = cuenta AND deleted_at IS NULL
```
- Implementado en la vista `account_balances` (security_invoker ⇒ respeta RLS).
- Editar/eliminar **no recalcula nada guardado**: solo cambia/anula una fila y la suma refleja el resultado. Es imposible tener un saldo "desincronizado".
- Ingreso de máquina: `incomes.amount` ≥ Σ asignaciones; cada asignación es un movimiento `machine_income`. `update_income` re-sincroniza las asignaciones en la misma transacción.
- Resumen por origen (pantalla "Mi cuenta"): `Σ signed_amount GROUP BY origin` → `account_summary()`.
- Transferencias: `register_transfer` bloquea la cuenta (`FOR UPDATE`), verifica saldo ≥ monto, inserta `−monto`.
- Ejemplo del encargo (probado): 200.000 → 350.000 (+150.000 M1) → 300.000 (−50.000) → ingreso M1 a 180.000 → **330.000**.

## Transferencias y comprobantes (resumen)
1. Mamá elige destinatario/monto/fecha/concepto → RPC `register_transfer` → movimiento negativo + notificación al hijo.
2. Elige archivo → la app lo sube a Storage en `receipts/<account_id>/<movement_id>/<archivo>` → RPC `attach_receipt` valida que la ruta corresponda al movimiento y guarda tipo/tamaño.
3. El hijo lee el archivo con una URL firmada de corta duración; la política de Storage solo lo permite si existe una fila `receipts` visible para él.

## Seguridad (resumen)
RLS forzada en todas las tablas · sin permisos de escritura directa · RPC `security definer` con `search_path` vacío y chequeo de admin · registro público desactivado · rol nunca viene de metadatos del cliente · una sola admin por índice único · bucket privado con MIME/tamaño limitados · auditoría por trigger · llave `service_role` jamás en la app (solo `anon` + JWT).

## Notificaciones y biometría (preparado)
`notifications` ya se llena por trigger con los textos del encargo. Falta (futuro): push con Expo Notifications guardando un token por dispositivo. Biometría: `expo-local-authentication` como "candado" local sobre la sesión persistida; no requiere cambios en BD.

## Estructura del proyecto
```
CLAUDE.md                     reglas y punteros para Claude
docs/                         ENCARGO · ARQUITECTURA · PROGRESO
supabase/
  config.toml                 registro público desactivado
  migrations/0001..0005       esquema, RLS, triggers, RPC, storage
  seed/provision_family.sql   crea perfiles + cuentas (una vez)
  tests/                      run.sh + casos 1–8 + reglas extra
app/                          (Fase 1b+) Expo: app/(auth) · app/admin · app/user, src/{lib,components,features}
```

## H. Plan por fases
1. **Arquitectura + BD + auth** — BD ✔ probada · login Expo (sesión persistente, rutas protegidas, recuperar clave, logout) ← siguiente.
2. **Cuenta de mamá** — dashboard (métricas §24, filtros de período), cuentas, máquinas.
3. **Cuenta de John** — inicio, mi cuenta (origen del saldo), historial.
4. **Hermano** — misma UI; solo se verifica el aislamiento.
5. **Movimientos/saldos/transferencias** — formularios de mamá sobre los RPC existentes.
6. **Comprobantes** — selector de archivo, subida, visor con URL firmada.
7. **Edición/eliminación/auditoría** — editar con motivo, confirmación de borrado, línea de tiempo.
8. **Seguridad + pruebas** — pruebas de la app, revisión de RLS con proyecto Supabase real.
9. **Diseño final** — tema navy, animaciones, estados vacíos, rendimiento.
10. **Publicación** — EAS Build, iconos, política de privacidad, TestFlight/APK interno.

---
## Cambios respecto al diseño inicial (estado final)
- **Navegación de mamá:** 5 pestañas (Inicio · Ingresos · Transferencias · Cuentas · Más), siguiendo la imagen de referencia; Máquinas e Historial se abren desde Ingresos/Inicio/Más.
- **Navegación del hijo:** Inicio · Historial · Comprobantes · Más; "Mi cuenta" es el detalle del saldo.
- **Familia flexible:** ya no son solo "John" y "Hermano": mamá agrega, renombra y quita personas (migración `0009`); "quitar" desactiva y conserva el historial.
- **Registro:** invitación de un solo enlace y un solo uso (Edge Functions `invite-member` y `accept-invite`, tabla `invitations`).
- **Ayudante de invitaciones:** rol opcional (`profiles.is_helper`) que no ve dinero.
- **Escritura:** los clientes no tienen ningún permiso de escritura sobre tablas; todo pasa por funciones RPC.
- **Seguridad:** ver `docs/SEGURIDAD.md`. **Publicación:** ver `docs/PUBLICAR.md`.
