/**
 * Middleware 404: responde JSON en lugar del HTML por defecto de Express.
 *
 * @type {import('express').RequestHandler}
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        code: 'ROUTE_NOT_FOUND'
    });
}

module.exports = notFoundHandler;
