/**
 * Función que se ejecuta DENTRO del navegador (vía `frame.evaluate`).
 *
 * Debe ser autocontenida: no puede referenciar variables del módulo porque
 * Puppeteer serializa su código fuente y la evalúa en la página.
 *
 * Estrategia: en lugar de depender del orden de las filas, se leen los pares
 * etiqueta/valor y se buscan por texto normalizado. Así el scraper sobrevive
 * a cambios de maquetación de SUNAT.
 *
 * @returns {Object} Datos crudos del contribuyente.
 */
function collectTaxpayerData() {
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
            .map((x) => x.trim())
            .filter(Boolean);

    const items = Array.from(document.querySelectorAll('.list-group-item'));
    const pairs = [];

    for (const item of items) {
        const headings = Array.from(item.querySelectorAll('h4.list-group-item-heading'));
        for (const heading of headings) {
            const label = normalizeLabel(heading.innerText || '');
            if (!label) continue;

            let valueContainer = null;
            const parent = heading.parentElement;
            const row = heading.closest('.row');

            if (parent && parent.nextElementSibling) {
                valueContainer = parent.nextElementSibling;
            } else if (row) {
                const cols = Array.from(row.children);
                const index = cols.findIndex((col) => col.contains(heading));
                if (index >= 0 && cols[index + 1]) valueContainer = cols[index + 1];
            }

            if (!valueContainer) {
                valueContainer =
                    heading.parentElement?.querySelector('.list-group-item-text') ||
                    heading.nextElementSibling;
            }

            const valueText = collapseText(valueContainer?.innerText || '');
            if (!valueText) continue;
            pairs.push({ label, value: valueText });
        }
    }

    const getByIncludes = (needles) => {
        const hits = pairs
            .filter((pair) => needles.some((needle) => pair.label.includes(needle)))
            .map((pair) => pair.value)
            .filter(Boolean);
        if (!hits.length) return '';
        return collapseText(hits.join('\n'));
    };

    const rucFull = getByIncludes(['numero de ruc']);
    const ruc = (rucFull.split('-')[0] || '').trim();
    const razonSocial = (rucFull.split('-').slice(1).join('-') || '').trim();

    const fechaBlock = getByIncludes(['fecha de inscripcion', 'fecha de inicio de actividades']);
    const fechaInscripcion =
        getByIncludes(['fecha de inscripcion']) ||
        fechaBlock.match(/fecha de inscripcion\s*:?\s*([0-9/]+)/i)?.[1] ||
        '';
    const fechaInicioActividades =
        getByIncludes(['fecha de inicio de actividades']) ||
        fechaBlock.match(/fecha de inicio de actividades\s*:?\s*([0-9/]+)/i)?.[1] ||
        '';

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
        actividadesEconomicas: asLines(
            getByIncludes([
                'actividad(es) economica',
                'actividad(es) economicas',
                'actividades economica',
                'actividades economicas'
            ])
        ),
        comprobantesImpresion: asLines(
            getByIncludes([
                'comprobantes de pago c/aut. de impresion',
                'comprobantes de pago c/aut. de impresión',
                'comprobantes de pago'
            ])
        ),
        sistemaEmisionElectronica: asLines(
            getByIncludes(['sistema de emision electronica', 'sistema de emision electrónica'])
        ),
        emisorElectronicoDesde: getByIncludes(['emisor electronico desde', 'emisor electrónico desde']),
        comprobantesElectronicos: getByIncludes(['comprobantes electronicos', 'comprobantes electrónicos'])
    };
}

module.exports = { collectTaxpayerData };
