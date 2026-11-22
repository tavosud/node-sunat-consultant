const NodeCache = require('node-cache');
const CachePort = require('../../application/ports/CachePort');

/**
 * Adaptador de caché en memoria (implementa `CachePort`) usando `node-cache`.
 */
class NodeCacheAdapter extends CachePort {
    /**
     * @param {Object} [options]
     * @param {number} [options.stdTTL] TTL por defecto en segundos.
     * @param {number} [options.checkperiod] Intervalo de limpieza en segundos.
     * @param {import('node-cache').Options} [options.extra] Opciones extra de node-cache.
     */
    constructor({ stdTTL, checkperiod, extra } = {}) {
        super();
        this.store = new NodeCache({ stdTTL, checkperiod, ...extra });
    }

    /** @param {string} key */
    async get(key) {
        return this.store.get(key);
    }

    /** @param {string} key @param {*} value @param {number} [ttlSeconds] */
    async set(key, value, ttlSeconds) {
        if (ttlSeconds) this.store.set(key, value, ttlSeconds);
        else this.store.set(key, value);
    }

    /** @param {string} key */
    async delete(key) {
        this.store.del(key);
    }

    /** @returns {number} Cantidad de entradas almacenadas. */
    size() {
        return this.store.keys().length;
    }
}

module.exports = NodeCacheAdapter;
