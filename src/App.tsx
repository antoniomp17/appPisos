import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, MapPin, Calculator, TrendingUp, AlertTriangle, 
  CheckCircle, Plus, Trash2, Settings, ArrowUpDown, Euro,
  Link, Loader2
} from 'lucide-react';

// --- CONFIGURACIÓN DE ZONAS Y LÍMITES ---
const ZONAS_CONFIG = {
  'Segovia': { limit: 160000, minM2: 60, name: 'Segovia' },
  'Guadalajara': { limit: 160000, minM2: 60, name: 'Guadalajara (Azuqueca, Alovera...)' },
  'Toledo': { limit: 160000, minM2: 60, name: 'Toledo (Buenavista/Polígono)' },
  'Talavera': { limit: 120000, minM2: 0, name: 'Talavera (Hospital, Centro)' }, // No especifica m2 mínimos en reglas
  'Avila': { limit: 120000, minM2: 60, name: 'Ávila' }
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
  const [properties, setProperties] = useState([
    // Datos de ejemplo
    { id: '1', nombre: 'Piso Hospital Talavera', zona: 'Talavera', planta: '1', m2: 75, precio: 75000, itp: 9, reforma: 8000, alquiler: 550, comunidad: 30, ibi: 180, seguro: 120, tin: 3.5, plazo: 30 },
    { id: '2', nombre: 'Centro Segovia', zona: 'Segovia', planta: '2', m2: 80, precio: 145000, itp: 8, reforma: 0, alquiler: 850, comunidad: 50, ibi: 300, seguro: 200, tin: 3.2, plazo: 25 },
  ]);

  const [globalMortgage, setGlobalMortgage] = useState({
    active: false,
    tin: 4.5,
    plazo: 25
  });

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
      alert('Error al conectar con la API de extracción. Asegúrate de que el servidor local está corriendo en http://localhost:3001');
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
      alert('Error al conectar con la API de extracción. Asegúrate de que el servidor local está corriendo en http://localhost:3001');
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
    
    setProperties(prev => [...prev, { ...formData, id: Date.now().toString() }]);
    setFormData({ ...initialForm, nombre: '' }); // Reset partial
  };

  const handleDelete = (id) => {
    setProperties(prev => prev.filter(p => p.id !== id));
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
          <div className="text-sm text-slate-400">Dashboard Inmobiliario</div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SECCIÓN LATERAL: FORMULARIO */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden sticky top-24">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-lg text-slate-800">Nuevo Inmueble</h2>
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

                <button 
                  type="submit" 
                  disabled={formErrors.length > 0}
                  className="w-full mt-4 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" /> Añadir Inmueble
                </button>
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
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                          <Building className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                          <p>No hay inmuebles en la cartera.</p>
                          <p className="text-sm">Añade uno desde el formulario lateral.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedProperties.map((prop) => {
                        const m = prop.metrics;
                        
                        // Determinación de colores del Cash Flow
                        let cfColor = "text-red-600 font-bold bg-red-50";
                        if (m.cashFlowMensual >= 0 && m.cashFlowMensual < 100) cfColor = "text-amber-500 font-bold bg-amber-50";
                        if (m.cashFlowMensual >= 100) cfColor = "text-green-600 font-bold bg-green-50";

                        return (
                          <tr key={prop.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-slate-900">{prop.nombre}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {ZONAS_CONFIG[prop.zona]?.name || prop.zona} • {prop.planta}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-700 whitespace-nowrap">
                              {formatCurrency(prop.precio)}
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
                              <button 
                                onClick={() => handleDelete(prop.id)}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                title="Eliminar inmueble"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen Global Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
    </div>
  );
}