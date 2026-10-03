# ENCARGO ORIGINAL — AppFamiliar (fuente de verdad)

> Este archivo es el requerimiento del dueño del proyecto, guardado para no tener que repetirlo.
> Estado de avance: ver `docs/PROGRESO.md`. Diseño técnico: ver `docs/ARQUITECTURA.md`.

App móvil **privada** para administrar el dinero entre mamá, hermano y yo (John). EXCLUSIVAMENTE familiar. No es app bancaria: sin pagos reales ni conexión a bancos. Es un **registro ordenado, transparente y privado** de cuánto corresponde a cada hijo, de dónde viene, cuánto se ha enviado y cuánto queda.

## 1. Usuarios (solo 3)

**Mamá — ADMIN (acceso completo):** ver resumen general; ver cuenta de John y del hermano; registrar ingresos (incl. de máquinas); crear/administrar máquinas; agregar saldo directo a John o al hermano; registrar transferencias y subir comprobantes; editar y eliminar movimientos; ver todo el historial; ver de dónde proviene el saldo de cada hijo.

**John — USUARIO:** solo su propia información: saldo, historial, ingresos, saldos agregados, transferencias recibidas/realizadas registradas, comprobantes propios, origen de su saldo. NO puede ver nada del hermano ni información privada de mamá.

**Hermano — USUARIO:** exactamente igual que John, solo su cuenta. NO puede conocer saldo, ingresos, transferencias, comprobantes ni movimientos de John.

**La privacidad entre hermanos es requisito FUNDAMENTAL.**

## 2. Concepto principal
NO es una cuenta familiar única. Cada hijo tiene una **cuenta independiente** (ej. John $550.000, Hermano $420.000). Mamá = administración general. Saldos calculados independientemente.

## 3. Ingresos
Mamá registra ingresos, pueden venir de una máquina (Máquina 1 $150.000, Máquina 2 $80.000, Máquina 3 $50.000).
Campos: ID, fecha, monto, máquina, descripción/observación, usuario creador, created_at, updated_at, estado.
Sección **Máquinas**: crear, editar, desactivar, ver historial de ingresos por máquina (ej. "Máquina 1 — total este mes: $600.000").

## 4. MUY IMPORTANTE: los ingresos NO siempre se reparten
El sistema NO asume que un ingreso de máquina se divide entre los hermanos. Mamá tiene dos opciones independientes:
- **A) Ingreso proveniente de una máquina** (ej. Máquina 1, $150.000); luego decide cómo asignarlo.
- **B) Agregar saldo directamente a un hijo**: destino [John|Hermano], monto, origen [Trabajo / Máquina / Otro / Personalizado], descripción. Aumenta SOLO el saldo de ese hijo.

## 5. Cuenta individual
Cada hijo: saldo inicial $0 + movimientos (+ saldo agregado, + máquina, + otro ingreso, − transferencia). Saldo actual calculado automáticamente:
`SALDO = saldo inicial + ingresos + saldos agregados + otros positivos − transferencias − otros negativos`

## 6. Transferencias
Pantalla "Transferir dinero" (solo mamá): destinatario (John/Hermano), monto, fecha, concepto, comprobante (imagen/PDF). Al guardar el saldo baja (550.000 − 100.000 = 450.000) y aparece en el historial.

## 7. Comprobantes
JPG, PNG, PDF, asociados al movimiento. John ve el de su cuenta ("Ver comprobante"); el hermano NO.

## 8. Historial
Cada movimiento muestra: fecha, tipo, monto, origen, destinatario, concepto, comprobante, usuario que lo hizo, fecha de modificación. Colores: ingresos (+), transferencias (−), saldos agregados (+), correcciones identificables.

## 9. Editar movimientos
Mamá edita cualquier movimiento (Máquina 1 $150.000 → $180.000). Saldos se recalculan sin inconsistencias. Auditoría: "Movimiento modificado por mamá", valor anterior, valor nuevo, fecha.

## 10. Eliminar movimientos
Con confirmación ("¿Está segura de que desea eliminar este movimiento?") mostrando tipo, monto, destinatario. Recalcula saldo. Preferible **soft delete**.

## 11. Dashboard de mamá
CUENTA MAMÁ — Resumen: total ingresos, total transferido, saldo administrado. CUENTAS: John, Hermano. Botones: Registrar ingreso, Agregar saldo, Registrar transferencia. Secciones: Máquinas, Historial, Cuentas, Configuración.

## 12. Pantalla de John
"Hola, John". Saldo actual, total ingresos, total recibido, último movimiento (+ $100.000). Tabs: Inicio, Historial, Comprobantes, Mi cuenta, Configuración.

## 13. Detalle de mi cuenta
Saldo actual + **origen del saldo** (Máquinas $350.000, Saldo agregado $200.000, Transferencias −$100.000). Tocar categoría → ver detalle.

## 14. Pantalla del hermano
Misma estructura, datos totalmente independientes. Un usuario normal NUNCA puede consultar ID, saldo ni movimientos del otro.

## 15. Privacidad y seguridad (MUY IMPORTANTE)
Roles `ROLE_ADMIN` / `ROLE_USER`. Mamá todo; John solo `user_id = John`; Hermano solo `user_id = Brother`. **Nunca confiar en ocultar botones**: seguridad en backend/base de datos. Un usuario no debe poder alterar una petición/API para ver datos del otro.

## 16. Autenticación
Login, email/usuario, contraseña, logout, recuperación de contraseña, sesión persistente, protección de rutas. Preparado para biometría futura.

## 17. Notificaciones
Arquitectura preparada (no compleja en v1). Ej.: "Mamá registró una transferencia de $100.000 a tu cuenta.", "Tu saldo fue actualizado.", "Se modificó un movimiento de tu cuenta."

## 18. Diseño
Moderno, limpio, profesional. Fondo oscuro azul/navy, tarjetas, verde = positivo, rojo = salidas, azul = info, iconos simples, bordes redondeados, tipografía moderna, mucho espacio, cómodo en teléfono. SIMPLE: mamá sin conocimientos técnicos. **CLARIDAD > cantidad de funciones.**

## 19. Navegación
- Mamá: Inicio · Ingresos · Transferencias · Cuentas · Máquinas · Historial · Más
- Hijos: Inicio · Historial · Comprobantes · Mi cuenta · Más

## 20. Tecnología
Proponer arquitectura moderna y económica. Evaluar React Native + Expo / Supabase (Postgres, Auth, Storage) pero NO asumirlo; si hay mejor opción, explicar por qué antes. Prioridades: 1 Seguridad, 2 Privacidad, 3 Simplicidad, 4 Bajo costo, 5 Mantenimiento, 6 Escalabilidad.

## 21. Base de datos
Mínimo: users, profiles, machines, income, accounts, account_movements, transfers, receipts, audit_logs, notifications. Relaciones claras: users→accounts→account_movements→receipts; machines→income→account_movements. Explicar relaciones y claves antes de implementar.

## 22. Regla fundamental del saldo
NUNCA guardar solo un número de saldo y modificarlo sin control. Historial de movimientos que permita reconstruir el saldo (+200.000, +150.000, −100.000 = 250.000; si el mov. 1 pasa a 250.000 → 300.000).

## 23. Auditoría
created_by, updated_by, created_at, updated_at, deleted_at, deleted_by. Saber qué hizo mamá y cuándo.

## 24. Dashboard de mamá (métricas)
Total administrado; total generado por máquinas; total asignado a John; total asignado al hermano; total transferido a John; total transferido al hermano; saldo actual por cuenta; ingresos por máquina; historial reciente. Filtros: Hoy, Esta semana, Este mes, Mes anterior, Personalizado.

## 25. Filtros del historial
Fecha, tipo, máquina, usuario, destinatario, monto. Orden: más reciente, más antiguo, mayor monto, menor monto.

## 26. Exportación
Futuro: CSV, Excel, PDF (dejar preparado, fase 2).

## 27. Responsive
Hoy móvil; la arquitectura debe permitir versión web para mamá después.

## 28. Forma de trabajo
Actuar como arquitecto + desarrollador senior + diseñador UX/UI. Primero: analizar requerimientos, detectar problemas/contradicciones, proponer arquitectura, BD, permisos, pantallas, navegación, lógica de saldos, transferencias, comprobantes, seguridad, estructura del proyecto. Luego construir **por fases, sin generar todo de una vez**.

Antes de programar presentar: **A** Arquitectura · **B** Diagrama · **C** Modelo BD · **D** Roles y permisos · **E** Pantallas · **F** Flujo de navegación · **G** Cálculo de saldos · **H** Plan por fases.

### Fases
1. Arquitectura + BD + autenticación
2. Cuenta de mamá
3. Cuenta de John
4. Cuenta del hermano
5. Movimientos + saldos + transferencias
6. Comprobantes
7. Edición + eliminación + auditoría
8. Seguridad + pruebas
9. Diseño final + optimización
10. Preparación para publicar

En cada fase: explicar qué se hace; generar código; indicar dónde va cada archivo; no romper lo anterior; si se modifica un archivo, entregarlo completo o indicar líneas; instrucciones para ejecutar/probar; probar casos importantes; no inventar funciones que aún no existen.

## Casos de prueba obligatorios
1. John $0 → mamá agrega $200.000 → John $200.000
2. Mamá agrega $150.000 de Máquina 1 a John → John $350.000
3. Mamá agrega $100.000 al hermano → John $350.000, Hermano $100.000
4. Mamá transfiere $50.000 a John → John $300.000
5. Mamá modifica ingreso Máquina 1 $150.000 → $180.000 → saldo recalculado correctamente
6. John inicia sesión: NO puede consultar nada del hermano
7. Hermano inicia sesión: NO puede consultar nada de John
8. Mamá inicia sesión: puede consultar ambas cuentas

## Objetivo final
"Mamá administra el dinero y cada hijo tiene una cuenta privada e independiente." Mamá ve todo; cada hijo solo lo suyo; cada movimiento tiene origen; cada transferencia puede tener comprobante; saldos automáticos; movimientos editables; todo queda registrado.
**Prioridad absoluta: saldos correctos y privacidad real entre hermanos.**
