const express = require('express');

/**
 * Rutas de consulta de contribuyentes.
 *
 * @param {Object} deps
 * @param {import('../controllers/TaxpayerController').prototype} deps.controller
 * @param {import('express').RequestHandler} deps.rateLimiter
 * @returns {import('express').Router}
 */
function createTaxpayerRoutes({ controller, rateLimiter }) {
    const router = express.Router();

    // Endpoint único por Catálogo 06 SUNAT.
    router.post('/consultar', rateLimiter, controller.handleQuery);

    // Rutas heredadas (compatibilidad con integraciones existentes).
    router.post('/consultar-ruc', rateLimiter, controller.handleLegacyRuc);
    router.post('/consultar-dni', rateLimiter, controller.handleLegacyDni);

    return router;
}

module.exports = createTaxpayerRoutes;
