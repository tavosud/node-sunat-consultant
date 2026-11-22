/**
 * Punto de entrada del microservicio.
 *
 * Responsabilidad única: construir el contenedor de dependencias, levantar el
 * servidor HTTP y gestionar un apagado ordenado. Toda la lógica vive en `src/`.
 *
 * Capas:
 *   src/domain         -> reglas de negocio puras (sin Express ni Puppeteer)
 *   src/application    -> casos de uso y puertos (interfaces)
 *   src/infrastructure -> adaptadores: Puppeteer, node-cache, config, logger
 *   src/interfaces     -> HTTP: controladores, rutas, middlewares, presenters
 */
const createApp = require('./src/interfaces/http/app');
const { buildContainer } = require('./src/infrastructure/di/container');

const { config, logger, useCase } = buildContainer();
const app = createApp({ config, useCase, logger });

const server = app.listen(config.server.port, () => {
    logger.info('==========================================');
    logger.info(`Servicio activo en puerto ${config.server.port} (${config.server.env})`);
    logger.info('==========================================');
});

/**
 * Apagado ordenado: deja de aceptar peticiones y espera a las que están en curso.
 *
 * @param {string} signal
 */
function shutdown(signal) {
    logger.info(`Recibida señal ${signal}: cerrando servidor...`);

    server.close(() => {
        logger.info('Servidor cerrado correctamente.');
        process.exit(0);
    });

    // Salida forzada si el cierre se cuelga (p. ej. un navegador Puppeteer vivo).
    setTimeout(() => {
        logger.error('Cierre forzado tras timeout.');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logger.error(`Promise rechazada sin manejar: ${reason?.stack || reason}`);
});

process.on('uncaughtException', (error) => {
    logger.error(`Excepción no capturada: ${error.stack || error.message}`);
    shutdown('uncaughtException');
});

module.exports = { app, server };
