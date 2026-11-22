const AppError = require('../../shared/errors/AppError');

/**
 * Error al obtener datos desde SUNAT (bloqueo, captcha, cambio de página, etc.).
 *
 * `statusCode` es 502 (falla de un sistema externo), pero la capa HTTP lo
 * publica con 200 + `success: false` para no romper a los clientes que ya
 * consumen el servicio.
 */
class ScrapingError extends AppError {
    /**
     * @param {string} message
     * @param {Object} [options]
     * @param {Object} [options.details] Debe incluir `document` y `catalogSunat` si se conocen.
     */
    constructor(message, { code = 'SCRAPING_ERROR', details = {}, cause } = {}) {
        super(message, { code, statusCode: 502, details, cause });
    }
}

module.exports = ScrapingError;
