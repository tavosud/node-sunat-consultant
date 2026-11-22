const DocumentNumber = require('../../domain/value-objects/DocumentNumber');
const Taxpayer = require('../../domain/entities/Taxpayer');
const TaxpayerQueryResult = require('../dtos/TaxpayerQueryResult');

/**
 * Caso de uso: consultar un contribuyente por documento (catálogo 06 SUNAT).
 *
 * Orquesta el flujo completo:
 *   1. Valida y normaliza la entrada (Value Object `DocumentNumber`).
 *   2. Intenta responder desde caché.
 *   3. Si no hay caché, delega la obtención al repositorio (puerto de dominio).
 *   4. Guarda el resultado en caché y devuelve un DTO.
 *
 * No conoce Express, Puppeteer ni node-cache: solo depende de abstracciones.
 */
class ConsultTaxpayerUseCase {
    /**
     * @param {Object} deps
     * @param {import('../../domain/ports/TaxpayerRepository').prototype} deps.taxpayerRepository
     * @param {import('../ports/CachePort').prototype} deps.cache
     * @param {import('../ports/LoggerPort').prototype} deps.logger
     * @param {number} [deps.cacheTtlSeconds] TTL de caché en segundos.
     */
    constructor({ taxpayerRepository, cache, logger, cacheTtlSeconds, metrics }) {
        this.taxpayerRepository = taxpayerRepository;
        this.cache = cache;
        this.logger = logger;
        this.cacheTtlSeconds = cacheTtlSeconds;
        this.metrics = metrics;
    }

    /**
     * @param {Object} input
     * @param {unknown} input.document Documento (DNI o RUC).
     * @param {unknown} input.catalogSunat Código del catálogo 06 ('1' DNI, '6' RUC).
     * @returns {Promise<TaxpayerQueryResult>}
     * @throws {import('../../domain/errors/ValidationError').prototype} Entrada inválida.
     * @throws {import('../../domain/errors/ScrapingError').prototype} Fallo al consultar SUNAT.
     */
    async execute({ document, catalogSunat }) {
        const documentNumber = DocumentNumber.create({ document, catalog: catalogSunat });

        const cached = await this.cache.get(documentNumber.cacheKey);
        if (cached) {
            this.metrics?.recordCache(true);
            this.logger.info(`[Cache] Hit para ${documentNumber.type}: ${documentNumber.value}`);
            return new TaxpayerQueryResult({
                document: documentNumber.value,
                catalogSunat: documentNumber.catalogCode,
                fromCache: true,
                data: Taxpayer.fromPrimitives(cached).toPrimitives()
            });
        }

        this.metrics?.recordCache(false);
        const taxpayer = await this.taxpayerRepository.findByDocumentNumber(documentNumber);
        const data = taxpayer.toPrimitives();

        await this.cache.set(documentNumber.cacheKey, data, this.cacheTtlSeconds);

        return new TaxpayerQueryResult({
            document: documentNumber.value,
            catalogSunat: documentNumber.catalogCode,
            fromCache: false,
            data
        });
    }
}

module.exports = ConsultTaxpayerUseCase;
