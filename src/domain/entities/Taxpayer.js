const { pruneEmpty } = require('../../shared/utils/pruneEmpty');
const { toUtcIsoDate } = require('../../shared/utils/sunatDate');

/**
 * Campos de fecha tal como los entrega SUNAT (`dd/mm/yyyy`).
 * Para cada uno se agrega su equivalente ISO 8601 UTC con sufijo `Utc`.
 */
const DATE_FIELDS = Object.freeze([
    'fechaInscripcion',
    'fechaInicioActividades',
    'emisorElectronicoDesde'
]);

/**
 * Entidad de dominio: contribuyente con los datos publicados por SUNAT.
 *
 * Los campos son dinámicos (SUNAT agrega/omite bloques según el contribuyente),
 * por eso la entidad guarda sus primitivas ya saneadas y sólo garantiza la
 * invariante "sin campos vacíos".
 */
class Taxpayer {
    #attributes;

    /**
     * @param {Object} attributes Datos ya saneados del contribuyente.
     */
    constructor(attributes = {}) {
        this.#attributes = Object.freeze({ ...attributes });
    }

    /**
     * Crea la entidad desde datos crudos, descartando campos vacíos,
     * `N/A`, `NO REGISTRADO` y `-`.
     *
     * Los campos de fecha originales se conservan tal cual los entrega SUNAT
     * (`dd/mm/yyyy`) y se agrega su equivalente ISO 8601 UTC con sufijo `Utc`
     * (p. ej. `fechaInscripcionUtc: '2002-08-05T00:00:00.000Z'`).
     *
     * @param {Object} raw
     * @returns {Taxpayer}
     */
    static fromPrimitives(raw) {
        const attributes = pruneEmpty(raw) ?? {};

        for (const field of DATE_FIELDS) {
            const isoDate = toUtcIsoDate(attributes[field]);
            if (isoDate) attributes[`${field}Utc`] = isoDate;
        }

        return new Taxpayer(attributes);
    }

    /** @returns {string|undefined} RUC del contribuyente, si existe. */
    get ruc() {
        return this.#attributes.ruc;
    }

    /** @returns {string|undefined} Razón social, si existe. */
    get businessName() {
        return this.#attributes.razonSocial;
    }

    /**
     * Datos planos listos para serializar o guardar en caché.
     * @returns {Object}
     */
    toPrimitives() {
        return { ...this.#attributes };
    }

    /** @returns {boolean} */
    isEmpty() {
        return Object.keys(this.#attributes).length === 0;
    }
}

module.exports = Taxpayer;
