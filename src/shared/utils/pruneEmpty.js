/**
 * Indica si un texto no aporta información (vacío, guion, "N/A", "NO REGISTRADO").
 * @param {string} value
 * @returns {boolean}
 */
function isBlankString(value) {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toUpperCase();
    return normalized === '' || normalized === '-' || normalized === 'N/A' || normalized === 'NO REGISTRADO';
}

/**
 * Elimina recursivamente valores vacíos de un objeto/array.
 * Devuelve `undefined` cuando el nodo queda vacío para que el padre lo omita.
 *
 * @param {*} value
 * @returns {*}
 */
function pruneEmpty(value) {
    if (value == null) return undefined;

    if (Array.isArray(value)) {
        const cleaned = value
            .map((item) => pruneEmpty(item))
            .filter((item) => item !== undefined);
        return cleaned.length ? cleaned : undefined;
    }

    if (typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            const cleaned = pruneEmpty(item);
            if (cleaned !== undefined && !isBlankString(cleaned)) out[key] = cleaned;
        }
        return Object.keys(out).length ? out : undefined;
    }

    if (isBlankString(value)) return undefined;
    return value;
}

module.exports = { pruneEmpty, isBlankString };
