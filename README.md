# SUNAT RUC Microservice

Este microservicio es una API REST construida con **Node.js**, **Express** y **Puppeteer** que permite consultar datos de RUCs directamente desde el portal de la SUNAT (Perú). Puede ejecutarse mediante **Docker** y cuenta con un sistema de **Caché** interno para optimizar las consultas repetidas.

## Características

* **Extracción Completa:** Captura RUC, Razón Social, Nombre Comercial, Estado, Condición, Domicilio Fiscal.
* **Bypass de Seguridad:** Utiliza `puppeteer-extra-plugin-stealth` para evitar bloqueos por detección de bots.
* **Microservicio Dockerizado:** Configuración lista para desplegar en cualquier entorno con Docker y Docker Compose.
* **Caché Inteligente:** Almacenamiento en memoria RAM (TTL 24h) para respuestas instantáneas en RUCs ya consultados.
* **Mapeo Robusto:** Lógica basada en etiquetas de texto para prevenir errores si la SUNAT cambia el orden de las filas.

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
**Respuesta Exitosa:** `(200 OK)`

```json
{
    "success": true,
    "data": {
        "ruc": "20212331377",
        "razonSocial": "GRUPO DELTRON S.A.",
        "nombreComercial": "DELTRON",
        "estado": "ACTIVO",
        "condicion": "HABIDO",
        "domicilioFiscal": "CAL.RAUL REBAGLIATI NRO. 170 URB. SANTA CATALINA LIMA - LIMA - LA VICTORIA"
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
**Respuesta Exitosa:** `(200 OK)`

```json
{
    "success": true,
    "data": {
        "ruc": "10445485336",
        "razonSocial": "ESTEBAN VILLANUEVA CARMEN YESENIA",
        "nombreComercial": "-",
        "estado": "ACTIVO",
        "condicion": "HABIDO",
        "domicilioFiscal": "-"
    }
}
```

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

**Nota:** Debes tener instalado Chrome o Chromium en tu sistema.