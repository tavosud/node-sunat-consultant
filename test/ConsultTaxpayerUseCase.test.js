const test = require('node:test');
const assert = require('node:assert/strict');

const ConsultTaxpayerUseCase = require('../src/application/use-cases/ConsultTaxpayerUseCase');
const Taxpayer = require('../src/domain/entities/Taxpayer');
const ScrapingError = require('../src/domain/errors/ScrapingError');

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

/** Caché en memoria que implementa `CachePort`. */
function buildCache() {
    const store = new Map();
    return {
        store,
        async get(key) {
            return store.get(key);
        },
        async set(key, value) {
            store.set(key, value);
        },
        async delete(key) {
            store.delete(key);
        }
    };
}

/** Repositorio falso que implementa `TaxpayerRepository`. */
function buildRepository(findByDocumentNumber) {
    return { findByDocumentNumber };
}

function buildUseCase({ repository, cache }) {
    return new ConsultTaxpayerUseCase({
        taxpayerRepository: repository,
        cache,
        logger: silentLogger,
        cacheTtlSeconds: 60
    });
}

test('consulta al repositorio y guarda el resultado en caché', async () => {
    const cache = buildCache();
    let calls = 0;

    const repository = buildRepository(async (documentNumber) => {
        calls += 1;
        return Taxpayer.fromPrimitives({
            ruc: documentNumber.value,
            razonSocial: 'GRUPO DELTRON S.A.'
        });
    });

    const result = await buildUseCase({ repository, cache }).execute({
        document: '20212331377',
        catalogSunat: '6'
    });

    assert.equal(calls, 1);
    assert.equal(result.fromCache, false);
    assert.equal(result.document, '20212331377');
    assert.equal(result.catalogSunat, '6');
    assert.deepEqual(result.data, { ruc: '20212331377', razonSocial: 'GRUPO DELTRON S.A.' });
    assert.deepEqual(cache.store.get('RUC_20212331377'), result.data);
});

test('la segunda consulta se responde desde caché sin llamar al scraper', async () => {
    const cache = buildCache();
    let calls = 0;

    const repository = buildRepository(async () => {
        calls += 1;
        return Taxpayer.fromPrimitives({ ruc: '20212331377', estado: 'ACTIVO' });
    });

    const useCase = buildUseCase({ repository, cache });

    await useCase.execute({ document: '20212331377', catalogSunat: '6' });
    const result = await useCase.execute({ document: '2021-2331377', catalogSunat: 6 });

    assert.equal(calls, 1);
    assert.equal(result.fromCache, true);
    assert.deepEqual(result.data, { ruc: '20212331377', estado: 'ACTIVO' });
});

test('propaga ScrapingError y no cachea resultados fallidos', async () => {
    const cache = buildCache();

    const repository = buildRepository(async () => {
        throw new ScrapingError('SUNAT dice: El RUC no existe', {
            details: { document: '10000000001', catalogSunat: '6' }
        });
    });

    await assert.rejects(
        () => buildUseCase({ repository, cache }).execute({ document: '10000000001', catalogSunat: '6' }),
        /SUNAT dice: El RUC no existe/
    );
    assert.equal(cache.store.size, 0);
});

test('valida la entrada antes de tocar caché o repositorio', async () => {
    const cache = buildCache();
    let calls = 0;

    const repository = buildRepository(async () => {
        calls += 1;
        return Taxpayer.fromPrimitives({});
    });

    await assert.rejects(
        () => buildUseCase({ repository, cache }).execute({ document: '123', catalogSunat: '1' }),
        /debe tener 8 dígitos/
    );
    assert.equal(calls, 0);
    assert.equal(cache.store.size, 0);
});
