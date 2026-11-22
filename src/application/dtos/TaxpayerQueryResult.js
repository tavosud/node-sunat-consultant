/**
 * DTO de salida del caso de uso `ConsultTaxpayerUseCase`.
 *
 * Es el contrato que la capa de interfaces (HTTP u otra) puede serializar.
 */
class TaxpayerQueryResult {
    /**
     * @param {Object} props
     * @param {string} props.document Documento consultado (normalizado).
     * @param {string} props.catalogSunat Código del catálogo 06 consultado.
     * @param {boolean} props.fromCache Si la respuesta vino de caché.
     * @param {Object} props.data Datos del contribuyente.
     */
    constructor({ document, catalogSunat, fromCache, data }) {
        this.document = document;
        this.catalogSunat = catalogSunat;
        this.fromCache = fromCache;
        this.data = data;
        Object.freeze(this);
    }
}

module.exports = TaxpayerQueryResult;
