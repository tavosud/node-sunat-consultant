const test = require('node:test');
const assert = require('node:assert/strict');

const Taxpayer = require('../src/domain/entities/Taxpayer');

test('agrega las fechas en ISO 8601 UTC conservando el formato de SUNAT', () => {
    const data = Taxpayer.fromPrimitives({
        ruc: '20212331377',
        fechaInscripcion: '05/08/2002',
        fechaInicioActividades: '5/8/2002',
        emisorElectronicoDesde: '01/12/2018'
    }).toPrimitives();

    assert.equal(data.fechaInscripcion, '05/08/2002');
    assert.equal(data.fechaInscripcionUtc, '2002-08-05T00:00:00.000Z');

    assert.equal(data.fechaInicioActividades, '5/8/2002');
    assert.equal(data.fechaInicioActividadesUtc, '2002-08-05T00:00:00.000Z');

    assert.equal(data.emisorElectronicoDesde, '01/12/2018');
    assert.equal(data.emisorElectronicoDesdeUtc, '2018-12-01T00:00:00.000Z');
});

test('no inventa campos Utc si el valor no es una fecha válida', () => {
    const data = Taxpayer.fromPrimitives({
        ruc: '20212331377',
        fechaInscripcion: '31/02/2002',
        fechaInicioActividades: 'SIN INFORMACION'
    }).toPrimitives();

    assert.equal(data.fechaInscripcion, '31/02/2002');
    assert.equal(data.fechaInscripcionUtc, undefined);
    assert.equal(data.fechaInicioActividades, 'SIN INFORMACION');
    assert.equal(data.fechaInicioActividadesUtc, undefined);
});

test('descarta campos vacíos o no registrados antes de convertir', () => {
    const data = Taxpayer.fromPrimitives({
        ruc: '20212331377',
        fechaInscripcion: '-',
        estado: 'ACTIVO'
    }).toPrimitives();

    assert.equal(data.fechaInscripcion, undefined);
    assert.equal(data.fechaInscripcionUtc, undefined);
    assert.equal(data.estado, 'ACTIVO');
});

test('la conversión es idempotente (datos que vienen de caché)', () => {
    const original = Taxpayer.fromPrimitives({ fechaInscripcion: '05/08/2002' }).toPrimitives();
    const recalculado = Taxpayer.fromPrimitives(original).toPrimitives();

    assert.deepEqual(recalculado, original);
    assert.equal(recalculado.fechaInscripcionUtc, '2002-08-05T00:00:00.000Z');
});
