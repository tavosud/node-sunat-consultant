const ScrapingError = require('../../../domain/errors/ScrapingError');

/**
 * Presenter: traduce resultados y errores de la aplicación al contrato JSON
 * público de la API. Si mañana cambia el formato de respuesta, sólo se toca
 * este archivo.
 */
const TaxpayerPresenter = {
    /**
     * Respuesta exitosa.
     *
     * @param {import('../../application/dtos/TaxpayerQueryResult').prototype} result
     * @returns {Object}
     */
    success(result) {
        return {
            success: true,
            fromCache: result.fromCache,
            document: result.document,
            catalog_sunat: result.catalogSunat,
            data: result.data
        };
    },

    /**
     * Respuesta de error.
     *
     * Los fallos de scraping conservan el contrato histórico
     * (`document` + `catalog_sunat`) para no romper integraciones existentes.
     *
     * @param {Error & { code?: string, details?: Object }} error
     * @returns {Object}
     */
    error(error) {
        const body = { success: false, message: error.message };

        if (error instanceof ScrapingError) {
            const { document, catalogSunat } = error.details ?? {};
            if (document !== undefined) body.document = document;
            if (catalogSunat !== undefined) body.catalog_sunat = catalogSunat;
        }

        if (error.code) body.code = error.code;
        return body;
    }
};

module.exports = TaxpayerPresenter;
