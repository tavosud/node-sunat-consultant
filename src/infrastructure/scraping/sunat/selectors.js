/**
 * Selectores CSS del portal e-consultaruc de SUNAT.
 *
 * Se declaran como listas de candidatos porque SUNAT cambia el markup con
 * frecuencia; el helper `waitFirstSelector` prueba en orden hasta acertar.
 */
const SELECTORS = Object.freeze({
    /** Campo de RUC (búsqueda por RUC). */
    ruc: Object.freeze(['#txtRuc', 'input[name="txtRuc"]', 'input[id*="txtRuc"]']),

    /** Pestaña "Por Documento" (búsqueda por DNI). */
    dniTab: Object.freeze(['#btnPorDocumento', '[id*="btnPorDocumento"]', '[name="btnPorDocumento"]']),

    /** Campo de número de documento (DNI). */
    dni: Object.freeze([
        '#txtNumeroDocumento',
        'input[name="txtNumeroDocumento"]',
        'input[id*="txtNumeroDocumento"]'
    ]),

    /** Botón "Aceptar". */
    accept: Object.freeze([
        '#btnAceptar',
        'input#btnAceptar',
        '[name="btnAceptar"]',
        'input[name="btnAceptar"]',
        'button#btnAceptar'
    ]),

    /** Mensaje de error devuelto por SUNAT. */
    alert: '.alert-danger',

    /** Lista de coincidencias (varios resultados). */
    resultList: '.aRucs',

    /** Contenedor de datos del contribuyente. */
    dataContainer: '.list-group'
});

module.exports = SELECTORS;
