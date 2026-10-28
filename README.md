# Lumine's Realm

Lumine's Realm es una aplicación web interactiva para reunir a personas que mantienen una relación o amistad a distancia. Combina un mapa compartido, recuerdos, una línea del tiempo, perfiles y una ruleta de premios en una interfaz inspirada en los menús de un RPG.

Está construida con React y TypeScript. Supabase proporciona autenticación, base de datos, almacenamiento privado y actualizaciones en tiempo real.

## Contenido

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación local](#instalación-local)
- [Configuración de Supabase](#configuración-de-supabase)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts disponibles](#scripts-disponibles)
- [Seguridad y permisos](#seguridad-y-permisos)
- [Mapa y atribución](#mapa-y-atribución)
- [Solución de problemas](#solución-de-problemas)

## Características

### Inicio y mapa compartido

- Mapa interactivo basado en Leaflet y teselas de OpenStreetMap.
- Muestra los miembros del Realm según el país de su perfil, con marcadores, avatares y hora local.
- Presenta el estado de conexión del Realm y actualiza la vista mediante Supabase Realtime.
- La ubicación es aproximada por país; la aplicación no solicita ni sigue la ubicación GPS del usuario.

### Inventario de recuerdos

- Tarjetas de regalos con título, descripción, categoría, fecha y rareza.
- Rarezas visuales: común, rara, épica y legendaria.
- Modal de detalle para consultar cada recuerdo.
- Los miembros pueden aportar regalos y decidir si son para el Realm, una persona o su vínculo de pareja.
- La administración de regalos se realiza en Inventario; cada autor puede editar o eliminar sus aportes.

### Arcade y ruleta

- Ruleta con segmentos numerados y una lista que relaciona cada número con el nombre del premio.
- Animación de giro y presentación del premio al terminar.
- Los premios se obtienen mediante la función PostgreSQL `spin_gacha_for_current_user`; el cliente no elige el resultado.
- Cada miembro puede proponer premios y limitar quién puede ganarlos.
- En Minijuegos, los autores pueden editar, activar, desactivar o eliminar sus premios.
- Los filtros **Grupo** y **Pareja** separan la audiencia visible en Inventario, Minijuegos y recuerdos; los aportes individuales accesibles aparecen en Grupo.
- La gestión de premios está plegada en un menú, y cada ruleta admite como máximo ocho premios activos.
- Los cupones de Grupo permiten solicitar el canje para un miembro o para todos; los de Pareja solo se canjean con la pareja vinculada.
- La colección de cupones se filtra también por Grupo o Pareja, y la solicitud se puede iniciar desde Minijuegos o Perfil.

### Línea del tiempo

- Galería cronológica de recuerdos que ya ocurrieron, con descripción y foto opcional.
- Cualquier miembro puede aportar un recuerdo para el Realm, una persona o su pareja.
- Los recuerdos se gestionan desde esta sección y solo admiten fechas presentes o pasadas.
- Las imágenes se guardan en un bucket privado de Supabase Storage y se muestran mediante enlaces firmados.

### Perfil y administración

- Registro e inicio de sesión con Supabase Auth.
- Edición del nombre de usuario, país y avatar mediante carga de imagen.
- Solicitud de canje de cupones con destinatario y aprobación por el administrador.
- Selector persistente de modo claro u oscuro, disponible desde la barra superior.
- Gestión de miembros mediante invitaciones por correo.
- Directorio privado del Realm con país, avatar, antigüedad, perfiles emergentes, control individual de visibilidad en el mapa e invitaciones mutuas para formar o terminar un vínculo de pareja.
- El administrador conserva herramientas de moderación e invitaciones; los miembros pueden crear contenido compartido.
- Las invitaciones quedan guardadas en la base de datos; la aplicación no envía correos automáticamente. El administrador comparte el enlace de la aplicación con la persona invitada.

## Tecnologías

- **React 19** y **TypeScript**
- **Vite 8** para desarrollo y compilación
- **Tailwind CSS 4** para estilos
- **Supabase JS** para Auth, PostgreSQL, Storage y Realtime
- **Leaflet / React-Leaflet** para el mapa
- **Framer Motion** para animaciones
- **Lucide React** para iconos
- **canvas-confetti** para los efectos de celebración de la ruleta

## Requisitos

- Node.js compatible con la versión de Vite instalada.
- npm.
- Un proyecto Supabase.
- Acceso a la consola SQL de Supabase para preparar el esquema, políticas y funciones requeridas.

## Instalación local

1. Clona el repositorio y entra en su directorio:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd lumine-realm
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea un archivo `.env.local` en la raíz:

   ```dotenv
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA_DE_SUPABASE
   ```

   Obtén estos valores en la configuración de API del proyecto Supabase. Los valores con prefijo `VITE_` se incluyen en el código enviado al navegador: usa una clave pública/anon compatible con tu configuración, nunca una clave `service_role`.

4. Prepara Supabase siguiendo la siguiente sección.

5. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Vite mostrará la URL local en la terminal, normalmente `http://localhost:5173`.

## Configuración de Supabase

Las migraciones de este repositorio amplían el esquema base de la aplicación; no reemplazan necesariamente toda la configuración inicial de la base de datos.

### 1. Configura Auth

- Habilita el proveedor de correo y contraseña en Supabase Auth.
- Configura las URL permitidas de redirección para desarrollo y para el dominio de publicación.
- Configura la confirmación de correo de acuerdo con las necesidades del proyecto.

### 2. Comprueba el esquema y la función base

Antes de ejecutar las migraciones incluidas, deben existir las tablas y columnas que consumen los servicios:

- `public.profiles`, asociada a `auth.users`.
- `public.gifts`, con los campos que consume `giftsService`.
- `public.coupons`, con los campos de propietario, premio y canje que consume `couponsService`.

### 3. Ejecuta las migraciones incluidas

En Supabase **SQL Editor**, ejecuta los archivos de `supabase/migrations` en orden ascendente:

1. `20261028007000_profile_edit_and_coupon_redemption_requests.sql`
2. `20261028008000_realm_status_realtime.sql`
3. `20261028009000_realm_members_and_invitations.sql`
4. `20261028010000_timeline_and_admin_tools.sql`
5. `20261028011000_admin_registered_users_and_auto_link.sql`
6. `20261028012000_admin_direct_profile_and_member_access.sql`
7. `20261028013000_group_spaces_and_redemption.sql`
8. `20261028014000_content_management_and_audience_filters.sql`
9. `20261028015000_gift_management_permissions.sql`
10. `20261028016000_coupon_targets_map_visibility_and_wheel_limits.sql`

La migración `090` crea el helper `is_realm_member_or_admin()` utilizado por políticas posteriores. La migración `110` añade las funciones de gestión de usuarios e invitaciones. La migración `120` prepara el correo sincronizado en los perfiles y los permisos RLS para que el panel Admin pueda consultar perfiles y añadir/quitar miembros directamente. Respeta el orden. Si estas migraciones ya se ejecutaron en el proyecto, no hace falta volver a aplicarlas.

La migración `130` agrega vínculos de pareja, directorio y audiencias privadas para regalos, premios y recuerdos. También crea el bucket de avatares, permite aportes de miembros y añade RPC protegidas para girar la ruleta y aprobar canjes sin depender del `SELECT` posterior a un cambio de estado. Aplica la migración en Supabase antes de desplegar esta versión. Los cambios de migración se aplican una sola vez; no vuelvas a ejecutar una migración que ya se aplicó.

La migración `140` habilita edición y eliminación por autor, filtros de audiencia en la ruleta, y una función administrativa que retira a un miembro junto con sus contenidos, vínculos y archivos asociados. Si ya aplicaste la `130`, ejecuta ahora la `140` y después la `150`.

La migración `150` concede a los usuarios autenticados los permisos SQL de actualización y eliminación de regalos. RLS sigue limitando estas operaciones al autor del regalo o al Game Master. Si ya aplicaste la `140`, ejecuta solo la `150`.

La migración `160` añade la audiencia y el destinatario de los cupones, la RPC protegida para solicitar canjes, un límite en base de datos de ocho premios activos por ruleta y las preferencias personales para ocultar miembros del mapa. También reemplaza la RPC de giro para separar Grupo y Pareja e incluye los premios individuales accesibles en Grupo. Si ya aplicaste la `150`, ejecuta solo la `160` antes de desplegar esta versión. No vuelvas a ejecutar una migración que ya se aplicó.

### 4. Configura la cuenta administradora

El correo administrador configurado actualmente es `mau.san.0275@gmail.com`, definido en `src/config/roles.ts`. Las políticas SQL también validan esa dirección.

Para usar otro correo, actualiza el valor en el código y ajusta las políticas y funciones SQL correspondientes. La comprobación de interfaz solo controla qué controles se muestran; la autorización real debe permanecer en RLS y PostgreSQL.

### 5. Invita miembros y crea contenido

- Registra e inicia sesión con la cuenta administradora.
- Invita a los miembros desde **Admin → Miembros del Realm**.
- Las cuentas existentes se vinculan directamente; si todavía no tienen cuenta, la invitación pendiente las vincula automáticamente cuando se registran con ese correo.
- Los miembros pueden aportar regalos desde **Inventario**, premios desde **Minijuegos** y recuerdos fechados desde **Línea del tiempo**.
- El contenido puede dirigirse a todo el Realm, a un miembro concreto o a un vínculo de pareja aceptado.
- Las invitaciones de pareja se envían dentro de **Comunidad** y requieren aceptación de la otra persona.

## Estructura del proyecto

```text
src/
├── App.tsx                    # Carga inicial del inventario y composición del hub
├── main.tsx                   # Punto de entrada de React
├── config/
│   ├── roles.ts               # Correo de la cuenta administradora
│   └── supabase.ts            # Cliente de Supabase
├── components/
│   └── ui/
│       └── GiftModal.tsx      # Detalle de un recuerdo
├── modules/
│   ├── admin/                 # Panel, miembros, premios, hitos y estado del Realm
│   ├── arcade/
│   │   └── GachaWheel.tsx     # Ruleta y colección de cupones
│   └── hub/
│       ├── MainHub.tsx        # Navegación principal y pestañas
│       ├── WorldMapHome.tsx   # Mapa compartido
│       ├── TimelineView.tsx   # Galería de recuerdos pasados
│       ├── RealmDirectory.tsx # Directorio y vínculos de pareja
│       └── UserProfile.tsx    # Auth, perfil y canje
├── services/                  # Acceso a Supabase organizado por dominio
└── index.css                  # Estilos globales y tema Tailwind

supabase/
└── migrations/                # Migraciones SQL incrementales
```

Los módulos principales se cargan de forma diferida desde `MainHub.tsx`. Las operaciones de acceso a datos se concentran en `src/services/` para separar la interfaz de la integración con Supabase.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Vite en modo desarrollo. |
| `npm run build` | Ejecuta el chequeo de TypeScript y genera la versión de producción en `dist/`. |
| `npm run preview` | Sirve localmente la compilación de `dist/`. |
| `npm run lint` | Ejecuta ESLint sobre el proyecto. |

Para validar una compilación antes de publicar:

```bash
npm run build
```

## Seguridad y permisos

- Las credenciales de Supabase se leen desde variables `VITE_*`. Todo valor `VITE_*` llega al navegador y no debe contener secretos.
- No uses una clave `service_role` en el frontend.
- Mantén RLS habilitado en las tablas expuestas por Supabase y revisa las políticas antes de publicar.
- La ruleta usa la función SQL segura `spin_gacha_for_current_user`; valida al usuario de sesión y no confía al navegador la selección del ganador ni la creación del cupón.
- Los canjes se solicitan mediante `request_coupon_redemption`; la interfaz no actualiza directamente el estado del cupón. Para premios de Grupo, el servidor valida que el destinatario pertenezca al Realm.
- Cada usuario controla sus propios miembros ocultos mediante `realm_map_hidden_members`; esta preferencia no cambia la pertenencia del Realm ni el mapa de otras personas.
- El correo de administrador está fijado en el código y en políticas SQL. Si se cambia, actualiza ambas partes.
- Los buckets de imágenes de recuerdos y archivos de regalos son privados. Su lectura se filtra mediante las audiencias y se consulta con URLs firmadas temporales.
- Los avatares se guardan en el bucket público `profile-avatars`; cada usuario solo puede subir o modificar archivos bajo su propia carpeta.
- Los cupones se aprueban mediante `admin_approve_coupon_redemption`, que comprueba el rol y devuelve el resultado sin depender de un `SELECT` bloqueado por RLS después del cambio de estado.

## Mapa y atribución

El mapa usa teselas estándar de OpenStreetMap, sin clave de proveedor, y muestra su atribución dentro del mapa. Si cambias el proveedor o la URL de teselas, revisa y cumple sus condiciones de uso y atribución.

Los marcadores se calculan a partir del país guardado en cada perfil y representan una posición aproximada, no la dirección exacta de una persona.

## Solución de problemas

### No se conecta a Supabase

- Comprueba que `.env.local` esté en la raíz y contenga `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Reinicia `npm run dev` después de cambiar variables de entorno.
- Verifica que la URL y la clave correspondan al mismo proyecto Supabase.

### Error de tabla o permiso

- Confirma que el esquema base y las migraciones estén aplicados en el orden indicado.
- Revisa que RLS y las políticas permitan la operación para el usuario y el rol correctos.
- Para consultar contenido de timeline, confirma que la cuenta sea miembro aceptado del Realm o administrador.

### La ruleta no puede girar

- Confirma que la migración `20261028013000_group_spaces_and_redemption.sql` esté aplicada y que exista la RPC `public.spin_gacha_for_current_user()`.
- Asegúrate de que haya al menos dos premios activos y que el catálogo no exceda los ocho espacios de la interfaz.
- Revisa los errores de la función en Supabase; la selección debe realizarse en el servidor.

### No cargan las imágenes de la línea del tiempo

- Confirma que exista el bucket privado `realm-timeline-images` y que la migración `20261028010000_timeline_and_admin_tools.sql` se haya aplicado.
- Revisa las políticas de Storage y que el usuario tenga permiso de lectura como miembro del Realm.

---

Lumine's Realm es un proyecto personal en evolución. La configuración de Supabase y las políticas de acceso forman parte esencial de la aplicación: revísalas para tu propio entorno antes de publicar.
