# SUNAT RUC Microservice

Este microservicio es una API REST construida con **Node.js**, **Express** y **Puppeteer** que permite consultar datos de RUCs directamente desde el portal de la SUNAT (Perú). Puede ejecutarse mediante **Docker** y cuenta con un sistema de **Caché** interno para optimizar las consultas repetidas.

## Características

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

## Instalación y Uso con Docker

Asegúrate de tener instalado [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/).

1.  **Clonar el repositorio o copiar los archivos.**
2.  **Construir y levantar el servicio:**
    ```bash
    docker-compose up --build -d
    ```
3.  **Verificar que el servicio esté corriendo:**
    El API estará disponible en `http://localhost:3000`.

## API Endpoints

### Consultar RUC
**URL:** `/consultar-ruc`  
**Método:** `POST`  
**Cuerpo (JSON):**

```json
{
  "ruc": "20212331377"
}
```
También acepta este formato (compatibilidad):
```json
{
  "id": "20212331377"
}
```
**Respuesta Exitosa:** `(200 OK)`

```json
{
    "success": true,
    "data": {
        "ruc": "20212331377",
        "razonSocial": "GRUPO DELTRON S.A.",
        "tipoContribuyente": "SOCIEDAD ANONIMA",
        "tipoDocumento": "RUC 20212331377 - GRUPO DELTRON S.A.",
        "nombreComercial": "DELTRON",
        "fechaInscripcion": "05/08/2002",
        "fechaInicioActividades": "05/08/2002",
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

### Consultar RUC mediante DNI
**URL:** `/consultar-dni`  
**Método:** `POST`  
**Cuerpo (JSON):**

```json
{
  "dni": "44548533"
}
```
También acepta este formato (compatibilidad):
```json
{
  "id": "44548533"
}
```
**Respuesta Exitosa:** `(200 OK)`

```json
{
    "success": true,
    "data": {
        "ruc": "10445485336",
        "razonSocial": "ESTEBAN VILLANUEVA CARMEN YESENIA",
        "estado": "ACTIVO",
        "condicion": "HABIDO"
    }
}
```

## Campos disponibles
Dependiendo del contribuyente, la SUNAT puede devolver (y el servicio intentará capturar) los siguientes campos. Si un campo no existe o viene vacío, no se incluirá en `data`.

- `ruc`, `razonSocial`, `tipoContribuyente`, `tipoDocumento`, `nombreComercial`
- `fechaInscripcion`, `fechaInicioActividades`
- `estado`, `condicion`, `domicilioFiscal`
- `sistemaEmisionComprobante`, `actividadComercioExterior`, `sistemaContabilidad`
- `actividadesEconomicas` (array)
- `comprobantesImpresion` (array)
- `sistemaEmisionElectronica` (array)
- `emisorElectronicoDesde`, `comprobantesElectronicos`

## Desarrollo local sin Docker
Si prefieres correrlo directamente en tu máquina:

1. **Instalar dependencias:** 
```bash
npm install
```

2. **Correr la aplicación:** 
```bash
node server.js
```

**Notas:**
- Debes tener instalado Chrome o Chromium en tu sistema (Puppeteer lo gestionará según tu entorno).
- Si SUNAT muestra captcha o bloquea el acceso, el scraping puede fallar aunque el servicio esté funcionando correctamente.
