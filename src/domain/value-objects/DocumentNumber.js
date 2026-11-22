const { DOCUMENT_TYPES, CATALOG_06_NAMES } = require('../constants/sunatCatalog');
const ValidationError = require('../errors/ValidationError');

const MESSAGE_DOCUMENT_REQUIRED = "Campo 'document' requerido";
const MESSAGE_CATALOG_REQUIRED =
    "Campo 'catalog_sunat' requerido (Catálogo 06 SUNAT: '1' = DNI, '6' = RUC)";

/**
 * Value Object: número de documento identificado por el Catálogo 06 de SUNAT.
 *
 * Encapsula la normalización (espacios/guiones) y la validación del documento,
 * de modo que el resto de la aplicación nunca trabaje con datos sin validar.
 */
class DocumentNumber {
    #value;
    #type;
    #catalogCode;

    /**
     * @param {Object} props
     * @param {string} props.value Documento ya normalizado (sin espacios ni guiones).
     * @param {string} props.type 'DNI' | 'RUC'.
     * @param {string} props.catalogCode Código del catálogo 06 ('1' o '6').
     */
    constructor({ value, type, catalogCode }) {
        this.#value = value;
        this.#type = type;
        this.#catalogCode = catalogCode;
        Object.freeze(this);
    }

    /**
     * Normaliza el documento recibido: acepta string o número y descarta
     * espacios y guiones (p. ej. "10-40846883-9" -> "10408468839").
     *
     * @param {unknown} document
     * @returns {string}
     */
    static normalize(document) {
        if (typeof document === 'string' || typeof document === 'number') {
            return String(document).replace(/[\s-]/g, '');
        }
        return '';
    }

    /**
     * Fábrica validada del Value Object.
     *
     * @param {Object} input
     * @param {unknown} input.document Documento a consultar.
     * @param {unknown} input.catalog Código del catálogo 06 de SUNAT.
     * @returns {DocumentNumber}
     * @throws {ValidationError}
     */
    static create({ document, catalog }) {
        const value = DocumentNumber.normalize(document);
        if (!value) throw new ValidationError(MESSAGE_DOCUMENT_REQUIRED);

        const catalogCode =
            (typeof catalog === 'string' || typeof catalog === 'number')
                ? String(catalog).trim().toUpperCase()
                : '';
        if (!catalogCode) throw new ValidationError(MESSAGE_CATALOG_REQUIRED);

        const documentType = DOCUMENT_TYPES[catalogCode];
        if (!documentType) {
            const officialName = CATALOG_06_NAMES[catalogCode];
            const detail = officialName ? ` ("${officialName}")` : '';
            throw new ValidationError(
                `Catálogo 06 código '${catalogCode}'${detail} no es consultable en SUNAT. Use '1' (DNI) o '6' (RUC).`
            );
        }

        if (!documentType.pattern.test(value)) {
            throw new ValidationError(
                `Documento inválido para ${documentType.type} (catálogo 06 código '${catalogCode}'): ` +
                `debe tener ${documentType.length} dígitos. Ejemplo: ${documentType.example}`
            );
        }

        return new DocumentNumber({ value, type: documentType.type, catalogCode });
    }

    /** @returns {string} Documento normalizado. */
    get value() {
        return this.#value;
    }

    /** @returns {string} 'DNI' | 'RUC'. */
    get type() {
        return this.#type;
    }

    /** @returns {string} Código del catálogo 06. */
    get catalogCode() {
        return this.#catalogCode;
    }

    /** Clave de caché estable por tipo y número: `RUC_10408468839`. */
    get cacheKey() {
        return `${this.#type}_${this.#value}`;
    }

    /** @returns {{ document: string, catalog_sunat: string }} Representación pública. */
    toPrimitives() {
        return { document: this.#value, catalog_sunat: this.#catalogCode };
    }

    toString() {
        return `${this.#type}:${this.#value}`;
    }
}

module.exports = DocumentNumber;
