/**
 * Middleware de log de peticiones: método, ruta, status y duración.
 *
 * Además alimenta el registro de métricas que expone `GET /metrics`.
 *
 * @param {import('../../../application/ports/LoggerPort').prototype} logger
 * @param {{ recordRequest: (event: { status: number, durationMs: number }) => void }} [metrics]
 * @returns {import('express').RequestHandler}
 */
function requestLogger(logger, metrics) {
    return (req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const durationMs = Date.now() - start;
            metrics?.recordRequest({ status: res.statusCode, durationMs });
            logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${durationMs}ms)`);
        });
        next();
    };
}

module.exports = requestLogger;
