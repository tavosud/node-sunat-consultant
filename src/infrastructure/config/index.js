/**
 * Configuración central del servicio.
 *
 * Único lugar donde se leen variables de entorno y se declaran valores por
 * defecto. El resto de la aplicación recibe la configuración ya resuelta.
 */

/**
 * Convierte una variable de entorno numérica.
 *
 * Ojo: `Number('') === 0`, así que una variable definida pero vacía (por
 * ejemplo `PORT=`) haría que el servidor escuche en un puerto aleatorio.
 * Aquí se ignora cualquier valor vacío o no numérico.
 *
 * @param {string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
const toNumber = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    const raw = String(value).trim();
    if (raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Convierte una variable de entorno booleana (`false`, `0`, `no`, `off` → false).
 *
 * @param {string|undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
const toBoolean = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    const raw = String(value).trim().toLowerCase();
    if (raw === '') return fallback;
    return !['false', '0', 'no', 'off'].includes(raw);
};

const config = {
    server: {
        port: toNumber(process.env.PORT, 3000),
        env: process.env.NODE_ENV || 'development'
    },

    cache: {
        /** SUNAT no cambia sus datos a cada minuto: 24h de TTL. */
        ttlSeconds: toNumber(process.env.CACHE_TTL_SECONDS, 86400)
    },

    rateLimit: {
        windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
        max: toNumber(process.env.RATE_LIMIT_MAX, 15)
    },

    scraper: {
        url: 'https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp',
        userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        /**
         * true = headless (por defecto). Con `PUPPETEER_HEADLESS=false` se abre
         * el navegador a la vista, muy útil para depurar en Windows.
         */
        headless: toBoolean(process.env.PUPPETEER_HEADLESS, true),

        /**
         * Windows: si Puppeteer no descargó su propio Chrome, se puede apuntar
         * al Chrome instalado en el sistema. Ejemplo:
         * PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
         */
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

        /**
         * Alternativa a la ruta: `PUPPETEER_CHANNEL=chrome` resuelve el Chrome
         * instalado por Puppeteer/el sistema sin hardcodear rutas.
         */
        channel: process.env.PUPPETEER_CHANNEL || undefined,

        /**
         * Scrapes simultáneos contra el portal. SUNAT bloquea IPs cuando detecta
         * varias sesiones en paralelo, así que por defecto se serializa (1).
         */
        maxConcurrency: toNumber(process.env.SCRAPER_MAX_CONCURRENCY, 1),

        launchArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        timeouts: {
            navigation: 15000,
            networkIdle: 15000,
            selector: 20000,
            result: 25000
        }
    }
};

module.exports = config;
