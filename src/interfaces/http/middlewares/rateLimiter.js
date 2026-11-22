const rateLimit = require('express-rate-limit');

/**
 * Fábrica del middleware de rate limiting (protege un scraper costoso).
 *
 * @param {Object} options
 * @param {number} options.windowMs Ventana en milisegundos.
 * @param {number} options.max Máximo de peticiones por ventana e IP.
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter({ windowMs, max }) {
    return rateLimit({
        windowMs,
        max,
        message: { success: false, message: 'Demasiadas peticiones, intenta en un minuto.' },
        standardHeaders: true,
        legacyHeaders: false
    });
}

module.exports = createRateLimiter;
