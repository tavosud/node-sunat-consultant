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

function pruneEmpty(value) {
    const isBlankString = (v) => typeof v === 'string' && (v.trim() === '' || v.trim() === '-' || v.trim().toUpperCase() === 'N/A' || v.trim().toUpperCase() === 'NO REGISTRADO');
    if (value == null) return undefined;
    if (Array.isArray(value)) {
        const cleaned = value
            .map(v => pruneEmpty(v))
            .filter(v => v !== undefined);
        return cleaned.length ? cleaned : undefined;
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const cleaned = pruneEmpty(v);
            if (cleaned !== undefined && !isBlankString(cleaned)) out[k] = cleaned;
        }
        return Object.keys(out).length ? out : undefined;
    }
    if (isBlankString(value)) return undefined;
    return value;
}

async function runScraper(id, tipo) {
    console.log(`[Scraper] Iniciando consulta ${tipo}: ${id}`);
    const browser = await puppeteer.launch({ 
        headless: "new", 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    const page = await browser.newPage();
    
    try {
        const selectors = {
            ruc: ['#txtRuc', 'input[name="txtRuc"]', 'input[id*="txtRuc"]'],
            dniTab: ['#btnPorDocumento', '[id*="btnPorDocumento"]', '[name="btnPorDocumento"]'],
            dni: ['#txtNumeroDocumento', 'input[name="txtNumeroDocumento"]', 'input[id*="txtNumeroDocumento"]'],
            accept: ['#btnAceptar', 'input#btnAceptar', '[name="btnAceptar"]', 'input[name="btnAceptar"]', 'button#btnAceptar']
        };

        const waitFirstSelector = async (ctx, selectorList, timeoutMs) => {
            const perTry = Math.max(500, Math.floor(timeoutMs / Math.max(1, selectorList.length)));
            for (const selector of selectorList) {
                try {
                    await ctx.waitForSelector(selector, { timeout: perTry, visible: true }).catch(() => ctx.waitForSelector(selector, { timeout: perTry }));
                    return selector;
                } catch {
                }
            }
            return '';
        };

        const findContext = async (selectorList, timeoutMs = 15000) => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                for (const frame of page.frames()) {
                    for (const selector of selectorList) {
                        try {
                            const el = await frame.$(selector);
                            if (el) return frame;
                        } catch {
                        }
                    }
                }
                await new Promise(r => setTimeout(r, 250));
            }
            return page;
        };

        const clickAccept = async (ctx, timeoutMs = 15000) => {
            const acceptSelector = await waitFirstSelector(ctx, selectors.accept, timeoutMs);
            if (acceptSelector) {
                await ctx.click(acceptSelector);
                return;
            }

            const xpaths = [
                `//input[translate(normalize-space(@value),'ACEPTAR','aceptar')='aceptar']`,
                `//button[contains(translate(normalize-space(string(.)),'ACEPTAR','aceptar'),'aceptar')]`,
                `//*[self::a or self::button][contains(translate(normalize-space(string(.)),'ACEPTAR','aceptar'),'aceptar')]`
            ];
            for (const xp of xpaths) {
                try {
                    const handles = await ctx.$x(xp);
                    if (handles && handles[0]) {
                        await handles[0].click();
                        return;
                    }
                } catch {
                }
            }

            const bodyText = await ctx.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText : '').catch(() => '');
            const hint = (bodyText || '').slice(0, 500).replace(/\s+/g, ' ').trim();
            throw new Error(`No element found for selector: #btnAceptar${hint ? ` | Vista: ${hint}` : ''}`);
        };

        const waitForResult = async (timeoutMs = 20000) => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                for (const frame of page.frames()) {
                    try {
                        const alert = await frame.$('.alert-danger');
                        if (alert) return { type: 'alert', frame };
                        const list = await frame.$('.aRucs');
                        if (list) return { type: 'list', frame };
                        const group = await frame.$('.list-group');
                        if (group) return { type: 'data', frame };
                    } catch {
                    }
                }
                await new Promise(r => setTimeout(r, 250));
            }
            return { type: 'timeout', frame: page };
        };

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
        await page.goto('https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp', {
            waitUntil: 'domcontentloaded'
        });

        const innerUrl = await page.evaluate(() => {
            const el = document.querySelector('frame[src], iframe[src]');
            if (!el) return '';
            const src = el.getAttribute('src') || '';
            try {
                return new URL(src, location.href).href;
            } catch {
                return '';
            }
        });
        if (innerUrl) {
            await page.goto(innerUrl, { waitUntil: 'domcontentloaded' });
        }
        let ctx = await findContext([...selectors.ruc, ...selectors.dniTab, ...selectors.accept, ...selectors.dni], 20000);

        if (tipo === 'DNI') {
            const tabSel = await waitFirstSelector(ctx, selectors.dniTab, 20000);
            if (!tabSel) throw new Error('No se encontró la pestaña de búsqueda por DNI (SUNAT cambió la página o hay bloqueo).');
            await ctx.click(tabSel);

            const dniSel = await waitFirstSelector(ctx, selectors.dni, 20000);
            if (!dniSel) throw new Error('No se encontró el campo de DNI (SUNAT cambió la página o hay bloqueo).');
            await ctx.focus(dniSel);
            await ctx.click(dniSel, { clickCount: 3 }).catch(() => null);
            await ctx.type(dniSel, id, { delay: 100 });
        } else {
            const rucSel = await waitFirstSelector(ctx, selectors.ruc, 20000);
            if (!rucSel) throw new Error('No se encontró el campo de RUC (SUNAT cambió la página o hay bloqueo).');
            await ctx.focus(rucSel);
            await ctx.click(rucSel, { clickCount: 3 }).catch(() => null);
            await ctx.type(rucSel, id, { delay: 50 });
        }
        
        await Promise.allSettled([
            clickAccept(ctx, 20000),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null)
        ]);

        const firstResult = await waitForResult(25000);
        if (firstResult.type === 'alert') {
            const msg = await firstResult.frame.evaluate(() => {
                const el = document.querySelector('.alert-danger');
                return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
            }).catch(() => '');
            if (msg) return { success: false, message: `SUNAT dice: ${msg}` };
        }
        if (firstResult.type === 'timeout') {
            throw new Error('SUNAT no devolvió resultado (posible bloqueo/captcha o cambio de página).');
        }

        const listaSelector = '.aRucs';
        let resultCtx = firstResult.frame || await findContext([listaSelector, '.list-group'], 20000);
        const esLista = await resultCtx.$(listaSelector);

        if (esLista) {
            await Promise.all([
                resultCtx.click(listaSelector),
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null)
            ]);
        }

        const afterList = await waitForResult(25000);
        if (afterList.type === 'alert') {
            const msg = await afterList.frame.evaluate(() => {
                const el = document.querySelector('.alert-danger');
                return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
            }).catch(() => '');
            if (msg) return { success: false, message: `SUNAT dice: ${msg}` };
        }
        if (afterList.type === 'timeout') {
            throw new Error('SUNAT no devolvió datos (posible bloqueo/captcha o cambio de página).');
        }

        resultCtx = afterList.frame || await findContext(['.list-group'], 20000);
        await resultCtx.waitForSelector('.list-group', { timeout: 20000 });

        const datos = await resultCtx.evaluate(() => {
            const normalize = (s) =>
                (s || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();

            const normalizeLabel = (s) => normalize(s).replace(/:$/g, '').trim();

            const collapseText = (s) =>
                (s || '')
                    .replace(/\r/g, '')
                    .replace(/[ \t]+\n/g, '\n')
                    .replace(/\n{2,}/g, '\n')
                    .replace(/[ \t]{2,}/g, ' ')
                    .trim();

            const asLines = (s) =>
                collapseText(s)
                    .split('\n')
                    .map(x => x.trim())
                    .filter(Boolean);

            const items = Array.from(document.querySelectorAll('.list-group-item'));
            const pairs = [];

            for (const item of items) {
                const headings = Array.from(item.querySelectorAll('h4.list-group-item-heading'));
                for (const h of headings) {
                    const labelRaw = h.innerText || '';
                    const label = normalizeLabel(labelRaw);
                    if (!label) continue;

                    let valueContainer = null;
                    const parent = h.parentElement;
                    const row = h.closest('.row');

                    if (parent && parent.nextElementSibling) {
                        valueContainer = parent.nextElementSibling;
                    } else if (row) {
                        const cols = Array.from(row.children);
                        const idx = cols.findIndex(c => c.contains(h));
                        if (idx >= 0 && cols[idx + 1]) valueContainer = cols[idx + 1];
                    }

                    if (!valueContainer) {
                        valueContainer = h.parentElement?.querySelector('.list-group-item-text') || h.nextElementSibling;
                    }

                    const valueText = collapseText(valueContainer?.innerText || '');
                    if (!valueText) continue;
                    pairs.push({ label, value: valueText });
                }
            }

            const getByIncludes = (needles) => {
                const hits = pairs
                    .filter(p => needles.some(n => p.label.includes(n)))
                    .map(p => p.value)
                    .filter(Boolean);
                if (!hits.length) return '';
                const merged = collapseText(hits.join('\n'));
                return merged;
            };

            const rucFull = getByIncludes(['numero de ruc']);
            const ruc = (rucFull.split('-')[0] || '').trim();
            const razonSocial = (rucFull.split('-').slice(1).join('-') || '').trim();

            const fechaBlock = getByIncludes(['fecha de inscripcion', 'fecha de inicio de actividades']);
            const fechaInscripcion = getByIncludes(['fecha de inscripcion']) || (fechaBlock.match(/fecha de inscripcion\s*:?\s*([0-9/]+)/i)?.[1] || '');
            const fechaInicioActividades = getByIncludes(['fecha de inicio de actividades']) || (fechaBlock.match(/fecha de inicio de actividades\s*:?\s*([0-9/]+)/i)?.[1] || '');

            return {
                ruc,
                razonSocial,
                tipoContribuyente: getByIncludes(['tipo contribuyente']),
                tipoDocumento: getByIncludes(['tipo de documento']),
                nombreComercial: getByIncludes(['nombre comercial']),
                fechaInscripcion,
                fechaInicioActividades,
                estado: getByIncludes(['estado del contribuyente', 'estado']),
                condicion: getByIncludes(['condicion del contribuyente', 'condicion']),
                domicilioFiscal: getByIncludes(['domicilio fiscal']),
                sistemaEmisionComprobante: getByIncludes(['sistema emision de comprobante']),
                actividadComercioExterior: getByIncludes(['actividad comercio exterior']),
                sistemaContabilidad: getByIncludes(['sistema contabilidad']),
                actividadesEconomicas: asLines(getByIncludes(['actividad(es) economica', 'actividad(es) economicas', 'actividades economica', 'actividades economicas'])),
                comprobantesImpresion: asLines(getByIncludes(['comprobantes de pago c/aut. de impresion', 'comprobantes de pago c/aut. de impresión', 'comprobantes de pago'])),
                sistemaEmisionElectronica: asLines(getByIncludes(['sistema de emision electronica', 'sistema de emision electrónica'])),
                emisorElectronicoDesde: getByIncludes(['emisor electronico desde', 'emisor electrónico desde']),
                comprobantesElectronicos: getByIncludes(['comprobantes electronicos', 'comprobantes electrónicos'])
            };
        });

        console.log(`[Scraper] ✅ Finalizado con éxito para: ${id}`);
        return { success: true, data: pruneEmpty(datos) || {} };
    } catch (e) {
        console.error(`[Scraper] Error: ${e.message}`);
        return { success: false, message: "Error en Scraper: " + e.message };
    } finally {
        await browser.close();
    }
}

// 3. Aplicar limiter a las rutas
app.post('/consultar-ruc', limiter, async (req, res) => {
    const raw = req.body?.ruc ?? req.body?.id;
    const ruc = (typeof raw === 'string' || typeof raw === 'number') ? String(raw).trim() : '';
    if (!ruc) return res.status(400).json({ success: false, message: "Campo 'ruc' requerido" });

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
    const raw = req.body?.dni ?? req.body?.id;
    const dni = (typeof raw === 'string' || typeof raw === 'number') ? String(raw).trim() : '';
    if (!dni) return res.status(400).json({ success: false, message: "Campo 'dni' requerido" });

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
