import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, MapPin, Calculator, TrendingUp, AlertTriangle, 
  CheckCircle, Plus, Trash2, Settings, ArrowUpDown, Euro,
  Link, Loader2, Download, Upload, RotateCcw, Cloud, RefreshCw, Edit
} from 'lucide-react';

// --- CONFIGURACIÓN DE ZONAS Y LÍMITES ---
const ZONAS_CONFIG = {
  'Segovia': { limit: 160000, minM2: 60, name: 'Segovia', avgRentPriceM2: 9.5, avgPriceM2: 1700 },
  'Guadalajara': { limit: 160000, minM2: 60, name: 'Guadalajara (Azuqueca, Alovera...)', avgRentPriceM2: 10.5, avgPriceM2: 1850 },
  'Toledo': { limit: 160000, minM2: 60, name: 'Toledo (Buenavista/Polígono)', avgRentPriceM2: 9.0, avgPriceM2: 1550 },
  'Talavera': { limit: 120000, minM2: 0, name: 'Talavera (Hospital, Centro)', avgRentPriceM2: 7.0, avgPriceM2: 1050 }, // No especifica m2 mínimos en reglas
  'Avila': { limit: 120000, minM2: 60, name: 'Ávila', avgRentPriceM2: 7.5, avgPriceM2: 1150 }
};

// --- ALGORITMO DE SCORE INMOBILIARIO ---
const getPropertyScore = (prop, metrics) => {
  const selectedPlanta = PLANTAS.find(p => p.id === prop.planta);
  if (selectedPlanta?.blocked) {
    return { grade: 'F', color: 'bg-red-100 text-red-700 border-red-200', label: 'Bloqueado' };
  }

  let points = 0;

  // 1. Rentabilidad Neta (ROE) - Max 25 pts
  const roe = metrics.rentabilidadNeta;
  if (roe >= 10) points += 25;
  else if (roe >= 8) points += 20;
  else if (roe >= 6) points += 15;
  else if (roe >= 4) points += 10;
  else if (roe >= 2) points += 5;
  else if (roe < 0) points -= 10;

  // 2. Cash Flow Mensual - Max 25 pts
  const cf = metrics.cashFlowMensual;
  if (cf >= 150) points += 25;
  else if (cf >= 100) points += 20;
  else if (cf >= 50) points += 15;
  else if (cf >= 0) points += 10;
  else points -= 15;

  // 3. Comparación de precio de compra por m2 vs media zona - Max 20 pts
  const config = ZONAS_CONFIG[prop.zona];
  if (config && prop.m2 > 0) {
    const pricePerM2 = prop.precio / prop.m2;
    const diffPercent = ((pricePerM2 - config.avgPriceM2) / config.avgPriceM2) * 100;
    
    if (diffPercent <= -15) points += 20;
    else if (diffPercent <= -5) points += 15;
    else if (diffPercent <= 5) points += 10;
    else if (diffPercent <= 15) points += 5;
    else points -= 10;
  } else {
    points += 10;
  }

  // 4. Límite de precio de la zona - Max 15 pts
  if (config) {
    const limitDiff = ((config.limit - prop.precio) / config.limit) * 100;
    if (limitDiff >= 15) points += 15;
    else if (limitDiff >= 0) points += 10;
    else points -= 10;
  } else {
    points += 10;
  }

  // 5. Tamaño mínimo de la zona - Max 15 pts
  if (config && config.minM2 > 0) {
    const sizeDiff = prop.m2 - config.minM2;
    if (sizeDiff >= 15) points += 15;
    else if (sizeDiff >= 0) points += 10;
    else points -= 10;
  } else {
    points += 10;
  }

  let grade = 'C';
  let color = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = 'Aceptable';

  if (points >= 85) {
    grade = 'A+';
    color = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    label = 'Excelente';
  } else if (points >= 70) {
    grade = 'A';
    color = 'bg-green-100 text-green-800 border-green-200';
    label = 'Muy Bueno';
  } else if (points >= 55) {
    grade = 'B';
    color = 'bg-blue-100 text-blue-800 border-blue-200';
    label = 'Bueno';
  } else if (points >= 40) {
    grade = 'C';
    color = 'bg-amber-100 text-amber-800 border-amber-200';
    label = 'Aceptable';
  } else if (points >= 20) {
    grade = 'D';
    color = 'bg-orange-100 text-orange-800 border-orange-200';
    label = 'Riesgoso';
  } else {
    grade = 'E';
    color = 'bg-red-100 text-red-800 border-red-200';
    label = 'No Recomendado';
  }

  return { grade, color, label, points };
};

const PLANTAS = [
  { id: 'Bajo', label: 'Bajo', blocked: true },
  { id: 'Entreplanta', label: 'Entreplanta', blocked: true },
  { id: '1', label: '1º Planta', blocked: false },
  { id: '2', label: '2º Planta', blocked: false },
  { id: '3_con', label: '3º o superior CON ascensor', blocked: false },
  { id: '3_sin', label: '3º o superior SIN ascensor', blocked: true },
];

// --- UTILIDADES DE FORMATO ---
const formatCurrency = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
const formatPercent = (val) => new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);

export default function App() {
  // --- ESTADO GLOBAL ---
  const [properties, setProperties] = useState(() => {
    const saved = localStorage.getItem('appPisos_properties');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved properties:", e);
      }
    }
    // Datos de ejemplo por defecto
    return [
      { id: '1', nombre: 'Piso Hospital Talavera', zona: 'Talavera', planta: '1', m2: 75, precio: 75000, itp: 9, reforma: 8000, alquiler: 550, comunidad: 30, ibi: 180, seguro: 120, tin: 3.5, plazo: 30 },
      { id: '2', nombre: 'Centro Segovia', zona: 'Segovia', planta: '2', m2: 80, precio: 145000, itp: 8, reforma: 0, alquiler: 850, comunidad: 50, ibi: 300, seguro: 200, tin: 3.2, plazo: 25 },
    ];
  });

  // Guardar propiedades en localStorage cada vez que cambien
  useEffect(() => {
    localStorage.setItem('appPisos_properties', JSON.stringify(properties));
  }, [properties]);

  const [globalMortgage, setGlobalMortgage] = useState({
    active: false,
    tin: 4.5,
    plazo: 25
  });

  // --- ESTADOS DE SINCRONIZACIÓN EN LA NUBE ---
  const [syncCode, setSyncCode] = useState(() => localStorage.getItem('appPisos_syncCode') || '');
  const [inputSyncCode, setInputSyncCode] = useState(syncCode);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [cloudMode, setCloudMode] = useState(() => localStorage.getItem('appPisos_cloudMode') || null);
  
  // --- ESTADOS DE NOTIFICACIÓN FLOTANTE ---
  const [notification, setNotification] = useState(null);

  // --- ESTADO DE EDICIÓN ---
  const [editingPropertyId, setEditingPropertyId] = useState(null);

  // Limpiar notificaciones automáticamente
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- CARGA DE DATOS DESDE ENLACE DE SINCRONIZACIÓN (Base64 URL) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    if (dataParam) {
      try {
        // Decodificar Base64 manejando caracteres UTF-8 de forma segura
        const decodedString = decodeURIComponent(escape(atob(dataParam)));
        const parsedData = JSON.parse(decodedString);
        
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          setProperties(parsedData);
          setNotification({
            text: `¡Cartera importada con éxito! Se cargaron ${parsedData.length} inmuebles desde el enlace.`,
            type: 'success'
          });
          
          // Limpiar el parámetro de la URL sin recargar la página
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          setNotification({
            text: 'El enlace de sincronización no contiene datos válidos.',
            type: 'error'
          });
        }
      } catch (err) {
        console.error("Error al decodificar la URL compartida:", err);
        setNotification({
          text: 'Fallo al importar la cartera. El enlace compartido podría estar incompleto o dañado.',
          type: 'error'
        });
      }
    }
  }, []);

  // --- MÉTODOS DE SINCRONIZACIÓN EN LA NUBE ---
  const handleSaveCloud = async (codeToSave) => {
    const cleanCode = codeToSave.replace(/[^a-zA-Z0-9_-]/g, '').trim().toLowerCase();
    if (!cleanCode) {
      setSyncMessage({ text: 'Código de sincronización inválido. Solo letras, números y guiones.', type: 'error' });
      return;
    }

    setIsSyncing(true);
    setSyncMessage({ text: 'Guardando cartera en el servidor...', type: 'info' });

    try {
      const response = await fetch('/api/portfolio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, properties })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setSyncCode(cleanCode);
        setCloudMode(resData.mode);
        localStorage.setItem('appPisos_syncCode', cleanCode);
        localStorage.setItem('appPisos_cloudMode', resData.mode);
        setSyncMessage({ 
          text: `¡Guardado con éxito! Modo: ${resData.mode === 'cloud' ? 'Nube (Vercel KV)' : 'Servidor Local'}`, 
          type: 'success' 
        });
        setTimeout(() => {
          setShowSyncModal(false);
          setSyncMessage(null);
        }, 1500);
      } else {
        setSyncMessage({ text: resData.error || 'Fallo al guardar la cartera.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ text: 'Error de red al conectar con el servidor de sincronización.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadCloud = async (codeToLoad) => {
    const cleanCode = codeToLoad.replace(/[^a-zA-Z0-9_-]/g, '').trim().toLowerCase();
    if (!cleanCode) {
      setSyncMessage({ text: 'Código de sincronización inválido.', type: 'error' });
      return;
    }

    setIsSyncing(true);
    setSyncMessage({ text: 'Cargando cartera desde el servidor...', type: 'info' });

    try {
      const response = await fetch(`/api/portfolio/load/${cleanCode}`);
      const resData = await response.json();

      if (response.ok && resData.success) {
        setProperties(resData.properties);
        setSyncCode(cleanCode);
        setCloudMode(resData.mode);
        localStorage.setItem('appPisos_syncCode', cleanCode);
        localStorage.setItem('appPisos_cloudMode', resData.mode);
        setSyncMessage({ 
          text: `¡Cartera cargada con éxito! Modo: ${resData.mode === 'cloud' ? 'Nube (Vercel KV)' : 'Servidor Local'}`, 
          type: 'success' 
        });
        setTimeout(() => {
          setShowSyncModal(false);
          setSyncMessage(null);
        }, 1500);
      } else {
        setSyncMessage({ text: resData.error || 'Fallo al cargar la cartera.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ text: 'Error de red al conectar con el servidor de sincronización.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const generateRandomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = 'cartera-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInputSyncCode(code);
  };

  // --- MÉTODO PARA GENERAR Y COPIAR ENLACE DE COMPARACIÓN (Base64) ---
  const handleCopyShareLink = () => {
    try {
      // Codificar en Base64 UTF-8 seguro
      const jsonString = JSON.stringify(properties);
      const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?data=${base64Data}`;
      
      // Intentar copiar al portapapeles
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setNotification({
            text: '¡Enlace de sincronización copiado al portapapeles! Envíalo a tu otro dispositivo.',
            type: 'success'
          });
          setShowSyncModal(false);
        })
        .catch(err => {
          console.error("Error al copiar enlace:", err);
          // Fallback manual en caso de que no haya permisos de clipboard
          setSyncMessage({
            text: `No se pudo copiar automáticamente. Copia este enlace manual: ${shareUrl}`,
            type: 'info'
          });
        });
    } catch (err) {
      console.error("Error al generar enlace de compartir:", err);
      setSyncMessage({
        text: 'Error al codificar la cartera de inmuebles.',
        type: 'error'
      });
    }
  };

  // --- MÉTODOS DE COPIA DE SEGURIDAD (IMPORTAR/EXPORTAR) ---
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(properties, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `cartera_pisos_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const resultText = event.target?.result;
        if (typeof resultText !== 'string') return;
        const parsed = JSON.parse(resultText);
        if (Array.isArray(parsed)) {
          const isValid = parsed.every(p => p.id && p.nombre && typeof p.precio === 'number');
          if (isValid) {
            if (confirm('¿Estás seguro de que quieres importar este archivo? Esto reemplazará tu cartera actual.')) {
              setProperties(parsed);
            }
          } else {
            alert('El archivo JSON no tiene un formato de propiedades válido.');
          }
        } else {
          alert('El archivo JSON debe contener una lista de propiedades.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDemo = () => {
    if (confirm('¿Quieres restablecer la cartera de inmuebles de demostración? Esto borrará tus inmuebles actuales.')) {
      setProperties([
        { id: '1', nombre: 'Piso Hospital Talavera', zona: 'Talavera', planta: '1', m2: 75, precio: 75000, itp: 9, reforma: 8000, alquiler: 550, comunidad: 30, ibi: 180, seguro: 120, tin: 3.5, plazo: 30 },
        { id: '2', nombre: 'Centro Segovia', zona: 'Segovia', planta: '2', m2: 80, precio: 145000, itp: 8, reforma: 0, alquiler: 850, comunidad: 50, ibi: 300, seguro: 200, tin: 3.2, plazo: 25 },
      ]);
      setExpandedPropertyId(null);
    }
  };

  const [expandedPropertyId, setExpandedPropertyId] = useState(null);

  const handleUpdatePropertyField = (id, field, value) => {
    setProperties(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const [sortConfig, setSortConfig] = useState({ key: 'roe', direction: 'desc' });

  // --- NUEVO: ESTADO PARA SCRAPING DE IDEALISTA ---
  const [idealistaUrl, setIdealistaUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [showHtmlPaste, setShowHtmlPaste] = useState(false);
  const [rawHtmlText, setRawHtmlText] = useState('');

  // --- ESTADO DEL FORMULARIO ---
  const initialForm = {
    nombre: '', zona: 'Segovia', planta: '1', m2: 65, precio: 100000, itp: 8, reforma: 5000,
    alquiler: 700, comunidad: 40, ibi: 250, seguro: 150, tin: 3.5, plazo: 30
  };
  const [formData, setFormData] = useState(initialForm);
  const [formErrors, setFormErrors] = useState([]);
  const [formWarnings, setFormWarnings] = useState([]);

  // --- NUEVO: LÓGICA DE SIMULACIÓN DE SCRAPING ---
  const handleScrapeUrl = async () => {
    // Validación básica
    if (!idealistaUrl.includes('idealista.com')) {
      alert("Por favor, introduce una URL válida de Idealista");
      return;
    }

    setIsScraping(true);

    try {
      const response = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: idealistaUrl })
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const d = result.data;
        setFormData(prev => ({
          ...prev,
          nombre: d.nombre || prev.nombre,
          precio: d.precio !== null ? Number(d.precio) : prev.precio,
          m2: d.m2 !== null ? Number(d.m2) : prev.m2,
          planta: d.planta || prev.planta,
          zona: d.zona || prev.zona,
          alquiler: d.alquiler !== null ? Number(d.alquiler) : prev.alquiler,
          comunidad: d.comunidad !== null ? Number(d.comunidad) : prev.comunidad,
          ibi: d.ibi !== null ? Number(d.ibi) : prev.ibi,
          reforma: 0 // Opcional: inicializar reforma a 0 o un valor base
        }));
        
        setIdealistaUrl(''); // Limpiamos el input tras el éxito
      } else {
        alert(result.error || 'No se pudieron extraer los datos del inmueble.');
      }
    } catch (error) {
      console.error('Error scraping property:', error);
      alert('Error al conectar con el servidor de extracción. Si estás en local, asegúrate de que el backend (node server.js) está corriendo. Si estás en producción en Vercel, es probable que la función serverless haya superado el límite de tiempo de 10s para levantar el navegador headless.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleParseHtml = async () => {
    if (!rawHtmlText.trim()) {
      alert("Por favor, introduce el código HTML del anuncio");
      return;
    }

    setIsScraping(true);

    try {
      const response = await fetch('/api/parse-html-source', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ html: rawHtmlText })
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const d = result.data;
        setFormData(prev => ({
          ...prev,
          nombre: d.nombre || prev.nombre,
          precio: d.precio !== null ? Number(d.precio) : prev.precio,
          m2: d.m2 !== null ? Number(d.m2) : prev.m2,
          planta: d.planta || prev.planta,
          zona: d.zona || prev.zona,
          alquiler: d.alquiler !== null ? Number(d.alquiler) : prev.alquiler,
          comunidad: d.comunidad !== null ? Number(d.comunidad) : prev.comunidad,
          ibi: d.ibi !== null ? Number(d.ibi) : prev.ibi,
          reforma: 0 // Opcional: inicializar reforma a 0 o un valor base
        }));
        
        setRawHtmlText(''); // Limpiamos tras el éxito
        setShowHtmlPaste(false);
      } else {
        alert(result.error || 'No se pudieron extraer los datos del código HTML.');
      }
    } catch (error) {
      console.error('Error parsing HTML source:', error);
      alert('Error al conectar con el servidor de extracción. Si estás en local, asegúrate de que el backend (node server.js) está corriendo en el puerto 3001.');
    } finally {
      setIsScraping(false);
    }
  };

  // --- LÓGICA DE CÁLCULO FINANCIERO REACTIVO ---
  const calculateMetrics = (prop) => {
    // 1. Gastos y Capital
    const notariaRegistro = 2000;
    const importeITP = prop.precio * (prop.itp / 100);
    const gastosAdquisicion = importeITP + notariaRegistro + prop.reforma;
    const entradaAportada = prop.precio * 0.20; // 20% no financiado
    const capitalAportadoTotal = entradaAportada + gastosAdquisicion;
    const financiacion = prop.precio * 0.80; // 80% financiado

    // 2. Hipoteca (Sistema Francés)
    const activeTin = globalMortgage.active ? globalMortgage.tin : prop.tin;
    const activePlazo = globalMortgage.active ? globalMortgage.plazo : prop.plazo;
    
    const r = (activeTin / 100) / 12; // Tipo mensual
    const n = activePlazo * 12; // Número total de pagos (meses)
    let cuotaMensual = 0;
    
    if (r > 0) {
      const factor = Math.pow(1 + r, n);
      cuotaMensual = financiacion * ((r * factor) / (factor - 1));
    } else {
      cuotaMensual = financiacion / n;
    }

    // 3. Flujo de Caja
    const vacancia = prop.alquiler * 0.05; // 5% de provisión
    const gastosFijosMensuales = prop.comunidad + (prop.ibi / 12) + (prop.seguro / 12);
    const cashFlowMensual = prop.alquiler - (cuotaMensual + gastosFijosMensuales + vacancia);

    // 4. Rentabilidades
    const rentabilidadBruta = ((prop.alquiler * 12) / prop.precio) * 100;
    const rentabilidadNeta = ((cashFlowMensual * 12) / capitalAportadoTotal) * 100;

    return {
      gastosAdquisicion,
      capitalAportadoTotal,
      financiacion,
      cuotaMensual,
      cashFlowMensual,
      rentabilidadBruta,
      rentabilidadNeta
    };
  };

  // Enriquecemos la lista de propiedades con sus métricas calculadas
  const enrichedProperties = useMemo(() => {
    return properties.map(p => ({ ...p, metrics: calculateMetrics(p) }));
  }, [properties, globalMortgage]);

  // Ordenación de la tabla
  const sortedProperties = useMemo(() => {
    let sortableItems = [...enrichedProperties];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key] ?? a.metrics[sortConfig.key];
        let bVal = b[sortConfig.key] ?? b.metrics[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [enrichedProperties, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // --- VALIDACIÓN EN TIEMPO REAL DEL FORMULARIO ---
  useEffect(() => {
    const errors = [];
    const warnings = [];
    
    // Reglas Estrictas
    const selectedPlanta = PLANTAS.find(p => p.id === formData.planta);
    if (selectedPlanta?.blocked) {
      errors.push(`Operación bloqueada: Planta '${selectedPlanta.label}' no cumple los criterios de calidad.`);
    }

    // Reglas de Zona
    const zonaConfig = ZONAS_CONFIG[formData.zona];
    if (zonaConfig) {
      if (formData.precio > zonaConfig.limit) {
        warnings.push(`Precio alto: Supera el límite de ${formatCurrency(zonaConfig.limit)} para ${zonaConfig.name}.`);
      }
      if (zonaConfig.minM2 > 0 && formData.m2 < zonaConfig.minM2) {
        warnings.push(`Espacio reducido: El tamaño es inferior a los ${zonaConfig.minM2}m² recomendados para ${zonaConfig.name}.`);
      }
    }

    setFormErrors(errors);
    setFormWarnings(warnings);
  }, [formData]);

  // --- MANEJADORES DE EVENTOS ---
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleAddProperty = (e) => {
    e.preventDefault();
    if (formErrors.length > 0) return;
    
    if (editingPropertyId) {
      // Modo Edición: Actualizar inmueble existente
      setProperties(prev => prev.map(p => p.id === editingPropertyId ? { ...formData, id: editingPropertyId } : p));
      setNotification({
        text: `Inmueble "${formData.nombre}" actualizado con éxito.`,
        type: 'success'
      });
      setEditingPropertyId(null);
    } else {
      // Modo Creación: Añadir nuevo inmueble
      setProperties(prev => [...prev, { ...formData, id: Date.now().toString() }]);
      setNotification({
        text: `Inmueble "${formData.nombre}" añadido a la cartera.`,
        type: 'success'
      });
    }
    setFormData({ ...initialForm, nombre: '' }); // Reset partial
  };

  const handleEdit = (prop) => {
    setEditingPropertyId(prop.id);
    setFormData({
      nombre: prop.nombre,
      zona: prop.zona,
      planta: prop.planta,
      m2: prop.m2,
      precio: prop.precio,
      itp: prop.itp,
      reforma: prop.reforma,
      alquiler: prop.alquiler,
      comunidad: prop.comunidad,
      ibi: prop.ibi,
      seguro: prop.seguro,
      tin: prop.tin,
      plazo: prop.plazo
    });
    // Scroll suave hasta el formulario (arriba)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingPropertyId(null);
    setFormData({ ...initialForm, nombre: '' });
  };

  const handleDelete = (id) => {
    const propToDelete = properties.find(p => p.id === id);
    setProperties(prev => prev.filter(p => p.id !== id));
    if (editingPropertyId === id) {
      setEditingPropertyId(null);
      setFormData({ ...initialForm, nombre: '' });
    }
    if (propToDelete) {
      setNotification({
        text: `Inmueble "${propToDelete.nombre}" eliminado.`,
        type: 'info'
      });
    }
  };

  // --- RENDERIZADO VISUAL ---
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Building className="h-6 w-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight">REI Analytics Pro</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setInputSyncCode(syncCode);
                setSyncMessage(null);
                setShowSyncModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                syncCode 
                  ? 'border-blue-500/30 bg-blue-950/20 text-blue-400 hover:bg-blue-950/40 hover:border-blue-500/50' 
                  : 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Sincronizar cartera en la nube / otros dispositivos"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>{syncCode ? `Nube: ${syncCode}` : 'Sincronizar'}</span>
            </button>
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Restablecer datos de ejemplo"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restablecer Demo</span>
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-lg transition-colors cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Importar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SECCIÓN LATERAL: FORMULARIO */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingPropertyId ? (
                    <Edit className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Plus className="h-5 w-5 text-blue-600" />
                  )}
                  <h2 className="font-semibold text-lg text-slate-800">
                    {editingPropertyId ? 'Editar Inmueble' : 'Nuevo Inmueble'}
                  </h2>
                </div>
                {formData.nombre && (() => {
                  const tempMetrics = calculateMetrics(formData);
                  const score = getPropertyScore(formData, tempMetrics);
                  return (
                    <div className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${score.color}`} title={`Calidad estimada: ${score.label} (${score.points} pts)`}>
                      Score: {score.grade}
                    </div>
                  );
                })()}
              </div>
              
              <form onSubmit={handleAddProperty} className="p-6 space-y-4">
                
                {/* NUEVO: INPUT MAGICO DE IDEALISTA O PEGAR HTML */}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
                  {!showHtmlPaste ? (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="url"
                            value={idealistaUrl}
                            onChange={(e) => setIdealistaUrl(e.target.value)}
                            placeholder="Pega aquí el enlace de Idealista..."
                            className="w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border bg-white placeholder:text-blue-300"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleScrapeUrl}
                          disabled={isScraping || idealistaUrl.length === 0}
                          className="flex-none flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Autocompletar datos"
                        >
                          {isScraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => setShowHtmlPaste(true)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 underline focus:outline-none"
                        >
                          O pegar código HTML del anuncio
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-blue-700">Código fuente HTML del anuncio:</label>
                      <textarea
                        value={rawHtmlText}
                        onChange={(e) => setRawHtmlText(e.target.value)}
                        placeholder="Pega aquí todo el código HTML (Ver código fuente / Ctrl+U)..."
                        rows={4}
                        className="w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-[11px] font-mono px-3 py-2 border bg-white placeholder:text-blue-300"
                      />
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHtmlPaste(false);
                            setRawHtmlText('');
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700 focus:outline-none"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleParseHtml}
                          disabled={isScraping || !rawHtmlText.trim()}
                          className="flex justify-center items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isScraping ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Extraer Datos
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">o rellena manualmente</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Inputs Básicos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre / Referencia</label>
                  <input required type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border" placeholder="Ej: Piso Centro..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Zona</label>
                    <select name="zona" value={formData.zona} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border bg-white">
                      {Object.keys(ZONAS_CONFIG).map(z => <option key={z} value={z}>{ZONAS_CONFIG[z].name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Planta</label>
                    <select name="planta" value={formData.planta} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border bg-white">
                      {PLANTAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Superficie (m²)</label>
                    <input required type="number" name="m2" value={formData.m2} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Precio Compra (€)</label>
                    <input required type="number" name="precio" value={formData.precio} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    {formData.m2 > 0 && ZONAS_CONFIG[formData.zona] && (() => {
                      const priceM2 = Math.round(formData.precio / formData.m2);
                      const avg = ZONAS_CONFIG[formData.zona].avgPriceM2;
                      const diff = Math.round(((priceM2 - avg) / avg) * 100);
                      const isBelow = diff <= 0;
                      return (
                        <div className={`text-[10px] mt-1 font-semibold leading-tight ${isBelow ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {priceM2} €/m² ({isBelow ? `🟢 ${diff}%` : `🟡 +${diff}%`} vs media {avg} €)
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Gastos Adquisición */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Adquisición</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">ITP (%)</label>
                      <input required type="number" step="0.1" name="itp" value={formData.itp} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Reforma (€)</label>
                      <input required type="number" name="reforma" value={formData.reforma} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    </div>
                  </div>
                </div>

                {/* Ingresos y Gastos Corrientes */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Operativa</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Alquiler Mes (€)</label>
                      <input required type="number" name="alquiler" value={formData.alquiler} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                      {formData.m2 > 0 && ZONAS_CONFIG[formData.zona] && (() => {
                        const suggested = Math.round(formData.m2 * ZONAS_CONFIG[formData.zona].avgRentPriceM2);
                        return (
                          <div className="text-[10px] text-blue-600 mt-1.5 flex justify-between items-center font-medium leading-none">
                            <span>💡 Sugerido: ~{suggested} €</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, alquiler: suggested }))}
                              className="text-[9px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded hover:bg-blue-100 border border-blue-200 transition-colors font-bold uppercase"
                            >
                              Aplicar
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Comunidad/mes</label>
                      <input required type="number" name="comunidad" value={formData.comunidad} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">IBI Anual (€)</label>
                      <input required type="number" name="ibi" value={formData.ibi} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Seguro Anual (€)</label>
                      <input required type="number" name="seguro" value={formData.seguro} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm" />
                    </div>
                  </div>
                </div>

                {/* Financiación (Si no hay global) */}
                <div className={`p-3 rounded-lg border ${globalMortgage.active ? 'bg-slate-200 border-slate-300 opacity-60' : 'bg-slate-50 border-slate-100'} space-y-3`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hipoteca (80%)</h3>
                    {globalMortgage.active && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Simulación Global Activa</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">TIN (%)</label>
                      <input disabled={globalMortgage.active} required type="number" step="0.1" name="tin" value={formData.tin} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm disabled:bg-slate-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Plazo (Años)</label>
                      <select disabled={globalMortgage.active} name="plazo" value={formData.plazo} onChange={handleInputChange} className="w-full rounded-md border-slate-300 shadow-sm px-3 py-2 border text-sm bg-white disabled:bg-slate-100">
                        <option value={15}>15 años</option>
                        <option value={20}>20 años</option>
                        <option value={25}>25 años</option>
                        <option value={30}>30 años</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Validaciones Visuales */}
                {formWarnings.length > 0 && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-md">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mr-2 mt-0.5 shrink-0" />
                      <ul className="text-xs text-amber-700 space-y-1">
                        {formWarnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {formErrors.length > 0 && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-md">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-red-600 mr-2 mt-0.5 shrink-0" />
                      <ul className="text-xs text-red-700 font-medium space-y-1">
                        {formErrors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {editingPropertyId ? (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button 
                      type="button" 
                      onClick={handleCancelEdit}
                      className="flex justify-center items-center py-2 px-3 border border-slate-300 hover:bg-slate-50 rounded-md text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={formErrors.length > 0}
                      className="flex justify-center items-center py-2 px-3 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Guardar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="submit" 
                    disabled={formErrors.length > 0}
                    className="w-full mt-4 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Añadir Inmueble
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* SECCIÓN CENTRAL: TABLA Y DASHBOARD */}
          <div className="flex-1 space-y-6 overflow-hidden">
            
            {/* Panel de Stress Test Hipotecario */}
            <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${globalMortgage.active ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${globalMortgage.active ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">Simulación Global de Hipoteca</h3>
                    <p className="text-xs text-slate-500">Aplica un TIN y Plazo a toda la cartera para ver el impacto en el Cash Flow</p>
                  </div>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={globalMortgage.active} onChange={() => setGlobalMortgage(p => ({...p, active: !p.active}))} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${globalMortgage.active ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${globalMortgage.active ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-slate-700">{globalMortgage.active ? 'Activo' : 'Inactivo'}</span>
                </label>
              </div>

              {globalMortgage.active && (
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/50">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">Tipo de Interés (TIN)</label>
                      <span className="text-sm font-bold text-amber-600">{globalMortgage.tin}%</span>
                    </div>
                    <input type="range" min="1" max="8" step="0.1" value={globalMortgage.tin} onChange={(e) => setGlobalMortgage(p => ({...p, tin: Number(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm font-medium text-slate-700">Plazo Amortización</label>
                      <span className="text-sm font-bold text-amber-600">{globalMortgage.plazo} años</span>
                    </div>
                    <input type="range" min="10" max="40" step="5" value={globalMortgage.plazo} onChange={(e) => setGlobalMortgage(p => ({...p, plazo: Number(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Tabla Dinámica */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Inmueble</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Compra</th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors"
                        onClick={() => requestSort('reforma')}
                      >
                         <div className="flex items-center justify-end gap-1">
                          Reforma <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cap. Aportado</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cuota Hip.</th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors"
                        onClick={() => requestSort('cashFlowMensual')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Cash Flow /mes <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 group transition-colors"
                        onClick={() => requestSort('rentabilidadBruta')}
                      >
                         <div className="flex items-center justify-end gap-1">
                          Rent. Bruta <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider cursor-pointer hover:bg-blue-50 group transition-colors"
                        onClick={() => requestSort('rentabilidadNeta')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          ROE (Neta) <ArrowUpDown className="h-3 w-3 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {sortedProperties.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                          <Building className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                          <p>No hay inmuebles en la cartera.</p>
                          <p className="text-sm">Añade uno desde el formulario lateral.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedProperties.map((prop) => {
                        const m = prop.metrics;
                        const score = getPropertyScore(prop, m);
                        const isExpanded = expandedPropertyId === prop.id;
                        
                        // Determinación de colores del Cash Flow
                        let cfColor = "text-red-600 font-bold bg-red-50";
                        if (m.cashFlowMensual >= 0 && m.cashFlowMensual < 100) cfColor = "text-amber-500 font-bold bg-amber-50";
                        if (m.cashFlowMensual >= 100) cfColor = "text-green-600 font-bold bg-green-50";
 
                        return (
                          <React.Fragment key={prop.id}>
                            <tr 
                              className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/80 border-l-4 border-blue-500 font-medium' : ''}`}
                              onClick={() => setExpandedPropertyId(isExpanded ? null : prop.id)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-semibold text-slate-900">{prop.nombre}</div>
                                  <span className={`inline-block px-1.5 py-0.2 text-[9px] font-bold rounded border ${score.color}`} title={`Calidad: ${score.label} (${score.points} pts)`}>
                                    {score.grade}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" /> {ZONAS_CONFIG[prop.zona]?.name || prop.zona} • {prop.planta}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                                {formatCurrency(prop.precio)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                                {prop.reforma > 0 ? (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-100/50">
                                    {formatCurrency(prop.reforma)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">
                                    Sin reforma
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                                {formatCurrency(m.capitalAportadoTotal)}
                                <div className="text-[10px] text-slate-400">Inc. {formatCurrency(m.gastosAdquisicion)} gastos</div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                                {formatCurrency(m.cuotaMensual)}
                                <div className="text-[10px] text-slate-400">
                                  {globalMortgage.active ? (
                                    <span className="text-amber-600">Sim. {globalMortgage.tin}%</span>
                                  ) : (
                                    <span>{prop.tin}% / {prop.plazo}y</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm ${cfColor}`}>
                                  {formatCurrency(m.cashFlowMensual)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                                {formatPercent(m.rentabilidadBruta)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm whitespace-nowrap">
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  {formatPercent(m.rentabilidadNeta)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <div className="flex justify-center items-center gap-1.5">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(prop);
                                    }}
                                    className={`transition-colors p-1 rounded ${
                                      editingPropertyId === prop.id 
                                        ? 'text-blue-500 bg-blue-50' 
                                        : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
                                    }`}
                                    title="Editar inmueble"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(prop.id);
                                    }}
                                    className="text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-colors p-1 rounded"
                                    title="Eliminar inmueble"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan={9} className="px-6 py-5 border-t border-b border-slate-200/80 shadow-inner">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Desglose de Gastos */}
                                    <div className="space-y-3">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desglose de Costes Iniciales</h4>
                                      <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2 text-xs">
                                        <div className="flex justify-between text-slate-600">
                                          <span>Entrada Aportada (20%):</span>
                                          <span className="font-semibold">{formatCurrency(prop.precio * 0.2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                          <span>Impuesto ITP ({prop.itp}%):</span>
                                          <span className="font-semibold">{formatCurrency(prop.precio * (prop.itp / 100))}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                          <span>Notaría, Registro y Gestoría:</span>
                                          <span className="font-semibold">{formatCurrency(2000)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                          <span>Reforma Estimada:</span>
                                          <span className="font-semibold">{formatCurrency(prop.reforma)}</span>
                                        </div>
                                        <div className="border-t border-slate-100 my-1.5 pt-1.5 flex justify-between font-bold text-slate-800">
                                          <span>Capital Aportado Total:</span>
                                          <span className="text-blue-600">{formatCurrency(m.capitalAportadoTotal)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Sliders Interactivos */}
                                    <div className="space-y-4 lg:col-span-2">
                                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Simulador Rápido (Modificar Inmueble)</h4>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-lg border border-slate-200 p-4">
                                        
                                        {/* Slider 1: Alquiler */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between text-xs font-medium">
                                            <span className="text-slate-600">Alquiler Estimado:</span>
                                            <span className="font-bold text-blue-600">{formatCurrency(prop.alquiler)}/mes</span>
                                          </div>
                                          <input 
                                            type="range" 
                                            min={Math.round(prop.alquiler * 0.5) || 200} 
                                            max={Math.round(prop.alquiler * 1.5) || 1500} 
                                            step={10} 
                                            value={prop.alquiler} 
                                            onChange={(e) => handleUpdatePropertyField(prop.id, 'alquiler', Number(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                          />
                                          {ZONAS_CONFIG[prop.zona] && (
                                            <div className="text-[10px] text-slate-400 flex justify-between">
                                              <span>Mín (50%): {formatCurrency(Math.round(prop.alquiler * 0.5))}</span>
                                              <span>Media Zona: ~{Math.round(prop.m2 * ZONAS_CONFIG[prop.zona].avgRentPriceM2)} €</span>
                                              <span>Máx (150%): {formatCurrency(Math.round(prop.alquiler * 1.5))}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Slider 2: TIN */}
                                        <div className="space-y-2">
                                          <div className="flex justify-between text-xs font-medium">
                                            <span className="text-slate-600">Interés Hipoteca (TIN):</span>
                                            {globalMortgage.active ? (
                                              <span className="font-bold text-amber-600">Fijado Global ({globalMortgage.tin}%)</span>
                                            ) : (
                                              <span className="font-bold text-blue-600">{prop.tin}%</span>
                                            )}
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0.5" 
                                            max="8.0" 
                                            step="0.1" 
                                            disabled={globalMortgage.active}
                                            value={globalMortgage.active ? globalMortgage.tin : prop.tin} 
                                            onChange={(e) => handleUpdatePropertyField(prop.id, 'tin', Number(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                                          />
                                          <div className="text-[10px] text-slate-400 flex justify-between">
                                            <span>Mín: 0.5%</span>
                                            <span>Plazo: {prop.plazo} años</span>
                                            <span>Máx: 8%</span>
                                          </div>
                                        </div>

                                      </div>

                                      {/* Métricas rápidas de impacto */}
                                      <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                                          <span className="block text-[9px] font-bold text-slate-400 uppercase">Cash Flow</span>
                                          <span className={`text-xs font-bold ${m.cashFlowMensual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(m.cashFlowMensual)}
                                          </span>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                                          <span className="block text-[9px] font-bold text-slate-400 uppercase">Rent. Bruta</span>
                                          <span className="text-xs font-bold text-slate-700">
                                            {formatPercent(m.rentabilidadBruta)}
                                          </span>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                                          <span className="block text-[9px] font-bold text-slate-400 uppercase">ROE (Neta)</span>
                                          <span className="text-xs font-bold text-blue-600 font-semibold bg-blue-50/50 rounded px-1">
                                            {formatPercent(m.rentabilidadNeta)}
                                          </span>
                                        </div>
                                      </div>

                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen Global Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4">
                    <Building className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Inmuebles</p>
                    <p className="text-2xl font-bold text-slate-800">{properties.length}</p>
                  </div>
               </div>
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center">
                  <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                    <Euro className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Capital Total Aportado</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {formatCurrency(enrichedProperties.reduce((acc, curr) => acc + curr.metrics.capitalAportadoTotal, 0))}
                    </p>
                  </div>
               </div>
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center">
                  <div className="p-3 rounded-full bg-amber-100 text-amber-600 mr-4">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Reformas</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {formatCurrency(properties.reduce((acc, curr) => acc + (curr.reforma || 0), 0))}
                    </p>
                  </div>
               </div>
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center">
                  <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Cash Flow Mensual Neto</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {formatCurrency(enrichedProperties.reduce((acc, curr) => acc + curr.metrics.cashFlowMensual, 0))}
                    </p>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </main>

      {/* NOTIFICACIÓN FLOTANTE */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 text-slate-100 flex items-start gap-3 animate-fade-in">
          <div className="p-1 rounded-full bg-blue-950/50 text-blue-400 mt-0.5 shrink-0">
            {notification.type === 'error' ? '⚠️' : '✅'}
          </div>
          <div className="flex-1 space-y-0.5">
            <h4 className="font-semibold text-sm">Sincronización</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{notification.text}</p>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-300 text-sm font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* MODAL DE SINCRONIZACIÓN */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 animate-scale-up">
            <div className="bg-slate-800/50 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-400 animate-pulse" />
                <h3 className="font-semibold text-lg text-slate-100">Sincronización de Cartera</h3>
              </div>
              <button 
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* SECCIÓN A: ENLACE COMPARTIDO (100% GRATIS) */}
              <div className="space-y-3 bg-slate-850/30 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-blue-400">
                  <Link className="h-4 w-4" />
                  <h4 className="font-semibold text-sm">Opción A: Compartir por Enlace (Gratis)</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Genera un enlace especial con todos tus inmuebles codificados. Envíatelo a tu móvil o ábrelo en otro navegador para importar tu cartera al instante.
                </p>
                <button
                  onClick={handleCopyShareLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-md font-bold"
                >
                  <Link className="h-4 w-4" />
                  Copiar Enlace de Sincronización
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-650 text-[10px] font-bold tracking-wider uppercase">O bien</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* SECCIÓN B: NUBE AUTOMÁTICA (VERCEL KV) */}
              <div className="space-y-3 border border-slate-800/40 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400">
                  <Cloud className="h-4 w-4" />
                  <h4 className="font-semibold text-sm text-slate-300">Opción B: Sincronización Nube (Vercel KV)</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Requiere configurar Vercel KV en el panel del proyecto. Permite guardar y cargar carteras en tiempo real mediante un código de texto.
                </p>

                {syncMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                    syncMessage.type === 'error' ? 'bg-red-950/30 text-red-300 border-red-900/50' :
                    syncMessage.type === 'success' ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/50' :
                    'bg-blue-950/30 text-blue-300 border-blue-900/50'
                  }`}>
                    <div className="font-semibold shrink-0">
                      {syncMessage.type === 'error' ? '⚠️' : syncMessage.type === 'success' ? '✅' : 'ℹ️'}
                    </div>
                    <div>{syncMessage.text}</div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputSyncCode}
                      onChange={(e) => setInputSyncCode(e.target.value)}
                      placeholder="Ej. mi-cartera-secreta"
                      className="flex-1 px-3 py-1.5 border border-slate-800 rounded-lg text-sm bg-slate-950 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-slate-650"
                      disabled={isSyncing}
                    />
                    <button
                      onClick={generateRandomCode}
                      className="px-2.5 py-1.5 border border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      disabled={isSyncing}
                    >
                      Generar
                    </button>
                  </div>
                </div>

                {syncCode && (
                  <div className="text-[10px] text-slate-500 bg-slate-950/40 p-2 rounded border border-slate-850/50 flex justify-between">
                    <span>Activo: <strong className="text-slate-400">{syncCode}</strong></span>
                    <span>Modo: <strong className="text-slate-400">{cloudMode === 'cloud' ? '☁️ Vercel KV' : '💾 Servidor Local'}</strong></span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleLoadCloud(inputSyncCode)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-850 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    disabled={isSyncing || !inputSyncCode.trim()}
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : <RefreshCw className="h-3.5 w-3.5 text-slate-400" />}
                    Cargar de Nube
                  </button>
                  
                  <button
                    onClick={() => handleSaveCloud(inputSyncCode)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                    disabled={isSyncing || !inputSyncCode.trim()}
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : <Cloud className="h-3.5 w-3.5 text-slate-400" />}
                    Guardar en Nube
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}