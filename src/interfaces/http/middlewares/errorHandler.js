const AppError = require('../../../shared/errors/AppError');
const ScrapingError = require('../../../domain/errors/ScrapingError');
const TaxpayerPresenter = require('../presenters/TaxpayerPresenter');

/**
 * Determina el status HTTP según el tipo de error.
 *
 * - `ScrapingError` -> 200 con `success: false` (compatibilidad con clientes
 *   que hoy consumen el servicio y no manejan códigos 5xx).
 * - Errores de validación / AppError -> su `statusCode`.
 * - JSON mal formado (body-parser) -> 400.
 * - Cualquier otro -> 500.
 *
 * @param {Error & { statusCode?: number, type?: string }} error
 * @returns {number}
 */
function resolveStatus(error) {
    if (error instanceof ScrapingError) return 200;
    if (error instanceof AppError) return error.statusCode;
    if (error?.type === 'entity.parse.failed') return 400;
    if (Number.isInteger(error?.statusCode)) return error.statusCode;
    return 500;
}

/**
 * Middleware final de errores: centraliza el manejo y evita filtrar detalles
 * internos al cliente.
 *
 * @param {import('../../../application/ports/LoggerPort').prototype} logger
 * @returns {import('express').ErrorRequestHandler}
 */
function errorHandler(logger) {
    return (error, req, res, next) => {
        if (res.headersSent) return next(error);

        const status = resolveStatus(error);

        if (status >= 500) {
            logger.error(`Error no controlado en ${req.method} ${req.originalUrl}: ${error.stack || error.message}`);
            return res.status(status).json({ success: false, message: 'Error interno del servidor' });
        }

        if (status === 200) {
            logger.warn(`${req.method} ${req.originalUrl} - ${error.code}: ${error.message}`);
        }

        return res.status(status).json(TaxpayerPresenter.error(error));
    };
}

module.exports = errorHandler;
