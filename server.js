const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit'); // Importamos rate-limit

puppeteer.use(StealthPlugin());
const app = express();
const rucCache = new NodeCache({ stdTTL: 86400 }); 

// 1. Configuración del Rate Limit (15 peticiones por minuto)
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 15, 
    message: { success: false, message: "Demasiadas peticiones, intenta en un minuto." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

async function runScraper(id, tipo) {
    console.log(`[Scraper] Iniciando consulta ${tipo}: ${id}`);
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    const page = await browser.newPage();
    
    try {
        await page.goto('https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp', { 
            waitUntil: 'networkidle2' 
        });

        if (tipo === 'DNI') {
            await page.waitForSelector('#btnPorDocumento');
            await page.click('#btnPorDocumento');
            await page.waitForSelector('#txtNumeroDocumento', { visible: true });
            await page.type('#txtNumeroDocumento', id, { delay: 100 });
        } else {
            await page.waitForSelector('#txtRuc');
            await page.type('#txtRuc', id, { delay: 50 });
        }
        
        await Promise.all([
            page.click('#btnAceptar'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => null) 
        ]);

        const listaSelector = '.aRucs';
        const esLista = await page.$(listaSelector);

        if (esLista) {
            await Promise.all([
                page.click(listaSelector),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
        }

        await page.waitForSelector('.list-group', { timeout: 10000 });

        const datos = await page.evaluate(() => {
            const bloques = Array.from(document.querySelectorAll('.list-group-item'));
            const buscar = (titulo) => {
                const b = bloques.find(el => el.querySelector('h4')?.innerText.toUpperCase().includes(titulo.toUpperCase()));
                if (!b) return "NO REGISTRADO";
                const val = b.querySelector('.list-group-item-text') || b.querySelectorAll('.list-group-item-heading')[1];
                return val?.innerText.replace(/\s+/g, ' ').trim() || "N/A";
            };

            const rucFull = buscar("Número de RUC");
            return {
                ruc: rucFull.split('-')[0]?.trim() || "N/A",
                razonSocial: rucFull.split('-')[1]?.trim() || "N/A",
                nombreComercial: buscar("Nombre Comercial"),
                estado: buscar("Estado del Contribuyente"),
                condicion: buscar("Condición del Contribuyente"),
                domicilioFiscal: buscar("Domicilio Fiscal")
            };
        });

        console.log(`[Scraper] ✅ Finalizado con éxito para: ${id}`);
        return { success: true, data: datos };
    } catch (e) {
        console.error(`[Scraper] Error: ${e.message}`);
        return { success: false, message: "Error en Scraper: " + e.message };
    } finally {
        await browser.close();
    }
}

// 3. Aplicar limiter a las rutas
app.post('/consultar-ruc', limiter, async (req, res) => {
    const { ruc } = req.body;
    const cached = rucCache.get(ruc);
    if (cached) {
        console.log(`[Cache] Hit para RUC: ${ruc}`);
        return res.json({ success: true, fromCache: true, data: cached });
    }

    const result = await runScraper(ruc, 'RUC');
    if (result.success) rucCache.set(ruc, result.data);
    res.json(result);
});

app.post('/consultar-dni', limiter, async (req, res) => {
    const { dni } = req.body;
    const cached = rucCache.get(`DNI_${dni}`);
    if (cached) {
        console.log(`[Cache] Hit para DNI: ${dni}`);
        return res.json({ success: true, fromCache: true, data: cached });
    }

    const result = await runScraper(dni, 'DNI');
    if (result.success) rucCache.set(`DNI_${dni}`, result.data);
    res.json(result);
});

app.listen(3000, () => {
    console.log('==========================================');
    console.log('Servicio activo en puerto 3000');
    console.log('==========================================');
});