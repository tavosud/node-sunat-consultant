const ValidationError = require('../../../domain/errors/ValidationError');
const { SUPPORTED_CATALOG_CODES } = require('../../../domain/constants/sunatCatalog');
const TaxpayerPresenter = require('../presenters/TaxpayerPresenter');

/**
 * Controlador HTTP de consultas de contribuyentes.
 *
 * Sólo traduce HTTP <-> caso de uso: lee el body, invoca la aplicación y
 * responde con el presenter. La validación de negocio vive en el dominio.
 */
class TaxpayerController {
    /**
     * @param {Object} deps
     * @param {import('../../../application/use-cases/ConsultTaxpayerUseCase').prototype} deps.consultTaxpayer
     */
    constructor({ consultTaxpayer }) {
        this.consultTaxpayer = consultTaxpayer;

        // Se enlazan los handlers para poder pasarlos directamente a Express.
        this.handleQuery = this.handleQuery.bind(this);
        this.handleLegacyRuc = this.handleLegacyRuc.bind(this);
        this.handleLegacyDni = this.handleLegacyDni.bind(this);
    }

    /**
     * POST /consultar
     * body: { document, catalog_sunat }
     *
     * @type {import('express').RequestHandler}
     */
    async handleQuery(req, res, next) {
        try {
            const { document, catalog_sunat: catalogSunat } = req.body ?? {};
            const result = await this.consultTaxpayer.execute({ document, catalogSunat });
            return res.status(200).json(TaxpayerPresenter.success(result));
        } catch (error) {
            return next(error);
        }
    }

    /**
     * POST /consultar-ruc (ruta heredada)
     * body: { ruc } o { id }
     *
     * @type {import('express').RequestHandler}
     */
    async handleLegacyRuc(req, res, next) {
        return this.#handleLegacy(req, res, next, {
            rawValue: req.body?.ruc ?? req.body?.id,
            fieldName: 'ruc',
            catalogCode: SUPPORTED_CATALOG_CODES.RUC
        });
    }

    /**
     * POST /consultar-dni (ruta heredada)
     * body: { dni } o { id }
     *
     * @type {import('express').RequestHandler}
     */
    async handleLegacyDni(req, res, next) {
        return this.#handleLegacy(req, res, next, {
            rawValue: req.body?.dni ?? req.body?.id,
            fieldName: 'dni',
            catalogCode: SUPPORTED_CATALOG_CODES.DNI
        });
    }

    /**
     * Implementación común de las rutas heredadas.
     *
     * @private
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @param {import('express').NextFunction} next
     * @param {{ rawValue: unknown, fieldName: string, catalogCode: string }} options
     */
    async #handleLegacy(req, res, next, { rawValue, fieldName, catalogCode }) {
        try {
            if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
                throw new ValidationError(`Campo '${fieldName}' requerido`);
            }

            const result = await this.consultTaxpayer.execute({
                document: rawValue,
                catalogSunat: catalogCode
            });
            return res.status(200).json(TaxpayerPresenter.success(result));
        } catch (error) {
            return next(error);
        }
    }
}

module.exports = TaxpayerController;
