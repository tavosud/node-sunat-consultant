/**
 * Registro de métricas en memoria (sin dependencias externas).
 *
 * Responde a "¿cuántas peticiones soporta mi servicio?" con datos reales del
 * proceso: peticiones por minuto, latencias por percentil, respuestas 429 y
 * scrapes que realmente salieron al portal de SUNAT.
 *
 * No pretende reemplazar a Prometheus: es observabilidad suficiente para
 * dimensionar el servicio y detectar bloqueos.
 */

/** Máximo de eventos guardados (memoria acotada en procesos largos). */
const MAX_EVENTS = 5000;

class MetricsRegistry {
    constructor() {
        this.startedAt = Date.now();
        /** @type {{ ts: number, status: number, durationMs: number }[]} */
        this.requests = [];
        /** @type {{ ts: number, ok: boolean, durationMs: number }[]} */
        this.scrapes = [];
        this.counters = {
            requests: 0,
            clientErrors: 0,
            serverErrors: 0,
            rateLimited: 0,
            cacheHits: 0,
            cacheMisses: 0,
            scrapes: 0,
            scrapeErrors: 0
        };
    }

    /**
     * @private
     * @param {Array} list
     * @param {Object} event
     */
    #push(list, event) {
        list.push(event);
        if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    }

    /**
     * Registra una petición HTTP terminada.
     *
     * @param {{ status: number, durationMs: number }} event
     */
    recordRequest({ status, durationMs }) {
        this.counters.requests += 1;
        if (status === 429) this.counters.rateLimited += 1;
        else if (status >= 500) this.counters.serverErrors += 1;
        else if (status >= 400) this.counters.clientErrors += 1;

        this.#push(this.requests, { ts: Date.now(), status, durationMs });
    }

    /**
     * Registra si la consulta se resolvió con caché.
     *
     * @param {boolean} hit
     */
    recordCache(hit) {
        if (hit) this.counters.cacheHits += 1;
        else this.counters.cacheMisses += 1;
    }

    /**
     * Registra una consulta enviada al portal de SUNAT.
     *
     * @param {{ ok: boolean, durationMs: number }} event
     */
    recordScrape({ ok, durationMs }) {
        this.counters.scrapes += 1;
        if (!ok) this.counters.scrapeErrors += 1;

        this.#push(this.scrapes, { ts: Date.now(), ok, durationMs });
    }

    /**
     * @private
     * @param {Array} list
     * @param {number} windowMs
     * @returns {number} Eventos dentro de la ventana.
     */
    #countInWindow(list, windowMs) {
        const since = Date.now() - windowMs;
        return list.reduce((total, event) => (event.ts >= since ? total + 1 : total), 0);
    }

    /**
     * @private
     * @param {number[]} values
     * @param {number} percentile
     * @returns {number|null}
     */
    #percentile(values, percentile) {
        if (!values.length) return null;

        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.min(sorted.length - 1, Math.floor((percentile / 100) * sorted.length));
        return Math.round(sorted[index]);
    }

    /**
     * @private
     * @returns {Object<string, number>}
     */
    #statusBreakdown() {
        const breakdown = {};
        for (const event of this.requests) {
            breakdown[event.status] = (breakdown[event.status] || 0) + 1;
        }
        return breakdown;
    }

    /**
     * Foto del estado actual (lo que devuelve `GET /metrics`).
     *
     * @returns {Object}
     */
    snapshot() {
        const perMinute = this.#countInWindow(this.requests, 60_000);
        const scrapeDurations = this.scrapes.map((event) => event.durationMs);
        const requestDurations = this.requests.map((event) => event.durationMs);

        return {
            uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
            counters: { ...this.counters },
            rates: {
                requestsPerMinute: perMinute,
                requestsPerSecond: Number((perMinute / 60).toFixed(2)),
                scrapesPerMinute: this.#countInWindow(this.scrapes, 60_000)
            },
            latencyMs: {
                requests: {
                    p50: this.#percentile(requestDurations, 50),
                    p95: this.#percentile(requestDurations, 95),
                    p99: this.#percentile(requestDurations, 99)
                },
                scrapes: {
                    p50: this.#percentile(scrapeDurations, 50),
                    p95: this.#percentile(scrapeDurations, 95)
                }
            },
            statusCodes: this.#statusBreakdown()
        };
    }
}

module.exports = MetricsRegistry;
