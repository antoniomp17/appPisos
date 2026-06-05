const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const playwright = require('playwright-core');
const provinciasConfig = require('./data/provincias.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS para permitir peticiones desde el frontend de React
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Servir los archivos estáticos del frontend compilado (React)
app.use(express.static(path.join(__dirname, 'dist')));

// Helper para parsear el HTML de Idealista
function parseIdealistaHTML(html, url = '') {
  const $ = cheerio.load(html);
  
  // 1. Extraer nombre (Título del anuncio)
  let nombre = $('h1.item-title').text().trim() || 
               $('.main-info__title-main').text().trim() || 
               $('title').text().trim();
  
  // Limpiar título de saltos de línea o espacios redundantes
  nombre = nombre.replace(/\s+/g, ' ');

  // 2. Extraer precio (usando .first() para evitar concatenar múltiples coincidencias)
  let precioText = $('.info-data-price .txt-bold').first().text().trim() ||
                   $('.info-data-price').first().text().trim() || 
                   $('.item-price').first().text().trim() || 
                   $('.price-value').first().text().trim() || '';
  
  let precio = null;
  let priceMatch = precioText.replace(/\./g, '').match(/(\d+)/);
  if (priceMatch) {
    precio = parseInt(priceMatch[1], 10);
  }

  // Obtenemos la descripción general
  let description = $('#descriptionText, .description-content, .adComments, .comment, .commentsContainer, .adCommentsLanguage').text() || '';
  
  // 3. Extraer metros cuadrados (m2)
  let m2 = null;
  // Buscamos primero en el listado de características específicas para evitar m2 de estadísticas o precios por m2
  $('.details-property_features li, .info-features span, .info-features-features').each((i, el) => {
    // Si contiene sub-elementos div, no es una hoja final
    if ($(el).find('div').length > 0) return;
    
    let text = $(el).text().toLowerCase().trim();
    
    // Ignorar si contiene precio por metro cuadrado (€/m2, €/m², /m2, /m²)
    if (text.includes('€/m') || text.includes('/m²') || text.includes('/m2')) {
      return; 
    }

    if (text.includes('m²') || text.includes('m2') || text.includes('metros cuadrados')) {
      let m2Match = text.match(/(\d+)\s*(?:m²|m2|metros)/);
      if (m2Match) {
        m2 = parseInt(m2Match[1], 10);
        return false; // romper bucle
      }
    }
  });

  // Si no se encontró en las características, buscar en elementos de texto individuales de la página
  if (!m2) {
    $('span, p, li').each((i, el) => {
      if ($(el).find('p, li, div, ul, ol').length > 0) return; // solo elementos hoja para no duplicar
      
      let text = $(el).text().toLowerCase().trim();
      if (text.includes('€/m') || text.includes('/m²') || text.includes('/m2')) {
        return;
      }
      if (text.includes('m²') || text.includes('m2')) {
        let m2Match = text.match(/(\d+)\s*(?:m²|m2)/);
        if (m2Match) {
          m2 = parseInt(m2Match[1], 10);
          return false;
        }
      }
    });
  }

  // 4. Extraer comunidad e IBI
  let comunidad = null;
  let ibi = null;

  // Buscar primero en la lista de características para ver si están explícitos
  $('.details-property_features li, .info-features span, .price-features__container p, .price-features__container span, .price-features__container li').each((i, el) => {
    if ($(el).find('div').length > 0) return;
    let text = $(el).text().toLowerCase().trim();
    
    if (text.includes('comunidad') && (text.includes('€') || text.includes('euro'))) {
      let match = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:€|euro)/);
      if (match) {
        comunidad = Math.round(parseFloat(match[1].replace('.', '').replace(',', '.')));
      }
    }
    if ((text.includes('ibi') || text.includes('contribucion') || text.includes('contribución')) && (text.includes('€') || text.includes('euro'))) {
      let match = text.match(/(\d+(?:[\.,]\d+)?)\s*(?:€|euro)/);
      if (match) {
        ibi = Math.round(parseFloat(match[1].replace('.', '').replace(',', '.')));
      }
    }
  });

  // Si no se encontraron, buscar en el texto de la descripción
  if (comunidad === null) {
    let comunidadMatch = description.match(/(?:comunidad|gastos.*?comunidad).*?(\d+(?:[\.,]\d+)?)\s*(?:€|euros)/i) || 
                         description.match(/(\d+(?:[\.,]\d+)?)\s*(?:€|euros).*?(?:comunidad|gastos.*?comunidad)/i);
    if (comunidadMatch) {
      comunidad = Math.round(parseFloat(comunidadMatch[1].replace('.', '').replace(',', '.')));
    }
  }

  if (ibi === null) {
    let ibiMatch = description.match(/(?:ibi|contribucion|contribución).*?(\d+(?:[\.,]\d+)?)\s*(?:€|euros)/i) || 
                   description.match(/(\d+(?:[\.,]\d+)?)\s*(?:€|euros).*?(?:ibi|contribucion|contribución)/i);
    if (ibiMatch) {
      ibi = Math.round(parseFloat(ibiMatch[1].replace('.', '').replace(',', '.')));
    }
  }

  // 5. Extraer y mapear planta + ascensor
  let plantaRaw = '';
  let tieneAscensor = null; // null = no especificado, true = con, false = sin

  // Buscar en características específicas (hojas del árbol HTML)
  $('.details-property_features li, .info-features span, .info-features-features').each((i, el) => {
    if ($(el).find('div').length > 0) return;
    
    let text = $(el).text().toLowerCase().trim();
    
    if (text.includes('ascensor')) {
      if (text.includes('con ascensor') || text.includes('tiene ascensor') || text.includes('c/asc.') || text.includes('con asc')) {
        tieneAscensor = true;
      } else if (text.includes('sin ascensor') || text.includes('no tiene ascensor') || text.includes('s/asc.') || text.includes('sin asc')) {
        tieneAscensor = false;
      }
    }
    
    if (text.includes('planta') || text.includes('bajo') || text.includes('entreplanta') || text.includes('sótano') || text.includes('semisótano')) {
      if (text.length < 100) {
        plantaRaw += ' ' + text;
      }
    }
  });

  // Si no se indica explícitamente el ascensor en la lista de características, buscar en la descripción
  if (tieneAscensor === null) {
    let descLower = description.toLowerCase();
    if (descLower.includes('con ascensor') || descLower.includes('tiene ascensor') || descLower.includes('c/asc.')) {
      tieneAscensor = true;
    } else if (descLower.includes('sin ascensor') || descLower.includes('no tiene ascensor') || descLower.includes('s/asc.')) {
      tieneAscensor = false;
    }
  }

  // Mapeo estricto del campo planta
  let planta = "1"; // Valor por defecto especificado
  plantaRaw = plantaRaw.toLowerCase();

  if (plantaRaw.includes('bajo') || plantaRaw.includes('planta baja') || plantaRaw.includes('piso bajo')) {
    planta = "Bajo";
  } else if (plantaRaw.includes('entreplanta')) {
    planta = "Entreplanta";
  } else {
    // Extraer número de piso
    // Ej: "planta 2ª", "2º piso", "planta 3", "2ª planta", "3º exterior"
    let floorMatch = plantaRaw.match(/(\d+)(?:ª|º|[ \t]*ª|[ \t]*º|[ \t]*planta|planta)/) || 
                     plantaRaw.match(/planta[ \t]*(\d+)/) ||
                     plantaRaw.match(/(\d+)\s*(?:ª|º)/);
    if (floorMatch) {
      let num = parseInt(floorMatch[1], 10);
      if (num === 1) {
        planta = "1";
      } else if (num === 2) {
        planta = "2";
      } else if (num >= 3) {
        if (tieneAscensor === true) {
          planta = "3_con";
        } else if (tieneAscensor === false) {
          planta = "3_sin";
        } else {
          planta = "3_con"; // Valor por defecto para 3º o superior si no se indica lo contrario
        }
      }
    }
  }

  // Helper para normalizar texto para comparación sin acentos
  const normalizeText = (str) => {
    if (!str) return '';
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Elimina marcas diacríticas
  };

  // Detectar la ciudad/zona buscando palabras clave en el título y migas de pan primero (más específico)
  const breadcrumbsText = $('.breadcrumb-navigation, #breadcrumb, .main-info__title-minor, .breadcrumb-navigation ul li').text();
  const titleText = nombre || '';
  const mainLocationText = `${titleText} ${breadcrumbsText}`;

  const detectZona = (text) => {
    const normalizedText = normalizeText(text);
    if (!normalizedText) return null;

    // Buscar en el config de provincias
    for (const [key, config] of Object.entries(provinciasConfig)) {
      // 1. Probar con el nombre de la provincia normalizado
      const normalizedName = normalizeText(config.name);
      if (normalizedText.includes(normalizedName)) {
        return key;
      }

      // 2. Probar con la clave normalizada (ej: "avila", "segovia")
      const normalizedKey = normalizeText(key);
      if (normalizedText.includes(normalizedKey)) {
        return key;
      }

      // 3. Probar con palabras clave personalizadas si existen
      if (config.keywords && Array.isArray(config.keywords)) {
        for (const keyword of config.keywords) {
          const normalizedKeyword = normalizeText(keyword);
          if (normalizedText.includes(normalizedKeyword)) {
            return key;
          }
        }
      }
    }
    return null;
  };

  let zona = detectZona(mainLocationText);

  // Si no se detectó en el título o migas de pan, buscar en la descripción
  if (!zona) {
    const descText = description || '';
    zona = detectZona(descText);
  }

  return {
    nombre: nombre || 'Piso en calle Falsa 123',
    precio: precio || 125000,
    m2: m2 || 85,
    planta: planta,
    zona: zona,
    alquiler: null,
    comunidad: comunidad,
    ibi: ibi
  };
}

// Función para descargar HTML de forma simulada con un navegador real (Playwright)
async function scrapeWithPlaywright(url) {
  let browser;
  try {
    const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;
    
    if (isVercel) {
      console.log(`[Playwright] Entorno Vercel detectado. Cargando @sparticuz/chromium...`);
      const chromiumModule = await import('@sparticuz/chromium');
      const chromium = chromiumModule.default || chromiumModule;
      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      console.log(`[Playwright] Entorno Local detectado. Buscando Google Chrome/Edge del sistema...`);
      try {
        browser = await playwright.chromium.launch({
          channel: 'chrome', // Abre Chrome local del usuario
          headless: true
        });
      } catch (chromeErr) {
        console.warn(`[Playwright] No se detectó Chrome local, intentando con MS Edge...`);
        browser = await playwright.chromium.launch({
          channel: 'msedge', // Abre Edge en Windows
          headless: true
        });
      }
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 805 },
      deviceScaleFactor: 1,
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid'
    });

    const page = await context.newPage();
    
    // Camuflar automatización
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`[Playwright] Navegando a: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Esperar a que cargue el contenido y simular interacción humana básica
    await page.waitForTimeout(2000);

    const title = await page.title();
    console.log(`[Playwright] Título de página cargada: "${title}"`);

    const html = await page.content();
    const htmlLower = html.toLowerCase();

    // Detección de bloqueos de Cloudflare por título o contenido del HTML
    if (
      title === 'idealista.com' ||
      title === 'idealista' ||
      title.includes('Attention Required') ||
      title.includes('Cloudflare') ||
      title.includes('Just a moment') ||
      htmlLower.includes('challenge-form') ||
      htmlLower.includes('cf-challenge') ||
      htmlLower.includes('cf-browser-verification') ||
      htmlLower.includes('turnstile') ||
      htmlLower.includes('captcha')
    ) {
      throw new Error('Bloqueo Cloudflare CAPTCHA detectado. El navegador automatizado fue interceptado.');
    }

    await browser.close();
    return html;
  } catch (err) {
    console.error(`[Playwright Error] Fallo al obtener HTML:`, err.message);
    if (browser) {
      await browser.close();
    }
    throw err;
  }
}

// (La página de inicio y estáticos se sirven de forma automática desde la carpeta 'dist')

// Ruta POST principal para extraer los datos del inmueble
app.post('/api/scrape-property', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'La propiedad "url" es requerida.'
    });
  }

  console.log(`[HTTP] Petición recibida para extraer URL: ${url}`);

  try {
    let html = '';
    let methodUsed = '';

    // Verificar si el usuario ha configurado una API de scraping premium (ej: ScrapingBee) en sus variables de entorno
    const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;

    if (scrapingBeeKey) {
      console.log(`[ScrapingBee] Intentando obtener contenido mediante ScrapingBee API...`);
      const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(url)}&premium_proxy=true&country_code=es`;
      const response = await axios.get(scrapingBeeUrl, { timeout: 15000 });
      html = response.data;
      methodUsed = 'ScrapingBee';
    } else {
      // Usar Playwright como el navegador simulado local
      console.log(`[Scraping] Iniciando descarga con Playwright...`);
      html = await scrapeWithPlaywright(url);
      methodUsed = 'Playwright';
    }

    const data = parseIdealistaHTML(html, url);

    // Si los datos esenciales coinciden con los fallbacks por defecto y el título es genérico, significa que el parseo falló (ej: bloqueado por verificación no capturada)
    if (data.precio === 125000 && data.m2 === 85 && data.nombre.toLowerCase().includes('idealista')) {
      throw new Error('La página no contiene la información real del inmueble. Es probable que se haya servido una pantalla de verificación.');
    }

    console.log(`[Scraping Exitoso] Datos extraídos con ${methodUsed}.`);

    return res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error(`[Error] No se pudieron extraer datos de la URL de Idealista:`, error.message);

    let friendlyError = 'La extracción automática directa ha sido bloqueada por la protección anti-bot de Idealista (Cloudflare).';
    if (error.message.includes('msedge') || error.message.includes('chrome') || error.message.includes('executablePath')) {
      friendlyError = 'No se pudo iniciar el navegador local en el servidor. Asegúrate de tener Google Chrome o Microsoft Edge instalado.';
    } else if (error.message.includes('CAPTCHA') || error.message.includes('interceptado')) {
      friendlyError = 'La navegación simulada ha sido interceptada por el CAPTCHA de Idealista.';
    }

    return res.status(502).json({
      success: false,
      error: `${friendlyError} Por favor, usa la opción "O pegar código HTML del anuncio" copiando todo el código fuente del anuncio (Ctrl+U en la página de Idealista).`
    });
  }
});

// Nueva ruta POST para extraer datos a partir del código HTML copiado por el usuario
app.post('/api/parse-html-source', (req, res) => {
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({
      success: false,
      error: 'La propiedad "html" conteniendo el código fuente es requerida.'
    });
  }

  console.log(`[HTTP] Petición recibida para parsear código HTML copiado manual (Tamaño: ${Math.round(html.length / 1024)} KB)`);

  try {
    const data = parseIdealistaHTML(html);
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(`[Error] Fallo al parsear el código HTML proporcionado:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'No se pudo parsear el código HTML proporcionado. Asegúrate de copiar el código fuente completo del anuncio.'
    });
  }
});

// Directorio para guardar datos locales
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Endpoint para guardar portafolio
app.post('/api/portfolio/save', async (req, res) => {
  const { code, properties } = req.body;

  if (!code || !properties) {
    return res.status(400).json({
      success: false,
      error: 'El código y la lista de propiedades son requeridos.'
    });
  }

  const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '').trim().toLowerCase();
  if (!safeCode) {
    return res.status(400).json({
      success: false,
      error: 'Código de sincronización inválido. Usa solo letras, números, guiones y barras bajas.'
    });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (KV_URL && KV_TOKEN) {
    // Entorno Vercel con KV activo
    console.log(`[Sync] Guardando portafolio "${safeCode}" en Vercel KV...`);
    try {
      await axios.post(
        KV_URL,
        ["SET", `portfolio:${safeCode}`, JSON.stringify(properties)],
        {
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return res.json({
        success: true,
        mode: 'cloud',
        message: 'Cartera guardada con éxito en la nube.'
      });
    } catch (error) {
      console.error(`[Sync Error] Fallo al guardar en Vercel KV:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al conectar con la base de datos en la nube de Vercel.'
      });
    }
  } else {
    // Entorno Local u offline (Archivos locales)
    console.log(`[Sync] Guardando portafolio "${safeCode}" en archivo local...`);
    try {
      const filePath = path.join(DATA_DIR, `portfolio_${safeCode}.json`);
      fs.writeFileSync(filePath, JSON.stringify(properties, null, 2));
      return res.json({
        success: true,
        mode: 'local',
        message: 'Cartera guardada localmente en el servidor.'
      });
    } catch (error) {
      console.error(`[Sync Error] Fallo al guardar en archivo local:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al escribir el archivo de datos local en el servidor.'
      });
    }
  }
});

// Endpoint para cargar portafolio
app.get('/api/portfolio/load/:code', async (req, res) => {
  const { code } = req.params;
  const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '').trim().toLowerCase();

  if (!safeCode) {
    return res.status(400).json({
      success: false,
      error: 'Código de sincronización inválido.'
    });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (KV_URL && KV_TOKEN) {
    // Entorno Vercel con KV activo
    console.log(`[Sync] Cargando portafolio "${safeCode}" desde Vercel KV...`);
    try {
      const response = await axios.post(
        KV_URL,
        ["GET", `portfolio:${safeCode}`],
        {
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const result = response.data.result;
      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró ninguna cartera guardada con ese código.'
        });
      }

      return res.json({
        success: true,
        mode: 'cloud',
        properties: JSON.parse(result)
      });
    } catch (error) {
      console.error(`[Sync Error] Fallo al cargar de Vercel KV:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al conectar con la base de datos en la nube de Vercel.'
      });
    }
  } else {
    // Entorno Local u offline (Archivos locales)
    console.log(`[Sync] Cargando portafolio "${safeCode}" desde archivo local...`);
    const filePath = path.join(DATA_DIR, `portfolio_${safeCode}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró ninguna cartera local con ese código en el servidor.'
      });
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return res.json({
        success: true,
        mode: 'local',
        properties: JSON.parse(data)
      });
    } catch (error) {
      console.error(`[Sync Error] Fallo al leer archivo local:`, error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al leer el archivo de datos local del servidor.'
      });
    }
  }
});

// Ruta comodín para redirigir cualquier petición de página al frontend de React (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Servidor API corriendo en: http://localhost:${PORT}`);
    console.log(`Ruta activa: POST http://localhost:${PORT}/api/scrape-property`);
    console.log(`==================================================`);
  });
}

module.exports = app;
