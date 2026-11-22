const config = require('../config');
const ConsoleLogger = require('../logging/ConsoleLogger');
const NodeCacheAdapter = require('../cache/NodeCacheAdapter');
const { launchBrowser } = require('../scraping/browserFactory');
const SunatTaxpayerRepository = require('../scraping/sunat/SunatTaxpayerRepository');
const ConsultTaxpayerUseCase = require('../../application/use-cases/ConsultTaxpayerUseCase');
const MetricsRegistry = require('../metrics/MetricsRegistry');
const Semaphore = require('../../shared/utils/Semaphore');

/**
 * Contenedor de dependencias (inyección manual, sin frameworks).
 *
 * Es el único punto donde se "cablean" adaptadores concretos con las
 * abstracciones. Cambiar de caché, de logger o de scraper se reduce a
 * editar este archivo.
 *
 * @param {Object} [overrides] Sustituciones para tests (adaptadores falsos).
 * @returns {{ config: Object, logger: Object, cache: Object, useCase: Object }}
 */
function buildContainer(overrides = {}) {
    const logger = overrides.logger ?? new ConsoleLogger('sunat');
    const metrics = overrides.metrics ?? new MetricsRegistry();

    // Techo de scrapes simultáneos hacia SUNAT (protege la IP del servicio).
    const concurrencyLimiter = new Semaphore(config.scraper.maxConcurrency);

    const cache =
        overrides.cache ??
        new NodeCacheAdapter({
            stdTTL: config.cache.ttlSeconds,
            checkperiod: Math.min(config.cache.ttlSeconds, 600)
        });

    const taxpayerRepository =
        overrides.taxpayerRepository ??
        new SunatTaxpayerRepository({
            logger,
            launchBrowser: overrides.launchBrowser ?? launchBrowser,
            scraperConfig: config.scraper,
            metrics,
            concurrencyLimiter
        });

    const useCase =
        overrides.useCase ??
        new ConsultTaxpayerUseCase({
            taxpayerRepository,
            cache,
            logger,
            cacheTtlSeconds: config.cache.ttlSeconds,
            metrics
        });

    return { config, logger, cache, useCase, taxpayerRepository, metrics };
}

module.exports = { buildContainer };
