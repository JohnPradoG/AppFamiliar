# Seguridad y privacidad — AppFamiliar

## Modelo de amenazas (qué se previene y cómo)
| Amenaza | Defensa | Probada en |
|---|---|---|
| Un hijo intenta ver el dinero, movimientos o comprobantes de otro (cambiando peticiones, ids, filtros) | RLS forzada en todas las tablas; solo ve filas de su cuenta. Los ingresos de máquina y la auditoría son solo de mamá | `30_cases_6_to_8`, `80_`, `40_` |
| Un hijo intenta escribir o cambiar su saldo/rol | Cero permisos de escritura directa; toda escritura es por funciones que exigen ser mamá; rol no editable | `30_`, `95_` |
| Un ayudante de invitaciones intenta ver dinero ajeno | No es admin; `family_status` no trae dinero ni ids | `70_helper` |
| Un ayudante pide un enlace nuevo para otra persona para entrar a su cuenta | Solo mamá (o la persona para sí misma) puede generar enlaces para una cuenta existente | `invite-member/handler.test.ts` |
| Alguien se registra por su cuenta | Registro público desactivado; solo entra quien tenga una invitación de un solo uso | `accept-invite/handler.test.ts` |
| Robo/adivinar el enlace de invitación | Código de 128 bits, solo se guarda su hash, vence en 7 días, un solo uso (canje atómico), se anula al generar otro | `accept-invite/handler.test.ts` |
| Persona "quitada" sigue viendo datos | `profiles.active = false` ⇒ RLS no le devuelve nada (cuenta, movimientos, comprobantes, notificaciones) | `90_members` |
| Comprobante de otro visto por URL | Bucket privado; leer exige una fila `receipts` visible para quien consulta; URL firmada de 2 min | `40_edge_cases` |
| Archivos peligrosos | Solo JPG/PNG/PDF ≤ 10 MB (app, tabla y bucket) | `receipts.test.ts`, `40_` |
| Manipular o borrar el rastro | `audit_logs` solo-agregar (trigger, incluso superusuario); borrado lógico en movimientos | `95_` |
| Montos/textos absurdos por petición manipulada | CHECKs en la BD (tope, longitudes, signo coherente con el tipo) | `95_`, `40_` |
| Secuestro de funciones (`search_path`) | Toda función `SECURITY DEFINER` fija `search_path` | `95_` |
| Fuga de llaves | La app solo lleva la llave anon; `service_role` solo existe dentro de las Edge Functions | `security.test.ts` |
| Tabla/función nueva sin proteger | Pruebas de invariantes fallan si falta RLS o sobra un permiso | `95_` |

## Lo que NO cubre / límites honestos
- **Quien administra el proyecto de Supabase** (el dueño de la cuenta) ve todos los datos desde el panel técnico. Es inherente; conviene que solo una persona de confianza tenga ese acceso y que active verificación en dos pasos.
- **Teléfono perdido o desbloqueado:** la sesión queda guardada en el equipo. Mitigación: bloqueo con huella/PIN (Más → Bloqueo de la app) y cerrar sesión. Pendiente de endurecer: guardar la sesión cifrada (SecureStore).
- **Plan gratuito de Supabase:** sin copias de seguridad automáticas. Exportar el historial (CSV) periódicamente o pasar al plan Pro.
- **Contraseñas filtradas:** la verificación contra listas de contraseñas filtradas es del plan Pro; mínimo de 8 caracteres configurado.
- **Limitación de intentos:** Supabase limita inicios de sesión; el canje de invitaciones se protege con el tamaño del código (128 bits) y un freno global (más de 20 fallos en 10 min bloquea el canje).

## Cómo correr las pruebas de seguridad
`npm test` (app y funciones) · `npm run test:db` (RLS, permisos e invariantes en Postgres real).
