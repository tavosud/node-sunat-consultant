const TaxpayerRepository = require('../../../domain/ports/TaxpayerRepository');
const Taxpayer = require('../../../domain/entities/Taxpayer');
const ScrapingError = require('../../../domain/errors/ScrapingError');
const SELECTORS = require('./selectors');
const {
    waitFirstSelector,
    findContext,
    clickAccept,
    waitForResult,
    readAlertMessage
} = require('./pageHelpers');
const { collectTaxpayerData } = require('./collectTaxpayerData');
const Semaphore = require('../../../shared/utils/Semaphore');

/**
 * Adaptador de infraestructura: obtiene contribuyentes desde el portal
 * e-consultaruc de SUNAT usando Puppeteer (implementa `TaxpayerRepository`).
 *
 * Responsabilidades: navegar, rellenar el formulario, resolver captchas
 * humanos/bloqueos por timeout y extraer los datos. Nada de HTTP ni de caché.
 */
class SunatTaxpayerRepository extends TaxpayerRepository {
    /**
     * @param {Object} deps
     * @param {import('../../../application/ports/LoggerPort').prototype} deps.logger
     * @param {(options: Object) => Promise<import('puppeteer').Browser>} deps.launchBrowser
     * @param {import('../../config').scraper} deps.scraperConfig
     */
    constructor({ logger, launchBrowser, scraperConfig, metrics, concurrencyLimiter }) {
        super();
        this.logger = logger;
        this.launchBrowser = launchBrowser;
        this.config = scraperConfig;
        this.metrics = metrics;
        this.limiter = concurrencyLimiter ?? new Semaphore(1);
    }

    /**
     * @param {import('../../../domain/value-objects/DocumentNumber').prototype} documentNumber
     * @returns {Promise<Taxpayer>}
     * @throws {ScrapingError}
     */
    async findByDocumentNumber(documentNumber) {
        const { value: id, type, catalogCode } = documentNumber;
        const errorDetails = { document: id, catalogSunat: catalogCode };

        this.logger.info(`[Scraper] Iniciando consulta ${type}: ${id}`);

        // Nunca más de N scrapes a la vez: SUNAT bloquea IPs con paralelismo.
        await this.limiter.acquire();
        const startedAt = Date.now();
        let browser;

        try {
            browser = await this.launchBrowser({
                headless: this.config.headless,
                args: this.config.launchArgs,
                executablePath: this.config.executablePath,
                channel: this.config.channel
            });
            const page = await browser.newPage();
            await page.setUserAgent(this.config.userAgent);

            await page.goto(this.config.url, { waitUntil: 'domcontentloaded' });

            // El portal suele cargar el formulario dentro de un frame.
            const innerUrl = await page.evaluate(() => {
                const element = document.querySelector('frame[src], iframe[src]');
                if (!element) return '';
                const src = element.getAttribute('src') || '';
                try {
                    return new URL(src, location.href).href;
                } catch {
                    return '';
                }
            });
            if (innerUrl) {
                await page.goto(innerUrl, { waitUntil: 'domcontentloaded' });
            }

            let ctx = await findContext(
                page,
                [...SELECTORS.ruc, ...SELECTORS.dniTab, ...SELECTORS.accept, ...SELECTORS.dni],
                this.config.timeouts.selector
            );

            ctx = await this.#fillSearchForm(ctx, { id, type });

            await Promise.allSettled([
                clickAccept(ctx, this.config.timeouts.selector),
                page
                    .waitForNavigation({
                        waitUntil: 'networkidle2',
                        timeout: this.config.timeouts.networkIdle
                    })
                    .catch(() => null)
            ]);

            const firstResult = await waitForResult(page, this.config.timeouts.result);
            if (firstResult.type === 'alert') {
                const message = await readAlertMessage(firstResult.frame);
                if (message) throw new ScrapingError(`SUNAT dice: ${message}`, { details: errorDetails });
            }
            if (firstResult.type === 'timeout') {
                throw new Error('SUNAT no devolvió resultado (posible bloqueo/captcha o cambio de página).');
            }

            // Si SUNAT devuelve varias coincidencias, se entra a la primera.
            let resultCtx =
                firstResult.frame ||
                (await findContext(
                    page,
                    [SELECTORS.resultList, SELECTORS.dataContainer],
                    this.config.timeouts.selector
                ));

            if (await resultCtx.$(SELECTORS.resultList)) {
                await Promise.all([
                    resultCtx.click(SELECTORS.resultList),
                    page
                        .waitForNavigation({
                            waitUntil: 'networkidle2',
                            timeout: this.config.timeouts.networkIdle
                        })
                        .catch(() => null)
                ]);
            }

            const afterList = await waitForResult(page, this.config.timeouts.result);
            if (afterList.type === 'alert') {
                const message = await readAlertMessage(afterList.frame);
                if (message) throw new ScrapingError(`SUNAT dice: ${message}`, { details: errorDetails });
            }
            if (afterList.type === 'timeout') {
                throw new Error('SUNAT no devolvió datos (posible bloqueo/captcha o cambio de página).');
            }

            resultCtx =
                afterList.frame ||
                (await findContext(page, [SELECTORS.dataContainer], this.config.timeouts.selector));

            await resultCtx.waitForSelector(SELECTORS.dataContainer, {
                timeout: this.config.timeouts.selector
            });

            const rawData = await resultCtx.evaluate(collectTaxpayerData);

            this.metrics?.recordScrape({ ok: true, durationMs: Date.now() - startedAt });
            this.logger.info(`[Scraper] ✅ Finalizado con éxito para: ${id}`);
            return Taxpayer.fromPrimitives(rawData);
        } catch (error) {
            this.metrics?.recordScrape({ ok: false, durationMs: Date.now() - startedAt });

            if (error instanceof ScrapingError) throw error;

            this.logger.error(`[Scraper] Error: ${error.message}`);
            throw new ScrapingError(`Error en Scraper: ${error.message}`, {
                details: errorDetails,
                cause: error
            });
        } finally {
            if (browser) await browser.close().catch(() => null);
            this.limiter.release();
        }
    }

    /**
     * Rellena el formulario según el tipo de documento.
     *
     * @param {import('puppeteer').Frame} ctx
     * @param {Object} params
     * @param {string} params.id Documento normalizado.
     * @param {string} params.type 'DNI' | 'RUC'.
     * @returns {Promise<import('puppeteer').Frame>} Contexto con el formulario.
     */
    async #fillSearchForm(ctx, { id, type }) {
        if (type === 'DNI') {
            const tabSelector = await waitFirstSelector(ctx, SELECTORS.dniTab, this.config.timeouts.selector);
            if (!tabSelector) {
                throw new Error('No se encontró la pestaña de búsqueda por DNI (SUNAT cambió la página o hay bloqueo).');
            }
            await ctx.click(tabSelector);

            const dniSelector = await waitFirstSelector(ctx, SELECTORS.dni, this.config.timeouts.selector);
            if (!dniSelector) {
                throw new Error('No se encontró el campo de DNI (SUNAT cambió la página o hay bloqueo).');
            }
            await ctx.focus(dniSelector);
            await ctx.click(dniSelector, { clickCount: 3 }).catch(() => null);
            await ctx.type(dniSelector, id, { delay: 100 });
            return ctx;
        }

        if (type === 'RUC') {
            const rucSelector = await waitFirstSelector(ctx, SELECTORS.ruc, this.config.timeouts.selector);
            if (!rucSelector) {
                throw new Error('No se encontró el campo de RUC (SUNAT cambió la página o hay bloqueo).');
            }
            await ctx.focus(rucSelector);
            await ctx.click(rucSelector, { clickCount: 3 }).catch(() => null);
            await ctx.type(rucSelector, id, { delay: 50 });
            return ctx;
        }

        throw new Error(`Tipo de documento no soportado: ${type}`);
    }
}

module.exports = SunatTaxpayerRepository;
