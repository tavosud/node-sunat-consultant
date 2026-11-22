const express = require('express');

const TaxpayerController = require('./controllers/TaxpayerController');
const createTaxpayerRoutes = require('./routes/taxpayerRoutes');
const createHealthRoutes = require('./routes/healthRoutes');
const requestLogger = require('./middlewares/requestLogger');
const createRateLimiter = require('./middlewares/rateLimiter');
const errorHandler = require('./middlewares/errorHandler');
const notFoundHandler = require('./middlewares/notFoundHandler');

/**
 * Composition root de la capa HTTP: arma la app de Express a partir de las
 * dependencias ya construidas por el contenedor.
 *
 * @param {Object} deps
 * @param {Object} deps.config Configuración resuelta.
 * @param {import('../../application/use-cases/ConsultTaxpayerUseCase').prototype} deps.useCase
 * @param {import('../../application/ports/LoggerPort').prototype} deps.logger
 * @returns {import('express').Express}
 */
function createApp({ config, useCase, logger, metrics }) {
    const app = express();

    // Permite confiar en proxies (Docker/Nginx) para el rate limit por IP.
    app.set('trust proxy', 1);
    app.disable('x-powered-by');

    app.use(express.json({ limit: '100kb' }));
    app.use(requestLogger(logger, metrics));

    const controller = new TaxpayerController({ consultTaxpayer: useCase });
    const rateLimiter = createRateLimiter(config.rateLimit);

    app.use(createHealthRoutes({ config, metrics }));
    app.use(createTaxpayerRoutes({ controller, rateLimiter }));

    app.use(notFoundHandler);
    app.use(errorHandler(logger));

    return app;
}

module.exports = createApp;
