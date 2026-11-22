const AppError = require('../../shared/errors/AppError');

/**
 * Error de entrada inválida del cliente (documento/catálogo mal formados).
 * La capa HTTP lo traduce a `400 Bad Request`.
 */
class ValidationError extends AppError {
    /**
     * @param {string} message
     * @param {Object} [options]
     */
    constructor(message, { code = 'VALIDATION_ERROR', details = {} } = {}) {
        super(message, { code, statusCode: 400, details });
    }
}

module.exports = ValidationError;
