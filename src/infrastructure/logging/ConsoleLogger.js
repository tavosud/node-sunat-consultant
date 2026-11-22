const LoggerPort = require('../../application/ports/LoggerPort');

/**
 * Adaptador de logging basado en consola (implementa `LoggerPort`).
 */
class ConsoleLogger extends LoggerPort {
    constructor(scope = 'app') {
        super();
        this.scope = scope;
    }

    #format(level, message) {
        return `[${new Date().toLocaleString()}] [${level}] [${this.scope}] ${message}`;
    }

    info(message) {
        console.log(this.#format('INFO', message));
    }

    warn(message) {
        console.warn(this.#format('WARN', message));
    }

    error(message) {
        console.error(this.#format('ERROR', message));
    }

    debug(message) {
        if (process.env.NODE_ENV === 'production') return;
        console.debug(this.#format('DEBUG', message));
    }
}

module.exports = ConsoleLogger;
