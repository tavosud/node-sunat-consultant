const express = require('express');

/**
 * Rutas de infraestructura (liveness y métricas para Docker/K8s).
 *
 * @param {Object} deps
 * @param {Object} deps.config
 * @param {{ snapshot: () => Object }} [deps.metrics]
 * @returns {import('express').Router}
 */
function createHealthRoutes({ config, metrics }) {
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            uptime: process.uptime(),
            env: config.server.env
        });
    });

    // Observabilidad para dimensionar el servicio y detectar bloqueos de SUNAT.
    router.get('/metrics', (req, res) => {
        if (!metrics) {
            return res.status(501).json({ success: false, message: 'Métricas no disponibles' });
        }
        return res.status(200).json(metrics.snapshot());
    });

    return router;
}

module.exports = createHealthRoutes;
