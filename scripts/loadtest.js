#!/usr/bin/env node
/**
 * Prueba de carga sin dependencias (solo Node 18+).
 *
 * Uso:
 *   node scripts/loadtest.js --path /health --concurrency 50 --duration 10
 *   node scripts/loadtest.js --path /consultar --document 20212331377 --catalog 6 --concurrency 1 --duration 60
 *
 * AVISO: cada petición a /consultar que no venga de caché lanza un navegador
 * contra SUNAT. Para medir la capacidad de *tu* servicio usa /health o un
 * documento ya cacheado. Para medir el portal, ve de uno en uno
 * (--concurrency 1) o te arriesgas a que SUNAT bloquee la IP.
 *
 * Opciones:
 *   --url         Base del servicio            (http://localhost:3003)
 *   --path        Ruta a probar                (/health)
 *   --concurrency Peticiones en paralelo       (10)
 *   --duration    Segundos de prueba           (10)
 *   --document    Documento para /consultar    (20212331377)
 *   --catalog     Catálogo 06 para /consultar  (6)
 */
const { URL } = require('node:url');
const { performance } = require('node:perf_hooks');

const DEFAULTS = {
    url: 'http://localhost:3003',
    path: '/health',
    concurrency: 10,
    duration: 10,
    document: '20212331377',
    catalog: '6'
};

const NUMERIC_KEYS = new Set(['concurrency', 'duration']);

/** @returns {Record<string, string|number>} */
function parseArgs(argv) {
    const args = { ...DEFAULTS };

    for (let i = 2; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) continue;

        const key = token.slice(2);
        const value = argv[i + 1];
        if (value === undefined) break;

        args[key] = NUMERIC_KEYS.has(key) ? Number(value) : value;
        i += 1;
    }

    return args;
}

/**
 * @param {number[]} values
 * @param {number} percentile
 * @returns {number|null}
 */
function percentile(values, percentileValue) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length));
    return Math.round(sorted[index]);
}

async function main() {
    const args = parseArgs(process.argv);
    const target = new URL(args.path, args.url).toString();
    const isPost = args.path.startsWith('/consultar');
    const body = isPost
        ? JSON.stringify({ document: String(args.document), catalog_sunat: String(args.catalog) })
        : undefined;

    console.log(`Objetivo   : ${isPost ? 'POST' : 'GET'} ${target}`);
    console.log(`Concurrencia: ${args.concurrency} | Duracion: ${args.duration}s`);

    if (isPost) {
        console.log(
            'Aviso: si el documento no esta en cache, cada peticion abre un navegador\n' +
            '       contra SUNAT. Usa concurrencia 1 para no activar sus bloqueos.\n'
        );
    }

    /** @type {{ status: number, ms: number }[]} */
    const results = [];
    const deadline = Date.now() + args.duration * 1000;
    const startedAt = performance.now();

    async function worker() {
        while (Date.now() < deadline) {
            const started = performance.now();
            let status = 0;

            try {
                const response = await fetch(target, {
                    method: isPost ? 'POST' : 'GET',
                    headers: isPost ? { 'content-type': 'application/json' } : undefined,
                    body
                });
                status = response.status;
                await response.text();
            } catch {
                status = 0;
            }

            results.push({ status, ms: performance.now() - started });
        }
    }

    await Promise.all(Array.from({ length: args.concurrency }, () => worker()));

    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    const durations = results.map((result) => result.ms);
    const byStatus = results.reduce((acc, result) => {
        acc[result.status] = (acc[result.status] || 0) + 1;
        return acc;
    }, {});

    const ok = results.filter((result) => result.status >= 200 && result.status < 300).length;
    const rateLimited = results.filter((result) => result.status === 429).length;
    const failed = results.filter((result) => result.status === 0 || result.status >= 500).length;

    console.log('--- Resultado ---');
    console.log(`Peticiones   : ${results.length} en ${elapsedSeconds.toFixed(1)}s`);
    console.log(`Throughput   : ${(results.length / elapsedSeconds).toFixed(2)} req/s`);
    console.log(`OK / 429 / err: ${ok} / ${rateLimited} / ${failed}`);
    console.log(`Latencia (ms): p50=${percentile(durations, 50)} p90=${percentile(durations, 90)} ` +
        `p95=${percentile(durations, 95)} p99=${percentile(durations, 99)} max=${Math.round(Math.max(...durations, 0))}`);
    console.log(`Status codes : ${JSON.stringify(byStatus)}`);

    console.log('\nComo leerlo:');
    console.log('- 429 en la mezcla = alcanzaste RATE_LIMIT_MAX (tu techo configurado).');
    console.log('- Latencia p95 alta con pocas req/s = el cuello de botella es el scrape, no Node.');
    console.log('- Consulta GET /metrics antes y despues para ver scrapesPerMinute y cacheHits.');
}

main().catch((error) => {
    console.error(`Error en la prueba: ${error.message}`);
    process.exit(1);
});
