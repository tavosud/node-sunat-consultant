const SELECTORS = require('./selectors');

/** @typedef {'alert'|'list'|'data'|'timeout'} ResultKind */
/** @typedef {{ type: ResultKind, frame: import('puppeteer').Frame }} ScrapeResult */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Espera al primer selector que exista dentro de una lista de candidatos.
 *
 * @param {import('puppeteer').Frame} ctx
 * @param {string[]} selectorList
 * @param {number} timeoutMs
 * @returns {Promise<string>} Selector encontrado o cadena vacía.
 */
async function waitFirstSelector(ctx, selectorList, timeoutMs) {
    const perTry = Math.max(500, Math.floor(timeoutMs / Math.max(1, selectorList.length)));
    for (const selector of selectorList) {
        try {
            await ctx
                .waitForSelector(selector, { timeout: perTry, visible: true })
                .catch(() => ctx.waitForSelector(selector, { timeout: perTry }));
            return selector;
        } catch {
            // Se prueba el siguiente candidato.
        }
    }
    return '';
}

/**
 * Localiza el frame que contiene alguno de los selectores indicados
 * (el portal usa frames/iframes anidados).
 *
 * @param {import('puppeteer').Page} page
 * @param {string[]} selectorList
 * @param {number} [timeoutMs]
 * @returns {Promise<import('puppeteer').Frame|import('puppeteer').Page>}
 */
async function findContext(page, selectorList, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        for (const frame of page.frames()) {
            for (const selector of selectorList) {
                try {
                    const element = await frame.$(selector);
                    if (element) return frame;
                } catch {
                    // Frame no disponible: se ignora.
                }
            }
        }
        await sleep(250);
    }
    return page;
}

/**
 * Hace click sobre el primer nodo que cumpla una expresión XPath.
 *
 * @param {import('puppeteer').Frame} ctx
 * @param {string} xpathExpr
 * @returns {Promise<boolean>} `true` si se hizo click.
 */
async function clickByXPath(ctx, xpathExpr) {
    const handle = await ctx.evaluateHandle((expr) => {
        const result = document.evaluate(
            expr,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );
        return result.singleNodeValue;
    }, xpathExpr);

    const element = handle.asElement();
    if (!element) {
        await handle.dispose().catch(() => null);
        return false;
    }

    await element.click();
    await element.dispose().catch(() => null);
    return true;
}

/**
 * Pulsa "Aceptar": primero por CSS y, si falla, por texto/XPath.
 *
 * @param {import('puppeteer').Frame} ctx
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
async function clickAccept(ctx, timeoutMs = 15000) {
    const acceptSelector = await waitFirstSelector(ctx, SELECTORS.accept, timeoutMs);
    if (acceptSelector) {
        await ctx.click(acceptSelector);
        return;
    }

    const xpaths = [
        `//input[translate(normalize-space(@value),'ACEPTAR','aceptar')='aceptar']`,
        `//button[contains(translate(normalize-space(string(.)),'ACEPTAR','aceptar'),'aceptar')]`,
        `//*[self::a or self::button][contains(translate(normalize-space(string(.)),'ACEPTAR','aceptar'),'aceptar')]`
    ];

    for (const xpath of xpaths) {
        try {
            const clicked = await clickByXPath(ctx, xpath);
            if (clicked) return;
        } catch {
            // Se prueba el siguiente XPath.
        }
    }

    const bodyText = await ctx
        .evaluate(() => (document.body && document.body.innerText ? document.body.innerText : ''))
        .catch(() => '');
    const hint = (bodyText || '').slice(0, 500).replace(/\s+/g, ' ').trim();
    throw new Error(`No element found for selector: #btnAceptar${hint ? ` | Vista: ${hint}` : ''}`);
}

/**
 * Espera a que aparezca un mensaje de error, una lista de coincidencias o los
 * datos del contribuyente.
 *
 * @param {import('puppeteer').Page} page
 * @param {number} [timeoutMs]
 * @returns {Promise<ScrapeResult>}
 */
async function waitForResult(page, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        for (const frame of page.frames()) {
            try {
                if (await frame.$(SELECTORS.alert)) return { type: 'alert', frame };
                if (await frame.$(SELECTORS.resultList)) return { type: 'list', frame };
                if (await frame.$(SELECTORS.dataContainer)) return { type: 'data', frame };
            } catch {
                // Frame recargándose: se reintenta.
            }
        }
        await sleep(250);
    }
    return { type: 'timeout', frame: page };
}

/**
 * Extrae el texto del mensaje de error de SUNAT dentro de un frame.
 *
 * @param {import('puppeteer').Frame} frame
 * @returns {Promise<string>}
 */
async function readAlertMessage(frame) {
    return frame
        .evaluate(() => {
            const element = document.querySelector('.alert-danger');
            return element ? element.innerText.replace(/\s+/g, ' ').trim() : '';
        })
        .catch(() => '');
}

module.exports = {
    waitFirstSelector,
    findContext,
    clickByXPath,
    clickAccept,
    waitForResult,
    readAlertMessage
};
