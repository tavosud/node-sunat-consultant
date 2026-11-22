/**
 * Utilidades de fechas del portal SUNAT.
 *
 * SUNAT publica las fechas como `dd/mm/yyyy` (por ejemplo `05/08/2002`). El
 * servicio devuelve ese valor tal cual y, además, su equivalente en ISO 8601
 * UTC (por ejemplo `2002-08-05T00:00:00.000Z`).
 */

/** @type {RegExp} `dd/mm/yyyy`; día y mes pueden venir sin cero a la izquierda. */
const SUNAT_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Convierte una fecha `dd/mm/yyyy` de SUNAT a ISO 8601 UTC.
 *
 * La fecha se interpreta como día calendario a las 00:00:00 UTC. A propósito
 * no se aplica la zona horaria de Lima (UTC-5): desplazarla cambiaría el día y
 * confundiría a los clientes que cruzan este dato con otros sistemas.
 *
 * @param {unknown} value Valor tal como lo entrega SUNAT.
 * @returns {string|undefined} `2002-08-05T00:00:00.000Z`, o `undefined` si el valor no es una fecha válida.
 */
function toUtcIsoDate(value) {
    if (typeof value !== 'string') return undefined;

    const match = value.trim().match(SUNAT_DATE_PATTERN);
    if (!match) return undefined;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    // Descarta fechas inexistentes (31/02/2002, 00/00/2000, ...).
    const isValid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

    return isValid ? date.toISOString() : undefined;
}

module.exports = { toUtcIsoDate, SUNAT_DATE_PATTERN };
