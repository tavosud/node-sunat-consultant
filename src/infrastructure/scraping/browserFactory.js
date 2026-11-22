const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// El plugin se registra una sola vez por proceso.
puppeteer.use(StealthPlugin());

/**
 * Fábrica de navegadores headless.
 *
 * Se inyecta en `SunatTaxpayerRepository` para poder sustituirla en tests
 * (por ejemplo, por un navegador falso) sin tocar la lógica de scraping.
 *
 * @param {Object} options
 * @param {boolean} [options.headless]
 * @param {string[]} [options.args]
 * @param {string} [options.executablePath] Ruta al navegador (Windows: Chrome instalado).
 * @param {string} [options.channel] Canal de Puppeteer (`chrome`, `chrome-beta`, ...).
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser({ headless = true, args = [], executablePath, channel } = {}) {
    const options = { headless, args };

    // `executablePath` tiene prioridad: es una ruta explícita del usuario.
    if (executablePath) options.executablePath = executablePath;
    else if (channel) options.channel = channel;

    try {
        return await puppeteer.launch(options);
    } catch (error) {
        // Error típico en Windows: no se descargó Chrome durante `npm install`.
        if (/could not find (chrome|chromium|browser)|failed to launch the browser/i.test(error.message)) {
            throw new Error(
                `${error.message} | Solucion: "npx puppeteer browsers install chrome" ` +
                'o define PUPPETEER_EXECUTABLE_PATH con la ruta de chrome.exe ' +
                '(o PUPPETEER_CHANNEL=chrome para usar el Chrome del sistema).'
            );
        }
        throw error;
    }
}

module.exports = { launchBrowser };
