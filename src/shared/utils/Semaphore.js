/**
 * Semáforo asíncrono.
 *
 * Limita cuántas operaciones corren a la vez. Se usa para que el servicio no
 * abra varios navegadores contra SUNAT en paralelo: el portal bloquea IPs
 * cuando detecta sesiones simultáneas.
 */
class Semaphore {
    /**
     * @param {number} [max] Operaciones concurrentes permitidas.
     */
    constructor(max = 1) {
        this.max = Math.max(1, Number(max) || 1);
        this.active = 0;
        this.queue = [];
    }

    /** @returns {number} Operaciones en espera. */
    get pending() {
        return this.queue.length;
    }

    /** @returns {Promise<void>} Se resuelve cuando hay un hueco libre. */
    async acquire() {
        if (this.active < this.max) {
            this.active += 1;
            return;
        }
        await new Promise((resolve) => this.queue.push(resolve));
        this.active += 1;
    }

    /** Libera un hueco y despierta al siguiente en cola. */
    release() {
        this.active = Math.max(0, this.active - 1);
        const next = this.queue.shift();
        if (next) next();
    }

    /**
     * Ejecuta una tarea respetando el límite.
     *
     * @template T
     * @param {() => Promise<T>} task
     * @returns {Promise<T>}
     */
    async run(task) {
        await this.acquire();
        try {
            return await task();
        } finally {
            this.release();
        }
    }
}

module.exports = Semaphore;
