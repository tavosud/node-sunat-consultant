/**
 * Puerto de dominio (interfaz) para obtener contribuyentes.
 *
 * El dominio y la aplicación dependen de esta abstracción; la implementación
 * concreta (Puppeteer/SUNAT) vive en `src/infrastructure/scraping`.
 */
class TaxpayerRepository {
    /**
     * Busca un contribuyente por número de documento.
     *
     * @param {import('../value-objects/DocumentNumber').prototype} documentNumber
     * @returns {Promise<import('../entities/Taxpayer').prototype>}
     * @throws {import('../errors/ScrapingError').prototype} Si SUNAT no devuelve datos.
     * @abstract
     */
    async findByDocumentNumber(documentNumber) { // eslint-disable-line no-unused-vars
        throw new Error(`${this.constructor.name}.findByDocumentNumber() no está implementado`);
    }
}

module.exports = TaxpayerRepository;
