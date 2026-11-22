/**
 * Catálogo N° 06 de SUNAT: "Tipo de Documento de Identidad".
 *
 * Solo los códigos '1' (DNI) y '6' (RUC) son consultables en el portal
 * e-consultaruc; los demás tipos de documento no se pueden buscar ahí.
 */

/** Códigos del catálogo 06 soportados por el servicio. */
const SUPPORTED_CATALOG_CODES = Object.freeze({
    DNI: '1',
    RUC: '6'
});

/** Documentos consultables: patrón, longitud y ejemplo para mensajes de error. */
const DOCUMENT_TYPES = Object.freeze({
    [SUPPORTED_CATALOG_CODES.DNI]: Object.freeze({
        type: 'DNI',
        name: 'DOCUMENTO NACIONAL DE IDENTIDAD',
        pattern: /^\d{8}$/,
        length: 8,
        example: '40846883'
    }),
    [SUPPORTED_CATALOG_CODES.RUC]: Object.freeze({
        type: 'RUC',
        name: 'REGISTRO UNICO DE CONTRIBUYENTES',
        pattern: /^\d{11}$/,
        length: 11,
        example: '10408468839'
    })
});

/**
 * Nombres oficiales del catálogo 06 (solo para mensajes de error claros
 * cuando el código no es consultable).
 */
const CATALOG_06_NAMES = Object.freeze({
    '0': 'DOC.TRIB.NO.DOM.SIN.RUC',
    '1': 'DOCUMENTO NACIONAL DE IDENTIDAD',
    '2': 'CARNE DE EXTRANJERIA',
    '3': 'PASAPORTE',
    '4': 'CARNE DE IDENTIDAD EXTRANJERA',
    '5': 'CEDULA DIPLOMATICA DE IDENTIDAD',
    '6': 'REGISTRO UNICO DE CONTRIBUYENTES',
    '7': 'PASAPORTE',
    'A': 'CEDULA DIPLOMATICA DE IDENTIDAD',
    'B': 'DOC.IDENT.PAIS.RESIDENCIA-NO.D',
    'C': 'TAX IDENTIFICATION NUMBER',
    'D': 'IDENTIFICACION DEL EXTRANJERO',
    'E': 'TAM - CEDULA DE IDENTIDAD',
    'F': 'PASAPORTE',
    'G': 'DOC.IDENT.PAIS.RESIDENCIA-NO.D'
});

module.exports = {
    SUPPORTED_CATALOG_CODES,
    DOCUMENT_TYPES,
    CATALOG_06_NAMES
};
