// ---------------------------------------------------------------------------
// Bootstrap: la lógica vive en `src/` (Clean Architecture).
// ---------------------------------------------------------------------------
const createApp = require('./src/interfaces/http/app');
const { buildContainer } = require('./src/infrastructure/di/container');

const containerConfig = require('./src/infrastructure/config');
const containerLogger = new (require('./src/infrastructure/logging/ConsoleLogger'))('sunat');
const container = buildContainer({ logger: containerLogger });
const application = createApp({
    config: containerConfig,
    useCase: container.useCase,
    logger: container.logger,
    metrics: container.metrics
});

const server = application.listen(containerConfig.server.port, () => {
    container.logger.info('==========================================');
    container.logger.info(`Servicio activo en puerto ${containerConfig.server.port}`);
    container.logger.info(`Health check: http://localhost:${containerConfig.server.port}/health`);
    container.logger.info('==========================================');
});

// Errores de arranque explícitos (puerto ocupado, permisos, etc.).
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        container.logger.error(
            `El puerto ${containerConfig.server.port} ya esta en uso. ` +
            'Deten el proceso anterior (o el contenedor viejo) o define otro PORT.'
        );
    } else {
        container.logger.error(`No se pudo iniciar el servidor: ${error.message}`);
    }
    process.exit(1);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

module.exports = { app: application, server };
