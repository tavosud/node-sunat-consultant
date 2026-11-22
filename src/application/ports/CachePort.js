/**
 * Puerto de caché (interfaz).
 *
 * La aplicación no sabe si detrás hay memoria (node-cache), Redis, etc.
 */
class CachePort {
    /**
     * @param {string} key
     * @returns {Promise<*>} Valor almacenado o `undefined`.
     * @abstract
     */
    async get(key) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.get() no está implementado`);
    }

    /**
     * @param {string} key
     * @param {*} value
     * @param {number} [ttlSeconds]
     * @returns {Promise<void>}
     * @abstract
     */
    async set(key, value, ttlSeconds) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.set() no está implementado`);
    }

    /**
     * @param {string} key
     * @returns {Promise<void>}
     * @abstract
     */
    async delete(key) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.delete() no está implementado`);
    }
}

module.exports = CachePort;
