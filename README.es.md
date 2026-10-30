<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ru.md">Русский</a> · <a href="README.hi.md">हिन्दी</a> · <a href="README.ja.md">日本語</a> · <a href="README.zh-TW.md">繁體中文</a> · <strong>Español</strong>
</p>

<p align="center">
  <a href="https://csrg3b.top/">
    <img src="public/branding/classhub-logo-384-d01f9050a1.webp" width="280" alt="ClassHub" />
  </a>
</p>

<h1 align="center">ClassHub</h1>

<p align="center">
  <strong>Las novedades del grupo, los recursos de estudio y las tareas diarias, en un solo lugar.</strong>
</p>

<p align="center">
  Una plataforma de información para grupos universitarios: avisos, noticias, actividades, recursos, conversaciones, gestión del grupo y asistencia con IA.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&amp;logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 22 en el entorno de despliegue" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&amp;logoColor=white" alt="MongoDB 8 en el entorno de despliegue" />
</p>

<p align="center">
  <a href="https://csrg3b.top/">Sitio web</a> ·
  <a href="https://csrg3b.top/about">Acerca del proyecto</a> ·
  <a href="https://csrg3b.top/privacy">Privacidad</a> ·
  <a href="https://github.com/Mason1035/uniclub-main/issues">Informar de un problema</a>
</p>

<p align="center">
  <a href="#quick-start">Inicio rápido</a> ·
  <a href="#features">Funciones</a> ·
  <a href="#configuration">Configuración</a> ·
  <a href="#deployment">Despliegue</a> ·
  <a href="#docs">Documentación</a> ·
  <a href="#faq">Preguntas frecuentes</a>
</p>

---

<a id="overview"></a>

## Descripción general

ClassHub presta servicio actualmente al **grupo 3 de Ingeniería de Software, cohorte de ingreso de 2025, de Sichuan Normal University**. Los miembros pueden consultar novedades, leer noticias, participar en actividades, compartir recursos, publicar mensajes y realizar trámites del grupo. Los administradores utilizan el mismo sistema para gestionar contenido, la lista de miembros, inscripciones y entregas.

El proyecto utiliza un frontend con React + TypeScript y un backend con Node.js + Express + MongoDB. Incluye cuentas reales, control de acceso, gestión de contenido, servicios de IA e integración con almacenamiento de objetos. Cada despliegue utiliza actualmente la lista de un solo grupo; no ofrece administración de múltiples grupos ni de múltiples organizaciones aisladas entre sí.

La página de inicio, About y la página de privacidad presentan información pública sobre el producto. Las páginas del grupo requieren iniciar sesión y el área de administración exige permisos de administrador. Un repositorio público de código no convierte los datos de los miembros ni los registros operativos en información pública. El proyecto tampoco representa a una organización oficial de la universidad.

**Este README describe la implementación del repositorio actual.** La versión desplegada, el contenido disponible y el estado de los servicios externos pueden ser distintos. La existencia del código no implica que todas las funciones estén configuradas o desplegadas en cada entorno.

### Índice

- [Funciones](#features)
- [Páginas y uso](#usage)
- [Tecnologías y arquitectura](#architecture)
- [Inicio rápido](#quick-start)
- [Entorno y servicios externos](#configuration)
- [Administradores y lista del grupo](#accounts)
- [IA y noticias diarias](#ai)
- [Desarrollo, compilación y verificación](#development)
- [Despliegue y operaciones](#deployment)
- [Seguridad, privacidad y limitaciones conocidas](#security)
- [Estructura del proyecto y mantenimiento del contenido](#structure)
- [Documentación](#docs)
- [Preguntas frecuentes](#faq)
- [Contribuciones e informes de problemas](#contributing)
- [Colaboradores, licencias y recursos](#credits)
- [Traducciones del README](#translations)

<a id="features"></a>

## Funciones

### Área de miembros

| Módulo | Capacidades implementadas |
| --- | --- |
| Inicio | Avisos, actividades, recursos y noticias recientes, además de una pequeña selección de publicaciones del grupo y recuerdos de actividades; las listas completas están en sus respectivas secciones |
| Avisos y notificaciones | Avisos del grupo, notificaciones personales, estado de mensajes sin leer y marcado como leído |
| Noticias | Listado, texto de los artículos, interacciones y conversación con IA sobre el artículo actual |
| Actividades | Etapas, calendario, filtros por tipo y año; solicitudes de inscripción, estado de aprobación personal y cancelación; resúmenes, álbumes y actividades anteriores |
| Recursos de estudio | Listados, detalles, enlaces, opciones de descarga y registros de uso |
| Publicaciones del grupo | Texto e imágenes, debates, interacciones, contenido guardado y las reglas existentes de seguimiento y visibilidad |
| Búsqueda del sitio | Contenido al que puede acceder la cuenta actual, mediante el diálogo de búsqueda compartido |
| Materiales de evaluación | Entregas ZIP durante periodos abiertos, estado de la entrega, sustitución antes del plazo y descarga de los archivos propios |
| Cuotas del grupo | Códigos QR de pago, capturas del pago y notas, y estado de confirmación del administrador |
| Selección aleatoria de miembros | Selección uniforme entre los miembros reales que cumplen los requisitos, presentada como una portada de álbum con el avatar y un disco de vinilo; permite volver a seleccionar |
| Cuentas y ajustes | Inicio de sesión con número de estudiante o identificador de cuenta, cambios de contraseña, perfil, avatar, preferencias y contenido guardado |
| Avatares predeterminados | Si no se ha subido un avatar, se asigna uno de la biblioteca mediante un identificador estable de la cuenta; se mantiene entre páginas y dispositivos |
| Mascota virtual en la web | Mascota opcional, apariencias, interacciones y preferencias asociadas a la cuenta; véase la [documentación de la mascota](docs/classhub-pet.md) |

### Área de administración

| Módulo | Capacidades implementadas |
| --- | --- |
| Panel general | Resumen del contenido y las operaciones existentes del grupo |
| Lista y miembros | Importación de la lista real del grupo, gestión de miembros y permisos de las cuentas |
| Gestión de contenido | Noticias, recursos, avisos/notificaciones y registros de álbumes existentes |
| Gestión de actividades | Borradores y publicación, horarios y capacidad, revisión de inscripciones y operaciones por lotes, recuento de miembros no inscritos, álbumes, resúmenes, archivo, ocultación y restauración |
| Materiales de evaluación | Periodos de recogida, horarios de apertura, miembros con o sin entrega según la lista real, filtros de registros y descargas |
| Gestión de cuotas | Configuración de códigos QR, revisión de comprobantes, conciliación manual y confirmación de recepción |
| Asistente de IA | Ayuda con texto e imágenes, generación según el escenario, vistas previas editables de publicación, revisiones posteriores, cancelación y respuestas en streaming |
| Noticias diarias con IA | Horario, cantidad y categorías; búsqueda, validación, publicación por lotes, estado de ejecución, motivos de fallo e historial de tareas |

### Interacción y presentación

- Cabecera adaptable, navegación inferior en móviles, pie de página centrado y componentes compartidos de formularios, diálogos y mensajes.
- Precarga de marca en la primera visita: espera a la ruta actual, las fuentes de la primera pantalla y las imágenes visibles; evita repetirse en la misma sesión e incluye tiempo límite y omisión con el teclado.
- About incluye desplazamiento suave, ilustraciones geométricas originales y tarjetas de desarrolladores que se mueven en arco. Esta página no muestra la cabecera del sitio.
- Una página 404 específica reutiliza la marca, la búsqueda existente y una ilustración local de un astronauta.
- Las animaciones respetan `prefers-reduced-motion`; los dispositivos móviles y táctiles utilizan diseños y comportamientos de desplazamiento adecuados.
- **La aplicación actual utiliza un tema claro fijo.** La presencia de estilos oscuros antiguos o dependencias relacionadas con temas no significa que exista un selector de modo oscuro.

<a id="usage"></a>

## Páginas y uso

| Página | Ruta | Acceso |
| --- | --- | --- |
| Inicio / About / Privacidad | `/`, `/about`, `/privacy` | Información pública del producto |
| Inicio de sesión | `/auth` | Acceso con una cuenta del grupo |
| Avisos / Noticias / Actividades | `/announcements`, `/news`, `/events` | Miembros con sesión iniciada |
| Recursos / Publicaciones del grupo | `/resources`, `/social` | Miembros con sesión iniciada |
| Notificaciones / Contenido guardado / Ajustes | `/notifications`, `/saved-posts`, `/settings` | Cuenta actual |
| Funciones del grupo | `/functions` | Miembros con sesión iniciada |
| Entrega de materiales / Cuotas | `/quantification`, `/fees` | Cuentas con sesión iniciada; el backend comprueba cada operación |
| Selección aleatoria de miembros | `/functions/random-call` | Miembros actuales que cumplen los requisitos |
| Administración | `/admin` | Administradores verificados por el backend |
| IA de administración / Noticias diarias | `/admin/ai`, `/admin/ai#daily-news` | Administradores |

Los artículos utilizan `/article/:id`, y se conserva `/news/:id` por compatibilidad. Los detalles de actividades utilizan `/events/:id`, con `/event/:id` también disponible. Los recursos utilizan `/resource/:id`. Las preguntas a la IA están al final del artículo; no constituyen una página pública de chat independiente.

Los estudiantes acceden con cuentas creadas por el administrador del grupo y abren las secciones desde la navegación. Los administradores preparan la lista real, publican contenido, abren periodos de recogida y configuran los servicios externos. Cuando no hay contenido publicado o un servicio no está disponible, las páginas muestran el estado vacío o el mensaje de error correspondiente.

<a id="architecture"></a>

## Tecnologías y arquitectura

| Capa | Tecnologías e implementación |
| --- | --- |
| Frontend | React 18, TypeScript 5, Vite 5, React Router 6 |
| Datos y componentes | TanStack React Query, Axios, Tailwind CSS, Radix UI, Lucide, React Markdown |
| Animación | GSAP 3.15, `@gsap/react`; ScrollTrigger / ScrollSmoother se cargan cuando About los necesita |
| Backend | Node.js, Express 5, CommonJS; rutas, servicios de negocio y repositorios |
| Base de datos | MongoDB, Mongoose 8 |
| Autenticación | Hash de contraseñas con bcrypt, JWT, comprobación de cuentas/administradores en la base de datos y revocación de sesiones mediante `tokenVersion` |
| IA | `DeepSeekAssistant` compartido, SSE, búsqueda web controlada y extracción del texto de artículos |
| Imágenes y archivos | Multer, Sharp, Tencent Cloud COS / SCF, firmas de corta duración y subidas directas desde el navegador |
| Páginas públicas | HTML real para visitantes de Inicio, About y Privacy generado durante la compilación, con interacciones de React en ejecución |
| Despliegue | ECS / Nginx / systemd; el repositorio también incluye configuración para Vercel |
| Móvil | Web adaptable, Web App Manifest, configuración de Capacitor y un proyecto Android |

```text
Navegador / páginas React
    |
    +-- Desarrollo: Vite actúa como proxy para /api y /uploads
    +-- Producción: proxy inverso Nginx / origen API separado
            |
            v
        Express API
            +-- Comprobaciones de JWT / cuenta / permisos
            +-- Service / Repository -- MongoDB
            +-- DeepSeekAssistant -- DeepSeek
            |        +-- NewsAPI / RSS de editores / lectura web controlada
            +-- Servicios de almacenamiento protegidos -- SCF / COS
                                                            ^
                       Subidas o descargas del navegador con autorización temporal
```

Los modelos principales son `User`, `EnrolledUser`, `News`, `Announcement`, `Event`, `ActivityMedia`, `Resource`, `SocialPost`, `Notification`, `Chat`, `AiSettings` y `DailyNewsJob`, además de modelos para periodos de recogida, entregas, subidas, configuración de cuotas y comprobantes de pago. Las funciones reutilizan los usuarios y la lista existentes en lugar de crear un segundo conjunto de datos de estudiantes.

<a id="quick-start"></a>

## Inicio rápido

### 1. Preparar el entorno

- Git, Node.js y npm. El despliegue ECS existente utiliza **Node.js 22**; se recomienda la misma versión principal en local. El repositorio no impone una restricción `engines`.
- Una instancia MongoDB accesible. El despliegue existente utiliza MongoDB 8. Algunas operaciones admiten MongoDB standalone; las transacciones de un replica set no son un requisito para arrancar.
- La IA y las subidas a la nube son servicios externos opcionales. Sin configurar, esas funciones no están disponibles, pero las páginas públicas de presentación siguen siendo accesibles.

### 2. Clonar e instalar dependencias

```bash
git clone https://github.com/Mason1035/uniclub-main.git
cd uniclub-main
npm ci
npm --prefix uniclub-backend ci
```

También se puede usar `npm run install-all`, que ejecuta `npm install` para frontend y backend. Las dependencias GSAP provienen de los paquetes incluidos en `vendor/`; conserva ese directorio al clonar, compilar y desplegar.

### 3. Configurar el backend

Copia el archivo de ejemplo:

```bash
cp uniclub-backend/.env.example uniclub-backend/.env
```

Windows PowerShell:

```powershell
Copy-Item uniclub-backend/.env.example uniclub-backend/.env
```

Edita `uniclub-backend/.env` y proporciona como mínimo:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/uniclub
JWT_SECRET=replace_with_a_long_random_private_secret
PORT=5050
REQUIRE_ENROLLED_ROSTER=true
ALLOWED_EMAIL_DOMAINS=
```

La cadena de conexión es un ejemplo local; sustituye `JWT_SECRET`. Los valores de ejemplo de NewsAPI / Gemini no son claves válidas y deben quedar vacíos si no se usan esos servicios. La configuración actual de DeepSeek se describe más abajo y no requiere una clave Gemini.

Si `mongod` ya está instalado, ejecútalo en otro terminal:

```bash
npm run mongo
```

El script escucha por defecto en `127.0.0.1:27017` y guarda los datos en `~/data/db`; no instala MongoDB. Omite este paso si la base de datos ya está funcionando. `MONGOD_BIN`, `MONGODB_DBPATH` y `MONGODB_PORT` permiten cambiar el ejecutable local, el directorio de datos o el puerto.

### 4. Iniciar frontend y backend

```bash
npm start
```

| Servicio | Dirección predeterminada |
| --- | --- |
| Frontend | <http://localhost:8081> |
| Estado del backend | <http://localhost:5050/api/health> |
| Acerca del proyecto | <http://localhost:8081/about> |
| Inicio de sesión / Administración | <http://localhost:8081/auth> / <http://localhost:8081/admin> |

El backend solo empieza a escuchar después de conectarse a la base de datos. En el primer uso, [inicializa el administrador y la lista del grupo](#accounts). La página pública de inicio no crea miembros ni contenido operativo automáticamente.

También puedes ejecutar `npm run backend` y `npm run frontend` en terminales separados. Los comandos normales de inicio funcionan en Windows. Los scripts antiguos `start:win` / `stop:win` aún asumen el puerto 5000 y terminan procesos asociados a puertos, por lo que no se recomiendan como método predeterminado.

<a id="configuration"></a>

## Entorno y servicios externos

### Dónde se guarda la configuración

| Configuración | Ubicación y finalidad |
| --- | --- |
| Conexiones del backend, autenticación y secretos del servidor | `uniclub-backend/.env` o variables de entorno protegidas en el servidor de producción |
| Proxy de desarrollo del frontend | `VITE_API_PROXY_TARGET` en `.env.local` de la raíz; por defecto `http://localhost:5050` |
| URL de API del frontend en producción | `VITE_API_URL` durante la compilación; vacía para un proxy inverso del mismo origen, o el origen de la API para otro host, sin añadir `/api` otra vez |
| Clave API de DeepSeek | Se configura en `/admin/ai` y se almacena cifrada en `AiSettings` |
| Ajustes de almacenamiento | Configuración de almacenamiento de materiales en administración, guardada en un archivo privado; `QUANTIFICATION_STORAGE_CONFIG_PATH` puede cambiar su ubicación |

**Las variables `VITE_*` se incluyen en la compilación para el navegador y nunca deben contener secretos.** El antiguo `.env.example` de la raíz contiene `VITE_API_URL=http://localhost:5000`; no es el puerto actual del proxy de desarrollo y no debe copiarse directamente a producción.

Al cambiar el puerto del backend, configura el destino del proxy en `.env.local` de la raíz antes de iniciar:

```dotenv
VITE_API_PROXY_TARGET=http://localhost:5051
```

El script de inicio de la raíz usa este destino para seleccionar el puerto del backend. Si también defines `PORT`, ambos deben coincidir. Un cambio de `VITE_API_URL` en producción requiere recompilar el frontend.

### Servicios opcionales

| Servicio | Configuración | Si no se configura |
| --- | --- | --- |
| DeepSeek | Inicializa `AI_SECRET_ENCRYPTION_KEY`, reinicia el backend, guarda la clave API y prueba la conexión en administración | La IA de administración, las preguntas sobre noticias y la generación diaria no están disponibles |
| Búsqueda de noticias | El `NEWS_API_KEY` existente; la capa compartida también puede usar RSS de editores predefinidos | RSS puede complementar los resultados, con límites de fuentes, actualidad y red |
| Adaptador COS directo | `OBJECT_STORAGE_PROVIDER=cos`, `COS_BUCKET`, `COS_REGION`, `COS_SECRET_ID`, `COS_SECRET_KEY` | Las subidas reales de materiales no están disponibles |
| SCF + COS | Bucket privado, región, URL de invocación de funciones, autenticación del servidor coincidente y ajustes de almacenamiento | Las subidas/descargas de nube correspondientes no están disponibles |
| Medios de actividades | SCF protegido, `CLASSHUB_SCF_AUTH_SECRET`, permisos limitados al prefijo de actividades y CORS | Los originales y las miniaturas no se pueden guardar correctamente |
| Orígenes de solicitudes en producción | Define `CORS_ORIGINS` y `BACKEND_URL` para los dominios reales | Las solicitudes entre orígenes o los enlaces generados pueden fallar |
| Cron autenticado | `CRON_SECRET` | Las solicitudes Cron externas se rechazan |

El almacenamiento también requiere recursos de nube, políticas de acceso privado, CORS y directorios persistentes. `npm start` no crea buckets, funciones ni roles de Tencent Cloud. La implementación actual admite COS y no incluye un adaptador OSS listo para usar. Las actividades y los materiales comparten configuración de almacenamiento, pero tienen prefijos de objetos y permisos de negocio separados.

Consulta la [guía de materiales de evaluación](docs/quantification.md), la [configuración SCF](uniclub-backend/cloud-functions/quantification/README.md) y la [guía COS de actividades](docs/activity-v2/ACTIVITY_V2_COS.md). Estos documentos incluyen registros históricos; la configuración efectiva debe determinarse con el código actual y el entorno de destino.

<a id="accounts"></a>

## Administradores y lista del grupo

### Inicializar un administrador

Define `ADMIN_EMAIL` y `ADMIN_PASSWORD` en el entorno privado del backend y, si hace falta, `ADMIN_NAME` y `ADMIN_UNIQUE_ID`. Después ejecuta desde la raíz del repositorio:

```bash
npm run admin:create
```

- El acceso utiliza el **número de estudiante / identificador de cuenta `uniqueId`**, no el correo electrónico. El identificador predeterminado de un administrador independiente sigue el formato `ADMIN-...`.
- Si encuentra una cuenta existente, el script puede concederle permisos de administrador. Conserva la contraseña salvo que se establezca explícitamente `ADMIN_UPDATE_PASSWORD=true`.
- Retira las variables de inicialización del entorno permanente después de usarlas. No escribas contraseñas reales en el README, ejemplos de comandos o Git.
- Para cambiar la contraseña de un administrador existente, usa el comando con entrada de contraseña oculta: `npm run admin:password -- admin@example.com`. El correo es un ejemplo. El cambio invalida las sesiones anteriores.

### Importar la lista del grupo

Se admiten CSV, TSV y JSON. El número de estudiante y el nombre son obligatorios; el correo es opcional. Ejemplo CSV con miembros ficticios:

```csv
uniqueId,name
202500001,Example Member A
202500002,Example Member B
```

Primero comprueba la importación y después escribe los datos:

```bash
npm run roster:import -- ./roster.csv --dry-run
npm run roster:import -- ./roster.csv
```

`--dry-run` no modifica cuentas, listas ni índices. La importación real crea las cuentas de acceso que faltan. **La contraseña inicial es el número de estudiante y debe cambiarse en el primer inicio de sesión.** Las importaciones repetidas conservan contraseñas, roles y perfiles existentes. Nunca incluyas una lista real en el repositorio público.

La política de registro predeterminada exige que el correo y el número de estudiante coincidan con la lista. El flujo principal actual importa cuentas y permite iniciar sesión directamente con el número de estudiante. `REQUIRE_ENROLLED_ROSTER=false` desactiva la comprobación de la lista durante el registro; no debe usarse como solución habitual para datos incorrectos.

La selección aleatoria utiliza la intersección de `User.isEnrolled` y `EnrolledUser.uniqueId`, sin excluir por el rol de administrador. Los estudiantes administradores que figuran en la lista participan; los administradores independientes que no figuran quedan fuera. Cada selección usa la lista completa y puede elegir a la misma persona varias veces seguidas. `crypto.getRandomValues()` del navegador, con muestreo por rechazo, evita el sesgo de la operación módulo.

<a id="ai"></a>

## IA y noticias diarias

### Un servicio de IA compartido

El asistente de administración, las preguntas sobre noticias y las noticias diarias reutilizan `DeepSeekAssistant`, la misma configuración de base de datos y la misma clave. No crean claves ni clientes de IA independientes. El código actual usa `deepseek-flash` y `https://api.deepseek.com`; la selección del modelo se concentra en el servicio compartido.

Inicializa la clave maestra de cifrado:

```bash
npm --prefix uniclub-backend run ai:init-secret
```

Reinicia el backend, introduce la clave API de DeepSeek en `/admin/ai` y prueba la conexión. La clave maestra es un valor de 32 bytes codificado en Base64; la clave API se almacena mediante AES-256-GCM. Haz copias de seguridad tanto de la base de datos como de la clave maestra. Perder o sustituir esta última impide descifrar la clave API guardada, que deberá introducirse de nuevo.

### Asistente de contenido para administradores

Admite texto e imágenes, 12 escenarios, generación en streaming, resultados Markdown, revisiones posteriores y cancelación. **Las descripciones de recursos, los borradores de avisos, los artículos de noticias y los textos de actividades** incluyen vistas previas para publicar en sus respectivas secciones. Tras editar, validar y confirmar, el contenido se publica mediante las API de negocio originales. Generar contenido no lo publica automáticamente.

### Preguntas sobre noticias

- El frontend solo envía el ID del artículo y la pregunta. `GET/POST /api/chat/:articleId` lee en el servidor el texto fiable, la visibilidad del artículo y el historial del usuario actual.
- Los resúmenes, los puntos de vista del artículo y la extracción de organizaciones priorizan el propio texto. Preguntas como «por qué», análisis de consecuencias y comparaciones pueden activar reasoning.
- Las preguntas sobre el estado más reciente, la situación actual, novedades posteriores o búsquedas explícitas activan la búsqueda compartida cuando hace falta. El contenido web externo se trata como referencia no fiable, no como instrucciones del sistema.
- Los artículos largos y el historial tienen límites de contexto. SSE muestra la respuesta por partes con el renderizador Markdown existente; las fuentes externas proceden únicamente de búsquedas reales.
- Si la búsqueda falla, el modelo puede responder con el artículo. Las conversaciones utilizan el modelo `Chat` existente y se separan por usuario y artículo. Las preguntas tienen un máximo de 1.000 caracteres.
- El backend aplica límites de frecuencia y protección de concurrencia. Por defecto, permite 20 preguntas por usuario cada 10 minutos. La protección actual está en memoria de un solo proceso; no es un sistema de cuotas distribuido.

### Noticias diarias con IA

Gestiona ajustes, estado e historial en `/admin/ai#daily-news`. Los valores predeterminados son `19:00` de Pekín y dos artículos al día. La cantidad puede configurarse de uno a cinco artículos, sobre inteligencia artificial, tecnología, ingeniería de software, ciencia y educación.

```text
Comprobación programada / ejecución confirmada por un administrador
    -> Búsqueda en NewsAPI + RSS de editores
    -> Validación de actualidad, editor y fuente
    -> Selección de temas, lectura de fuentes, generación y revisión de hechos
    -> Preparación de un lote completo
    -> Activación del lote visible tras el éxito; conservación de artículos manuales y registros anteriores
```

El proceso usa fuentes reales publicadas en las 24 horas anteriores. Si faltan fuentes fiables o falla la validación, no completa la cantidad con contenido inventado ni sustituye el último lote correcto. Las noticias antiguas de IA se archivan por lotes; las creadas manualmente no se eliminan de forma automática.

El proceso persistente del backend revisa las tareas programadas con `NODE_ENV=production`. El inicio en desarrollo no llama automáticamente a servicios de IA de pago. Vercel Cron utiliza el endpoint protegido `/api/cron/daily-news`, requiere `CRON_SECRET` y un plan que admita la frecuencia configurada y suficiente tiempo de ejecución.

Ejecuta el diagnóstico manual desde el directorio del backend:

```bash
cd uniclub-backend
node manual-curation.js --dry-run
```

**Este `--dry-run` sigue haciendo solicitudes reales a la red y llamadas a IA de pago; solo evita guardar noticias.** Sin el parámetro, el comando intenta publicar. `--force` regenera expresamente el lote del día. Los comandos antiguos de selección de noticias ahora usan el flujo diario unificado; no los configures con las antiguas instrucciones de Gemini programadas a medianoche de Dallas.

El plan gratuito Developer de NewsAPI retrasa los artículos 24 horas y está limitado oficialmente a desarrollo y pruebas, excluyendo staging y producción. Usar este proveedor en producción requiere un plan adecuado. Consulta los [planes oficiales de NewsAPI](https://newsapi.org/pricing). RSS puede aportar fuentes adicionales, pero el éxito local no garantiza el funcionamiento de la red del servidor, las páginas fuente o todas las fechas de publicación. La implementación se describe en la [documentación de noticias diarias](uniclub-backend/README.daily-news.md). Verifica los resultados de IA y sus referencias; los costes dependen del proveedor y del uso real.

<a id="development"></a>

## Desarrollo, compilación y verificación

### Comandos habituales

Ejecuta estos comandos desde la raíz del repositorio:

| Comando | Finalidad |
| --- | --- |
| `npm start` / `npm run dev` | Iniciar frontend y backend juntos |
| `npm run frontend` / `npm run backend` | Iniciar solo una parte |
| `npm run mongo` | Iniciar MongoDB local ya instalado |
| `npm run typecheck` | Comprobar TypeScript del frontend y de la configuración Vite |
| `npm run lint` | Comprobar el código con la configuración ESLint actual |
| `npm run build` | Comprobación de tipos, compilación Vite y generación de HTML público para SEO |
| `npm run preview` | Vista previa de `dist/`; no inicia backend ni base de datos |
| `npm test` | Pruebas del backend y de la mascota; no incluye todos los scripts específicos del frontend |
| `npm --prefix uniclub-backend run test:ai` | Pruebas de IA de administración |
| `npm run test:seo` | Verificar páginas públicas y rutas de despliegue; requiere compilar antes |
| `npm run test:pet` | Pruebas de la mascota |
| `npm run admin:create` / `npm run roster:import -- ...` | Inicializar administradores y lista; escribe en la base de datos según los argumentos |
| `npm run curate:news` | Tarea manual de noticias diarias; puede llamar a servicios de pago y guardar noticias |
| `npm run daily-curator` | Proceso de planificación independiente; normalmente no hace falta si el proceso principal de producción ya ejecuta el planificador |

Elige las comprobaciones existentes que correspondan al cambio:

```bash
node scripts/test-news-chat.mjs
node scripts/test-ai-preview.mjs
node scripts/test-daily-news-ui.mjs
node scripts/test-activity-frontend.mjs
node scripts/test-random-call.mjs
node scripts/test-default-avatars.mjs
node scripts/test-preloader.mjs
node scripts/test-request-sharing.mjs
node scripts/test-not-found.mjs
```

Algunas comprobaciones de integración del backend requieren MongoDB o un entorno de pruebas aislado. Si no hay Nginx, las comprobaciones de SEO serving omiten las respuestas reales de Nginx. Superar las pruebas no verifica los servicios de IA externos, los permisos de nube, los navegadores en dispositivos físicos ni el entorno de producción. Para cambios habituales, ejecuta las comprobaciones directamente relacionadas y las compilaciones necesarias; no hace falta una regresión de todo el sitio cada vez.

<a id="deployment"></a>

## Despliegue y operaciones

### Archivos del frontend y rutas HTTP

`npm run build` genera `dist/`, que incluye:

- `index.html`, `about.html`, `privacy.html`: contenido real para visitantes.
- `app.html`: estructura de la aplicación privada para inicio de sesión, páginas de miembros y administración.
- `404.html`: página para rutas desconocidas.
- `sitemap.xml`, `seo-routes.json`, `static/` y recursos públicos.

No redirijas indiscriminadamente todas las URL desconocidas al inicio. El despliegue debe distinguir entre páginas públicas, aplicación privada, proxy API y respuestas 404 reales. Las URL canónicas, las directivas robots, JSON-LD y el sitemap solo cubren las páginas públicas de presentación revisadas.

### ECS / Nginx / systemd

El repositorio incluye procedimientos de publicación, copia de seguridad y reversión para el servidor existente; véase [`deploy/ecs/README.md`](deploy/ecs/README.md). Utiliza un proceso Node.js persistente, MongoDB y Nginx, acordes con los requisitos actuales de configuración en archivos, subidas y tareas en segundo plano.

Tras verificar el acceso SSH, los directorios de destino y la configuración del entorno, los responsables de mantenimiento pueden ejecutar:

```bash
bash deploy/ecs/push.sh
```

Este comando compila, transfiere y activa la versión del servidor. **No es un instalador universal de un servidor nuevo con un solo comando.** Verifica el destino antes de ejecutarlo.

Consideraciones de despliegue:

- Mantén los archivos de entorno, las subidas y la configuración privada de almacenamiento fuera de los directorios de versiones. Inclúyelos en copias protegidas, no en Git ni en los paquetes del frontend.
- Sirve HTTPS público mediante Nginx. Configura backend y base de datos para escuchar en loopback o interfaces de red privada según la topología.
- Configura los `CORS_ORIGINS` reales de producción. Usa `TRUST_PROXY=loopback` solo para la topología correspondiente de proxy inverso local.
- Permite streaming SSE en el proxy y configura tiempos de espera suficientes. Evita caché o buffering intermedios que impidan mostrar respuestas por partes.
- Tras publicar, comprueba el estado de los servicios, el inicio de sesión, el HTML público, los recursos estáticos, los 404 de URL desconocidas y las funciones afectadas por el cambio.
- Haz copia, como mínimo, de MongoDB, archivos subidos, ajustes de almacenamiento y clave maestra de IA. Revertir el código no revierte la base de datos.

### Vercel y proyectos móviles

`vercel.json` contiene configuración de compilación, API, páginas públicas, recursos estáticos, 404 y Cron. Las subidas a disco, las escrituras de configuración privada, los límites de frecuencia en memoria y las tareas de IA prolongadas requieren adaptación a la plataforma. No se debe asumir que todas las funciones existentes pueden trasladarse sin cambios a serverless.

El repositorio incluye configuración de Capacitor y un proyecto Android que todavía conservan identificadores históricos `Uniclub`. Una web adaptable y un Web App Manifest no implican que se hayan publicado aplicaciones Android/iOS ni que los datos del grupo estén disponibles sin conexión.

### Actualización de datos

Los scripts existentes cubren preferencias predeterminadas de la mascota, inicialización de cuotas, noticias diarias y Activity V2. Están en `uniclub-backend/migrations/` o en los scripts del backend. Primero haz una copia de seguridad, lee el script y la documentación del módulo, y después decide si ejecutarlo. No ejecutes todo el directorio sin revisar.

La migración Activity V2 utiliza dry-run por defecto, exige un `ACTIVITY_MIGRATION_MONGO_URI` explícito y solo escribe con `--apply`. Los destinos remotos también requieren `--allow-remote`. Las cuotas se inicializan con `npm --prefix uniclub-backend run fees:init`; el script de compatibilidad de noticias diarias es `uniclub-backend/migrations/20261006_daily_ai_news.js`. Estas operaciones son independientes de una compilación normal del frontend.

<a id="security"></a>

## Seguridad, privacidad y limitaciones conocidas

| Área | Comportamiento actual y límites |
| --- | --- |
| Permisos | El backend verifica cuentas reales, versiones de sesión y condición de administrador. Ocultar enlaces, usar robots o noindex no sustituye la autorización de API o medios |
| API y medios antiguos | Algunos endpoints anónimos y enlaces antiguos aún necesitan una auditoría independiente. El proyecto no afirma que todos los datos operativos sean totalmente privados; véase la [auditoría SEO/GEO](docs/SEO_GEO_AUDIT.md) |
| Alcance del grupo | Un grupo por despliegue; sin aislamiento entre varias organizaciones, administración de toda la universidad ni cambio de grupo |
| Cuotas | Un registro actual por usuario; las capturas se guardan en la base de datos y los administradores concilian los pagos manualmente. Sin pasarela de pago, detección automática de ingresos, OCR, reembolsos ni libro de cuentas de varios periodos |
| Materiales de evaluación | ZIP de hasta 500 MiB, subidas multipart y reintentos durante la sesión. Sin análisis de virus; al recargar durante una subida incompleta normalmente hay que seleccionar el archivo otra vez. No hay reanudación completa mediante identificadores de archivo entre cargas de página |
| Álbumes de actividades | JPEG / PNG / WebP, hasta 10 MiB por imagen, con miniaturas WebP generadas. Las miniaturas eliminan metadatos; los originales pueden conservar EXIF. Los medios nuevos usan acceso controlado con firma |
| Selección aleatoria | Intersección de la lista y las cuentas válidas; quedan fuera las entradas sin cuenta creada. Se permiten repeticiones; no hay modo sin repetición |
| IA | Las claves permanecen en el servidor. Verifica los resultados. Búsqueda, generación, cuotas y costes dependen de servicios externos |
| Varios procesos | Los límites de IA operan actualmente en la memoria del proceso; los bloqueos de la configuración dinámica de almacenamiento también están limitados a un proceso. Evalúa estas restricciones antes de escalar |
| Archivos y copias | Los objetos COS, MongoDB y los archivos locales se gestionan por separado. Las listas reales, capturas de pago, ZIP entregados, archivos de entorno y copias no deben aparecer en el repositorio público |

Los usuarios pueden consultar la [información de privacidad y almacenamiento del navegador](https://csrg3b.top/privacy). Los registros históricos de verificación en la documentación no implican que todos los problemas estén resueltos en el despliegue actual de producción.

Si una incidencia afecta a cuentas, claves o privacidad de los miembros, no publiques detalles de explotación, datos reales ni credenciales en un Issue público. Informa mediante un canal privado ya establecido con los responsables de mantenimiento y publica una descripción sin información sensible después de la confirmación. El repositorio todavía no tiene un `SECURITY.md` independiente ni un plazo de respuesta garantizado.

<a id="structure"></a>

## Estructura del proyecto y mantenimiento del contenido

```text
uniclub-main/
├── src/
│   ├── components/              # Cabecera, pie, búsqueda, chat IA y UI compartida
│   ├── context/                 # Cuenta, autenticación, diálogos y estado del tema
│   ├── features/pet/            # Mascota virtual del sitio principal
│   ├── pages/                   # Páginas de miembros, About y administración
│   ├── lib/                     # Solicitudes, sesiones, animación, subidas y utilidades
│   ├── styles/                  # Tokens de diseño y estilos compartidos
│   ├── seo/                     # Renderizado de páginas públicas al compilar
│   └── routeConfig.tsx          # Definiciones de rutas del sitio
├── public/                      # Marca, fuentes, avatares, mascotas y recursos estáticos
├── shared/                      # Reglas compartidas y lista de páginas públicas SEO
├── uniclub-backend/
│   ├── index.js                 # Entrada Express e integración de tareas
│   ├── routes/                  # API de miembros, administradores y Cron autenticado
│   ├── middleware/              # Autenticación, permisos, privacidad y respuestas
│   ├── models/                  # Modelos MongoDB
│   ├── services/                # Servicios de negocio, IA, búsqueda y almacenamiento
│   ├── cloud-functions/         # Código Tencent Cloud SCF
│   ├── jobs/                    # Tareas programadas
│   ├── migrations/              # Migraciones incrementales
│   ├── scripts/                 # Herramientas de listas, administradores y operaciones
│   └── test/                    # Pruebas del backend
├── test/                        # Fuentes de pruebas específicas del frontend
├── scripts/                     # Inicio, compilación, recursos y comprobaciones
├── docs/                        # Guías, auditorías, informes y documentación archivada
├── deploy/ecs/                  # Nginx, systemd, publicación, copias y reversión
├── vendor/                      # Paquetes GSAP distribuidos con el repositorio
├── design-experiments/          # Experimentos independientes, no rutas del sitio principal
├── dsh-niulai-pet-master/        # Proyecto original de referencia de la mascota
├── android/                     # Proyecto Android de Capacitor
├── tokens.css                   # Fuentes, colores y tokens de diseño globales
├── package.json                 # Comandos de desarrollo y dependencias del frontend
└── vercel.json                  # Configuración de despliegue Vercel
```

| Qué cambiar | Ubicación principal |
| --- | --- |
| Contenido de About y desarrolladores | `src/pages/AboutPage.tsx`, `src/pages/about/` |
| Lema de inicio y parámetros de escritura | `src/pages/Homepage.tsx`, `src/components/AnimatedTerminalText.tsx` |
| Cabecera, pie y estructura de página | `src/components/SiteHeader.tsx`, `SiteFooter.tsx`, `Layout.tsx` |
| Fuentes, colores e interacciones | `tokens.css` de la raíz y `src/styles/`; fuentes documentadas en `FONT_NOTES.md` |
| Rutas | `src/routeConfig.tsx`, `src/routes.tsx` |
| Textos SEO públicos y alcance | `shared/seo.json`, `src/lib/seo.ts`, `scripts/build-seo.mjs` |
| Solicitudes Axios / SSE | `src/lib/axios.ts`, `src/lib/aiStream.ts` |
| Modelos IA, contexto y búsqueda | `uniclub-backend/services/DeepSeekAssistant.js` y servicios de búsqueda compartidos |

<a id="docs"></a>

## Documentación

| Documento | Contenido |
| --- | --- |
| [Despliegue ECS](deploy/ecs/README.md) | Publicación, comprobaciones de estado, copias, reversión y directorios persistentes |
| [IA de administración](uniclub-backend/README.ai.md) | Claves, escenarios, vistas previas e implementación del servicio |
| [Noticias diarias con IA](uniclub-backend/README.daily-news.md) | Búsqueda, actualidad, programación, publicación por lotes y diagnóstico de fallos |
| [Materiales de evaluación](docs/quantification.md) | Periodos de recogida, ZIP, COS, subidas y descargas |
| [Cuotas del grupo](docs/fees.md) | Comprobantes de pago y confirmación manual |
| [Diseño de actividades](docs/activity-v2/ACTIVITY_V2_DESIGN.md) | Ciclo de vida, inscripción, medios y límites de compatibilidad |
| [API de actividades](docs/activity-v2/ACTIVITY_V2_API.md) | Contratos de API de miembros y administradores |
| [COS de actividades](docs/activity-v2/ACTIVITY_V2_COS.md) | Almacenamiento de nube, SCF, permisos y registros de verificación real |
| [Informe de pruebas de actividades](docs/activity-v2/ACTIVITY_V2_TEST_REPORT.md) | Resultados y casos no cubiertos |
| [Funciones SCF](uniclub-backend/cloud-functions/quantification/README.md) | Despliegue de funciones e invocación protegida |
| [Mascota virtual](docs/classhub-pet.md) | Funciones reales, preferencias, fuentes y capacidades no migradas |
| [Fuentes tipográficas](FONT_NOTES.md) | Origen, uso, subconjuntos y licencias |
| [Paquetes GSAP](vendor/README.md) | Dependencias locales y convenciones de compilación |
| [Auditoría SEO / GEO](docs/SEO_GEO_AUDIT.md) | Alcance público, HTML, indexación, despliegue y tareas pendientes |
| [Archivo antiguo UniClub](docs/archive/legacy-uniclub/README.md) | Arquitectura y operaciones históricas; no es la guía actual de inicio |

La mayoría de las guías técnicas enlazadas están actualmente en chino. Algunos documentos conservan registros de despliegue, pruebas e incidencias del momento en que se escribieron. Contrasta los puertos, los estados de interfaz y las conclusiones de «completo/incompleto» con el código actual; no describen necesariamente el estado de producción de hoy.

<a id="faq"></a>

## Preguntas frecuentes

### ¿Por qué localhost:8081 rechaza la conexión?

Comprueba que `npm start` siga funcionando, que las dependencias estén instaladas y que el puerto 8081 esté libre. Si el backend no arranca, revisa en el terminal los errores de MongoDB y de configuración. `ERR_CONNECTION_REFUSED` significa que no hay un servicio accesible en el puerto de destino; recargar la página no lo resuelve.

### ¿Por qué fallan las solicitudes API si el frontend abre bien?

Comprueba <http://localhost:5050/api/health> y compara `VITE_API_PROXY_TARGET` con el puerto real del backend. El proxy de desarrollo y `VITE_API_URL` de producción tienen funciones distintas. Un host API separado también necesita CORS correcto. El endpoint de estado puede devolver 503 si la base de datos está desconectada.

### ¿Por qué no hay novedades del grupo en Inicio o no puedo acceder a administración?

El inicio para visitantes muestra información pública del producto y no consulta contenido del grupo. Después de iniciar sesión, la información depende de los registros publicados. Administración requiere permisos de administrador en la base de datos. Cambiar botones del frontend o falsificar un campo de rol no concede permisos.

### ¿Por qué las noticias devuelven `SEARCH_NO_RESULTS` o `INSUFFICIENT_SOURCES`?

Revisa en los registros los resultados de búsqueda, editores independientes, texto accesible y fechas. Una clave válida no garantiza suficientes fuentes fiables. La demora de NewsAPI gratuito, los fallos RSS o la conectividad del servidor pueden afectar al resultado. El proceso no completa los huecos ampliando el plazo de actualidad, desactivando la validación ni inventando noticias.

### ¿Por qué la IA funciona en local pero falla después del despliegue?

Compara la clave maestra de IA, configuración de base de datos, conectividad de búsqueda, extracción de fuentes, tiempos de espera del proxy y duración de tareas del entorno de destino. Configuraciones iguales en la interfaz no implican claves, redes o directorios persistentes iguales en el servidor. Utiliza los códigos de error para identificar la etapa que falla.

### ¿Por qué las subidas indican almacenamiento no disponible o un error CORS?

Comprueba los ajustes de almacenamiento, el bucket privado, autenticación de funciones, permisos limitados a los prefijos necesarios, origen real del sitio y cabeceras. Los medios de actividades no deben reutilizar una función antigua de credenciales sin protección. Obtén una nueva firma si caduca; no hagas público el bucket para evitar el problema.

### ¿Por qué falta alguien en la selección aleatoria?

Comprueba que la persona figure tanto en la lista real actual como en las cuentas de miembros válidas. Las entradas sin cuenta válida no participan. El rol de administrador no excluye por sí solo, pero un administrador independiente que no figura en la lista no es un miembro elegible para esta selección.

### ¿Puedo crear varios grupos, activar modo oscuro o publicar una aplicación móvil directamente?

Estas funciones del producto aún no están terminadas. Varios grupos requieren un diseño explícito de aislamiento de datos; el tema actual es claro y fijo. El proyecto móvil necesita todavía marca, firma, configuración de plataforma y verificación correspondiente.

<a id="contributing"></a>

## Contribuciones e informes de problemas

Comunica problemas reproducibles mediante [Issues](https://github.com/Mason1035/uniclub-main/issues) o propón mejoras con Pull Request.

- Incluye página, pasos de reproducción, resultado esperado y real, dispositivo y entorno. Retira información sensible de capturas y registros antes de compartirlos.
- Utiliza rutas, capa de solicitudes, modelos de usuario, componentes y tokens existentes. Evita duplicar sistemas de autenticación, IA o almacenamiento.
- Si el cambio afecta a datos de miembros, permisos, costes, recursos de nube o migraciones, explica su alcance, recuperación ante fallos y límites de verificación.
- Conserva atribuciones y avisos de licencia de terceros; actualiza la documentación junto con los cambios relacionados.
- Ejecuta pruebas, lint, comprobaciones de tipos o compilaciones según el cambio. No presentes comprobaciones de API simuladas como verificación real de producción.
- Actualmente no hay un `CONTRIBUTING.md` independiente ni un `CHANGELOG.md` formal. Las convenciones están en esta sección y en los documentos de cada módulo.

<a id="credits"></a>

## Colaboradores, licencias y recursos

El repositorio es mantenido por [Mason1035](https://github.com/Mason1035) y otros colaboradores. Entre los miembros que participan en desarrollo y operaciones están **He Yuxuan (何宇轩), Zhang Pengfei (张鹏飞) y Li Qingyuan (李青原)**. Las contribuciones individuales pueden consultarse en el historial de commits.

Todavía no hay un `LICENSE` general en la raíz. Los metadatos ISC del paquete backend, las licencias de dependencias, OFL de las fuentes y MIT del motor de la mascota no otorgan una licencia única para todo el proyecto y todos sus recursos. Antes de copiar, redistribuir o utilizar comercialmente, confirma el alcance aplicable con los responsables de mantenimiento.

| Origen | Observaciones |
| --- | --- |
| Fuentes principales | Source Han Serif, Source Han Sans, Smiley Sans y Schibsted Grotesk; los orígenes y textos OFL están en [FONT_NOTES.md](FONT_NOTES.md) |
| Fuente inglesa de About | Space Grotesk; se conserva su [licencia OFL](public/fonts/classhub/SpaceGrotesk-OFL.txt) |
| Motor de la mascota | Adaptado de dsh-niulai-pet de whitefirer; se conservan la [licencia MIT](public/pet-assets/LICENSE) y los [avisos de recursos](public/pet-assets/NOTICE.md) |
| Personajes, audio y avatares proporcionados por usuarios | La licencia del código o del motor no concede automáticamente derechos sobre recursos de terceros; comprueba los derechos de cada recurso por separado |
| GSAP y otras dependencias | Se conservan sus licencias propias; los paquetes locales GSAP se describen en [vendor/README.md](vendor/README.md) |

<a id="translations"></a>

## Traducciones del README

El README en chino simplificado es la fuente de las traducciones. Las versiones terminadas tienen enlaces; las previstas no se enlazan hasta que existan sus archivos.

| Idioma | Estado |
| --- | --- |
| 简体中文 (chino simplificado) | Disponible: [README.md](README.md) |
| English (inglés) | Disponible: [README.en.md](README.en.md) |
| Русский (ruso) | Disponible: [README.ru.md](README.ru.md) |
| हिन्दी (hindi) | Disponible: [README.hi.md](README.hi.md) |
| 日本語 (japonés) | Disponible: [README.ja.md](README.ja.md) |
| 繁體中文 (chino tradicional) | Disponible: [README.zh-TW.md](README.zh-TW.md) |
| Español | Disponible: [README.es.md](README.es.md) |

Las traducciones mantienen las mismas funciones, comandos, limitaciones y enlaces, sin añadir capacidades ausentes del original chino. Se pueden incorporar más idiomas según sea necesario.

---

<p align="center">
  <a href="https://csrg3b.top/">ClassHub</a> · Sichuan Normal University · Ingeniería de Software, grupo 3, cohorte de ingreso de 2025
</p>
