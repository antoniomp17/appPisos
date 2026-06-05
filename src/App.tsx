import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, MapPin, Calculator, TrendingUp, AlertTriangle, 
  CheckCircle, Plus, Trash2, Settings, ArrowUpDown, Euro,
  Link, Loader2, Download, Upload, RotateCcw, Cloud, RefreshCw, Edit, Sparkles
} from 'lucide-react';

// --- BASE DE DATOS DE PROVINCIAS BASE ---
import provinciasDefault from '../data/provincias.json';

// --- ALGORITMO DE SCORE INMOBILIARIO ---
const getPropertyScore = (prop, metrics, zonesConfig) => {
  const selectedPlanta = PLANTAS.find(p => p.id === prop.planta);
  if (selectedPlanta?.blocked) {
    return { grade: 'F', color: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Bloqueado' };
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
  const config = zonesConfig[prop.zona];
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
  let color = 'bg-slate-800/80 text-slate-300 border-slate-700/80';
  let label = 'Aceptable';

  if (points >= 85) {
    grade = 'A+';
    color = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-glow-emerald';
    label = 'Excelente';
  } else if (points >= 70) {
    grade = 'A';
    color = 'bg-teal-500/10 text-teal-300 border-teal-500/30';
    label = 'Muy Bueno';
  } else if (points >= 55) {
    grade = 'B';
    color = 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-glow-blue';
    label = 'Bueno';
  } else if (points >= 40) {
    grade = 'C';
    color = 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-glow-amber';
    label = 'Aceptable';
  } else if (points >= 20) {
    grade = 'D';
    color = 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    label = 'Riesgoso';
  } else {
    grade = 'E';
    color = 'bg-red-500/10 text-red-450 border-red-500/30';
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

  // --- ESTADO DE ZONAS PERSONALIZADAS Y OVERRIDES ---
  const [customZones, setCustomZones] = useState(() => {
    const saved = localStorage.getItem('appPisos_customZones');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing custom zones:", e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('appPisos_customZones', JSON.stringify(customZones));
  }, [customZones]);

  const [provinciasOverrides, setProvinciasOverrides] = useState(() => {
    const saved = localStorage.getItem('appPisos_provinciasOverrides');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing province overrides:", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('appPisos_provinciasOverrides', JSON.stringify(provinciasOverrides));
  }, [provinciasOverrides]);

  const zonesConfig = useMemo(() => {
    const config = {};
    for (const [key, value] of Object.entries(provinciasDefault)) {
      config[key] = {
        ...value,
        ...(provinciasOverrides[key] || {}),
        isProvince: true,
        key: key
      };
    }
    customZones.forEach(zone => {
      config[zone.id] = {
        name: zone.name,
        limit: zone.limit,
        minM2: zone.minM2,
        avgRentPriceM2: zone.avgRentPriceM2,
        avgPriceM2: zone.avgPriceM2,
        isCustom: true,
        key: zone.id
      };
    });
    return config;
  }, [customZones, provinciasOverrides]);

  const [showZonesModal, setShowZonesModal] = useState(false);
  const [zonesTab, setZonesTab] = useState('custom'); // 'custom' | 'provinces'
  const [provinceSearch, setProvinceSearch] = useState('');
  const [newZoneForm, setNewZoneForm] = useState({
    name: '',
    limit: 150000,
    minM2: 60,
    avgPriceM2: 1500,
    avgRentPriceM2: 9.0
  });

  const handleAddCustomZone = (e) => {
    e.preventDefault();
    if (!newZoneForm.name.trim()) return;

    const zoneId = newZoneForm.name.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');

    if (zonesConfig[zoneId]) {
      alert("Ya existe una zona o provincia con este nombre o identificación.");
      return;
    }

    const newZone = {
      id: zoneId,
      name: newZoneForm.name.trim(),
      limit: Number(newZoneForm.limit),
      minM2: Number(newZoneForm.minM2),
      avgPriceM2: Number(newZoneForm.avgPriceM2),
      avgRentPriceM2: Number(newZoneForm.avgRentPriceM2)
    };

    setCustomZones(prev => [...prev, newZone]);
    setNewZoneForm({
      name: '',
      limit: 150000,
      minM2: 60,
      avgPriceM2: 1500,
      avgRentPriceM2: 9.0
    });
    setNotification({ text: `Zona "${newZone.name}" creada con éxito.`, type: 'success' });
  };

  const handleDeleteCustomZone = (id) => {
    if (confirm("¿Seguro que quieres eliminar esta zona personalizada?")) {
      setCustomZones(prev => prev.filter(z => z.id !== id));
      setNotification({ text: "Zona eliminada", type: 'info' });
    }
  };

  const handleUpdateProvinceOverride = (key, field, value) => {
    setProvinciasOverrides(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: Number(value)
      }
    }));
  };

  const handleResetProvinceOverride = (key) => {
    setProvinciasOverrides(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setNotification({ text: "Valores predeterminados restablecidos para esta provincia", type: 'info' });
  };

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

  // --- ESTADO INE IPV ---
  const [ineData, setIneData] = useState(null); // { byccaa: {ccaa: {variacionAnual, anyo, periodo}}, lastPeriod: string }
  
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

  // Cargar IPV del INE al montar
  useEffect(() => {
    fetch('/api/ine-precios')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.success) {
          setIneData(data);
        }
      })
      .catch(() => {}); // fallo silencioso si no hay servidor
  }, []);

  // --- CARGA DE DATOS DESDE ENLACE DE SINCRONIZACIÓN (Base64 URL) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    if (dataParam) {
      try {
        // Decodificar Base64 manejando caracteres UTF-8 de forma segura
        const decodedString = decodeURIComponent(escape(atob(dataParam)));
        const parsedData = JSON.parse(decodedString);
        
        let propertiesCount = 0;
        let customZonesCount = 0;

        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Formato antiguo
          setProperties(parsedData);
          propertiesCount = parsedData.length;
        } else if (parsedData && Array.isArray(parsedData.properties)) {
          // Formato nuevo
          setProperties(parsedData.properties);
          propertiesCount = parsedData.properties.length;
          if (Array.isArray(parsedData.customZones)) {
            setCustomZones(parsedData.customZones);
            customZonesCount = parsedData.customZones.length;
          }
        }

        if (propertiesCount > 0) {
          setNotification({
            text: `¡Cartera importada con éxito! Se cargaron ${propertiesCount} inmuebles${customZonesCount > 0 ? ` y ${customZonesCount} zonas` : ''} desde el enlace.`,
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

    const bookmarkletParam = params.get('import_bookmarklet');
    if (bookmarkletParam) {
      try {
        const decodedString = decodeURIComponent(escape(atob(bookmarkletParam)));
        const payload = JSON.parse(decodedString);
        
        // Determinar la zona en base a las provincias y sus keywords
        let matchedZona = 'Segovia'; // valor por defecto
        const searchableText = (payload.fullText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        for (const key of Object.keys(provinciasDefault)) {
          const p = provinciasDefault[key];
          const nameLower = (p.name || key).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (searchableText.includes(nameLower)) {
            matchedZona = key;
            break;
          }
          if (p.keywords && p.keywords.length > 0) {
            let found = false;
            for (const kw of p.keywords) {
              const kwLower = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (searchableText.includes(kwLower)) {
                matchedZona = key;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }

        // Auto-sugerencia de alquiler si no viene
        let sugeridoAlquiler = payload.alquiler;
        if (!sugeridoAlquiler && payload.m2) {
          const zoneDefault = provinciasDefault[matchedZona];
          if (zoneDefault) {
            sugeridoAlquiler = Math.round(payload.m2 * zoneDefault.avgRentPriceM2);
          }
        }

        setFormData(prev => ({
          ...prev,
          nombre: payload.nombre || prev.nombre,
          precio: payload.precio !== null ? Number(payload.precio) : prev.precio,
          m2: payload.m2 !== null ? Number(payload.m2) : prev.m2,
          planta: payload.planta || prev.planta,
          zona: matchedZona,
          alquiler: sugeridoAlquiler || prev.alquiler,
          comunidad: payload.comunidad !== null ? Number(payload.comunidad) : prev.comunidad,
          ibi: payload.ibi !== null ? Number(payload.ibi) : prev.ibi,
          reforma: 0
        }));

        setNotification({
          text: `¡Anuncio importado con éxito! Se cargaron los datos de "${payload.nombre || 'Inmueble'}" en el formulario.`,
          type: 'success'
        });

        // Limpiar el parámetro de la URL sin recargar la página
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } catch (err) {
        console.error("Error al decodificar import_bookmarklet:", err);
        setNotification({
          text: 'Fallo al importar datos desde el marcador. El enlace podría estar incompleto o dañado.',
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
        body: JSON.stringify({ code: cleanCode, properties: { properties, customZones } })
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
        const data = resData.properties;
        if (Array.isArray(data)) {
          setProperties(data);
        } else if (data && Array.isArray(data.properties)) {
          setProperties(data.properties);
          if (Array.isArray(data.customZones)) {
            setCustomZones(data.customZones);
          }
        }
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
      const payload = {
        properties,
        customZones
      };
      const jsonString = JSON.stringify(payload);
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
    const payload = {
      properties,
      customZones
    };
    const dataStr = JSON.stringify(payload, null, 2);
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
              setCustomZones([]);
            }
          } else {
            alert('El archivo JSON no tiene un formato de propiedades válido.');
          }
        } else if (parsed && Array.isArray(parsed.properties)) {
          const isValid = parsed.properties.every(p => p.id && p.nombre && typeof p.precio === 'number');
          if (isValid) {
            if (confirm('¿Estás seguro de que quieres importar este archivo? Esto reemplazará tu cartera actual.')) {
              setProperties(parsed.properties);
              if (Array.isArray(parsed.customZones)) {
                setCustomZones(parsed.customZones);
              }
            }
          } else {
            alert('El archivo JSON no tiene un formato de propiedades válido.');
          }
        } else {
          alert('El archivo JSON debe contener una lista de propiedades o un paquete de cartera válido.');
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

  const bookmarkletCode = `javascript:(function(){try{var t=document.querySelector('h1.item-title')?.innerText||document.querySelector('.main-info__title-main')?.innerText||document.title;t=t.replace(/\\s+/g,' ').trim();var pText=document.querySelector('.info-data-price .txt-bold')?.innerText||document.querySelector('.info-data-price')?.innerText||document.querySelector('.item-price')?.innerText||'';var pMatch=pText.replace(/\\./g,'').match(/(\\d+)/);var precio=pMatch?parseInt(pMatch[1],10):null;var m2=null;var list=document.querySelectorAll('.details-property_features li, .info-features span');list.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('€/m')||text.includes('/m²')||text.includes('/m2'))return;if(text.includes('m²')||text.includes('m2')||text.includes('metros')){var mMatch=text.match(/(\\d+)\\s*(?:m²|m2|metros)/);if(mMatch)m2=parseInt(mMatch[1],10)}});var comunidad=null;var ibi=null;var priceFeatures=document.querySelectorAll('.details-property_features li, .info-features span, .price-features__container p, .price-features__container span, .price-features__container li');priceFeatures.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('comunidad')&&text.includes('€')){var cMatch=text.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euro)/);if(cMatch)comunidad=Math.round(parseFloat(cMatch[1].replace('.','').replace(',','.')))}if((text.includes('ibi')||text.includes('contribucion')||text.includes('contribución'))&&text.includes('€')){var iMatch=text.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euro)/);if(iMatch)ibi=Math.round(parseFloat(iMatch[1].replace('.','').replace(',','.')))}});var description=document.querySelector('#descriptionText, .description-content, .adComments, .comment')?.innerText||'';if(comunidad===null&&description){var cMatch=description.match(/(?:comunidad|gastos.*?comunidad).*?(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros)/i)||description.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros).*?(?:comunidad|gastos.*?comunidad)/i);if(cMatch)comunidad=Math.round(parseFloat(cMatch[1].replace('.','').replace(',','.')))}if(ibi===null&&description){var iMatch=description.match(/(?:ibi|contribucion|contribución).*?(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros)/i)||description.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros).*?(?:ibi|contribucion|contribución)/i);if(iMatch)ibi=Math.round(parseFloat(iMatch[1].replace('.','').replace(',','.')))}var tieneAscensor=null;var plantaRaw='';list.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('ascensor')){if(text.includes('con ascensor')||text.includes('tiene ascensor')||text.includes('c/asc.'))tieneAscensor=!0;else if(text.includes('sin ascensor')||text.includes('no tiene ascensor')||text.includes('s/asc.'))tieneAscensor=!1}if(text.includes('planta')||text.includes('bajo')||text.includes('entreplanta')){if(text.length<100)plantaRaw+=' '+text}});var planta='1';if(plantaRaw.includes('bajo')||plantaRaw.includes('planta baja')){planta='Bajo'}else if(plantaRaw.includes('entreplanta')){planta='Entreplanta'}else{var fMatch=plantaRaw.match(/(\\d+)(?:ª|º|planta)/)||plantaRaw.match(/planta\\s*(\\d+)/)||plantaRaw.match(/(\\d+)\\s*(?:ª|º)/);if(fMatch){var num=parseInt(fMatch[1],10);if(num===0)planta='Bajo';else if(num>=3)planta=tieneAscensor?'3_con':'3_sin';else planta=String(num)}}var breadcrumbs=document.querySelector('.breadcrumb-navigation, .breadcrumb-list')?.innerText||'';var payload={nombre:t,precio:precio,m2:m2,comunidad:comunidad,ibi:ibi,planta:planta,url:window.location.href,fullText:(t+' '+breadcrumbs+' '+description).toLowerCase()};var b64=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));window.open('${window.location.origin}/?import_bookmarklet='+b64,'_blank')}catch(e){alert('Error al extraer datos: '+e.message)}})();`;

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setNotification({
      text: '¡Código del marcador copiado al portapapeles! Guárdalo en los marcadores de tu móvil.',
      type: 'success'
    });
  };

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
    const zonaConfig = zonesConfig[formData.zona];
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
  }, [formData, zonesConfig]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Luces de ambiente (Decorative Blur Glows) */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[150px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute top-[30%] right-[-10%] w-[700px] h-[700px] rounded-full bg-blue-500/8 blur-[160px] pointer-events-none animate-pulse-slow-reverse"></div>
      <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[140px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="sticky top-4 z-20 mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/85 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-glow-emerald">
              <Building className="h-5.5 w-5.5 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 bg-clip-text">
              REI <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Analytics Pro</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInputSyncCode(syncCode);
                setSyncMessage(null);
                setShowSyncModal(true);
              }}
              className={`flex items-center gap-1.5 h-10 px-4 border text-xs font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                syncCode 
                  ? 'border-blue-500/30 bg-blue-950/40 text-blue-400 hover:bg-blue-950/60 hover:border-blue-500/50 shadow-glow-blue' 
                  : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-350 hover:text-white'
              }`}
              title="Sincronizar cartera en la nube / otros dispositivos"
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>{syncCode ? `Nube: ${syncCode}` : 'Sincronizar'}</span>
            </button>
            <button
              onClick={() => {
                setProvinceSearch('');
                setShowZonesModal(true);
              }}
              className="flex items-center gap-1.5 h-10 px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
              title="Configurar parámetros de las Zonas y Provincias"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Zonas</span>
            </button>
            <button
              onClick={handleResetDemo}
              className="flex items-center gap-1.5 h-10 px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
              title="Restablecer datos de ejemplo"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Demo</span>
            </button>
            <label className="flex items-center gap-1.5 h-10 px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-slate-400" />
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
              className="flex items-center gap-1.5 h-10 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white rounded-xl shadow-md hover:shadow-emerald-500/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
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
            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden sticky top-24">
              <div className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {editingPropertyId ? (
                    <Edit className="h-5 w-5 text-emerald-450" />
                  ) : (
                    <Plus className="h-5 w-5 text-emerald-450" />
                  )}
                  <h2 className="font-bold text-base text-slate-100">
                    {editingPropertyId ? 'Editar Inmueble' : 'Nuevo Inmueble'}
                  </h2>
                </div>
                {formData.nombre && (() => {
                  const tempMetrics = calculateMetrics(formData);
                  const score = getPropertyScore(formData, tempMetrics, zonesConfig);
                  return (
                    <div className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${score.color}`} title={`Calidad estimada: ${score.label} (${score.points} pts)`}>
                      Score: {score.grade}
                    </div>
                  );
                })()}
              </div>
              
              <form onSubmit={handleAddProperty} className="p-6 space-y-4">
                
                {/* Marcador Importador Mágico de Idealista */}
                <div className="border-glowing-gradient p-4 rounded-xl space-y-3 shadow-lg shadow-emerald-500/5 bg-slate-950/40">
                  <div className="flex items-center gap-2 text-emerald-450 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" />
                    <span>Importación Mágica (Idealista)</span>
                  </div>
                  <p className="text-[11px] text-slate-450 leading-normal">
                    Arrastra este botón verde a tu barra de marcadores. Cuando estés en cualquier anuncio de Idealista, haz clic en él para importar todos los datos al instante:
                  </p>
                  
                  <div className="flex justify-center py-1">
                    <a
                      href={`javascript:(function(){try{var t=document.querySelector('h1.item-title')?.innerText||document.querySelector('.main-info__title-main')?.innerText||document.title;t=t.replace(/\\s+/g,' ').trim();var pText=document.querySelector('.info-data-price .txt-bold')?.innerText||document.querySelector('.info-data-price')?.innerText||document.querySelector('.item-price')?.innerText||'';var pMatch=pText.replace(/\\./g,'').match(/(\\d+)/);var precio=pMatch?parseInt(pMatch[1],10):null;var m2=null;var list=document.querySelectorAll('.details-property_features li, .info-features span');list.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('€/m')||text.includes('/m²')||text.includes('/m2'))return;if(text.includes('m²')||text.includes('m2')||text.includes('metros')){var mMatch=text.match(/(\\d+)\\s*(?:m²|m2|metros)/);if(mMatch)m2=parseInt(mMatch[1],10)}});var comunidad=null;var ibi=null;var priceFeatures=document.querySelectorAll('.details-property_features li, .info-features span, .price-features__container p, .price-features__container span, .price-features__container li');priceFeatures.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('comunidad')&&text.includes('€')){var cMatch=text.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euro)/);if(cMatch)comunidad=Math.round(parseFloat(cMatch[1].replace('.','').replace(',','.')))}if((text.includes('ibi')||text.includes('contribucion')||text.includes('contribución'))&&text.includes('€')){var iMatch=text.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euro)/);if(iMatch)ibi=Math.round(parseFloat(iMatch[1].replace('.','').replace(',','.')))}});var description=document.querySelector('#descriptionText, .description-content, .adComments, .comment')?.innerText||'';if(comunidad===null&&description){var cMatch=description.match(/(?:comunidad|gastos.*?comunidad).*?(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros)/i)||description.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros).*?(?:comunidad|gastos.*?comunidad)/i);if(cMatch)comunidad=Math.round(parseFloat(cMatch[1].replace('.','').replace(',','.')))}if(ibi===null&&description){var iMatch=description.match(/(?:ibi|contribucion|contribución).*?(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros)/i)||description.match(/(\\d+(?:[\\.,]\\d+)?)\\s*(?:€|euros).*?(?:ibi|contribucion|contribución)/i);if(iMatch)ibi=Math.round(parseFloat(iMatch[1].replace('.','').replace(',','.')))}var tieneAscensor=null;var plantaRaw='';list.forEach(function(el){if(el.querySelector('div'))return;var text=el.innerText.toLowerCase();if(text.includes('ascensor')){if(text.includes('con ascensor')||text.includes('tiene ascensor')||text.includes('c/asc.'))tieneAscensor=!0;else if(text.includes('sin ascensor')||text.includes('no tiene ascensor')||text.includes('s/asc.'))tieneAscensor=!1}if(text.includes('planta')||text.includes('bajo')||text.includes('entreplanta')){if(text.length<100)plantaRaw+=' '+text}});var planta='1';if(plantaRaw.includes('bajo')||plantaRaw.includes('planta baja')){planta='Bajo'}else if(plantaRaw.includes('entreplanta')){planta='Entreplanta'}else{var fMatch=plantaRaw.match(/(\\d+)(?:ª|º|planta)/)||plantaRaw.match(/planta\\s*(\\d+)/)||plantaRaw.match(/(\\d+)\\s*(?:ª|º)/);if(fMatch){var num=parseInt(fMatch[1],10);if(num===0)planta='Bajo';else if(num>=3)planta=tieneAscensor?'3_con':'3_sin';else planta=String(num)}}var breadcrumbs=document.querySelector('.breadcrumb-navigation, .breadcrumb-list')?.innerText||'';var payload={nombre:t,precio:precio,m2:m2,comunidad:comunidad,ibi:ibi,planta:planta,url:window.location.href,fullText:(t+' '+breadcrumbs+' '+description).toLowerCase()};var b64=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));window.open('${window.location.origin}/?import_bookmarklet='+b64,'_blank')}catch(e){alert('Error al extraer datos: '+e.message)}})();`}
                      className="inline-flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-extrabold text-white rounded-xl shadow-md cursor-grab active:cursor-grabbing hover:scale-[1.02] active:scale-[0.98] transition-all"
                      title="Arrastra este botón a tus marcadores"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      Analizar en REI
                    </a>
                  </div>
                  
                  <div className="text-center space-y-2 mt-1">
                    <button
                      type="button"
                      onClick={handleCopyBookmarklet}
                      className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      title="Copiar código de marcador para añadirlo manualmente en móvil"
                    >
                      <Download className="h-3 w-3" />
                      Copiar Código del Marcador
                    </button>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowHtmlPaste(true)}
                        className="text-[9px] text-slate-500 hover:text-emerald-400 font-semibold focus:outline-none transition-colors"
                      >
                        ¿No tienes barra de marcadores? Pegar HTML manualmente
                      </button>
                    </div>
                  </div>

                  {showHtmlPaste && (
                    <div className="pt-2 border-t border-slate-900/60 space-y-2.5">
                      <textarea
                        value={rawHtmlText}
                        onChange={(e) => setRawHtmlText(e.target.value)}
                        placeholder="Pega el código HTML completo aquí (Ctrl+U en Idealista)..."
                        rows={3}
                        className="w-full rounded-lg border-slate-850 text-[10px] font-mono px-3 py-2 border bg-slate-950 text-slate-100 placeholder:text-slate-650 focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHtmlPaste(false);
                            setRawHtmlText('');
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-200"
                        >
                          Ocultar
                        </button>
                        <button
                          type="button"
                          onClick={handleParseHtml}
                          disabled={isScraping || !rawHtmlText.trim()}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[10px] font-bold cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          {isScraping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Extraer Datos
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative flex items-center py-1.5">
                  <div className="flex-grow border-t border-slate-800/80"></div>
                  <span className="flex-shrink-0 mx-3 text-slate-500 text-[9px] font-bold uppercase tracking-wider">o rellena manualmente</span>
                  <div className="flex-grow border-t border-slate-800/80"></div>
                </div>

                {/* Inputs Básicos */}
                <div>
                  <label className="block text-xs font-bold text-slate-455 mb-1.5 tracking-wide">Nombre / Referencia</label>
                  <input required type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Ej: Piso Centro..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-455 mb-1.5 tracking-wide">Zona</label>
                    <select name="zona" value={formData.zona} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                      {customZones.length > 0 && (
                        <optgroup label="Zonas Personalizadas" className="bg-slate-950 text-slate-300">
                          {customZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </optgroup>
                      )}
                      <optgroup label="Provincias (Predeterminadas)" className="bg-slate-950 text-slate-300">
                        {Object.keys(provinciasDefault).map(z => (
                          <option key={z} value={z}>{zonesConfig[z]?.name || z}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-455 mb-1.5 tracking-wide">Planta</label>
                    <select name="planta" value={formData.planta} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                      {PLANTAS.map(p => <option key={p.id} value={p.id} className="bg-slate-950">{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wide">Superficie (m²)</label>
                    <input required type="number" name="m2" value={formData.m2} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wide">Precio Compra (€)</label>
                    <input required type="number" name="precio" value={formData.precio} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    {formData.m2 > 0 && zonesConfig[formData.zona] && (() => {
                      const priceM2 = Math.round(formData.precio / formData.m2);
                      const avg = zonesConfig[formData.zona].avgPriceM2;
                      const diff = Math.round(((priceM2 - avg) / avg) * 100);
                      const isBelow = diff <= 0;
                      return (
                        <div className={`text-[10px] mt-1 font-bold leading-tight ${isBelow ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {priceM2} €/m² ({isBelow ? `🟢 ${diff}%` : `🟡 +${diff}%`} vs media {avg} €)
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Gastos Adquisición */}
                <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/80 space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Adquisición</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">ITP (%)</label>
                      <input required type="number" step="0.1" name="itp" value={formData.itp} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Reforma (€)</label>
                      <input required type="number" name="reforma" value={formData.reforma} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Ingresos y Gastos Corrientes */}
                <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/80 space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Operativa</h3>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Alquiler Mes (€)</label>
                      <input required type="number" name="alquiler" value={formData.alquiler} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                      {formData.m2 > 0 && zonesConfig[formData.zona] && (() => {
                        const suggested = Math.round(formData.m2 * zonesConfig[formData.zona].avgRentPriceM2);
                        return (
                          <div className="text-[10px] text-blue-450 mt-1.5 flex justify-between items-center font-medium leading-none">
                            <span>💡 Sugerido: ~{suggested} €</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, alquiler: suggested }))}
                              className="text-[9px] bg-blue-950/40 text-blue-400 px-2 py-1 rounded hover:bg-blue-900/40 border border-blue-900/50 transition-all font-bold uppercase cursor-pointer"
                            >
                              Aplicar
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Comunidad/mes</label>
                      <input required type="number" name="comunidad" value={formData.comunidad} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">IBI Anual (€)</label>
                      <input required type="number" name="ibi" value={formData.ibi} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Seguro Anual (€)</label>
                      <input required type="number" name="seguro" value={formData.seguro} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Financiación (Si no hay global) */}
                <div className={`p-3.5 rounded-xl border transition-all duration-200 ${globalMortgage.active ? 'bg-slate-950/20 border-slate-900 opacity-40' : 'bg-slate-950/45 border-slate-850/80'} space-y-3`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Hipoteca (80%)</h3>
                    {globalMortgage.active && <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">Global Activa</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">TIN (%)</label>
                      <input disabled={globalMortgage.active} required type="number" step="0.1" name="tin" value={formData.tin} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Plazo (Años)</label>
                      <select disabled={globalMortgage.active} name="plazo" value={formData.plazo} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-950 cursor-pointer">
                        <option value={15} className="bg-slate-950">15 años</option>
                        <option value={20} className="bg-slate-950">20 años</option>
                        <option value={25} className="bg-slate-950">25 años</option>
                        <option value={30} className="bg-slate-950">30 años</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Validaciones Visuales */}
                {formWarnings.length > 0 && (
                  <div className="bg-amber-500/5 border-l-4 border-amber-500 p-3.5 rounded-r-xl">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-amber-450 mr-2 mt-0.5 shrink-0" />
                      <ul className="text-xs text-amber-300 space-y-1">
                        {formWarnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </div>
                )}

                {formErrors.length > 0 && (
                  <div className="bg-red-500/5 border-l-4 border-red-500 p-3.5 rounded-r-xl">
                    <div className="flex items-start">
                      <AlertTriangle className="h-4 w-4 text-red-400 mr-2 mt-0.5 shrink-0" />
                      <ul className="text-xs text-red-350 font-semibold space-y-1">
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
                      className="flex justify-center items-center h-11 px-4 border border-slate-800 bg-slate-900 text-slate-350 hover:bg-slate-850 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={formErrors.length > 0}
                      className="flex justify-center items-center h-11 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Guardar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="submit" 
                    disabled={formErrors.length > 0}
                    className="w-full mt-4 flex justify-center items-center h-11 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-indigo-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
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
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${globalMortgage.active ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]' : 'bg-slate-900/40 border-slate-850/80 shadow-md'}`}>
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-850">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${globalMortgage.active ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-450 border border-slate-700/50'}`}>
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Simulación Global de Hipoteca</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Aplica un TIN y Plazo a toda la cartera para ver el impacto en el Cash Flow</p>
                  </div>
                </div>
                <label className="flex items-center cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={globalMortgage.active} onChange={() => setGlobalMortgage(p => ({...p, active: !p.active}))} />
                    <div className={`w-[56px] h-[30px] rounded-full transition-all duration-300 border bg-slate-950 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${globalMortgage.active ? 'bg-amber-500/25 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]' : 'border-slate-800'}`}></div>
                    <div className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full transition-all duration-300 ${globalMortgage.active ? 'translate-x-[26px] bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-slate-400'}`}></div>
                  </div>
                  <span className={`ml-3.5 text-xs font-extrabold uppercase tracking-wider transition-colors duration-200 ${globalMortgage.active ? 'text-amber-400' : 'text-slate-450'}`}>{globalMortgage.active ? 'ON' : 'OFF'}</span>
                </label>
              </div>

              {globalMortgage.active && (
                <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/20">
                  <div>
                    <div className="flex justify-between mb-1.5 items-center">
                      <label className="text-xs font-semibold text-slate-400">Tipo de Interés (TIN)</label>
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{globalMortgage.tin}%</span>
                    </div>
                    <input type="range" min="1" max="8" step="0.1" value={globalMortgage.tin} onChange={(e) => setGlobalMortgage(p => ({...p, tin: Number(e.target.value)}))} className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5 items-center">
                      <label className="text-xs font-semibold text-slate-400">Plazo Amortización</label>
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{globalMortgage.plazo} años</span>
                    </div>
                    <input type="range" min="10" max="40" step="5" value={globalMortgage.plazo} onChange={(e) => setGlobalMortgage(p => ({...p, plazo: Number(e.target.value)}))} className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Tabla Dinámica */}
            <div className="bg-slate-900/30 border border-slate-850/80 rounded-2xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-850/60">
                  <thead className="bg-slate-900/60">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-slate-450 uppercase tracking-wider">Inmueble</th>
                      <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider">Compra</th>
                      <th 
                        className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider cursor-pointer hover:bg-slate-800/40 hover:text-white group transition-all"
                        onClick={() => requestSort('reforma')}
                      >
                         <div className="flex items-center justify-end gap-1">
                          Reforma <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider">Cap. Aportado</th>
                      <th className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider">Cuota Hip.</th>
                      <th 
                        className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider cursor-pointer hover:bg-slate-800/40 hover:text-white group transition-all"
                        onClick={() => requestSort('cashFlowMensual')}
                      >
                         <div className="flex items-center justify-end gap-1">
                          Cash Flow <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3.5 text-right text-xs font-bold text-slate-450 uppercase tracking-wider cursor-pointer hover:bg-slate-800/40 hover:text-white group transition-all"
                        onClick={() => requestSort('rentabilidadBruta')}
                      >
                         <div className="flex items-center justify-end gap-1">
                          R. Bruta <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3.5 text-right text-xs font-bold text-emerald-400 uppercase tracking-wider cursor-pointer hover:bg-emerald-950/20 group transition-all"
                        onClick={() => requestSort('rentabilidadNeta')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          ROE (Neta) <ArrowUpDown className="h-3 w-3 text-emerald-400/65 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-450 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-slate-900/10 divide-y divide-slate-850/50">
                    {sortedProperties.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                          <Building className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                          <p className="font-semibold text-slate-450">No hay inmuebles en la cartera.</p>
                          <p className="text-xs text-slate-650 mt-1">Añade uno usando el panel lateral o pega un enlace de Idealista.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedProperties.map((prop) => {
                        const m = prop.metrics;
                        const score = getPropertyScore(prop, m, zonesConfig);
                        const isExpanded = expandedPropertyId === prop.id;
                        const baseRent = zonesConfig[prop.zona] ? (zonesConfig[prop.zona].avgRentPriceM2 * prop.m2) : 600;
                        const minRent = Math.max(100, Math.round(baseRent * 0.4));
                        const maxRent = Math.round(baseRent * 2.2);
                        
                        // Determinación de colores del Cash Flow
                        let cfColor = "text-red-400 font-bold bg-red-500/10 border border-red-500/20";
                        if (m.cashFlowMensual >= 0 && m.cashFlowMensual < 100) cfColor = "text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20";
                        if (m.cashFlowMensual >= 100) cfColor = "text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 shadow-glow-emerald";
 
                        return (
                          <React.Fragment key={prop.id}>
                            <tr 
                              className={`hover:bg-slate-850/50 border-b border-slate-850/60 transition-all cursor-pointer ${isExpanded ? 'bg-slate-850/35 border-l-4 border-emerald-500 font-medium' : ''}`}
                              onClick={() => setExpandedPropertyId(isExpanded ? null : prop.id)}
                            >
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-bold text-slate-100">{prop.nombre}</div>
                                  <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded border ${score.color}`} title={`Calidad: ${score.label} (${score.points} pts)`}>
                                    {score.grade}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-455 flex items-center gap-1.5 mt-1 font-medium">
                                  <MapPin className="h-3 w-3 text-slate-500" /> {zonesConfig[prop.zona]?.name || prop.zona} • {prop.planta}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-200 font-medium whitespace-nowrap">
                                {formatCurrency(prop.precio)}
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-200 font-medium whitespace-nowrap">
                                {prop.reforma > 0 ? (
                                  <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-bold border border-amber-500/20">
                                    {formatCurrency(prop.reforma)}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-normal italic text-xs">
                                    Sin reforma
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-200 font-medium whitespace-nowrap">
                                {formatCurrency(m.capitalAportadoTotal)}
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">Inc. {formatCurrency(m.gastosAdquisicion)} gastos</div>
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-200 font-medium whitespace-nowrap">
                                {formatCurrency(m.cuotaMensual)}
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                  {globalMortgage.active ? (
                                    <span className="text-amber-455 font-semibold">Sim. {globalMortgage.tin}%</span>
                                  ) : (
                                    <span>{prop.tin}% / {prop.plazo}y</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${cfColor}`}>
                                  {formatCurrency(m.cashFlowMensual)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-300 font-semibold whitespace-nowrap">
                                {formatPercent(m.rentabilidadBruta)}
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm whitespace-nowrap">
                                <span className="font-bold text-emerald-450 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 shadow-glow-emerald">
                                  {formatPercent(m.rentabilidadNeta)}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    onClick={() => handleEdit(prop)}
                                    className={`transition-all p-1.5 rounded-lg ${
                                      editingPropertyId === prop.id 
                                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                        : 'text-slate-450 hover:text-emerald-400 hover:bg-slate-800'
                                    }`}
                                    title="Editar inmueble"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(prop.id)}
                                    className="text-slate-450 hover:text-red-400 hover:bg-slate-800 p-1.5 rounded-lg transition-all"
                                    title="Eliminar inmueble"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-950/40">
                                <td colSpan={9} className="px-6 py-5 border-t border-b border-slate-850/80 shadow-inner">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Desglose de Gastos */}
                                    <div className="space-y-3 animate-slide-up">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose de Costes Iniciales</h4>
                                      <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-2.5 text-xs shadow-md">
                                        <div className="flex justify-between text-slate-400">
                                          <span>Entrada Aportada (20%):</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * 0.2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                          <span>Impuesto ITP ({prop.itp}%):</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * (prop.itp / 100))}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                          <span>Notaría, Registro y Gestoría:</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(2000)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                          <span>Reforma Estimada:</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.reforma)}</span>
                                        </div>
                                        <div className="border-t border-slate-800/85 my-1.5 pt-2 flex justify-between font-extrabold text-slate-100">
                                          <span>Capital Aportado Total:</span>
                                          <span className="text-emerald-400">{formatCurrency(m.capitalAportadoTotal)}</span>
                                        </div>
                                      </div>
                                    </div>
 
                                    {/* Sliders Interactivos */}
                                    <div className="space-y-4 lg:col-span-2 animate-slide-up">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulador Rápido (Modificar Inmueble)</h4>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/80 rounded-xl border border-slate-850 p-4 shadow-md">
                                        
                                        {/* Slider 1: Alquiler */}
                                        <div className="space-y-2.5">
                                          <div className="flex justify-between items-center text-xs font-semibold">
                                            <span className="text-slate-400">Alquiler Estimado:</span>
                                            <div className="flex items-center gap-1.5">
                                              <input
                                                type="number"
                                                value={prop.alquiler}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'alquiler', Number(e.target.value))}
                                                className="w-20 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold"
                                              />
                                              <span className="text-slate-455">/mes</span>
                                            </div>
                                          </div>
                                          <input 
                                            type="range" 
                                            min={minRent} 
                                            max={maxRent} 
                                            step={10} 
                                            value={prop.alquiler} 
                                            onChange={(e) => handleUpdatePropertyField(prop.id, 'alquiler', Number(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                          />
                                          {zonesConfig[prop.zona] && (
                                            <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                              <span>Mín: {formatCurrency(minRent)}</span>
                                              <span>Media: ~{Math.round(baseRent)} €</span>
                                              <span>Máx: {formatCurrency(maxRent)}</span>
                                            </div>
                                          )}
                                        </div>
 
                                        {/* Slider 2: TIN */}
                                        <div className="space-y-2.5">
                                          <div className="flex justify-between items-center text-xs font-semibold">
                                            <span className="text-slate-400">Interés Hipoteca (TIN):</span>
                                            <div className="flex items-center gap-1.5">
                                              <input
                                                type="number"
                                                step="0.1"
                                                disabled={globalMortgage.active}
                                                value={globalMortgage.active ? globalMortgage.tin : prop.tin}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'tin', Number(e.target.value))}
                                                className="w-16 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold disabled:opacity-40"
                                              />
                                              <span className="text-slate-455">%</span>
                                            </div>
                                          </div>
                                          <input 
                                            type="range" 
                                            min="0.5" 
                                            max="8.0" 
                                            step="0.1" 
                                            disabled={globalMortgage.active}
                                            value={globalMortgage.active ? globalMortgage.tin : prop.tin} 
                                            onChange={(e) => handleUpdatePropertyField(prop.id, 'tin', Number(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 disabled:cursor-not-allowed" 
                                          />
                                          <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                            <span>Mín: 0.5%</span>
                                            <span>Plazo: {prop.plazo} años</span>
                                            <span>Máx: 8%</span>
                                          </div>
                                        </div>
 
                                      </div>
 
                                      {/* Métricas rápidas de impacto */}
                                      <div className="grid grid-cols-3 gap-3 text-center">
                                        <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 shadow-md">
                                          <span className="block text-[9px] font-bold text-slate-500 uppercase">Cash Flow</span>
                                          <span className={`text-xs font-bold ${m.cashFlowMensual >= 0 ? 'text-emerald-450' : 'text-red-405'}`}>
                                            {formatCurrency(m.cashFlowMensual)}
                                          </span>
                                        </div>
                                        <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 shadow-md">
                                          <span className="block text-[9px] font-bold text-slate-500 uppercase">Rent. Bruta</span>
                                          <span className="text-xs font-bold text-slate-200">
                                            {formatPercent(m.rentabilidadBruta)}
                                          </span>
                                        </div>
                                        <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 shadow-md">
                                          <span className="block text-[9px] font-bold text-slate-500 uppercase">ROE (Neta)</span>
                                          <span className="text-xs font-bold text-emerald-450 bg-emerald-500/10 rounded-md px-1.5 py-0.5 border border-emerald-500/20 shadow-glow-emerald">
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
               <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-850/80 p-5 flex items-center shadow-lg">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-glow-blue mr-4 shrink-0">
                    <Building className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Total Inmuebles</p>
                    <p className="text-xl font-extrabold text-slate-100 mt-1">{properties.length}</p>
                  </div>
               </div>
               <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-850/80 p-5 flex items-center shadow-lg">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-glow-emerald mr-4 shrink-0">
                    <Euro className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Cap. Total Aportado</p>
                    <p className="text-xl font-extrabold text-slate-100 mt-1">
                       {formatCurrency(enrichedProperties.reduce((acc, curr) => acc + curr.metrics.capitalAportadoTotal, 0))}
                    </p>
                  </div>
               </div>
               <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-850/80 p-5 flex items-center shadow-lg">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-glow-amber mr-4 shrink-0">
                    <Calculator className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Total Reformas</p>
                    <p className="text-xl font-extrabold text-slate-100 mt-1">
                      {formatCurrency(properties.reduce((acc, curr) => acc + (curr.reforma || 0), 0))}
                    </p>
                  </div>
               </div>
               <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-850/80 p-5 flex items-center shadow-lg">
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-glow-purple mr-4 shrink-0">
                    <TrendingUp className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase tracking-wider font-bold">Cash Flow Mensual Neto</p>
                    <p className="text-xl font-extrabold text-slate-100 mt-1">
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-xl p-4 text-slate-100 flex items-start gap-3 animate-fade-in">
          <div className="p-1 rounded-full bg-blue-950/50 text-blue-400 mt-0.5 shrink-0">
            {notification.type === 'error' ? '⚠️' : '✅'}
          </div>
          <div className="flex-1 space-y-0.5">
            <h4 className="font-semibold text-sm">Sincronización</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{notification.text}</p>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-350 text-sm font-bold cursor-pointer transition-colors"
          >
            &times;
          </button>
        </div>
      )}
 
      {/* MODAL DE SINCRONIZACIÓN */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-100 animate-scale-up">
            <div className="bg-slate-900/95 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-400 animate-pulse" />
                <h3 className="font-bold text-base text-slate-100">Sincronización de Cartera</h3>
              </div>
              <button 
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 space-y-6 bg-slate-900/60">
              {/* SECCIÓN A: ENLACE COMPARTIDO (100% GRATIS) */}
              <div className="space-y-3 bg-slate-950/45 p-4 rounded-xl border border-slate-850/80 shadow-md">
                <div className="flex items-center gap-2 text-blue-400 font-semibold">
                  <Link className="h-4 w-4" />
                  <h4 className="font-bold text-xs uppercase tracking-wider">Opción A: Compartir por Enlace (Gratis)</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Genera un enlace especial con todos tus inmuebles codificados. Envíatelo a tu móvil o ábrelo en otro navegador para importar tu cartera al instante.
                </p>
                <button
                  onClick={handleCopyShareLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-md hover:shadow-indigo-500/15"
                >
                  <Link className="h-4 w-4" />
                  Copiar Enlace de Sincronización
                </button>
              </div>
 
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-850"></div>
                <span className="flex-shrink mx-4 text-slate-600 text-[9px] font-bold tracking-wider uppercase">O bien</span>
                <div className="flex-grow border-t border-slate-850"></div>
              </div>
 
              {/* SECCIÓN B: NUBE AUTOMÁTICA (VERCEL KV) */}
              <div className="space-y-3 bg-slate-950/25 p-4 rounded-xl border border-slate-850/65 shadow-md">
                <div className="flex items-center gap-2 text-slate-400 font-semibold">
                  <Cloud className="h-4 w-4 text-slate-450" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-350">Opción B: Sincronización Nube (Vercel KV)</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Requiere configurar Vercel KV en el panel del proyecto. Permite guardar y cargar carteras en tiempo real mediante un código de texto.
                </p>
 
                {syncMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                    syncMessage.type === 'error' ? 'bg-red-950/30 text-red-305 border-red-900/50' :
                    syncMessage.type === 'success' ? 'bg-emerald-950/30 text-emerald-305 border-emerald-900/50' :
                    'bg-blue-950/30 text-blue-305 border-blue-900/50'
                  }`}>
                    <div className="font-bold shrink-0">
                      {syncMessage.type === 'error' ? '⚠️' : syncMessage.type === 'success' ? '✅' : 'ℹ️'}
                    </div>
                    <div className="font-medium leading-tight">{syncMessage.text}</div>
                  </div>
                )}
 
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputSyncCode}
                      onChange={(e) => setInputSyncCode(e.target.value)}
                      placeholder="Ej. mi-cartera-secreta"
                      className="flex-1 h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-slate-650 disabled:opacity-40 transition-all"
                      disabled={isSyncing}
                    />
                    <button
                      onClick={generateRandomCode}
                      className="h-11 px-4 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer hover:text-white hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                      disabled={isSyncing}
                    >
                      Generar
                    </button>
                  </div>
                </div>
 
                {syncCode && (
                  <div className="text-[10px] text-slate-550 bg-slate-950/50 p-2 rounded-lg border border-slate-850/50 flex justify-between font-semibold">
                    <span>Activo: <strong className="text-slate-400 font-bold">{syncCode}</strong></span>
                    <span>Modo: <strong className="text-slate-400 font-bold">{cloudMode === 'cloud' ? '☁️ Vercel KV' : '💾 Servidor Local'}</strong></span>
                  </div>
                )}
 
                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <button
                    onClick={() => handleLoadCloud(inputSyncCode)}
                    className="flex items-center justify-center gap-1.5 h-11 px-4 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={isSyncing || !inputSyncCode.trim()}
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : <RefreshCw className="h-3.5 w-3.5 text-slate-500" />}
                    Cargar
                  </button>
                  
                  <button
                    onClick={() => handleSaveCloud(inputSyncCode)}
                    className="flex items-center justify-center gap-1.5 h-11 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={isSyncing || !inputSyncCode.trim()}
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : <Cloud className="h-3.5 w-3.5 text-slate-450" />}
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
 
      {/* MODAL DE CONFIGURACIÓN DE ZONAS */}
      {showZonesModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden text-slate-100 animate-scale-up max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 border-b border-slate-850 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings className="h-5 w-5 text-emerald-450" />
                <h3 className="font-bold text-base text-slate-100">Configuración de Zonas de Análisis</h3>
              </div>
              <button 
                onClick={() => setShowZonesModal(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
 
            {/* Selector de pestañas */}
            <div className="flex border-b border-slate-850 bg-slate-950/50 shrink-0">
              <button
                onClick={() => setZonesTab('custom')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  zonesTab === 'custom' 
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                    : 'border-transparent text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                Zonas Personalizadas (Barrios/Sub-zonas)
              </button>
              <button
                onClick={() => setZonesTab('provinces')}
                className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  zonesTab === 'provinces' 
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
                    : 'border-transparent text-slate-450 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                Medias Provinciales ({Object.keys(provinciasDefault).length - 1} Provincias)
              </button>
            </div>
 
            {/* Contenido con scroll */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-900/20">
              {zonesTab === 'custom' ? (
                <>
                  {/* Formulario para añadir nueva zona personalizada */}
                  <form onSubmit={handleAddCustomZone} className="bg-slate-950/45 p-5 rounded-xl border border-slate-850/80 space-y-4">
                    <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Añadir Nueva Zona</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nombre (ej: Segovia Centro)</label>
                        <input
                          required
                          type="text"
                          value={newZoneForm.name}
                          onChange={(e) => setNewZoneForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nombre de la zona..."
                          className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder-slate-650 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Límite Venta (€)</label>
                        <input
                          required
                          type="number"
                          value={newZoneForm.limit}
                          onChange={(e) => setNewZoneForm(prev => ({ ...prev, limit: Number(e.target.value) }))}
                          className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Min m²</label>
                        <input
                          required
                          type="number"
                          value={newZoneForm.minM2}
                          onChange={(e) => setNewZoneForm(prev => ({ ...prev, minM2: Number(e.target.value) }))}
                          className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Venta €/m²</label>
                        <input
                          required
                          type="number"
                          value={newZoneForm.avgPriceM2}
                          onChange={(e) => setNewZoneForm(prev => ({ ...prev, avgPriceM2: Number(e.target.value) }))}
                          className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Alquiler €/m² (Renta estimada)</label>
                        <input
                          required
                          type="number"
                          step="0.1"
                          value={newZoneForm.avgRentPriceM2}
                          onChange={(e) => setNewZoneForm(prev => ({ ...prev, avgRentPriceM2: Number(e.target.value) }))}
                          className="w-32 h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-11 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-emerald-500/15 transition-all cursor-pointer self-end uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Crear Zona
                      </button>
                    </div>
                  </form>
 
                  {/* Listado de zonas creadas */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zonas Registradas ({customZones.length})</h4>
                    {customZones.length === 0 ? (
                      <div className="text-center py-8 text-slate-550 text-xs bg-slate-950/20 rounded-xl border border-dashed border-slate-850/80">
                        No has creado ninguna zona personalizada. Escríbela arriba para afinar estimaciones por calle/barrio.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {customZones.map(zone => (
                          <div key={zone.id} className="flex justify-between items-center p-3.5 bg-slate-950/40 rounded-xl border border-slate-850/60 text-xs shadow-sm">
                            <div>
                              <div className="font-bold text-emerald-400 text-sm">{zone.name}</div>
                              <div className="text-xs text-slate-500 mt-1 font-medium">
                                Límite compra: <span className="text-slate-350">{formatCurrency(zone.limit)}</span> • Mínimo: <span className="text-slate-350">{zone.minM2} m²</span> • Medias: <span className="text-slate-350">{zone.avgPriceM2}€/m² venta</span>, <span className="text-slate-350">{zone.avgRentPriceM2}€/m² rent.</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteCustomZone(zone.id)}
                              className="text-red-400 hover:text-red-300 p-1.8 rounded-lg bg-red-950/20 border border-red-900/30 transition-all cursor-pointer hover:bg-red-950/40"
                              title="Eliminar zona"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Tab Provincias: Búsqueda y Overrides */}
                  <div className="space-y-4">
                    {/* Badge de fuente de datos */}
                    <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950/50 rounded-xl border border-slate-850/60">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fuente datos venta:</span>
                        <span className="text-[10px] text-slate-300 font-semibold">MIVAU — Valor Tasado Vivienda Libre Q4 2024</span>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        {ineData ? (
                          <>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">IPV INE:</span>
                            <span className="text-[10px] text-teal-400 font-bold">{ineData.lastPeriod}</span>
                            <span className="text-[10px] text-slate-500">(variación anual por CCAA activa)</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">IPV INE no disponible</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={provinceSearch}
                        onChange={(e) => setProvinceSearch(e.target.value)}
                        placeholder="Buscar provincia... (ej. Avila, Madrid, Segovia)"
                        className="flex-1 h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder-slate-600 transition-all"
                      />
                    </div>
 
                    <div className="space-y-2.5">
                      {Object.keys(provinciasDefault)
                        .filter(key => {
                          const name = provinciasDefault[key].name || key;
                          return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
                            provinceSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                          );
                        })
                        .map(key => {
                          const base = provinciasDefault[key];
                          const override = provinciasOverrides[key] || {};
                          const hasOverrides = Object.keys(override).length > 0;
                          
                          // Valores activos (por defecto o modificados)
                          const limit = override.limit ?? base.limit;
                          const minM2 = override.minM2 ?? base.minM2;
                          const avgPriceM2 = override.avgPriceM2 ?? base.avgPriceM2;
                          const avgRentPriceM2 = override.avgRentPriceM2 ?? base.avgRentPriceM2;
 
                          // Obtener variación IPV para esta CCAA
                          const ccaa = base.ccaa;
                          const ipvData = ineData && ccaa ? ineData.byccaa[ccaa] : null;

                          return (
                            <div key={key} className={`p-5 bg-slate-950/30 rounded-2xl border transition-all ${hasOverrides ? 'border-amber-500/35 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.03)]' : 'border-slate-850/85'}`}>
                              <div className="flex justify-between items-center mb-3">
                                <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                                  {base.name}
                                  {hasOverrides && <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-1.5 py-0.2 rounded font-bold uppercase">Modificado</span>}
                                  {ipvData && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                      ipvData.variacionAnual >= 10 ? 'bg-red-500/10 text-red-400 border-red-500/25' :
                                      ipvData.variacionAnual >= 5  ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                                                                      'bg-teal-500/10 text-teal-400 border-teal-500/25'
                                    }`}>
                                      IPV {ipvData.variacionAnual > 0 ? '+' : ''}{ipvData.variacionAnual}% anual
                                    </span>
                                  )}
                                </span>
                                {hasOverrides && (
                                  <button
                                    onClick={() => handleResetProvinceOverride(key)}
                                    className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-750 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                  >
                                    Restablecer
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Límite Compra (€)</label>
                                  <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => handleUpdateProvinceOverride(key, 'limit', e.target.value)}
                                    className="w-full h-9 px-2.5 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Mínimo (m²)</label>
                                  <input
                                    type="number"
                                    value={minM2}
                                    onChange={(e) => handleUpdateProvinceOverride(key, 'minM2', e.target.value)}
                                    className="w-full h-9 px-2.5 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Venta (€/m²)</label>
                                  <input
                                    type="number"
                                    value={avgPriceM2}
                                    onChange={(e) => handleUpdateProvinceOverride(key, 'avgPriceM2', e.target.value)}
                                    className="w-full h-9 px-2.5 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Alquiler (€/m²)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={avgRentPriceM2}
                                    onChange={(e) => handleUpdateProvinceOverride(key, 'avgRentPriceM2', e.target.value)}
                                    className="w-full h-9 px-2.5 border border-slate-800 rounded-lg bg-slate-950 text-slate-100 text-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}