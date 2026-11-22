/**
 * Error base de la aplicación.
 *
 * Todas las capas lanzan errores que extienden esta clase, de modo que la capa
 * de interfaces (HTTP) pueda traducirlos a una respuesta sin conocer detalles
 * de dominio, de infraestructura ni de Express.
 */
class AppError extends Error {
    /**
     * @param {string} message Mensaje legible para el cliente.
     * @param {Object} [options]
     * @param {string} [options.code] Código estable para clientes/programas.
     * @param {number} [options.statusCode] Sugerencia de status HTTP.
     * @param {Object} [options.details] Información adicional del error.
     * @param {Error} [options.cause] Error original (para logs).
     */
    constructor(message, { code = 'APP_ERROR', statusCode = 500, details = {}, cause } = {}) {
        super(message);
        this.name = new.target.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        if (cause) this.cause = cause;
        Error.captureStackTrace?.(this, new.target);
    }
}

module.exports = AppError;
