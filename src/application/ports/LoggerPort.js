/**
 * Puerto de logging (interfaz).
 *
 * Permite sustituir `console` por pino/winston/Datadog sin tocar las demás capas.
 */
class LoggerPort {
    /** @param {string} message @abstract */
    info(message, meta) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.info() no está implementado`);
    }

    /** @param {string} message @abstract */
    warn(message, meta) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.warn() no está implementado`);
    }

    /** @param {string} message @abstract */
    error(message, meta) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.error() no está implementado`);
    }

    /** @param {string} message @abstract */
    debug(message, meta) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.debug() no está implementado`);
    }
}

module.exports = LoggerPort;
