# SUNAT RUC Microservice

Este microservicio es una API REST construida con **Node.js**, **Express** y **Puppeteer** que permite consultar datos de RUCs directamente desde el portal de la SUNAT (Perú). Puede ejecutarse mediante **Docker** y cuenta con un sistema de **Caché** interno para optimizar las consultas repetidas.

## Características

* **Endpoint único por Catálogo 06:** `/consultar` resuelve DNI (`catalog_sunat: "1"`) o RUC (`catalog_sunat: "6"`) con el mismo contrato.
* **Extracción Extendida:** Además de los datos básicos, captura campos como Tipo de Contribuyente, Tipo de Documento, Fechas, Sistemas de Emisión, Actividades Económicas, etc.
* **Bypass de Seguridad:** Utiliza `puppeteer-extra-plugin-stealth` para evitar bloqueos por detección de bots.
* **Microservicio Dockerizado:** Configuración lista para desplegar en cualquier entorno con Docker y Docker Compose.
* **Caché Inteligente:** Almacenamiento en memoria RAM (TTL 24h) para respuestas instantáneas en RUCs ya consultados.
* **Mapeo Robusto:** Lógica basada en etiquetas de texto para prevenir errores si la SUNAT cambia el orden de las filas.
* **Respuesta Limpia:** Los campos vacíos, `N/A`, `NO REGISTRADO` o `-` no se devuelven en el JSON (así el frontend no los muestra).
* **Control de abuso:** Rate limit de 15 solicitudes por minuto por IP.

## Tecnologías

* **Entorno de Ejecución:** [Node.js](https://nodejs.org/) v20+
* **Servidor Web:** [Express.js](https://expressjs.com/)
* **Navegación & Scraping:** [Puppeteer Extra](https://github.com/berstend/puppeteer-extra) con [Stealth Plugin](https://www.npmjs.com/package/puppeteer-extra-plugin-stealth)
* **Gestión de Memoria:** [Node-cache](https://www.npmjs.com/package/node-cache) (TTL de 24 horas)
* **Seguridad & Control:** [Express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
* **Infraestructura:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

## Arquitectura

El proyecto sigue **Clean Architecture**: las dependencias apuntan siempre hacia el
dominio, que no sabe nada de Express, Puppeteer ni node-cache.

```text
src/
├── domain/                          # Reglas de negocio puras (sin librerías externas)
│   ├── constants/sunatCatalog.js    # Catálogo 06: '1' = DNI, '6' = RUC
│   ├── entities/Taxpayer.js         # Contribuyente con datos ya saneados
│   ├── errors/                      # ValidationError (400) / ScrapingError (success:false)
│   ├── ports/TaxpayerRepository.js  # Interfaz para obtener contribuyentes
│   └── value-objects/
│       └── DocumentNumber.js        # Normaliza y valida (documento + catálogo)
│
├── application/                     # Casos de uso y puertos de salida
│   ├── dtos/TaxpayerQueryResult.js
│   ├── ports/CachePort.js           # Interfaz de caché
│   ├── ports/LoggerPort.js          # Interfaz de logging
│   └── use-cases/
│       └── ConsultTaxpayerUseCase.js  # validar → caché → repositorio → DTO
│
├── infrastructure/                  # Adaptadores (aquí sí hay librerías externas)
│   ├── cache/NodeCacheAdapter.js    # Implementa CachePort con node-cache
│   ├── config/index.js              # Único lugar que lee process.env
│   ├── di/container.js              # Composition root (inyección manual)
│   ├── logging/ConsoleLogger.js     # Implementa LoggerPort
│   └── scraping/
│       ├── browserFactory.js        # Lanza Puppeteer (sustituible en tests)
│       └── sunat/
│           ├── SunatTaxpayerRepository.js  # Implementa TaxpayerRepository
│           ├── collectTaxpayerData.js      # Se ejecuta DENTRO del navegador
│           ├── pageHelpers.js              # Esperas, frames, clicks
│           └── selectors.js                # Selectores con fallback
│
├── interfaces/http/                 # Entrada HTTP (Express)
│   ├── app.js                       # Composition root de Express
│   ├── controllers/TaxpayerController.js
│   ├── middlewares/                 # requestLogger, rateLimiter, errorHandler, 404
│   ├── presenters/TaxpayerPresenter.js  # Único lugar que define el JSON público
│   └── routes/
│
├── shared/                          # Código transversal (AppError, pruneEmpty)
└── server.js                        # Bootstrap: contenedor + listen + shutdown
```

### Flujo de una consulta

```text
POST /consultar
   │
   ▼
TaxpayerController ──► ConsultTaxpayerUseCase
                            ├─► DocumentNumber.create()       (dominio: normaliza/valida)
                            ├─► CachePort.get()               (adaptador: node-cache)
                            ├─► TaxpayerRepository.find...()  (adaptador: Puppeteer)
                            └─► CachePort.set() + DTO
   │
   ▼
TaxpayerPresenter ──► JSON: { success, fromCache, document, catalog_sunat, data }
```

### Cómo extender

| Necesidad | Dónde tocar |
| --------- | ----------- |
| Cambiar la caché en memoria por Redis | Crear un adaptador que implemente `CachePort` y registrarlo en `src/infrastructure/di/container.js` |
| Usar pino/winston en lugar de `console` | Crear un adaptador que implemente `LoggerPort` e inyectarlo en el contenedor |
| Consultar otra fuente en vez de scraping | Implementar `TaxpayerRepository` y cambiar el cableado del contenedor |
| Cambiar el formato de respuesta HTTP | `src/interfaces/http/presenters/TaxpayerPresenter.js` |
| Soportar otro documento del catálogo 06 | `src/domain/constants/sunatCatalog.js` |

## Instalación y Uso con Docker

Asegúrate de tener instalado [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/).

1.  **Clonar el repositorio o copiar los archivos.**
2.  **Construir y levantar el servicio:**
    ```bash
    docker-compose up --build -d
    ```
3.  **Verificar que el servicio esté corriendo:**
    El API estará disponible en `http://localhost:3000`.

    ```bash
    curl http://localhost:3000/health
    ```

    Si no responde, revisa los logs del contenedor:

    ```bash
    docker-compose logs -f
    ```

## API Endpoints

### Consultar documento (Catálogo 06 - SUNAT)

Un único endpoint que resuelve la búsqueda según el **Catálogo N° 06 de SUNAT** ("Tipo de Documento de Identidad").

**URL:** `/consultar`
**Método:** `POST`
**Cuerpo (JSON):**

```json
{
  "document": "40846883",
  "catalog_sunat": "1"
}
```

| `catalog_sunat` | Tipo de documento | Formato de `document` |
| --------------- | ----------------- | --------------------- |
| `1`             | DNI               | 8 dígitos             |
| `6`             | RUC               | 11 dígitos            |

**Consultar RUC (código 6):**

```json
{
  "document": "10408468839",
  "catalog_sunat": "6"
}
```

**Respuesta Exitosa:** `(200 OK)`

```json
{
  "success": true,
  "fromCache": false,
  "document": "10408468839",
  "catalog_sunat": "6",
  "data": {
    "ruc": "10408468839",
    "razonSocial": "ESTEBAN VILLANUEVA CARMEN YESENIA",
    "estado": "ACTIVO",
    "condicion": "HABIDO"
  }
}
```

**Errores de validación:** `(400 Bad Request)`

```json
{
  "success": false,
  "message": "Documento inválido para DNI (catálogo 06 código '1'): debe tener 8 dígitos. Ejemplo: 40846883"
}
```

Los códigos del catálogo 06 distintos de `1` y `6` (carné de extranjería, pasaporte, etc.) no son consultables en `e-consultaruc` y devuelven `400` con un mensaje explicativo.

**Nota:** `catalog_sunat` puede enviarse como texto (`"6"`) o número (`6`). Se toleran espacios y guiones en `document` (p. ej. `"10-40846883-9"`).

### Rutas heredadas (compatibilidad)

Siguen disponibles y comparten el mismo scraper y caché, pero se recomienda migrar a `/consultar`.

| URL | Cuerpo aceptado |
| --- | --------------- |
| `/consultar-ruc` | `{ "ruc": "20212331377" }` o `{ "id": "20212331377" }` |
| `/consultar-dni` | `{ "dni": "44548533" }` o `{ "id": "44548533" }` |

Ejemplo de respuesta de `/consultar-ruc`:

```json
{
    "success": true,
    "fromCache": false,
    "document": "20212331377",
    "catalog_sunat": "6",
    "data": {
        "ruc": "20212331377",
        "razonSocial": "GRUPO DELTRON S.A.",
        "tipoContribuyente": "SOCIEDAD ANONIMA",
        "tipoDocumento": "RUC 20212331377 - GRUPO DELTRON S.A.",
        "nombreComercial": "DELTRON",
                
        "fechaInscripcion": "05/08/2002",
        "fechaInscripcionUtc": "2002-08-05T00:00:00.000Z",
        "fechaInicioActividades": "05/08/2002",
        "fechaInicioActividadesUtc": "2002-08-05T00:00:00.000Z",
        "estado": "ACTIVO",
        "condicion": "HABIDO",
        "domicilioFiscal": "CAL.RAUL REBAGLIATI NRO. 170 URB. SANTA CATALINA LIMA - LIMA - LA VICTORIA",
        "sistemaEmisionComprobante": "MANUAL",
        "actividadComercioExterior": "SIN ACTIVIDAD",
        "sistemaContabilidad": "MANUAL",
        "actividadesEconomicas": [
            "Principal - 6202 - CONSULTORÍA DE INFORMÁTICA Y GESTIÓN DE INSTALACIONES INFORMÁTICAS"
        ]
    }
}
```

### Ejemplo rápido con curl

```bash
curl -X POST http://localhost:3000/consultar \
  -H "Content-Type: application/json" \
  -d "{\"document\":\"40846883\",\"catalog_sunat\":\"1\"}"
```

## Fechas

SUNAT entrega las fechas como texto `dd/mm/yyyy`. El servicio **no altera** ese
valor y agrega un campo paralelo con el mismo dato en **ISO 8601 UTC**
(`...T00:00:00.000Z`).

| Campo SUNAT (`dd/mm/yyyy`) | Campo UTC (ISO 8601) |
| -------------------------- | -------------------- |
| `fechaInscripcion` | `fechaInscripcionUtc` |
| `fechaInicioActividades` | `fechaInicioActividadesUtc` |
| `emisorElectronicoDesde` | `emisorElectronicoDesdeUtc` |

```json
{
  "fechaInscripcion": "05/08/2002",
  "fechaInscripcionUtc": "2002-08-05T00:00:00.000Z"
}
```

Notas:

- La fecha se interpreta como día calendario a las `00:00:00 UTC`; no se aplica
  la zona horaria de Lima (UTC-5) para no desplazar el día.
- Si el valor no es una fecha válida (vacío, `-`, `SIN INFORMACION`, `31/02/2002`),
  el campo `...Utc` simplemente no se incluye.
- Ambos campos conviven: no se rompe el contrato existente.

## Campos disponibles
Dependiendo del contribuyente, la SUNAT puede devolver (y el servicio intentará capturar) los siguientes campos. Si un campo no existe o viene vacío, no se incluirá en `data`.

- `ruc`, `razonSocial`, `tipoContribuyente`, `tipoDocumento`, `nombreComercial`
- `fechaInscripcion`, `fechaInicioActividades` (formato SUNAT, `dd/mm/yyyy`)
- `fechaInscripcionUtc`, `fechaInicioActividadesUtc` (los mismos datos en ISO 8601 UTC)
- `estado`, `condicion`, `domicilioFiscal`
- `sistemaEmisionComprobante`, `actividadComercioExterior`, `sistemaContabilidad`
- `actividadesEconomicas` (array)
- `comprobantesImpresion` (array)
- `sistemaEmisionElectronica` (array)
- `emisorElectronicoDesde` (formato SUNAT) y `emisorElectronicoDesdeUtc` (ISO 8601 UTC)
- `comprobantesElectronicos`

## Desarrollo local sin Docker
Si prefieres correrlo directamente en tu máquina:

1. **Instalar dependencias:** 
```bash
npm install
```

2. **Correr la aplicación:** 
```bash
npm start        # producción
npm run dev      # con --watch (recarga automática)
```

**Notas:**
- El puerto se toma de la variable de entorno `PORT` (por defecto `3003` en local; en Docker Compose se define `PORT=3000`).
- Debes tener instalado Chrome o Chromium en tu sistema (Puppeteer lo gestionará según tu entorno).
- Si SUNAT muestra captcha o bloquea el acceso, el scraping puede fallar aunque el servicio esté funcionando correctamente.

## Windows: Chrome / Puppeteer

En Windows el error más común es:

```text
Error: Could not find Chrome (ver. 131.x). This can occur if either
1. you did not perform an installation before running the script or
2. your cache path is incorrectly configured
```

Significa que Puppeteer no tiene su navegador descargado (ocurre si `node_modules`
se copió de otra máquina o si se instaló con `--ignore-scripts`).
Opciones, en orden de preferencia:

**1. Descargar el Chrome de Puppeteer (recomendado):**

```powershell
npx puppeteer browsers install chrome
```

**2. Usar el Chrome ya instalado en el sistema:**

```powershell
$env:PUPPETEER_CHANNEL="chrome"
npm run dev
```

**3. Apuntar a un `chrome.exe` concreto:**

```powershell
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run dev
```

**4. Depurar viendo el navegador:**

```powershell
$env:PUPPETEER_HEADLESS="false"
npm run dev
```

Comprobar qué ejecutable resuelve Puppeteer:

```powershell
node -e "console.log(require('puppeteer').executablePath())"
```

En Linux/Docker esto no aplica: la imagen instala las librerías del sistema y
Puppeteer descarga su propio Chromium durante `npm install`.

## Variables de entorno

Todas se leen en `src/infrastructure/config/index.js`, el único punto de la
aplicación que accede a `process.env`.

| Variable | Por defecto | Descripción |
| -------- | ----------- | ----------- |
| `PORT` | `3003` (local) / `3000` (Docker) | Puerto HTTP del servicio. |
| `NODE_ENV` | `development` | Entorno; en `production` se silencia el log de debug. |
| `CACHE_TTL_SECONDS` | `86400` | TTL de la caché en segundos (24 h). |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Ventana del rate limit en milisegundos. |
| `RATE_LIMIT_MAX` | `15` | Máximo de peticiones por IP y ventana. |
| `SCRAPER_MAX_CONCURRENCY` | `1` | Scrapes simultáneos hacia SUNAT (subirlo aumenta el riesgo de bloqueo). |
| `PUPPETEER_HEADLESS` | `true` | `false` abre el navegador a la vista (depuración). |
| `PUPPETEER_EXECUTABLE_PATH` | — | Ruta a `chrome.exe` / binario de Chromium. Prioridad sobre `PUPPETEER_CHANNEL`. |
| `PUPPETEER_CHANNEL` | — | `chrome` usa el Chrome instalado en el sistema. |

```bash
PORT=4000 CACHE_TTL_SECONDS=3600 npm start
```

## Health check

```bash
curl http://localhost:3003/health
```

```json
{ "status": "ok", "uptime": 12.34, "env": "development" }
```

## Capacidad y protección de SUNAT

### No intentes "medir" el límite de SUNAT

Sondear el umbral real del portal con ráfagas es la forma más rápida de que
bloqueen la IP del servidor (y normalmente va contra sus términos de uso).
Lo correcto es medir **tu** servicio y mantener acotado el tráfico hacia SUNAT.

### La fórmula que necesitas

```text
throughput (req/s) ≈ concurrencia / latencia media
```

- Una consulta completa al portal tarda ~8-15 s (varias navegaciones + click).
- Con 1 scrape simultáneo → ~4-7 consultas **reales** por minuto a SUNAT.
- Con `SCRAPER_MAX_CONCURRENCY=1` el resto se sirve de caché: `fromCache: true`
  **no** toca el portal.

### Medir el servicio: `GET /metrics`

```bash
curl http://localhost:3003/metrics
```

```json
{
  "uptimeSeconds": 430,
  "counters": {
    "requests": 120, "clientErrors": 2, "serverErrors": 0, "rateLimited": 3,
    "cacheHits": 98, "cacheMisses": 17, "scrapes": 17, "scrapeErrors": 1
  },
  "rates": { "requestsPerMinute": 42, "requestsPerSecond": 0.7, "scrapesPerMinute": 6 },
  "latencyMs": {
    "requests": { "p50": 12, "p95": 9200, "p99": 14100 },
    "scrapes": { "p50": 9100, "p95": 13800 }
  },
  "statusCodes": { "200": 115, "400": 2, "429": 3 }
}
```

Qué mirar:

| Métrica | Para qué sirve |
| ------- | -------------- |
| `rates.requestsPerMinute` | capacidad que está sirviendo la instancia |
| `rates.scrapesPerMinute` | consultas que **sí** llegan a SUNAT (el número que importa para no ser bloqueado) |
| `counters.cacheHits` / `cacheMisses` | cuánto te está salvando la caché |
| `counters.rateLimited` | veces que saltó tu propio límite (429) |
| `latencyMs.scrapes` | si sube, SUNAT está frenando o hay bloqueo |
| `counters.scrapeErrors` | fallos y timeouts del portal |

### Prueba de carga local

```bash
# Capacidad HTTP pura (no toca SUNAT)
npm run loadtest -- --path /health --concurrency 50 --duration 10

# Camino real, de uno en uno (cada petición no cacheada abre un navegador)
npm run loadtest -- --path /consultar --document 20212331377 --concurrency 1 --duration 60
```

La salida incluye throughput, p50/p90/p95/p99 y el reparto de status codes. Si
aparecen `429` es que alcanzaste **tu** techo configurado, no el de SUNAT.

### Configuración recomendada (1 instancia)

| Variable | Valor | Motivo |
| -------- | ----- | ------ |
| `RATE_LIMIT_MAX` | `15` | techo duro por IP y minuto |
| `SCRAPER_MAX_CONCURRENCY` | `1` | evita sesiones paralelas detectables |
| `CACHE_TTL_SECONDS` | `86400` | reduce los scrapes reales |

Si necesitas más volumen, sube la caché y pon una cola o un servicio dedicado
que scrapee de uno en uno. Varias instancias multiplican los navegadores sobre
la misma IP pública: el cuello de botella (y el riesgo de bloqueo) no cambia.

## Pruebas

```bash
npm test
```

## Solución de problemas

| Síntoma | Causa probable | Solución |
| ------- | -------------- | -------- |
| `El puerto 3003 ya esta en uso` | Quedó un proceso o contenedor anterior activo | Detenerlo (`docker-compose down`) o arrancar con `PORT=4000` |
| El servicio arranca pero `curl` falla | Se está llamando a otro puerto | Revisar el log de arranque: imprime el puerto y la URL de `/health` |
| `"message": "SUNAT dice: ..."` | SUNAT rechazó la consulta (documento inexistente, bloqueo o captcha) | Reintentar más tarde; el mensaje proviene de SUNAT |
| `SUNAT no devolvió datos ...` | Captcha o cambio de maquetación del portal | Revisar `src/infrastructure/scraping/sunat/selectors.js` |
| `Error en Scraper: ...` | Fallo de red, timeout o Chromium no disponible | Ver logs; el detalle viaja en `message` |
