const test = require('node:test');
const assert = require('node:assert/strict');

const DocumentNumber = require('../src/domain/value-objects/DocumentNumber');

test('normaliza un RUC con guiones y espacios', () => {
    const doc = DocumentNumber.create({ document: ' 10-408468839 ', catalog: '6' });

    assert.equal(doc.value, '10408468839');
    assert.equal(doc.type, 'RUC');
    assert.equal(doc.catalogCode, '6');
    assert.equal(doc.cacheKey, 'RUC_10408468839');
});

test('acepta el catálogo y el documento como números', () => {
    const doc = DocumentNumber.create({ document: 40846883, catalog: 1 });

    assert.equal(doc.type, 'DNI');
    assert.equal(doc.value, '40846883');
    assert.equal(doc.cacheKey, 'DNI_40846883');
});

test('rechaza un documento vacío', () => {
    assert.throws(
        () => DocumentNumber.create({ document: '', catalog: '1' }),
        /Campo 'document' requerido/
    );
});

test('rechaza un catálogo faltante', () => {
    assert.throws(
        () => DocumentNumber.create({ document: '40846883' }),
        /catalog_sunat' requerido/
    );
});

test('rechaza un código del catálogo 06 no consultable', () => {
    assert.throws(
        () => DocumentNumber.create({ document: '123456789', catalog: '3' }),
        /no es consultable en SUNAT/
    );
});

test('rechaza longitudes inválidas según el tipo', () => {
    assert.throws(
        () => DocumentNumber.create({ document: '123', catalog: '6' }),
        /debe tener 11 dígitos/
    );
    assert.throws(
        () => DocumentNumber.create({ document: '123456789', catalog: '1' }),
        /debe tener 8 dígitos/
    );
});
