import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, MapPin, Calculator, TrendingUp, AlertTriangle, 
  CheckCircle, Plus, Trash2, Settings, ArrowUpDown, Euro,
  Link, Loader2, Download, Upload, RotateCcw, Cloud, RefreshCw, Edit, Sparkles,
  ChevronDown, Lock, Unlock, Eye, EyeOff,
  Phone, Calendar, MessageSquare, User, Clock, XCircle
} from 'lucide-react';

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'pending': return 'No contactado';
    case 'contacted': return 'Contactado';
    case 'visit_scheduled': return 'Visita programada';
    case 'visit_done': return 'Visita realizada';
    case 'offer_submitted': return 'Oferta presentada';
    case 'negotiation': return 'En negociación';
    case 'reserved': return 'Reservado / Comprado';
    case 'discarded': return 'Descartado';
    default: return 'No contactado';
  }
};

const getStatusStyles = (status?: string) => {
  switch (status) {
    case 'pending':
      return 'bg-slate-800/80 text-slate-350 border-slate-700/80';
    case 'contacted':
      return 'bg-blue-500/10 text-blue-405 border-blue-500/20';
    case 'visit_scheduled':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'visit_done':
      return 'bg-teal-500/10 text-teal-350 border-teal-500/20';
    case 'offer_submitted':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'negotiation':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'reserved':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'discarded':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-slate-800/80 text-slate-355 border-slate-700/80';
  }
};

// --- BASE DE DATOS DE PROVINCIAS BASE ---
import provinciasDefault from '../data/provincias.json';

// --- FUNCIONES HELPER PARA CIFRADO CLIENT-SIDE (ZERO-KNOWLEDGE) ---
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(plaintext: string, password: string): Promise<any> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    encrypted: true,
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encrypted)
  };
}

async function decryptData(encryptedObj: any, password: string): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(encryptedObj.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedObj.iv));
  const ciphertext = base64ToArrayBuffer(encryptedObj.ciphertext);
  
  const key = await deriveKey(password, salt);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

function calculateMortgageSchedule(principal: number, tin: number, years: number) {
  const r = (tin / 100) / 12;
  const totalMonths = (years || 30) * 12;
  let balance = principal;
  let monthlyPayment = 0;

  if (r > 0 && totalMonths > 0) {
    const factor = Math.pow(1 + r, totalMonths);
    monthlyPayment = principal * ((r * factor) / (factor - 1));
  } else if (totalMonths > 0) {
    monthlyPayment = principal / totalMonths;
  }

  const schedule = [];
  for (let m = 1; m <= totalMonths; m++) {
    const interest = balance * r;
    const principalPaid = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month: m, interest, principalPaid, balance });
  }
  return { monthlyPayment, schedule };
}

function calculateIRR(cashFlows: number[]): number | null {
  if (cashFlows.length === 0) return null;
  const hasNegative = cashFlows.some(val => val < 0);
  const hasPositive = cashFlows.some(val => val > 0);
  if (!hasNegative || !hasPositive) return null;

  const maxIterations = 1000;
  const precision = 1e-6;
  let r = 0.1;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + r, t);
      if (t > 0) {
        dNpv -= t * cashFlows[t] / Math.pow(1 + r, t + 1);
      }
    }
    if (Math.abs(dNpv) < 1e-12) {
      break;
    }
    const nextR = r - npv / dNpv;
    if (Math.abs(nextR - r) < precision) {
      if (nextR < -1) return -100;
      return nextR * 100;
    }
    r = nextR;
  }

  // Fallback a búsqueda binaria si Newton-Raphson no converge
  let low = -0.999;
  let high = 5.0;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    let npv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + mid, t);
    }
    if (Math.abs(npv) < precision) {
      return mid * 100;
    }
    if (npv > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return null;
}

// --- ALGORITMO DE SCORE INMOBILIARIO ---
const getPropertyScore = (prop, metrics, zonesConfig) => {
  const selectedPlanta = PLANTAS.find(p => p.id === prop.planta);
  if (selectedPlanta?.blocked) {
    return { grade: 'F', color: 'bg-red-500/10 text-red-400 border-red-500/30', label: 'Bloqueado' };
  }

  let points = 0;

  // 1. Rentabilidad Neta (ROE) - Max 40 pts
  const roe = metrics.rentabilidadNeta;
  if (roe >= 10) points += 40;
  else if (roe >= 8) points += 32;
  else if (roe >= 6) points += 24;
  else if (roe >= 4) points += 16;
  else if (roe >= 2) points += 8;
  else if (roe < 0) points -= 15;

  // 2. Cash Flow Mensual - Max 30 pts
  const cf = metrics.cashFlowMensual;
  if (cf >= 200) points += 30;
  else if (cf >= 150) points += 25;
  else if (cf >= 100) points += 20;
  else if (cf >= 50) points += 15;
  else if (cf >= 0) points += 10;
  else points -= 15;

  // 3. Rentabilidad Bruta - Max 30 pts
  const brute = metrics.rentabilidadBruta;
  if (brute >= 9) points += 30;
  else if (brute >= 8) points += 25;
  else if (brute >= 7) points += 20;
  else if (brute >= 6) points += 15;
  else if (brute >= 5) points += 10;
  else if (brute < 4) points -= 10;

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
  { id: 'Bajo', label: 'Bajo', blocked: false },
  { id: 'Entreplanta', label: 'Entreplanta', blocked: false },
  { id: '1', label: '1º Planta', blocked: false },
  { id: '2', label: '2º Planta', blocked: false },
  { id: '3_con', label: '3º o superior CON ascensor', blocked: false },
  { id: '3_sin', label: '3º o superior SIN ascensor', blocked: false },
];

// --- UTILIDADES DE FORMATO ---
const formatCurrency = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
const formatPercent = (val) => new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val / 100);

// --- SANITIZACIÓN DE INMUEBLES IMPORTADOS ---
const sanitizeImportedProperty = (prop: any) => {
  if (!prop) return prop;
  const { metrics, score, negotiationRanges, ...rest } = prop;
  return rest;
};

export default function App() {
  // --- ESTADO GLOBAL ---
  const [properties, setProperties] = useState(() => {
    const saved = localStorage.getItem('appPisos_properties');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.map(sanitizeImportedProperty) : [];
      } catch (e) {
        console.error("Error parsing saved properties:", e);
      }
    }
    // Datos de ejemplo por defecto
    return [
      { id: '1', nombre: 'Piso Talavera', zona: 'Talavera', planta: '1', m2: 75, precio: 75000, itp: 9, reforma: 8000, alquiler: 550, comunidad: 30, ibi: 180, seguro: 120, tin: 3.5, plazo: 30, honorarios: 0, notariaRegistro: 1, sinHipoteca: false, precioOriginal: 75000, contactStatus: 'contacted', contactDate: '', contactNotes: 'Llamada inicial realizada. Propietario abierto a negociar el precio de venta si la señal es rápida.', contactPhone: '600111222', contactName: 'Marta Pérez (Agente)' },
      { id: '2', nombre: 'Centro Segovia', zona: 'Segovia', planta: '2', m2: 80, precio: 145000, itp: 8, reforma: 0, alquiler: 850, comunidad: 50, ibi: 300, seguro: 200, tin: 3.2, plazo: 25, honorarios: 0, notariaRegistro: 2, sinHipoteca: false, precioOriginal: 145000, contactStatus: 'visit_scheduled', contactDate: '2026-06-15T17:30', contactNotes: 'Cita organizada para el lunes por la tarde. Llevar documentación del seguro y ver estado de fachada.', contactPhone: '699888777', contactName: 'Juan Gómez' },
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
  const [syncPassword, setSyncPassword] = useState(() => localStorage.getItem('appPisos_syncPassword') || '');
  const [inputSyncPassword, setInputSyncPassword] = useState(syncPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [cloudMode, setCloudMode] = useState(() => localStorage.getItem('appPisos_cloudMode') || null);

  // --- ESTADOS DE NAVEGACIÓN MÓVIL ---
  const [mobileTab, setMobileTab] = useState<'cartera' | 'añadir' | 'analisis'>('cartera');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- ESTADO INE IPV ---
  const [ineData, setIneData] = useState(null); // { byccaa: {ccaa: {variacionAnual, anyo, periodo}}, lastPeriod: string }
  
  // --- ESTADOS DE NOTIFICACIÓN FLOTANTE ---
  const [notification, setNotification] = useState(null);



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
          setProperties(parsedData.map(sanitizeImportedProperty));
          propertiesCount = parsedData.length;
        } else if (parsedData && Array.isArray(parsedData.properties)) {
          // Formato nuevo
          setProperties(parsedData.properties.map(sanitizeImportedProperty));
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
          precioOriginal: payload.precio !== null ? Number(payload.precio) : prev.precioOriginal,
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

  const handleSaveCloud = async (codeToSave) => {
    const cleanCode = codeToSave.replace(/[^a-zA-Z0-9_-]/g, '').trim().toLowerCase();
    if (!cleanCode) {
      setSyncMessage({ text: 'Código de sincronización inválido. Solo letras, números y guiones.', type: 'error' });
      return;
    }

    setIsSyncing(true);
    setSyncMessage({ text: 'Guardando cartera en el servidor...', type: 'info' });

    try {
      let payload: any = { properties, customZones };

      if (inputSyncPassword) {
        setSyncMessage({ text: 'Cifrando datos de la cartera...', type: 'info' });
        try {
          payload = await encryptData(JSON.stringify(payload), inputSyncPassword);
        } catch (encryptError) {
          console.error("Encryption error:", encryptError);
          setSyncMessage({ text: 'Error al cifrar los datos de la cartera.', type: 'error' });
          setIsSyncing(false);
          return;
        }
      }

      const response = await fetch('/api/portfolio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, properties: payload })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setSyncCode(cleanCode);
        setSyncPassword(inputSyncPassword);
        setCloudMode(resData.mode);
        localStorage.setItem('appPisos_syncCode', cleanCode);
        if (inputSyncPassword) {
          localStorage.setItem('appPisos_syncPassword', inputSyncPassword);
        } else {
          localStorage.removeItem('appPisos_syncPassword');
        }
        localStorage.setItem('appPisos_cloudMode', resData.mode);
        setSyncMessage({ 
          text: `¡Guardado con éxito! Modo: ${resData.mode === 'cloud' ? 'Nube (Vercel KV)' : 'Servidor Local'}` + (inputSyncPassword ? ' (Cifrada en privado)' : ' (Pública)'), 
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
        let data = resData.properties;

        // Comprobar si está cifrado
        if (data && data.encrypted) {
          if (!inputSyncPassword) {
            setSyncMessage({ text: 'Esta cartera está cifrada de forma privada. Introduce la contraseña para cargarla.', type: 'error' });
            setIsSyncing(false);
            return;
          }

          setSyncMessage({ text: 'Descifrando datos de la cartera...', type: 'info' });
          try {
            const decryptedText = await decryptData(data, inputSyncPassword);
            data = JSON.parse(decryptedText);
          } catch (decryptError) {
            console.error("Decryption error:", decryptError);
            setSyncMessage({ text: 'Contraseña incorrecta. No se pudo descifrar la cartera.', type: 'error' });
            setIsSyncing(false);
            return;
          }
        }

        if (Array.isArray(data)) {
          setProperties(data.map(sanitizeImportedProperty));
        } else if (data && Array.isArray(data.properties)) {
          setProperties(data.properties.map(sanitizeImportedProperty));
          if (Array.isArray(data.customZones)) {
            setCustomZones(data.customZones);
          }
        }
        setSyncCode(cleanCode);
        setSyncPassword(inputSyncPassword);
        setCloudMode(resData.mode);
        localStorage.setItem('appPisos_syncCode', cleanCode);
        if (inputSyncPassword) {
          localStorage.setItem('appPisos_syncPassword', inputSyncPassword);
        } else {
          localStorage.removeItem('appPisos_syncPassword');
        }
        localStorage.setItem('appPisos_cloudMode', resData.mode);
        setSyncMessage({ 
          text: `¡Cartera cargada con éxito! Modo: ${resData.mode === 'cloud' ? 'Nube (Vercel KV)' : 'Servidor Local'}` + (inputSyncPassword ? ' (Descifrada)' : ''), 
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

  // --- MÉTODOS DE COPIA DE SEGURIDAD (IMPORTAR) ---
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
              setProperties(parsed.map(sanitizeImportedProperty));
              setCustomZones([]);
              setSelectedPropertyIds([]);
            }
          } else {
            alert('El archivo JSON no tiene un formato de propiedades válido.');
          }
        } else if (parsed && Array.isArray(parsed.properties)) {
          const isValid = parsed.properties.every(p => p.id && p.nombre && typeof p.precio === 'number');
          if (isValid) {
            if (confirm('¿Estás seguro de que quieres importar este archivo? Esto reemplazará tu cartera actual.')) {
              setProperties(parsed.properties.map(sanitizeImportedProperty));
              if (Array.isArray(parsed.customZones)) {
                setCustomZones(parsed.customZones);
              }
              setSelectedPropertyIds([]);
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
        { id: '1', nombre: 'Piso Talavera', zona: 'Talavera', planta: '1', m2: 75, precio: 75000, itp: 9, reforma: 8000, alquiler: 550, comunidad: 30, ibi: 180, seguro: 120, tin: 3.5, plazo: 30, honorarios: 0, notariaRegistro: 1, sinHipoteca: false, precioOriginal: 75000 },
        { id: '2', nombre: 'Centro Segovia', zona: 'Segovia', planta: '2', m2: 80, precio: 145000, itp: 8, reforma: 0, alquiler: 850, comunidad: 50, ibi: 300, seguro: 200, tin: 3.2, plazo: 25, honorarios: 0, notariaRegistro: 2, sinHipoteca: false, precioOriginal: 145000 },
      ]);
      setExpandedPropertyId(null);
      setSelectedPropertyIds([]);
    }
  };

  const [expandedPropertyId, setExpandedPropertyId] = useState(null);
  const [showExtraSimulatorOptions, setShowExtraSimulatorOptions] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);

  // --- NUEVO: ESTADOS PARA FILTRADO Y COMPARACIÓN (MÓDULO 2) ---
  const [filterText, setFilterText] = useState('');
  const [filterMaxPrecio, setFilterMaxPrecio] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('Todos');
  const [filterHipotecaMode, setFilterHipotecaMode] = useState('Todos');
  const [filterZone, setFilterZone] = useState('Todos');
  const [filterContactStatus, setFilterContactStatus] = useState('Todos');
  const [groupingMode, setGroupingMode] = useState('none');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('listado');
  const [hoveredGraphPropId, setHoveredGraphPropId] = useState(null);

  const toggleSelectProperty = (id) => {
    setSelectedPropertyIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllProperties = () => {
    if (selectedPropertyIds.length === filteredProperties.length) {
      setSelectedPropertyIds([]);
    } else {
      setSelectedPropertyIds(filteredProperties.map(p => p.id));
    }
  };

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
  const [showFiscalFormOptions, setShowFiscalFormOptions] = useState(false);

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
    alquiler: 700, comunidad: 40, ibi: 250, seguro: 150, tin: 3.5, plazo: 30, honorarios: 0, notariaRegistro: 2, sinHipoteca: false, precioOriginal: 0,
    financiacionPct: 80, irpfMarginal: 30, porcentajeConstruccion: 70, viviendaHabitual: true,
    revalorizacionAnual: 2, ipcAnual: 2,
    contactStatus: 'pending', contactDate: '', contactNotes: '', contactPhone: '', contactName: ''
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
          precioOriginal: d.precio !== null ? Number(d.precio) : prev.precioOriginal,
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
          precioOriginal: d.precio !== null ? Number(d.precio) : prev.precioOriginal,
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
    // Valores por defecto autocurativos si los campos no existen en inmuebles antiguos
    const activeFinanciacionPct = prop.financiacionPct !== undefined ? prop.financiacionPct : 80;
    const activeIrpfMarginal = prop.irpfMarginal !== undefined ? prop.irpfMarginal : 30;
    const activePorcentajeConstruccion = prop.porcentajeConstruccion !== undefined ? prop.porcentajeConstruccion : 70;
    const activeViviendaHabitual = prop.viviendaHabitual !== undefined ? prop.viviendaHabitual : true;
    const activeRevalorizacionAnual = prop.revalorizacionAnual !== undefined ? prop.revalorizacionAnual : 2;
    const activeIpcAnual = prop.ipcAnual !== undefined ? prop.ipcAnual : 2;

    // 1. Gastos y Capital
    const notariaPct = prop.notariaRegistro !== undefined ? prop.notariaRegistro : Math.max(0, 10 - prop.itp);
    const notariaRegistro = prop.precio * (notariaPct / 100);
    const importeITP = prop.precio * (prop.itp / 100);
    const honorariosInmo = prop.honorarios || 0;
    const gastosAdquisicion = importeITP + notariaRegistro + prop.reforma + honorariosInmo;

    const pctFinanciacion = prop.sinHipoteca ? 0 : activeFinanciacionPct / 100;
    const entradaAportada = prop.precio * (1 - pctFinanciacion);
    const capitalAportadoTotal = entradaAportada + gastosAdquisicion;
    const financiacion = prop.sinHipoteca ? 0 : prop.precio * pctFinanciacion;

    // 2. Hipoteca (Sistema Francés)
    const activeTin = globalMortgage.active ? globalMortgage.tin : prop.tin;
    const activePlazo = globalMortgage.active ? globalMortgage.plazo : prop.plazo;
    
    const mortgageInfo = calculateMortgageSchedule(financiacion, activeTin, activePlazo);
    const cuotaMensual = prop.sinHipoteca ? 0 : mortgageInfo.monthlyPayment;
    
    // Suma de intereses del primer año (primeros 12 meses)
    let interesesPrimerAno = 0;
    if (!prop.sinHipoteca && mortgageInfo.schedule.length > 0) {
      for (let i = 0; i < Math.min(12, mortgageInfo.schedule.length); i++) {
        interesesPrimerAno += mortgageInfo.schedule[i].interest;
      }
    }

    // 3. Flujo de Caja (Antes de Impuestos)
    const vacancia = prop.alquiler * 0.05; // 5% de provisión
    const gastosFijosMensuales = prop.comunidad + (prop.ibi / 12) + (prop.seguro / 12);
    const cashFlowMensual = prop.alquiler - (cuotaMensual + gastosFijosMensuales + vacancia);

    // 4. Rentabilidades (Antes de Impuestos)
    const rentabilidadBruta = ((prop.alquiler * 12) / (prop.precio + (prop.reforma || 0))) * 100;
    const rentabilidadNeta = ((cashFlowMensual * 12) / capitalAportadoTotal) * 100;

    // 5. Simulación Fiscal IRPF España
    const amortizacionConstruccion = (prop.precio + gastosAdquisicion) * (activePorcentajeConstruccion / 100) * 0.03;
    const deduccionesAnuales = (prop.comunidad * 12) + prop.ibi + prop.seguro + interesesPrimerAno + amortizacionConstruccion;
    const ingresosAlquilerAnuales = prop.alquiler * 12;
    const rendimientoNetoAnual = Math.max(0, ingresosAlquilerAnuales - deduccionesAnuales);
    const baseImponibleAnual = activeViviendaHabitual ? rendimientoNetoAnual * 0.50 : rendimientoNetoAnual;
    const impuestosIRPFAnuales = baseImponibleAnual * (activeIrpfMarginal / 100);
    const impuestoIRPFMensual = impuestosIRPFAnuales / 12;

    const cashFlowMensualPostImpuestos = cashFlowMensual - impuestoIRPFMensual;
    const rentabilidadNetaPostImpuestos = ((cashFlowMensualPostImpuestos * 12) / capitalAportadoTotal) * 100;

    // 6. Proyección a 10 Años y Cálculo de TIR
    const cashFlowsTIR = [-capitalAportadoTotal];
    const monthlySchedule = mortgageInfo.schedule;

    for (let t = 1; t <= 10; t++) {
      const inflationFactor = Math.pow(1 + activeIpcAnual / 100, t - 1);
      const ingresosAlquilerT = prop.alquiler * 12 * inflationFactor;
      const vacanciaT = ingresosAlquilerT * 0.05;
      const gastosOperativosT = ((prop.comunidad * 12) + prop.ibi + prop.seguro) * inflationFactor;
      const cuotaAnualT = cuotaMensual * 12;
      
      // Sumar intereses del año t
      let interesesAnoT = 0;
      const startMonth = (t - 1) * 12;
      if (!prop.sinHipoteca && monthlySchedule.length > 0) {
        for (let m = startMonth; m < Math.min(startMonth + 12, monthlySchedule.length); m++) {
          interesesAnoT += monthlySchedule[m].interest;
        }
      }

      const deduccionesT = ((prop.comunidad * 12) * inflationFactor) + (prop.ibi * inflationFactor) + (prop.seguro * inflationFactor) + interesesAnoT + amortizacionConstruccion;
      const rendimientoNetoT = Math.max(0, ingresosAlquilerT - deduccionesT);
      const baseImponibleT = activeViviendaHabitual ? rendimientoNetoT * 0.50 : rendimientoNetoT;
      const impuestosT = baseImponibleT * (activeIrpfMarginal / 100);

      const cashFlowAnualT = ingresosAlquilerT - cuotaAnualT - gastosOperativosT - vacanciaT - impuestosT;

      if (t === 10) {
        const precioVenta = prop.precio * Math.pow(1 + activeRevalorizacionAnual / 100, 10);
        const gastosVenta = precioVenta * 0.05;
        let deudaPendiente = 0;
        const endMonthIndex = 120 - 1;
        if (!prop.sinHipoteca && endMonthIndex < monthlySchedule.length) {
          deudaPendiente = monthlySchedule[endMonthIndex].balance;
        }
        const cobroNetoVenta = precioVenta - gastosVenta - deudaPendiente;
        cashFlowsTIR.push(cashFlowAnualT + cobroNetoVenta);
      } else {
        cashFlowsTIR.push(cashFlowAnualT);
      }
    }

    const tir = calculateIRR(cashFlowsTIR);

    return {
      gastosAdquisicion,
      capitalAportadoTotal,
      financiacion,
      cuotaMensual,
      cashFlowMensual,
      rentabilidadBruta,
      rentabilidadNeta,

      // Valores avanzados calculados
      interesesPrimerAno,
      amortizacionConstruccion,
      impuestosIRPFAnuales,
      impuestoIRPFMensual,
      cashFlowMensualPostImpuestos,
      rentabilidadNetaPostImpuestos,
      tir,
      cashFlowsTIR
    };
  };

  // Enriquecemos la lista de propiedades con sus métricas calculadas
  const enrichedProperties = useMemo(() => {
    return properties.map(p => ({ ...p, metrics: calculateMetrics(p) }));
  }, [properties, globalMortgage]);

  // Filtrado reactivo de la cartera
  const filteredProperties = useMemo(() => {
    return enrichedProperties.filter(p => {
      // 1. Filtro de texto (nombre o zona)
      if (filterText) {
        const text = filterText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const matchesNombre = p.nombre && p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(text);
        const matchesZona = p.zona && zonesConfig[p.zona]?.name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(text);
        const matchesZonaKey = p.zona && p.zona.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(text);
        if (!matchesNombre && !matchesZona && !matchesZonaKey) return false;
      }
      
      // 2. Filtro de precio máximo
      if (filterMaxPrecio !== '') {
        const maxP = Number(filterMaxPrecio);
        if (p.precio > maxP) return false;
      }

      // 3. Filtro de Hipoteca
      if (filterHipotecaMode === 'Con Hipoteca') {
        if (p.sinHipoteca) return false;
      } else if (filterHipotecaMode === 'Sin Hipoteca') {
        if (!p.sinHipoteca) return false;
      }

      // 4. Filtro de Score mínimo
      if (filterMinScore !== 'Todos') {
        const score = getPropertyScore(p, p.metrics, zonesConfig);
        const gradePoints = { 'A+': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0 };
        const pPoints = gradePoints[score.grade] ?? 0;
        const limitPoints = gradePoints[filterMinScore] ?? 0;
        if (pPoints < limitPoints) return false;
      }

      // 5. Filtro de Zona / Ciudad
      if (filterZone !== 'Todos') {
        if (p.zona !== filterZone) return false;
      }

      // 6. Filtro de Estado de Contacto
      if (filterContactStatus !== 'Todos') {
        const status = p.contactStatus || 'pending';
        if (status !== filterContactStatus) return false;
      }

      return true;
    });
  }, [enrichedProperties, filterText, filterMaxPrecio, filterMinScore, filterHipotecaMode, filterZone, filterContactStatus, zonesConfig]);

  const maxPropertyPrice = useMemo(() => {
    if (properties.length === 0) return 300000;
    return Math.max(...properties.map(p => p.precio));
  }, [properties]);

  const selectedPropertiesToCompare = useMemo(() => {
    return enrichedProperties.filter(p => selectedPropertyIds.includes(p.id));
  }, [enrichedProperties, selectedPropertyIds]);

  const getWinnerId = (metricKey, isLowerBetter = false) => {
    if (selectedPropertiesToCompare.length === 0) return null;
    let winner = selectedPropertiesToCompare[0];
    
    selectedPropertiesToCompare.forEach(p => {
      let val = p[metricKey] ?? p.metrics[metricKey];
      let winVal = winner[metricKey] ?? winner.metrics[metricKey];
      
      if (val === undefined || val === null) return;
      if (winVal === undefined || winVal === null) {
        winner = p;
        return;
      }

      if (isLowerBetter) {
        if (val < winVal) winner = p;
      } else {
        if (val > winVal) winner = p;
      }
    });

    return winner.id;
  };

  const handleCopyComparisonMarkdown = () => {
    if (selectedPropertiesToCompare.length === 0) return;
    
    let md = `| Métrica | ${selectedPropertiesToCompare.map(p => p.nombre).join(' | ')} |\n`;
    md += `| --- | ${selectedPropertiesToCompare.map(() => '---').join(' | ')} |\n`;
    
    const addRow = (label, key, isMetric = false, formatFn = val => val) => {
      md += `| ${label} | ${selectedPropertiesToCompare.map(p => {
        const val = isMetric ? p.metrics[key] : p[key];
        return formatFn(val);
      }).join(' | ')} |\n`;
    };

    addRow('Zona', 'zona', false, val => zonesConfig[val]?.name || val);
    addRow('Precio de Compra', 'precio', false, val => formatCurrency(val));
    addRow('Reforma Estimada', 'reforma', false, val => formatCurrency(val));
    addRow('Capital Aportado Total', 'capitalAportadoTotal', true, val => formatCurrency(val));
    addRow('Alquiler Estimado', 'alquiler', false, val => formatCurrency(val));
    addRow('Cuota Hipoteca', 'cuotaMensual', true, val => formatCurrency(val));
    addRow('Cash Flow Neto (Antes Imp.)', 'cashFlowMensual', true, val => formatCurrency(val));
    addRow('Impuesto IRPF Mensual', 'impuestoIRPFMensual', true, val => formatCurrency(val));
    addRow('Cash Flow Neto (Post-Imp.)', 'cashFlowMensualPostImpuestos', true, val => formatCurrency(val));
    addRow('Rentabilidad Bruta', 'rentabilidadBruta', true, val => formatPercent(val));
    addRow('ROE (Antes Imp.)', 'rentabilidadNeta', true, val => formatPercent(val));
    addRow('ROE Post-Impuestos', 'rentabilidadNetaPostImpuestos', true, val => formatPercent(val));
    addRow('TIR a 10 Años', 'tir', true, val => val !== null ? formatPercent(val) : 'N/A');

    navigator.clipboard.writeText(md).then(() => {
      setNotification({
        text: '¡Comparación copiada al portapapeles en formato Markdown!',
        type: 'success'
      });
    }).catch(err => {
      console.error("Error al copiar comparación:", err);
    });
  };

  // Ordenación de la tabla
  const sortedProperties = useMemo(() => {
    let sortableItems = [...filteredProperties];
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
  }, [filteredProperties, sortConfig]);

  // Zonas únicas presentes en la cartera
  const uniqueZonesInProperties = useMemo(() => {
    const zonesSet = new Set(properties.map(p => p.zona).filter(Boolean));
    return Array.from(zonesSet);
  }, [properties]);

  // Agrupación de la cartera
  const groupedProperties = useMemo(() => {
    if (groupingMode === 'none') {
      return [{ groupName: 'Todos los Inmuebles', properties: sortedProperties }];
    }
    
    const groups: { [key: string]: typeof sortedProperties } = {};
    
    if (groupingMode === 'zona') {
      sortedProperties.forEach(prop => {
        const zoneName = zonesConfig[prop.zona]?.name || prop.zona || 'Sin Zona';
        if (!groups[zoneName]) {
          groups[zoneName] = [];
        }
        groups[zoneName].push(prop);
      });
    } else if (groupingMode === 'contacto') {
      sortedProperties.forEach(prop => {
        const status = prop.contactStatus || 'pending';
        const label = getStatusLabel(status);
        if (!groups[label]) {
          groups[label] = [];
        }
        groups[label].push(prop);
      });
    }
    
    return Object.entries(groups).map(([name, list]) => ({
      groupName: name,
      properties: list
    }));
  }, [sortedProperties, groupingMode, zonesConfig]);

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
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
      };
      if (name === 'zona') {
        const targetZone = zonesConfig[value];
        if (targetZone && targetZone.itp !== undefined) {
          updated.itp = targetZone.itp;
        }
      }
      
      // Auto-calcular el porcentaje de notariaRegistro como el restante para llegar al 10%.
      // Si el valor anterior de notariaRegistro coincide con el valor estimado para los valores previos,
      // actualizamos dinámicamente. Si el usuario lo ha modificado manualmente a otro porcentaje, lo respetamos.
      if (name === 'itp' || name === 'zona') {
        const prevCalculated = Math.max(0, 10 - prev.itp);
        if (prev.notariaRegistro === prevCalculated || prev.notariaRegistro === 2) {
          updated.notariaRegistro = Math.max(0, 10 - updated.itp);
        }
      }

      return updated;
    });
  };

  const handleAddProperty = (e) => {
    e.preventDefault();
    if (formErrors.length > 0) return;
    
    const finalPrecioOriginal = Number(formData.precioOriginal) || Number(formData.precio);
    const dataToSave = { ...formData, precioOriginal: finalPrecioOriginal };
    
    // Modo Creación: Añadir nuevo inmueble
    setProperties(prev => [...prev, { ...dataToSave, id: Date.now().toString() }]);
    setNotification({
      text: `Inmueble "${formData.nombre}" añadido a la cartera.`,
      type: 'success'
    });
    setFormData({ ...initialForm, nombre: '' }); // Reset partial
  };

  const handleDelete = (id) => {
    const propToDelete = properties.find(p => p.id === id);
    setProperties(prev => prev.filter(p => p.id !== id));
    setSelectedPropertyIds(prev => prev.filter(item => item !== id));
    if (propToDelete) {
      setNotification({
        text: `Inmueble "${propToDelete.nombre}" eliminado.`,
        type: 'info'
      });
    }
  };

  const optimizeProperty = (prop) => {
    const zone = zonesConfig[prop.zona];
    if (!zone) return prop;

    const avgRent = zone.avgRentPriceM2 * prop.m2;
    const targetRent = Math.round(avgRent * 1.10);
    // Conservamos el alquiler actual del inmueble si es mayor que 0; de lo contrario, usamos targetRent
    const optimizedAlquiler = prop.alquiler > 0 ? prop.alquiler : targetRent;

    const zoneRentToPriceRatio = zone.avgRentPriceM2 > 0 ? (zone.avgPriceM2 / zone.avgRentPriceM2) : 150;
    const targetPrice = Math.round(optimizedAlquiler * zoneRentToPriceRatio * 0.85);
    const baselinePrice = prop.precioOriginal || prop.precio;
    const optimizedPrecio = Math.min(baselinePrice, targetPrice);

    const optimizedReforma = prop.reforma; // Conservamos la reforma introducida por el usuario

    const optimizedSinHipoteca = false;
    const optimizedTin = 3.0;
    const optimizedPlazo = 30;
    const optimizedHonorarios = 0;

    const optimizedComunidad = Math.min(prop.comunidad, 40);
    const optimizedIbi = Math.min(prop.ibi, 200);
    const optimizedSeguro = Math.min(prop.seguro, 150);

    const optimizedNotariaPct = Math.max(1.0, 10 - (zone.itp || prop.itp || 8));

    return {
      ...prop,
      precio: optimizedPrecio,
      alquiler: optimizedAlquiler,
      reforma: optimizedReforma,
      sinHipoteca: optimizedSinHipoteca,
      tin: optimizedTin,
      plazo: optimizedPlazo,
      honorarios: optimizedHonorarios,
      comunidad: optimizedComunidad,
      ibi: optimizedIbi,
      seguro: optimizedSeguro,
      notariaRegistro: optimizedNotariaPct
    };
  };

  const handleOptimizeProperty = (id) => {
    setProperties(prev => prev.map(p => {
      if (p.id === id) {
        const optimized = optimizeProperty(p);
        setNotification({
          text: `Inmueble "${p.nombre}" optimizado con éxito para una rentabilidad máxima realista.`,
          type: 'success'
        });
        return optimized;
      }
      return p;
    }));
  };

  const handleOptimizeAll = () => {
    if (confirm('¿Quieres optimizar todos los inmuebles de tu cartera a parámetros de rentabilidad realistas? Esto modificará sus valores.')) {
      setProperties(prev => prev.map(p => optimizeProperty(p)));
      setNotification({
        text: '¡Toda la cartera de inmuebles ha sido optimizada con éxito!',
        type: 'success'
      });
    }
  };

  const getPriceRangesForGrades = (prop) => {
    const selectedPlanta = PLANTAS.find(p => p.id === prop.planta);
    if (selectedPlanta?.blocked) {
      return null;
    }

    const baselinePrice = prop.precioOriginal || prop.precio;
    const minPrice = Math.max(15000, Math.round(baselinePrice * 0.5));
    const maxPrice = Math.max(baselinePrice * 2.5, 300000);
    const step = 500;

    const ranges = {
      'A+': { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity },
      'A':  { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity },
      'B':  { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity },
      'C':  { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity },
      'D':  { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity },
      'E':  { min: Infinity, max: -Infinity, minRoe: Infinity, maxRoe: -Infinity, minCf: Infinity, maxCf: -Infinity, minBruta: Infinity, maxBruta: -Infinity }
    };

    for (let price = minPrice; price <= maxPrice; price += step) {
      const tempProp = { ...prop, precio: price };
      const tempMetrics = calculateMetrics(tempProp);
      const score = getPropertyScore(tempProp, tempMetrics, zonesConfig);

      const grade = score.grade;
      if (ranges[grade]) {
        if (price < ranges[grade].min) ranges[grade].min = price;
        if (price > ranges[grade].max) ranges[grade].max = price;
        
        const roe = tempMetrics.rentabilidadNeta;
        const cf = tempMetrics.cashFlowMensual;
        const bruta = tempMetrics.rentabilidadBruta;

        if (roe < ranges[grade].minRoe) ranges[grade].minRoe = roe;
        if (roe > ranges[grade].maxRoe) ranges[grade].maxRoe = roe;

        if (cf < ranges[grade].minCf) ranges[grade].minCf = cf;
        if (cf > ranges[grade].maxCf) ranges[grade].maxCf = cf;

        if (bruta < ranges[grade].minBruta) ranges[grade].minBruta = bruta;
        if (bruta > ranges[grade].maxBruta) ranges[grade].maxBruta = bruta;
      }
    }

    return ranges;
  };

  // --- MÉTODOS DE COPIA DE SEGURIDAD (EXPORTAR CON ANÁLISIS ENRIQUECIDO) ---
  const enrichPropertyForExport = (prop) => {
    const metrics = calculateMetrics(prop);
    const score = getPropertyScore(prop, metrics, zonesConfig);
    const negotiationRanges = getPriceRangesForGrades(prop);
    return {
      ...prop,
      metrics,
      score,
      negotiationRanges
    };
  };

  const handleExportJSON = () => {
    const payload = {
      properties: properties.map(enrichPropertyForExport),
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

  const handleExportSelectedJSON = () => {
    if (selectedPropertyIds.length === 0) return;
    const selectedProps = properties.filter(p => selectedPropertyIds.includes(p.id));
    const selectedZones = customZones.filter(z => selectedProps.some(p => p.zona === z.id));
    const payload = {
      properties: selectedProps.map(enrichPropertyForExport),
      customZones: selectedZones
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `seleccion_inmuebles_${new Date().toISOString().slice(0, 10)}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleProperty = (prop) => {
    const payload = {
      properties: [enrichPropertyForExport(prop)],
      customZones: customZones.filter(z => z.id === prop.zona)
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `inmueble_${prop.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
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
            {/* Botón Sincronizar - Compacto en móvil, completo en desktop */}
            <button
              onClick={() => {
                setInputSyncCode(syncCode);
                setSyncMessage(null);
                setShowSyncModal(true);
              }}
              className={`flex items-center justify-center gap-1.5 h-10 px-3 sm:px-4 border text-xs font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                syncCode 
                  ? 'border-blue-500/30 bg-blue-950/40 text-blue-400 hover:bg-blue-950/60 hover:border-blue-500/50 shadow-glow-blue' 
                  : 'border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-350 hover:text-white'
              }`}
              title="Sincronizar cartera en la nube / otros dispositivos"
            >
              <Cloud className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">{syncCode ? `Nube: ${syncCode}` : 'Sincronizar'}</span>
            </button>

            {/* Botón Zonas - Compacto en móvil, completo en desktop */}
            <button
              onClick={() => {
                setProvinceSearch('');
                setShowZonesModal(true);
              }}
              className="flex items-center justify-center gap-1.5 h-10 px-3 sm:px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
              title="Configurar parámetros de las Zonas y Provincias"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span className="hidden sm:inline">Zonas</span>
            </button>

            {/* Desktop-only secondary buttons */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={handleResetDemo}
                className="flex items-center gap-1.5 h-10 px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                title="Restablecer datos de ejemplo"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                <span>Demo</span>
              </button>
              <label className="flex items-center gap-1.5 h-10 px-4 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-slate-400" />
                <span>Importar</span>
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
                title="Exportar toda la cartera a JSON"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar Cartera</span>
              </button>
            </div>

            {/* Mobile-only hamburger menu */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex items-center justify-center h-10 w-10 border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <span className="text-lg font-bold">≡</span>
              </button>

              {mobileMenuOpen && (
                <>
                  {/* Overlay to close menu on click outside */}
                  <div className="fixed inset-0 z-30" onClick={() => setMobileMenuOpen(false)}></div>
                  
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-40 space-y-1 animate-scale-up">
                    <button
                      onClick={() => {
                        handleResetDemo();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 h-10 px-3 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-all text-left cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4 text-slate-400" />
                      <span>Cargar Demo</span>
                    </button>
                    <label className="w-full flex items-center gap-2 h-10 px-3 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-all text-left cursor-pointer">
                      <Upload className="h-4 w-4 text-slate-400" />
                      <span>Importar JSON</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          handleImportJSON(e);
                          setMobileMenuOpen(false);
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => {
                        handleExportJSON();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 h-10 px-3 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-all text-left cursor-pointer"
                    >
                      <Download className="h-4 w-4 text-slate-400" />
                      <span>Exportar Cartera</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 lg:pb-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          
          {/* SECCIÓN LATERAL: FORMULARIO */}
          <div className={`w-full lg:w-[400px] shrink-0 ${mobileTab !== 'añadir' ? 'hidden lg:block' : ''}`}>
            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden lg:sticky lg:top-24">
              <div className="bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Plus className="h-5 w-5 text-emerald-450" />
                  <h2 className="font-bold text-base text-slate-100">
                    Nuevo Inmueble
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5 tracking-wide" title="Precio original del anuncio en Idealista para poder comparar">Precio Idealista (€)</label>
                    <input type="number" name="precioOriginal" value={formData.precioOriginal || ''} onChange={handleInputChange} placeholder="Opcional" className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    <div className="text-[10px] text-slate-500 mt-1 font-medium leading-tight">Valor de referencia inicial</div>
                  </div>
                </div>

                {/* Gastos Adquisición */}
                <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/80 space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Adquisición</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">ITP (%)</label>
                      <input required type="number" step="0.1" name="itp" value={formData.itp} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Reforma (€)</label>
                      <input required type="number" name="reforma" value={formData.reforma} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Honorarios Inmobiliaria (€)</label>
                      <input required type="number" name="honorarios" value={formData.honorarios} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Notaría y Registro (%)</label>
                      <input required type="number" step="0.1" name="notariaRegistro" value={formData.notariaRegistro} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                    </div>
                  </div>
                </div>

                {/* Ingresos y Gastos Corrientes */}
                <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/80 space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Operativa</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Alquiler Mes (€)</label>
                      <input required type="number" name="alquiler" value={formData.alquiler} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                      {formData.m2 > 0 && zonesConfig[formData.zona] && (() => {
                        const suggested = Math.round(formData.m2 * zonesConfig[formData.zona].avgRentPriceM2);
                        return (
                          <div className="space-y-2 mt-1.5">
                            <div className="text-[10px] text-blue-450 flex justify-between items-center font-medium leading-none">
                              <span>💡 Sugerido: ~{suggested} €</span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, alquiler: suggested }))}
                                className="text-[9px] bg-blue-950/40 text-blue-400 px-2 py-1 rounded hover:bg-blue-900/40 border border-blue-900/50 transition-all font-bold uppercase cursor-pointer"
                              >
                                Aplicar
                              </button>
                            </div>
                            <div className="text-[10px] text-amber-500/90 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 flex items-start gap-1.5 leading-relaxed font-semibold">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>El alquiler sugerido es una estimación media por m². Se aconseja investigar en Idealista el precio real de alquiler de la zona específica para obtener una rentabilidad precisa.</span>
                            </div>
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
                <div className={`p-3.5 rounded-xl border transition-all duration-200 bg-slate-950/45 border-slate-850/80 space-y-3`}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Financiación</h3>
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="sinHipoteca" 
                        checked={formData.sinHipoteca || false} 
                        onChange={handleInputChange} 
                        className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer" 
                      />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sin Hipoteca</span>
                    </label>
                  </div>
                  
                  {!formData.sinHipoteca ? (
                    <div className={`transition-all duration-200 ${globalMortgage.active ? 'opacity-40' : ''} space-y-3`}>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Hipoteca ({formData.financiacionPct !== undefined ? formData.financiacionPct : 80}% del precio)</span>
                        {globalMortgage.active && <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">Global Activa</span>}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500">
                          <span>LTV (Financiación):</span>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              name="financiacionPct" 
                              value={formData.financiacionPct !== undefined ? formData.financiacionPct : 80} 
                              onChange={handleInputChange} 
                              min="10" 
                              max="100" 
                              className="w-12 h-6 text-right px-1 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold" 
                            />
                            <span>%</span>
                          </div>
                        </div>
                        <input 
                          type="range" 
                          name="financiacionPct" 
                          min="10" 
                          max="100" 
                          step="5"
                          value={formData.financiacionPct !== undefined ? formData.financiacionPct : 80} 
                          onChange={handleInputChange} 
                          className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">TIN (%)</label>
                          <input disabled={globalMortgage.active} required={!formData.sinHipoteca} type="number" step="0.1" name="tin" value={formData.tin} onChange={handleInputChange} className="w-full h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed" />
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
                  ) : (
                    <div className="text-[11px] text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-900 leading-relaxed font-medium">
                      <span className="text-emerald-400 font-bold block mb-0.5">🟢 Compra al Contado ("A Toca Teja"):</span>
                      Se aportará el 100% del precio de compra ({formatCurrency(formData.precio)}) más los gastos de adquisición ({formatCurrency((formData.precio * (formData.itp / 100)) + (formData.precio * (formData.notariaRegistro / 100)) + formData.reforma + formData.honorarios)}). No se generará cuota de hipoteca ni intereses mensuales.
                    </div>
                  )}
                </div>

                {/* Parámetros Fiscales e Impuestos Collapsible */}
                <div className="p-3.5 rounded-xl border bg-slate-950/45 border-slate-850/80 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowFiscalFormOptions(!showFiscalFormOptions)}
                    className="w-full flex items-center justify-between text-[10px] font-bold text-slate-455 uppercase tracking-wider focus:outline-none"
                  >
                    <span>Impuestos e IRPF (España)</span>
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-350 ${showFiscalFormOptions ? 'rotate-180' : ''}`} />
                  </button>

                  {showFiscalFormOptions && (
                    <div className="space-y-3.5 pt-2 border-t border-slate-900/60 animate-scale-up text-left">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">IRPF Marginal (%)</label>
                          <input 
                            type="number" 
                            name="irpfMarginal" 
                            value={formData.irpfMarginal !== undefined ? formData.irpfMarginal : 30} 
                            onChange={handleInputChange} 
                            className="w-full h-9 px-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg text-xs focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">% Construcción</label>
                          <input 
                            type="number" 
                            name="porcentajeConstruccion" 
                            value={formData.porcentajeConstruccion !== undefined ? formData.porcentajeConstruccion : 70} 
                            onChange={handleInputChange} 
                            className="w-full h-9 px-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg text-xs focus:outline-none" 
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-500">¿Vivienda Habitual?</span>
                        <label className="relative flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            name="viviendaHabitual" 
                            checked={formData.viviendaHabitual !== undefined ? formData.viviendaHabitual : true} 
                            onChange={handleInputChange} 
                            className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer" 
                          />
                          <span className="text-[10px] font-bold text-slate-400 ml-1.5 uppercase">Sí (Reducción 50%)</span>
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3.5 border-t border-slate-900/40 pt-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">IPC / Inflación (%)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            name="ipcAnual" 
                            value={formData.ipcAnual !== undefined ? formData.ipcAnual : 2} 
                            onChange={handleInputChange} 
                            className="w-full h-9 px-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg text-xs focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">Revaloriz. Anual (%)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            name="revalorizacionAnual" 
                            value={formData.revalorizacionAnual !== undefined ? formData.revalorizacionAnual : 2} 
                            onChange={handleInputChange} 
                            className="w-full h-9 px-3 border border-slate-800 bg-slate-950 text-slate-100 rounded-lg text-xs focus:outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  )}
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

                <button 
                  type="submit" 
                  disabled={formErrors.length > 0}
                  className="w-full mt-4 flex justify-center items-center h-11 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-indigo-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 mr-2" /> Añadir Inmueble
                </button>
              </form>
            </div>
          </div>

          {/* SECCIÓN CENTRAL: TABLA Y DASHBOARD */}
          <div className={`flex-1 space-y-6 overflow-hidden ${mobileTab === 'añadir' ? 'hidden lg:block' : ''}`}>
            
            {/* Panel de Stress Test Hipotecario */}
            <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${mobileTab !== 'analisis' ? 'hidden lg:block' : ''} ${globalMortgage.active ? 'bg-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]' : 'bg-slate-900/40 border-slate-850/80 shadow-md'}`}>
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

            {/* Cabecera de la Cartera */}
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-850/80 rounded-2xl p-5 shadow-md ${mobileTab !== 'cartera' ? 'hidden lg:flex' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Inmuebles en Cartera</h3>
                  <p className="text-xs text-slate-455 mt-0.5">Total de propiedades registradas: <span className="font-extrabold text-slate-300">{properties.length}</span></p>
                </div>
              </div>
              <button
                onClick={handleOptimizeAll}
                className="flex items-center gap-2 h-10 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-xs font-extrabold text-emerald-455 hover:text-emerald-400 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                title="Optimizar todos los inmuebles con parámetros de máxima rentabilidad realista"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Optimizar Cartera</span>
              </button>
              {selectedPropertyIds.length > 0 && (
                <button
                  onClick={handleExportSelectedJSON}
                  className="flex items-center gap-2 h-10 px-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 text-xs font-extrabold text-blue-400 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer animate-fade-in"
                  title="Exportar inmuebles seleccionados a JSON"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Exportar Seleccionados ({selectedPropertyIds.length})</span>
                </button>
              )}
            </div>

            {/* Filtros y Tabs de Navegación (Módulo 2) */}
            <div className={`space-y-4 ${mobileTab !== 'cartera' ? 'hidden lg:block' : ''}`}>
              <div className="flex justify-between items-center gap-3 border-b border-slate-850 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveMainTab('listado')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeMainTab === 'listado' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'}`}
                  >
                    📂 Listado de Inmuebles
                  </button>
                  <button
                    onClick={() => setActiveMainTab('grafico')}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeMainTab === 'grafico' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'}`}
                  >
                    📈 Análisis Gráfico ({filteredProperties.length})
                  </button>
                </div>
                {activeMainTab === 'listado' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Agrupación */}
                    <div className="flex items-center gap-1 bg-slate-900/40 border border-slate-800 rounded-xl px-2.5 h-9">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:inline">Agrupar:</span>
                      <select
                        value={groupingMode}
                        onChange={(e) => setGroupingMode(e.target.value)}
                        className="bg-transparent text-slate-350 rounded text-xs font-bold focus:outline-none cursor-pointer border-none py-0.5 px-1 pr-6"
                      >
                        <option value="none" className="bg-slate-950 text-slate-350">Sin agrupar</option>
                        <option value="zona" className="bg-slate-950 text-slate-350">Ciudad / Zona</option>
                        <option value="contacto" className="bg-slate-950 text-slate-350">Por Contacto</option>
                      </select>
                    </div>

                    <button
                      onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                      className={`flex items-center gap-1.5 h-9 px-3.5 border rounded-xl text-xs font-bold transition-all cursor-pointer ${showFiltersPanel || filterText || filterMaxPrecio || filterMinScore !== 'Todos' || filterHipotecaMode !== 'Todos' || filterZone !== 'Todos' || filterContactStatus !== 'Todos' ? 'border-blue-500/30 bg-blue-500/5 text-blue-400' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200'}`}
                    >
                      <Settings className={`h-3.5 w-3.5 ${showFiltersPanel ? 'animate-spin' : ''}`} />
                      <span>Filtros {filterText || filterMaxPrecio || filterMinScore !== 'Todos' || filterHipotecaMode !== 'Todos' || filterZone !== 'Todos' || filterContactStatus !== 'Todos' ? 'Activos' : ''}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showFiltersPanel ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Panel de Filtros Colapsable */}
              {activeMainTab === 'listado' && showFiltersPanel && (
                <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-scale-up text-left shadow-inner">
                  {/* Búsqueda de Texto */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buscar</label>
                    <input
                      type="text"
                      placeholder="Nombre o zona..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-950 border border-slate-850 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                    />
                  </div>

                  {/* Precio Máximo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Precio Máx:</span>
                      <span className="text-blue-400 font-extrabold">{filterMaxPrecio !== '' ? formatCurrency(filterMaxPrecio) : 'Todos'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max={maxPropertyPrice || 300000}
                        step="5000"
                        value={filterMaxPrecio === '' ? maxPropertyPrice || 300000 : filterMaxPrecio}
                        onChange={(e) => setFilterMaxPrecio(e.target.value === String(maxPropertyPrice || 300000) ? '' : e.target.value)}
                        className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      {filterMaxPrecio !== '' && (
                        <button
                          onClick={() => setFilterMaxPrecio('')}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                        >
                          Limp.
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hipoteca Mode */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Financiación</label>
                    <select
                      value={filterHipotecaMode}
                      onChange={(e) => setFilterHipotecaMode(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-950 border border-slate-850 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Con Hipoteca">Con Hipoteca</option>
                      <option value="Sin Hipoteca">Sin Hipoteca</option>
                    </select>
                  </div>

                  {/* Calificación de Score */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score Mínimo</label>
                    <select
                      value={filterMinScore}
                      onChange={(e) => setFilterMinScore(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-950 border border-slate-850 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                    >
                      <option value="Todos">Todos</option>
                      <option value="A+">A+ Excelente</option>
                      <option value="A">A Muy Bueno+</option>
                      <option value="B">B Bueno+</option>
                      <option value="C">C Aceptable+</option>
                      <option value="D">D Riesgoso+</option>
                    </select>
                  </div>

                  {/* Filtrar por Zona */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Zona / Ciudad</label>
                    <select
                      value={filterZone}
                      onChange={(e) => setFilterZone(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-950 border border-slate-850 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                    >
                      <option value="Todos">Todas las zonas</option>
                      {uniqueZonesInProperties.map(z => (
                        <option key={z} value={z}>{zonesConfig[z]?.name || z}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtrar por Estado de Contacto */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contacto</label>
                    <select
                      value={filterContactStatus}
                      onChange={(e) => setFilterContactStatus(e.target.value)}
                      className="w-full h-9 px-2 bg-slate-950 border border-slate-850 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                    >
                      <option value="Todos">Todos</option>
                      <option value="pending">No contactado</option>
                      <option value="contacted">Contactado</option>
                      <option value="visit_scheduled">Visita programada</option>
                      <option value="visit_done">Visita realizada</option>
                      <option value="offer_submitted">Oferta presentada</option>
                      <option value="negotiation">En negociación</option>
                      <option value="reserved">Reservado / Comprado</option>
                      <option value="discarded">Descartado</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Tab de Gráficos Comparativos (Módulo 2) */}
              {activeMainTab === 'grafico' && (
                <div className="bg-slate-900/40 border border-slate-850/80 rounded-2xl p-6 shadow-xl space-y-6 animate-scale-up">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-left">
                      <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-5 w-5 text-blue-450" />
                        <span>Matriz Inmobiliaria: Rentabilidad vs. Precio</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Cada burbuja representa un inmueble. El eje vertical mide la rentabilidad (ROE %) y el horizontal el precio. El tamaño de la burbuja representa el Cash Flow positivo.
                      </p>
                    </div>
                  </div>

                  {filteredProperties.length === 0 ? (
                    <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      <TrendingUp className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                      <p className="font-semibold text-slate-450">No hay inmuebles que coincidan con los filtros para el gráfico.</p>
                    </div>
                  ) : (
                    <div className="relative bg-slate-950/45 rounded-xl border border-slate-850/50 p-4 overflow-x-auto shadow-inner">
                      {(() => {
                        const prices = filteredProperties.map(p => p.precio);
                        const roes = filteredProperties.map(p => p.metrics.rentabilidadNeta);
                        const cfs = filteredProperties.map(p => p.metrics.cashFlowMensual);
                        
                        const minPrice = Math.min(...prices, 50000);
                        const maxPrice = Math.max(...prices, 150000) * 1.1;
                        const minRoe = Math.min(...roes, 0);
                        const maxRoe = Math.max(...roes, 10) * 1.2;
                        const minCf = Math.min(...cfs, 0);
                        const maxCf = Math.max(...cfs, 300);

                        const margin = { top: 30, right: 30, bottom: 50, left: 60 };
                        const graphW = 800 - margin.left - margin.right;
                        const graphH = 400 - margin.top - margin.bottom;

                        const graphNodes = filteredProperties.map(p => {
                          const score = getPropertyScore(p, p.metrics, zonesConfig);
                          const priceRange = maxPrice - minPrice;
                          const roeRange = maxRoe - minRoe;
                          
                          const x = margin.left + ((p.precio - minPrice) / (priceRange || 1)) * graphW;
                          const y = margin.top + graphH - ((p.metrics.rentabilidadNeta - minRoe) / (roeRange || 1)) * graphH;
                          
                          const cfRange = maxCf - minCf;
                          const r = 8 + ((Math.max(0, p.metrics.cashFlowMensual) - 0) / (cfRange || 1)) * 16;
                          
                          return {
                            id: p.id,
                            nombre: p.nombre,
                            precio: p.precio,
                            roe: p.metrics.rentabilidadNeta,
                            cf: p.metrics.cashFlowMensual,
                            grade: score.grade,
                            scoreColor: score.color,
                            x,
                            y,
                            r
                          };
                        });

                        return (
                          <>
                            <svg viewBox="0 0 800 400" className="w-full min-w-[650px] h-auto overflow-visible">
                              {/* Ejes y Cuadrícula */}
                              {/* Líneas horizontales de ROE */}
                              {[0, 2, 4, 6, 8, 10, 12, 14].map((roeValue, idx) => {
                                const y = margin.top + graphH - ((roeValue - minRoe) / ((maxRoe - minRoe) || 1)) * graphH;
                                if (y < margin.top || y > margin.top + graphH) return null;

                                return (
                                  <g key={idx}>
                                    <line x1="60" y1={y} x2="770" y2={y} stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                                    <text x="50" y={y + 4} fill="#64748b" className="text-[10px] font-bold text-right" textAnchor="end">{roeValue}%</text>
                                  </g>
                                );
                              })}

                              {/* Líneas verticales de Precios */}
                              {(() => {
                                const step = Math.round((maxPrice - minPrice) / 5 / 10000) * 10000 || 20000;
                                const gridValues = [];
                                for (let val = Math.ceil(minPrice / step) * step; val < maxPrice; val += step) {
                                  gridValues.push(val);
                                }

                                return gridValues.map((priceVal, idx) => {
                                  const x = margin.left + ((priceVal - minPrice) / ((maxPrice - minPrice) || 1)) * graphW;
                                  return (
                                    <g key={idx}>
                                      <line x1={x} y1="30" x2={x} y2="350" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
                                      <text x={x} y="370" fill="#64748b" className="text-[10px] font-bold text-center" textAnchor="middle">{formatCurrency(priceVal)}</text>
                                    </g>
                                  );
                                });
                              })()}

                              {/* Títulos Ejes */}
                              <text x="400" y="395" fill="#94a3b8" className="text-[11px] font-extrabold uppercase tracking-wider text-center" textAnchor="middle">Precio de Compra (€)</text>
                              <text x="18" y="190" fill="#94a3b8" className="text-[11px] font-extrabold uppercase tracking-wider" transform="rotate(-90 18 190)" textAnchor="middle">Rentabilidad Neta (ROE %)</text>

                              {/* Burbujas */}
                              {graphNodes.map((node) => {
                                const isHovered = hoveredGraphPropId === node.id;
                                return (
                                  <g 
                                    key={node.id}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHoveredGraphPropId(node.id)}
                                    onMouseLeave={() => setHoveredGraphPropId(null)}
                                    onClick={() => {
                                      setExpandedPropertyId(node.id);
                                      setActiveMainTab('listado');
                                      setTimeout(() => {
                                        document.getElementById(`property-row-${node.id}`)?.scrollIntoView({ behavior: 'smooth' });
                                      }, 100);
                                    }}
                                  >
                                    <circle 
                                      cx={node.x} 
                                      cy={node.y} 
                                      r={node.r + (isHovered ? 5 : 0)} 
                                      fill={node.grade === 'A+' ? '#10b981' : node.grade === 'A' ? '#14b8a6' : node.grade === 'B' ? '#3b82f6' : node.grade === 'C' ? '#f59e0b' : node.grade === 'D' ? '#f97316' : '#ef4444'} 
                                      fillOpacity={isHovered ? 0.45 : 0.25}
                                      stroke={node.grade === 'A+' ? '#10b981' : node.grade === 'A' ? '#14b8a6' : node.grade === 'B' ? '#3b82f6' : node.grade === 'C' ? '#f59e0b' : node.grade === 'D' ? '#f97316' : '#ef4444'} 
                                      strokeWidth={isHovered ? 3 : 1.5}
                                      className="transition-all duration-300"
                                    />
                                    {node.r > 12 && (
                                      <text 
                                        x={node.x} 
                                        y={node.y + 3.5} 
                                        fill="#ffffff" 
                                        className="text-[9px] font-black text-center" 
                                        textAnchor="middle"
                                      >
                                        {node.grade}
                                      </text>
                                    )}
                                  </g>
                                );
                              })}
                            </svg>

                            {/* Tooltip flotante */}
                            {hoveredGraphPropId && (
                              (() => {
                                const hoveredNode = graphNodes.find(n => n.id === hoveredGraphPropId);
                                if (!hoveredNode) return null;
                                return (
                                  <div 
                                    className="absolute bg-slate-950/95 border border-slate-800 text-slate-100 rounded-xl p-3.5 shadow-2xl text-xs space-y-1.5 animate-scale-up pointer-events-none text-left"
                                    style={{ 
                                      left: `${Math.min(75, (hoveredNode.x / 800) * 100)}%`, 
                                      top: `${Math.max(5, (hoveredNode.y / 400) * 100 - 30)}%`,
                                      transform: 'translate(-50%, -50%)',
                                      zIndex: 50
                                    }}
                                  >
                                    <div className="font-extrabold text-slate-200 border-b border-slate-900 pb-1 mb-1 flex items-center gap-1.5 justify-between">
                                      <span>{hoveredNode.nombre}</span>
                                      <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[9px] font-black text-emerald-450">{hoveredNode.grade}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span className="text-slate-455">Precio:</span>
                                      <span className="font-bold">{formatCurrency(hoveredNode.precio)}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span className="text-slate-455">Rentabilidad (ROE):</span>
                                      <span className="font-bold text-emerald-400">{formatPercent(hoveredNode.roe)}</span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span className="text-slate-455">Cash Flow:</span>
                                      <span className="font-bold text-blue-400">+{formatCurrency(hoveredNode.cf)}/mes</span>
                                    </div>
                                    <div className="text-[9px] text-slate-500 italic mt-1.5 pt-1.5 border-t border-slate-900">
                                      Haz clic para ir a la ficha completa
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {filteredProperties.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-5 pt-2 border-t border-slate-850/40 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500/25 border border-emerald-500"></span> A+ / A (Excelente)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-blue-500/25 border border-blue-500"></span> B (Bueno)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-amber-500/25 border border-amber-500"></span> C (Aceptable)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500/25 border border-red-500"></span> D / E / F (Riesgoso)
                      </span>
                      <span className="text-slate-600 font-semibold italic select-none">
                        *El tamaño de la burbuja indica el volumen de Cash Flow positivo mensual.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabla Dinámica */}
            {activeMainTab === 'listado' && (
              <div className={`bg-slate-900/30 border border-slate-850/80 rounded-2xl shadow-xl overflow-hidden ${mobileTab !== 'cartera' ? 'hidden lg:block' : ''}`}>

              {/* VISTA TARJETAS — solo móvil (< lg) */}
              <div className="lg:hidden divide-y divide-slate-850/60">
                {sortedProperties.length === 0 ? (
                  <div className="px-6 py-14 text-center text-slate-500">
                    <Building className="mx-auto h-10 w-10 text-slate-700 mb-3" />
                    <p className="font-semibold text-slate-450">No hay inmuebles en la cartera.</p>
                    <p className="text-xs text-slate-650 mt-1">Pulsa <span className="text-emerald-400 font-bold">+ Añadir</span> para empezar.</p>
                  </div>
                ) : groupedProperties.map((group) => (
                  <React.Fragment key={group.groupName}>
                    {groupingMode !== 'none' && (
                      <div className="bg-slate-950 border-y border-slate-850/60 px-4 py-2.5 text-left text-xs font-extrabold text-blue-400 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5 shadow-sm">
                        <span>🏙️</span>
                        <span>{group.groupName}</span>
                        <span className="text-slate-500 font-bold">({group.properties.length})</span>
                      </div>
                    )}
                    {group.properties.map((prop) => {
                      const m = prop.metrics;
                      const score = getPropertyScore(prop, m, zonesConfig);
                      const isExpanded = expandedPropertyId === prop.id;
                      const baseRent = zonesConfig[prop.zona] ? (zonesConfig[prop.zona].avgRentPriceM2 * prop.m2) : 600;
                      const minRent = Math.max(100, Math.round(baseRent * 0.4));
                      const maxRent = Math.round(baseRent * 2.2);

                      let cfColor = "text-red-400 bg-red-500/10 border border-red-500/20";
                      if (m.cashFlowMensual >= 0 && m.cashFlowMensual < 100) cfColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                      if (m.cashFlowMensual >= 100) cfColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                      return (
                        <div 
                          key={prop.id} 
                          className={`p-4 hover:bg-slate-850/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-850/20 border-l-4 border-emerald-500' : ''}`}
                          onClick={() => setExpandedPropertyId(isExpanded ? null : prop.id)}
                        >
                          {/* Cabecera tarjeta */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedPropertyIds.includes(prop.id)}
                                  onChange={() => toggleSelectProperty(prop.id)}
                                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-100 truncate">{prop.nombre}</span>
                                  <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-extrabold rounded border ${score.color}`}>{score.grade}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-medium flex-wrap">
                                  <MapPin className="h-3 w-3 text-slate-650" />
                                  <span>{zonesConfig[prop.zona]?.name || prop.zona}</span>
                                  <span>·</span>
                                  <span>{prop.planta}</span>
                                  <span>·</span>
                                  <span>{prop.m2} m²</span>
                                  {prop.contactStatus && (
                                    <>
                                      <span>·</span>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${getStatusStyles(prop.contactStatus)}`}>
                                        {getStatusLabel(prop.contactStatus)}
                                      </span>
                                    </>
                                  )}
                                  {prop.contactStatus === 'visit_scheduled' && prop.contactDate && (
                                    <span className="text-[9px] text-indigo-400 font-extrabold bg-indigo-500/10 px-1 py-0.2 rounded border border-indigo-550/20">
                                      📅 {new Date(prop.contactDate).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleOptimizeProperty(prop.id)} 
                              className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-all" 
                              title="Optimizar"
                            >
                              <Sparkles className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(prop.id)} 
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all" 
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div 
                            className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                      {/* Métricas principales */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-950/60 rounded-xl p-2.5 text-center border border-slate-850">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Compra</p>
                          <p className="text-xs font-bold text-slate-200">{formatCurrency(prop.precio)}</p>
                        </div>
                        <div className={`rounded-xl p-2.5 text-center border ${cfColor}`}>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-70">Cash Flow</p>
                          <p className="text-xs font-bold">{formatCurrency(m.cashFlowMensual)}/mes</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-2.5 text-center">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">ROE Neta</p>
                          <p className="text-xs font-bold text-emerald-400">{formatPercent(m.rentabilidadNeta)}</p>
                        </div>
                      </div>

                      {/* Menu de edición rápida y desglose (Simulador Rápido) */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-850/80 cursor-default" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 gap-6">
                            
                            {/* Desglose de Gastos */}
                            <div className="space-y-3 animate-slide-up">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose de Costes Iniciales</h4>
                              <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-2.5 text-xs shadow-md">
                                {prop.precioOriginal && prop.precioOriginal !== prop.precio && (
                                  <div className="flex justify-between text-slate-500 border-b border-slate-800/40 pb-1.5 mb-1.5">
                                    <span>Precio Original (Idealista):</span>
                                    <span className="font-semibold text-slate-400 line-through">{formatCurrency(prop.precioOriginal)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-slate-400">
                                  <span>{prop.sinHipoteca ? 'Pago al Contado (100%):' : 'Entrada Aportada (20%):'}</span>
                                  <span className="font-semibold text-slate-200">{formatCurrency(prop.sinHipoteca ? prop.precio : prop.precio * 0.2)}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Impuesto ITP ({prop.itp}%):</span>
                                  <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * (prop.itp / 100))}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Notaría, Registro y Gestoría ({prop.notariaRegistro !== undefined ? prop.notariaRegistro : Math.max(0, 10 - prop.itp)}%):</span>
                                  <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * ((prop.notariaRegistro !== undefined ? prop.notariaRegistro : Math.max(0, 10 - prop.itp)) / 100))}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Reforma Estimada:</span>
                                  <span className="font-semibold text-slate-200">{formatCurrency(prop.reforma)}</span>
                                </div>
                                {prop.honorarios > 0 && (
                                  <div className="flex justify-between text-slate-400">
                                    <span>Honorarios Inmobiliaria:</span>
                                    <span className="font-semibold text-slate-200">{formatCurrency(prop.honorarios)}</span>
                                  </div>
                                )}
                                <div className="border-t border-slate-800/85 my-1.5 pt-2 flex justify-between font-extrabold text-slate-100">
                                  <span>Capital Aportado Total:</span>
                                  <span className="text-emerald-400">{formatCurrency(m.capitalAportadoTotal)}</span>
                                </div>
                              </div>

                              {/* Desglose de Operativa Mensual */}
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Desglose de Operativa Mensual</h4>
                              <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-2.5 text-xs shadow-md">
                                <div className="flex justify-between text-slate-400">
                                  <span>Ingreso por Alquiler:</span>
                                  <span className="font-semibold text-emerald-400">+{formatCurrency(prop.alquiler)}</span>
                                </div>
                                {!prop.sinHipoteca ? (
                                  <div className="flex justify-between text-slate-400">
                                    <span>Cuota de Hipoteca:</span>
                                    <span className="font-semibold text-red-400">-{formatCurrency(m.cuotaMensual)}</span>
                                  </div>
                                ) : (
                                  <div className="flex justify-between text-slate-500">
                                    <span>Cuota de Hipoteca:</span>
                                    <span className="font-semibold text-slate-455">No aplica (Al contado)</span>
                                  </div>
                                )}
                                {prop.comunidad > 0 && (
                                  <div className="flex justify-between text-slate-400">
                                    <span>Gastos de Comunidad:</span>
                                    <span className="font-semibold text-red-400">-{formatCurrency(prop.comunidad)}</span>
                                  </div>
                                )}
                                {prop.ibi > 0 && (
                                  <div className="flex justify-between text-slate-400">
                                    <span>Impuesto IBI (Mensual):</span>
                                    <span className="font-semibold text-red-400">-{formatCurrency(prop.ibi / 12)}</span>
                                  </div>
                                )}
                                {prop.seguro > 0 && (
                                  <div className="flex justify-between text-slate-400">
                                    <span>Seguro (Mensual):</span>
                                    <span className="font-semibold text-red-400">-{formatCurrency(prop.seguro / 12)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-slate-500">
                                  <span>Provisión Vacancia (5%):</span>
                                  <span className="font-semibold text-red-400/80">-{formatCurrency(prop.alquiler * 0.05)}</span>
                                </div>
                                <div className="flex justify-between text-slate-550 border-t border-slate-800/40 pt-1.5 font-medium">
                                  <span>Cash Flow (Antes Imp.):</span>
                                  <span className={m.cashFlowMensual >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                                    {formatCurrency(m.cashFlowMensual)}/mes
                                  </span>
                                </div>
                                <div className="flex justify-between text-slate-550 font-medium">
                                  <span>Impuesto IRPF Estimado:</span>
                                  <span className="text-red-400">-{formatCurrency(m.impuestoIRPFMensual)}/mes</span>
                                </div>
                                <div className="border-t border-slate-800/85 my-1.5 pt-2 flex justify-between font-extrabold text-slate-100">
                                  <span>Cash Flow Neto (Post-Imp.):</span>
                                  <span className={m.cashFlowMensualPostImpuestos >= 0 ? 'text-emerald-450 font-extrabold shadow-glow-emerald' : 'text-red-400 font-bold'}>
                                    {formatCurrency(m.cashFlowMensualPostImpuestos)}/mes
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Sliders Interactivos */}
                            <div className="space-y-4 animate-slide-up">
                              <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulador Rápido (Modificar Inmueble)</h4>
                                <button
                                  onClick={() => handleOptimizeProperty(prop.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-[10px] font-extrabold text-emerald-450 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                  title="Optimizar parámetros de este inmueble para máxima rentabilidad"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span>Optimizar Inmueble</span>
                                </button>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/50 rounded-xl border border-slate-850 p-4 shadow-sm items-center justify-between font-medium">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider shrink-0">Nombre / Referencia:</span>
                                  <input
                                    type="text"
                                    value={prop.nombre}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'nombre', e.target.value)}
                                    className="flex-grow h-8 px-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    placeholder="Ej: Piso Centro..."
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-900/80 rounded-xl border border-slate-850 p-4 shadow-md font-medium">
                                
                                {/* Slider 1: Precio de Compra */}
                                <div className="space-y-2.5">
                                  <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Precio de Compra:</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        value={prop.precio}
                                        step={500}
                                        onChange={(e) => handleUpdatePropertyField(prop.id, 'precio', Number(e.target.value))}
                                        className="w-24 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold bg-slate-950"
                                      />
                                      <span className="text-slate-455">€</span>
                                    </div>
                                  </div>
                                  <input 
                                    type="range" 
                                    min={Math.max(10000, Math.round((prop.precioOriginal || prop.precio) * 0.4))} 
                                    max={Math.round((prop.precioOriginal || prop.precio) * 1.6)} 
                                    step={500} 
                                    value={prop.precio} 
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'precio', Number(e.target.value))} 
                                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                  />
                                  <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                    <span>Mín: {formatCurrency(Math.max(10000, Math.round((prop.precioOriginal || prop.precio) * 0.4)))}</span>
                                    {prop.precioOriginal && (
                                      <span>Original: {formatCurrency(prop.precioOriginal)}</span>
                                    )}
                                    <span>Máx: {formatCurrency(Math.round((prop.precioOriginal || prop.precio) * 1.6))}</span>
                                  </div>
                                </div>

                                {/* Slider 2: Alquiler Estimado */}
                                <div className="space-y-2.5">
                                  <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Alquiler Estimado:</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        value={prop.alquiler}
                                        onChange={(e) => handleUpdatePropertyField(prop.id, 'alquiler', Number(e.target.value))}
                                        className="w-20 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold bg-slate-950"
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
                                    <div className="space-y-2">
                                      <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                        <span>Mín: {formatCurrency(minRent)}</span>
                                        <span>Media: ~{Math.round(baseRent)} €</span>
                                        <span>Máx: {formatCurrency(maxRent)}</span>
                                      </div>
                                      <div className="text-[9px] text-amber-500/90 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 flex items-start gap-1 font-semibold leading-normal">
                                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                        <span>El alquiler sugerido es estimativo. Investigue en Idealista la renta real de la zona para no distorsionar el análisis.</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Slider 3: Reforma Estimada */}
                                <div className="space-y-2.5">
                                  <div className="flex justify-between items-center text-xs font-semibold">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Reforma Estimada:</span>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        value={prop.reforma}
                                        step={500}
                                        onChange={(e) => handleUpdatePropertyField(prop.id, 'reforma', Number(e.target.value))}
                                        className="w-24 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold bg-slate-950"
                                      />
                                      <span className="text-slate-455">€</span>
                                    </div>
                                  </div>
                                  <input 
                                    type="range" 
                                    min={0} 
                                    max={Math.max(60000, Math.round(prop.m2 * 800))} 
                                    step={500} 
                                    value={prop.reforma} 
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'reforma', Number(e.target.value))} 
                                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                  />
                                  <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                    <span>Sin reforma</span>
                                    {prop.m2 > 0 && prop.reforma > 0 && (
                                      <span>~{Math.round(prop.reforma / prop.m2)} €/m²</span>
                                    )}
                                    <span>Máx: {formatCurrency(Math.max(60000, Math.round(prop.m2 * 800)))}</span>
                                  </div>
                                </div>

                                {/* Slider 4: Financiación/Hipoteca */}
                                <div className="space-y-2.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Financiación:</span>
                                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={prop.sinHipoteca || false} 
                                        onChange={(e) => handleUpdatePropertyField(prop.id, 'sinHipoteca', e.target.checked)} 
                                        className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-3.5 w-3.5 cursor-pointer" 
                                      />
                                      <span>Al contado</span>
                                    </label>
                                  </div>

                                  {prop.sinHipoteca ? (
                                    <div className="flex flex-col justify-center h-[72px] bg-emerald-950/20 border border-emerald-900/60 rounded-xl p-3 space-y-1 text-left">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-450 leading-none">
                                        <Sparkles className="h-3 w-3" />
                                        <span>Compra al Contado Activa</span>
                                      </div>
                                      <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                        100% capital aportado de fondos propios. Sin cuota hipotecaria.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3.5">
                                      {/* LTV */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center text-xs font-semibold">
                                          <span className="text-slate-550 text-[10px]">LTV (Financiación):</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              value={prop.financiacionPct !== undefined ? prop.financiacionPct : 80}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'financiacionPct', Number(e.target.value))}
                                              className="w-12 h-6 text-right px-1 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold bg-slate-950"
                                            />
                                            <span className="text-slate-455">%</span>
                                          </div>
                                        </div>
                                        <input 
                                          type="range" 
                                          min="10" 
                                          max="100" 
                                          step="5" 
                                          value={prop.financiacionPct !== undefined ? prop.financiacionPct : 80} 
                                          onChange={(e) => handleUpdatePropertyField(prop.id, 'financiacionPct', Number(e.target.value))} 
                                          className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-blue-500" 
                                        />
                                      </div>

                                      {/* TIN */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center text-xs font-semibold">
                                          <span className="text-slate-550 text-[10px]">Interés (TIN):</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.1"
                                              disabled={globalMortgage.active}
                                              value={globalMortgage.active ? globalMortgage.tin : prop.tin}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'tin', Number(e.target.value))}
                                              className="w-16 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold disabled:opacity-40 bg-slate-950"
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
                                          className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 disabled:cursor-not-allowed" 
                                        />
                                        <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                          <span>Mín: 0.5%</span>
                                          <span>Máx: 8%</span>
                                        </div>
                                      </div>

                                      {/* Plazo Amortización en Ajustes Rápidos */}
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center text-xs font-semibold">
                                          <span className="text-slate-550 text-[10px]">Plazo Hipoteca:</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              disabled={globalMortgage.active}
                                              value={globalMortgage.active ? globalMortgage.plazo : prop.plazo}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))}
                                              className="w-12 h-6 text-right px-1 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold disabled:opacity-40 bg-slate-950 text-slate-100"
                                            />
                                            <span className="text-slate-455">años</span>
                                          </div>
                                        </div>
                                        <input 
                                          type="range" 
                                          min="10" 
                                          max="40" 
                                          step="5" 
                                          disabled={globalMortgage.active}
                                          value={globalMortgage.active ? globalMortgage.plazo : prop.plazo} 
                                          onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))} 
                                          className="w-full h-1 bg-slate-950 rounded appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 disabled:cursor-not-allowed" 
                                        />
                                        <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                          <span>Mín: 10a</span>
                                          <span>Máx: 40a</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                              </div>

                              {/* Collapsible toggle for extra options */}
                              <div className="flex justify-center py-1">
                                <button
                                  type="button"
                                  onClick={() => setShowExtraSimulatorOptions(!showExtraSimulatorOptions)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-750 hover:border-slate-700 rounded-xl text-[10px] font-bold text-slate-350 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  <Settings className="h-3 w-3 text-slate-455" />
                                  <span>{showExtraSimulatorOptions ? 'Ocultar Parámetros' : 'Parámetros Adicionales (Gastos, Plazos...)'}</span>
                                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-300 ${showExtraSimulatorOptions ? 'rotate-180' : ''}`} />
                                </button>
                              </div>

                              {showExtraSimulatorOptions && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-900/60 border border-slate-850 rounded-xl p-4 shadow-inner animate-slide-up text-left mt-2">
                                  
                                  {/* Gastos Mensuales */}
                                  <div className="col-span-2 border-b border-slate-800/85 pb-1 flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Gastos de Operativa (Mensuales/Anuales)</span>
                                  </div>

                                  {/* Comunidad */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455">Comunidad (€/mes)</label>
                                    <input
                                      type="number"
                                      value={prop.comunidad}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'comunidad', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* IBI */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455">IBI Anual (€/año)</label>
                                    <input
                                      type="number"
                                      value={prop.ibi}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'ibi', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Seguro */}
                                  <div className="space-y-1.5 col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-455">Seguro Anual (€/año)</label>
                                    <input
                                      type="number"
                                      value={prop.seguro}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'seguro', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Gastos de Compra */}
                                  <div className="col-span-2 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Gastos de Compra (Adquisición)</span>
                                  </div>

                                  {/* ITP */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455">ITP (%)</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={prop.itp}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'itp', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Honorarios */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455">Honorarios Inmo. (€)</label>
                                    <input
                                      type="number"
                                      value={prop.honorarios}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'honorarios', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Notaría / Registro */}
                                  <div className="space-y-1.5 col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-455">Notaría y Reg. (%)</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={prop.notariaRegistro}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'notariaRegistro', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Parámetros Técnicos */}
                                  <div className="col-span-2 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Otros Parámetros de Simulación</span>
                                  </div>

                                  {/* Zona */}
                                  <div className="space-y-1.5 col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-455">Zona</label>
                                    <select
                                      value={prop.zona}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleUpdatePropertyField(prop.id, 'zona', val);
                                        const targetZone = zonesConfig[val];
                                        if (targetZone && targetZone.itp !== undefined) {
                                          handleUpdatePropertyField(prop.id, 'itp', targetZone.itp);
                                          handleUpdatePropertyField(prop.id, 'notariaRegistro', Math.max(0, 10 - targetZone.itp));
                                        }
                                      }}
                                      className="w-full h-8 px-2 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer text-slate-100 bg-slate-950"
                                    >
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

                                  {/* Precio Idealista */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455">Precio Idealista (€)</label>
                                    <input
                                      type="number"
                                      value={prop.precioOriginal || ''}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'precioOriginal', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                      placeholder="Opcional"
                                    />
                                  </div>

                                  {/* Plazo Hipoteca */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">Plazo Hipoteca</label>
                                    <select
                                      disabled={prop.sinHipoteca || globalMortgage.active}
                                      value={prop.plazo}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-slate-950 text-slate-100"
                                    >
                                      <option value={10}>10 años</option>
                                      <option value={15}>15 años</option>
                                      <option value={20}>20 años</option>
                                      <option value={25}>25 años</option>
                                      <option value={30}>30 años</option>
                                      <option value={35}>35 años</option>
                                      <option value={40}>40 años</option>
                                    </select>
                                  </div>

                                  {/* Superficie */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">Superficie (m²)</label>
                                    <input
                                      type="number"
                                      value={prop.m2}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'm2', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Planta */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">Planta</label>
                                    <select
                                      value={prop.planta}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'planta', e.target.value)}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                                    >
                                      {PLANTAS.map(p => <option key={p.id} value={p.id} className="bg-slate-950">{p.label}</option>)}
                                    </select>
                                  </div>

                                  {/* Parámetros Fiscales e Impuestos */}
                                  <div className="col-span-2 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Parámetros Fiscales y Proyección</span>
                                  </div>

                                  {/* IRPF Marginal */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">IRPF Marginal (%)</label>
                                    <input
                                      type="number"
                                      value={prop.irpfMarginal !== undefined ? prop.irpfMarginal : 30}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'irpfMarginal', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* % Construcción */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">% Construcción (Edificación)</label>
                                    <input
                                      type="number"
                                      value={prop.porcentajeConstruccion !== undefined ? prop.porcentajeConstruccion : 70}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'porcentajeConstruccion', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Alquiler Habitual */}
                                  <div className="space-y-1.5 flex flex-col justify-end pb-1.5 col-span-2">
                                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={prop.viviendaHabitual !== undefined ? prop.viviendaHabitual : true}
                                        onChange={(e) => handleUpdatePropertyField(prop.id, 'viviendaHabitual', e.target.checked)}
                                        className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                                      />
                                      <span>Alquiler Vivienda Habitual (50% red.)</span>
                                    </label>
                                  </div>

                                  {/* IPC/Inflación */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">IPC / Inflación Anual (%)</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={prop.ipcAnual !== undefined ? prop.ipcAnual : 2}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'ipcAnual', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                  {/* Revalorización Anual */}
                                  <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-455 font-semibold">Revalorización Anual (%)</label>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={prop.revalorizacionAnual !== undefined ? prop.revalorizacionAnual : 2}
                                      onChange={(e) => handleUpdatePropertyField(prop.id, 'revalorizacionAnual', Number(e.target.value))}
                                      className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                    />
                                  </div>

                                </div>
                              )}

                            </div>

                            {/* Fiscalidad y Proyección (TIR a 10 Años) */}
                            <div className="border-t border-slate-850/60 pt-5 mt-2 space-y-4 animate-slide-up">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 rounded-xl border border-slate-850 p-5 shadow-lg">
                                {/* Ficha Fiscal */}
                                <div className="space-y-3 text-left">
                                  <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calculator className="h-4 w-4 text-blue-450" />
                                    <span>Ficha Fiscal Anual (Año 1)</span>
                                  </h4>
                                  <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                                    <div className="flex justify-between">
                                      <span>Ingresos Brutos Anuales:</span>
                                      <span className="font-semibold text-slate-200">{formatCurrency(prop.alquiler * 12)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Intereses Hipoteca Deducibles:</span>
                                      <span className="font-semibold text-red-400">-{formatCurrency(m.interesesPrimerAno)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Amortización Edificación (3%):</span>
                                      <span className="font-semibold text-red-400">-{formatCurrency(m.amortizacionConstruccion)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Otros Gastos Deducibles:</span>
                                      <span className="font-semibold text-red-400">-{formatCurrency((prop.comunidad * 12) + prop.ibi + prop.seguro)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-semibold text-slate-300">
                                      <span>Base Imponible Estimada:</span>
                                      <span className="text-slate-100">{formatCurrency(Math.max(0, (prop.alquiler * 12) - ((prop.comunidad * 12) + prop.ibi + prop.seguro + m.interesesPrimerAno + m.amortizacionConstruccion)))}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                      <span>Base Reducida (Habitual):</span>
                                      <span>
                                        {prop.viviendaHabitual !== false ? '50% aplicado' : 'Sin reducción'}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-bold text-slate-200">
                                      <span>IRPF Anual ({prop.irpfMarginal !== undefined ? prop.irpfMarginal : 30}%):</span>
                                      <span className="text-red-400">{formatCurrency(m.impuestosIRPFAnuales)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Proyección y Rentabilidad TIR */}
                                <div className="md:col-span-2 space-y-3 flex flex-col justify-between text-left">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                                      <TrendingUp className="h-4 w-4 text-emerald-450" />
                                      <span>Proyección de Flujos y TIR Estimada</span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                                      Proyección financiera a 10 años con incremento de alquileres y gastos de <strong>{prop.ipcAnual !== undefined ? prop.ipcAnual : 2}% (IPC)</strong> y revalorización del inmueble del <strong>{prop.revalorizacionAnual !== undefined ? prop.revalorizacionAnual : 2}% anual</strong>.
                                    </p>
                                  </div>
                                  
                                  {/* Minibarras de Flujo de Caja */}
                                  <div className="grid grid-cols-10 gap-1.5 py-2">
                                    {m.cashFlowsTIR && m.cashFlowsTIR.slice(1).map((cf, idx) => {
                                      const isPositive = cf >= 0;
                                      return (
                                        <div key={idx} className="flex flex-col items-center group relative">
                                          <div className="text-[8px] text-slate-500 font-bold">A{idx+1}</div>
                                          <div className="w-full h-12 bg-slate-950 rounded border border-slate-880/60 flex items-end justify-center overflow-hidden">
                                            <div 
                                              style={{ height: `${Math.min(100, Math.max(10, Math.abs(cf) / 100))}%` }} 
                                              className={`w-full ${isPositive ? 'bg-emerald-500/30 border-t border-emerald-400' : 'bg-red-500/30 border-t border-red-400'}`}
                                            />
                                          </div>
                                          <div className="absolute bottom-14 hidden group-hover:block bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-2 py-1 whitespace-nowrap z-10 shadow-xl font-bold">
                                            CF Año {idx+1}: {formatCurrency(cf)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/80 border border-slate-850 rounded-xl p-3.5 mt-2 gap-4">
                                    <div className="text-left">
                                      <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Rentabilidad Neta Fiscal (ROE Post-Imp.)</span>
                                      <span className="text-sm font-extrabold text-emerald-450">
                                        {formatPercent(m.rentabilidadNetaPostImpuestos)}
                                      </span>
                                    </div>
                                    
                                    <div className="text-right sm:text-right w-full sm:w-auto">
                                      <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">TIR Estimada a 10 Años (Venta)</span>
                                      <span className={`text-base font-extrabold px-3 py-1 rounded-md border ${m.tir !== null && m.tir >= 8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-glow-emerald' : m.tir !== null && m.tir >= 4 ? 'text-blue-450 bg-blue-500/10 border-blue-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                                        {m.tir !== null ? `${formatPercent(m.tir)}` : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Rangos de Precio de Compra sugeridos para Negociación */}
                            {(() => {
                              const priceRanges = getPriceRangesForGrades(prop);
                              return (
                                <div className="border-t border-slate-850/60 pt-5 mt-2 space-y-4 animate-slide-up">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                      <TrendingUp className="h-4 w-4 text-emerald-450" />
                                      <span>Rangos de Precio sugeridos</span>
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                                      Rango de precios de adquisición simulados y la calificación de inversión que obtendrías.
                                    </p>
                                  </div>
                                  
                                  {priceRanges === null ? (
                                    <div className="bg-red-950/15 border border-red-900/40 rounded-xl p-4 flex items-start gap-3 shadow-md">
                                      <AlertTriangle className="h-5 w-5 text-red-450 shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                        <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider">Inmueble Bloqueado (Grado F)</h5>
                                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                          Este inmueble tiene asignado un Grado F (Bloqueado) debido a que no cumple con criterios esenciales de la inversión.
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                      {Object.entries(priceRanges).map(([grade, range]) => {
                                        if (range.min === Infinity) return null;
                                        const isCurrent = grade === score.grade;
                                        
                                        let gradeStyle = {
                                          bg: 'bg-slate-900/60',
                                          border: 'border-slate-800/80',
                                          text: 'text-slate-350',
                                          badge: 'bg-slate-800 text-slate-400 border-slate-700/60',
                                          label: ''
                                        };
                                        
                                        if (grade === 'A+') {
                                          gradeStyle = { bg: 'bg-emerald-950/10', border: 'border-emerald-500/15', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Exc.' };
                                        } else if (grade === 'A') {
                                          gradeStyle = { bg: 'bg-teal-950/10', border: 'border-teal-500/15', text: 'text-teal-300', badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20', label: 'M. Bueno' };
                                        } else if (grade === 'B') {
                                          gradeStyle = { bg: 'bg-blue-950/10', border: 'border-blue-500/15', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Bueno' };
                                        } else if (grade === 'C') {
                                          gradeStyle = { bg: 'bg-amber-950/10', border: 'border-amber-500/15', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Acep.' };
                                        } else if (grade === 'D') {
                                          gradeStyle = { bg: 'bg-orange-950/10', border: 'border-orange-500/15', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Riesgoso' };
                                        } else if (grade === 'E') {
                                          gradeStyle = { bg: 'bg-red-950/10', border: 'border-red-500/15', text: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'No Rec.' };
                                        }
                                        
                                        return (
                                          <div
                                            key={grade}
                                            className={`relative p-3 rounded-xl border flex flex-col justify-between transition-all duration-300 shadow-md ${
                                              isCurrent
                                                ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                                                : `${gradeStyle.border} ${gradeStyle.bg}`
                                            }`}
                                          >
                                            {isCurrent && (
                                              <span className="absolute -top-2 left-2 px-1.5 py-0.5 text-[7px] font-extrabold tracking-wider uppercase bg-emerald-500 text-slate-950 rounded shadow-glow-emerald">
                                                Actual
                                              </span>
                                            )}
                                            
                                            <div className="flex justify-between items-center mb-1.5">
                                              <span className={`text-xs font-extrabold ${isCurrent ? 'text-emerald-455' : gradeStyle.text}`}>
                                                {grade}
                                              </span>
                                              <span className={`text-[7px] font-extrabold px-1 py-0.2 rounded border ${gradeStyle.badge}`}>
                                                {gradeStyle.label}
                                              </span>
                                            </div>
                                            
                                            <div className="space-y-1.5 mt-2 border-t border-slate-850 pt-2 flex flex-col gap-0.5">
                                               <div>
                                                 <div className="text-slate-500 font-bold uppercase text-[7px] tracking-wider">Precio</div>
                                                 <div className="font-extrabold text-slate-100 text-[10px] truncate">
                                                   {range.min === range.max
                                                     ? formatCurrency(range.min)
                                                     : `${formatCurrency(range.min)} - ${formatCurrency(range.max)}`}
                                                 </div>
                                               </div>
                                               <div>
                                                 <div className="text-slate-500 font-bold uppercase text-[7px] tracking-wider">ROE (Neta)</div>
                                                 <div className="font-extrabold text-emerald-450 text-[10px] truncate">
                                                   {range.minRoe === range.maxRoe
                                                     ? formatPercent(range.minRoe)
                                                     : `${formatPercent(range.minRoe)} - ${formatPercent(range.maxRoe)}`}
                                                 </div>
                                               </div>
                                             </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Módulo: Gestión de Contacto y Citas */}
                            <div className="space-y-3 border-t border-slate-850/60 pt-5 mt-2 animate-slide-up text-left">
                              <h4 className="text-xs font-bold text-slate-405 uppercase tracking-wider flex items-center gap-1.5">
                                <span>📞 Gestión de Contacto y Citas</span>
                              </h4>
                              <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-4 shadow-md font-medium">
                                {/* Estado de Gestión */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado de Contacto</label>
                                  <select
                                    value={prop.contactStatus || 'pending'}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'contactStatus', e.target.value)}
                                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 cursor-pointer bg-slate-950 text-slate-100"
                                  >
                                    <option value="pending">🔘 No contactado</option>
                                    <option value="contacted">📞 Contactado</option>
                                    <option value="visit_scheduled">📅 Visita programada</option>
                                    <option value="visit_done">✅ Visita realizada</option>
                                    <option value="offer_submitted">✉️ Oferta presentada</option>
                                    <option value="negotiation">🤝 En negociación</option>
                                    <option value="reserved">🏆 Reservado / Comprado</option>
                                    <option value="discarded">❌ Descartado</option>
                                  </select>
                                </div>

                                {/* Fecha y Hora */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                                    <span>Fecha y Hora de Cita</span>
                                  </label>
                                  <input
                                    type="datetime-local"
                                    value={prop.contactDate || ''}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'contactDate', e.target.value)}
                                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                  />
                                </div>

                                {/* Nombre de Contacto */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <User className="h-3.5 w-3.5 text-blue-405" />
                                    <span>Vendedor / Contacto</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={prop.contactName || ''}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'contactName', e.target.value)}
                                    placeholder="Ej: Inmobiliaria Tecnocasa / Particular"
                                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                  />
                                </div>

                                {/* Teléfono */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <Phone className="h-3.5 w-3.5 text-emerald-455" />
                                    <span>Teléfono</span>
                                  </label>
                                  <input
                                    type="tel"
                                    value={prop.contactPhone || ''}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'contactPhone', e.target.value)}
                                    placeholder="Ej: 600123456"
                                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                  />
                                </div>

                                {/* Notas */}
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Notas de Contacto e Info Adicional</span>
                                  </label>
                                  <textarea
                                    value={prop.contactNotes || ''}
                                    onChange={(e) => handleUpdatePropertyField(prop.id, 'contactNotes', e.target.value)}
                                    placeholder="Anota precio negociable, estado, reformas necesarias, comentarios del propietario, etc."
                                    rows={4}
                                    className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 resize-y bg-slate-950 text-slate-100 min-h-[90px]"
                                  />
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

              {/* TABLA — solo desktop (≥ lg) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-850/60">
                  <thead className="bg-slate-900/60">
                    <tr>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-slate-455 uppercase tracking-wider w-10">
                        <input 
                          type="checkbox" 
                          disabled={filteredProperties.length === 0}
                          checked={filteredProperties.length > 0 && selectedPropertyIds.length === filteredProperties.length}
                          onChange={toggleSelectAllProperties}
                          className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                        />
                      </th>
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
                        <td colSpan={10} className="px-6 py-16 text-center text-slate-500">
                          <Building className="mx-auto h-12 w-12 text-slate-700 mb-3" />
                          <p className="font-semibold text-slate-450">No hay inmuebles en la cartera.</p>
                          <p className="text-xs text-slate-650 mt-1">Añade uno usando el panel lateral o pega un enlace de Idealista.</p>
                        </td>
                      </tr>
                    ) : (
                      groupedProperties.map((group) => (
                        <React.Fragment key={group.groupName}>
                          {groupingMode !== 'none' && (
                            <tr>
                              <td colSpan={10} className="bg-slate-950/80 border-y border-slate-850 px-4 py-2.5 text-left text-xs font-extrabold text-blue-450 uppercase tracking-wider sticky top-0 z-10">
                                🏙️ {group.groupName} ({group.properties.length} {group.properties.length === 1 ? 'inmueble' : 'inmuebles'})
                              </td>
                            </tr>
                          )}
                          {group.properties.map((prop) => {
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
                              <td className="px-4 py-3.5 text-center w-10" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedPropertyIds.includes(prop.id)}
                                  onChange={() => toggleSelectProperty(prop.id)}
                                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                                />
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="text-sm font-bold text-slate-100">{prop.nombre}</div>
                                  <span className={`inline-block px-2 py-0.5 text-[9px] font-extrabold rounded border ${score.color}`} title={`Calidad: ${score.label} (${score.points} pts)`}>
                                    {score.grade}
                                  </span>
                                  {prop.contactStatus && (
                                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-extrabold rounded border ${getStatusStyles(prop.contactStatus)}`}>
                                      {getStatusLabel(prop.contactStatus)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-455 flex items-center gap-1.5 mt-1 font-medium flex-wrap">
                                  <MapPin className="h-3 w-3 text-slate-500" /> {zonesConfig[prop.zona]?.name || prop.zona} • {prop.planta}
                                  {prop.contactStatus === 'visit_scheduled' && prop.contactDate && (
                                    <span className="text-[10px] text-indigo-400 font-extrabold bg-indigo-500/10 px-1 py-0.2 rounded border border-indigo-550/20">
                                      📅 {new Date(prop.contactDate).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-right text-sm text-slate-200 font-medium whitespace-nowrap">
                                <div>{formatCurrency(prop.precio)}</div>
                                {prop.precioOriginal && prop.precioOriginal !== prop.precio ? (
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    Orig: <span className="line-through">{formatCurrency(prop.precioOriginal)}</span>
                                    {(() => {
                                      const diff = prop.precio - prop.precioOriginal;
                                      const pct = Math.round((diff / prop.precioOriginal) * 100);
                                      return (
                                        <span className={`ml-1 font-bold ${diff < 0 ? 'text-emerald-450' : 'text-red-400'}`}>
                                          {diff < 0 ? `${pct}%` : `+${pct}%`}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                ) : null}
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
                                {prop.sinHipoteca ? (
                                  <>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                                      Al contado
                                    </span>
                                    <div className="text-[9px] text-slate-500 font-medium mt-1">100% Capital</div>
                                  </>
                                ) : (
                                  <>
                                    {formatCurrency(m.cuotaMensual)}
                                    <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                      {globalMortgage.active ? (
                                        <span className="text-amber-455 font-semibold">Sim. {globalMortgage.tin}%</span>
                                      ) : (
                                        <span>{prop.tin}% / {prop.plazo}y</span>
                                      )}
                                    </div>
                                  </>
                                )}
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
                                    onClick={() => handleOptimizeProperty(prop.id)}
                                    className="text-slate-455 hover:text-emerald-400 hover:bg-slate-800 p-1.5 rounded-lg transition-all cursor-pointer"
                                    title="Optimizar inmueble"
                                  >
                                    <Sparkles className="h-4 w-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleExportSingleProperty(prop)}
                                    className="text-slate-450 hover:text-blue-400 hover:bg-slate-800 p-1.5 rounded-lg transition-all"
                                    title="Exportar este inmueble a JSON"
                                  >
                                    <Download className="h-4 w-4" />
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
                                <td colSpan={10} className="px-6 py-5 border-t border-b border-slate-850/80 shadow-inner">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Desglose de Gastos */}
                                    <div className="space-y-3 animate-slide-up">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose de Costes Iniciales</h4>
                                      <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-2.5 text-xs shadow-md">
                                        {prop.precioOriginal && prop.precioOriginal !== prop.precio && (
                                          <div className="flex justify-between text-slate-500 border-b border-slate-800/40 pb-1.5 mb-1.5">
                                            <span>Precio Original (Idealista):</span>
                                            <span className="font-semibold text-slate-400 line-through">{formatCurrency(prop.precioOriginal)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-slate-400">
                                          <span>{prop.sinHipoteca ? 'Pago al Contado (100%):' : 'Entrada Aportada (20%):'}</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.sinHipoteca ? prop.precio : prop.precio * 0.2)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                          <span>Impuesto ITP ({prop.itp}%):</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * (prop.itp / 100))}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400">
                                          <span>Notaría, Registro y Gestoría ({prop.notariaRegistro !== undefined ? prop.notariaRegistro : Math.max(0, 10 - prop.itp)}%):</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.precio * ((prop.notariaRegistro !== undefined ? prop.notariaRegistro : Math.max(0, 10 - prop.itp)) / 100))}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-450">
                                          <span>Reforma Estimada:</span>
                                          <span className="font-semibold text-slate-200">{formatCurrency(prop.reforma)}</span>
                                        </div>
                                        {prop.honorarios > 0 && (
                                          <div className="flex justify-between text-slate-400">
                                            <span>Honorarios Inmobiliaria:</span>
                                            <span className="font-semibold text-slate-200">{formatCurrency(prop.honorarios)}</span>
                                          </div>
                                        )}
                                        <div className="border-t border-slate-800/85 my-1.5 pt-2 flex justify-between font-extrabold text-slate-100">
                                          <span>Capital Aportado Total:</span>
                                          <span className="text-emerald-400">{formatCurrency(m.capitalAportadoTotal)}</span>
                                        </div>
                                      </div>

                                      {/* Desglose de Operativa Mensual */}
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Desglose de Operativa Mensual</h4>
                                      <div className="bg-slate-900/80 rounded-xl border border-slate-850 p-4 space-y-2.5 text-xs shadow-md">
                                        <div className="flex justify-between text-slate-400">
                                          <span>Ingreso por Alquiler:</span>
                                          <span className="font-semibold text-emerald-400">+{formatCurrency(prop.alquiler)}</span>
                                        </div>
                                        {!prop.sinHipoteca ? (
                                          <div className="flex justify-between text-slate-400">
                                            <span>Cuota de Hipoteca:</span>
                                            <span className="font-semibold text-red-400">-{formatCurrency(m.cuotaMensual)}</span>
                                          </div>
                                        ) : (
                                          <div className="flex justify-between text-slate-500">
                                            <span>Cuota de Hipoteca:</span>
                                            <span className="font-semibold text-slate-455">No aplica (Al contado)</span>
                                          </div>
                                        )}
                                        {prop.comunidad > 0 && (
                                          <div className="flex justify-between text-slate-400">
                                            <span>Gastos de Comunidad:</span>
                                            <span className="font-semibold text-red-400">-{formatCurrency(prop.comunidad)}</span>
                                          </div>
                                        )}
                                        {prop.ibi > 0 && (
                                          <div className="flex justify-between text-slate-400">
                                            <span>Impuesto IBI (Mensual):</span>
                                            <span className="font-semibold text-red-400">-{formatCurrency(prop.ibi / 12)}</span>
                                          </div>
                                        )}
                                        {prop.seguro > 0 && (
                                          <div className="flex justify-between text-slate-400">
                                            <span>Seguro (Mensual):</span>
                                            <span className="font-semibold text-red-400">-{formatCurrency(prop.seguro / 12)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between text-slate-500">
                                          <span>Provisión Vacancia (5%):</span>
                                          <span className="font-semibold text-red-400/80">-{formatCurrency(prop.alquiler * 0.05)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-550 border-t border-slate-800/40 pt-1.5 font-medium">
                                          <span>Cash Flow (Antes Imp.):</span>
                                          <span className={m.cashFlowMensual >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}>
                                            {formatCurrency(m.cashFlowMensual)}/mes
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-slate-550 font-medium">
                                          <span>Impuesto IRPF Estimado:</span>
                                          <span className="text-red-400">-{formatCurrency(m.impuestoIRPFMensual)}/mes</span>
                                        </div>
                                        <div className="border-t border-slate-800/85 my-1.5 pt-2 flex justify-between font-extrabold text-slate-100">
                                          <span>Cash Flow Neto (Post-Imp.):</span>
                                          <span className={m.cashFlowMensualPostImpuestos >= 0 ? 'text-emerald-450 font-extrabold shadow-glow-emerald' : 'text-red-400 font-bold'}>
                                            {formatCurrency(m.cashFlowMensualPostImpuestos)}/mes
                                          </span>
                                        </div>
                                      </div>
                                    </div>
 
                                    {/* Sliders Interactivos */}
                                    <div className="space-y-4 lg:col-span-2 animate-slide-up">
                                      <div className="flex justify-between items-center">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Simulador Rápido (Modificar Inmueble)</h4>
                                        <button
                                          onClick={() => handleOptimizeProperty(prop.id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl text-[10px] font-extrabold text-emerald-450 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                          title="Optimizar parámetros de este inmueble para máxima rentabilidad"
                                        >
                                          <Sparkles className="h-3 w-3" />
                                          <span>Optimizar Inmueble</span>
                                        </button>
                                       </div>

                                       <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/50 rounded-xl border border-slate-850 p-4 shadow-sm items-center justify-between font-medium">
                                         <div className="flex items-center gap-2 w-full">
                                           <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider shrink-0">Nombre / Referencia:</span>
                                           <input
                                             type="text"
                                             value={prop.nombre}
                                             onChange={(e) => handleUpdatePropertyField(prop.id, 'nombre', e.target.value)}
                                             className="flex-grow h-8 px-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                             placeholder="Ej: Piso Centro..."
                                           />
                                         </div>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/80 rounded-xl border border-slate-850 p-4 shadow-md font-medium">
                                         
                                         {/* Slider 1: Precio de Compra */}
                                         <div className="space-y-2.5">
                                           <div className="flex justify-between items-center text-xs font-semibold">
                                             <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Precio de Compra:</span>
                                             <div className="flex items-center gap-1.5">
                                               <input
                                                 type="number"
                                                 value={prop.precio}
                                                 step={500}
                                                 onChange={(e) => handleUpdatePropertyField(prop.id, 'precio', Number(e.target.value))}
                                                 className="w-24 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold"
                                               />
                                               <span className="text-slate-455">€</span>
                                             </div>
                                           </div>
                                           <input 
                                             type="range" 
                                             min={Math.max(10000, Math.round((prop.precioOriginal || prop.precio) * 0.4))} 
                                             max={Math.round((prop.precioOriginal || prop.precio) * 1.6)} 
                                             step={500} 
                                             value={prop.precio} 
                                             onChange={(e) => handleUpdatePropertyField(prop.id, 'precio', Number(e.target.value))} 
                                             className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                           />
                                           <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                             <span>Mín: {formatCurrency(Math.max(10000, Math.round((prop.precioOriginal || prop.precio) * 0.4)))}</span>
                                             {prop.precioOriginal && (
                                               <span>Original: {formatCurrency(prop.precioOriginal)}</span>
                                             )}
                                             <span>Máx: {formatCurrency(Math.round((prop.precioOriginal || prop.precio) * 1.6))}</span>
                                           </div>
                                         </div>

                                         {/* Slider 2: Alquiler Estimado */}
                                         <div className="space-y-2.5">
                                           <div className="flex justify-between items-center text-xs font-semibold">
                                             <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Alquiler Estimado:</span>
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
                                             <div className="space-y-2">
                                               <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                                 <span>Mín: {formatCurrency(minRent)}</span>
                                                 <span>Media: ~{Math.round(baseRent)} €</span>
                                                 <span>Máx: {formatCurrency(maxRent)}</span>
                                               </div>
                                               <div className="text-[9px] text-amber-500/90 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 flex items-start gap-1 font-semibold leading-normal">
                                                 <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                                 <span>El alquiler sugerido es estimativo. Investigue en Idealista la renta real de la zona para no distorsionar el análisis.</span>
                                               </div>
                                             </div>
                                           )}
                                         </div>

                                         {/* Slider 3: Reforma Estimada */}
                                         <div className="space-y-2.5">
                                           <div className="flex justify-between items-center text-xs font-semibold">
                                             <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Reforma Estimada:</span>
                                             <div className="flex items-center gap-1.5">
                                               <input
                                                 type="number"
                                                 value={prop.reforma}
                                                 step={500}
                                                 onChange={(e) => handleUpdatePropertyField(prop.id, 'reforma', Number(e.target.value))}
                                                 className="w-24 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold"
                                               />
                                               <span className="text-slate-455">€</span>
                                             </div>
                                           </div>
                                           <input 
                                             type="range" 
                                             min={0} 
                                             max={Math.max(60000, Math.round(prop.m2 * 800))} 
                                             step={500} 
                                             value={prop.reforma} 
                                             onChange={(e) => handleUpdatePropertyField(prop.id, 'reforma', Number(e.target.value))} 
                                             className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                           />
                                           <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                             <span>Sin reforma</span>
                                             {prop.m2 > 0 && prop.reforma > 0 && (
                                               <span>~{Math.round(prop.reforma / prop.m2)} €/m²</span>
                                             )}
                                             <span>Máx: {formatCurrency(Math.max(60000, Math.round(prop.m2 * 800)))}</span>
                                           </div>
                                         </div>

                                         {/* Slider 4: Financiación/Hipoteca */}
                                         <div className="space-y-2.5">
                                           <div className="flex justify-between items-center">
                                             <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Financiación:</span>
                                             <label className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer">
                                               <input 
                                                 type="checkbox" 
                                                 checked={prop.sinHipoteca || false} 
                                                 onChange={(e) => handleUpdatePropertyField(prop.id, 'sinHipoteca', e.target.checked)} 
                                                 className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-3.5 w-3.5 cursor-pointer" 
                                               />
                                               <span>Al contado</span>
                                             </label>
                                           </div>

                                           {prop.sinHipoteca ? (
                                             <div className="flex flex-col justify-center h-[72px] bg-emerald-950/20 border border-emerald-900/60 rounded-xl p-3 space-y-1 text-left">
                                               <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-450 leading-none">
                                                 <Sparkles className="h-3 w-3" />
                                                 <span>Compra al Contado Activa</span>
                                               </div>
                                               <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                                 100% capital aportado de fondos propios. Sin cuota hipotecaria.
                                               </p>
                                             </div>
                                           ) : (
                                             <div className="space-y-3.5">
                                               {/* LTV */}
                                               <div className="space-y-1">
                                                 <div className="flex justify-between items-center text-xs font-semibold">
                                                   <span className="text-slate-550 text-[10px]">LTV (Financiación):</span>
                                                   <div className="flex items-center gap-1">
                                                     <input
                                                       type="number"
                                                       value={prop.financiacionPct !== undefined ? prop.financiacionPct : 80}
                                                       onChange={(e) => handleUpdatePropertyField(prop.id, 'financiacionPct', Number(e.target.value))}
                                                       className="w-12 h-6 text-right px-1 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold bg-slate-950"
                                                     />
                                                     <span className="text-slate-455">%</span>
                                                   </div>
                                                 </div>
                                                 <input 
                                                   type="range" 
                                                   min="10" 
                                                   max="100" 
                                                   step="5" 
                                                   value={prop.financiacionPct !== undefined ? prop.financiacionPct : 80} 
                                                   onChange={(e) => handleUpdatePropertyField(prop.id, 'financiacionPct', Number(e.target.value))} 
                                                   className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                                 />
                                               </div>

                                               {/* TIN */}
                                               <div className="space-y-1">
                                                 <div className="flex justify-between items-center text-xs font-semibold">
                                                   <span className="text-slate-550 text-[10px]">Interés (TIN):</span>
                                                   <div className="flex items-center gap-1">
                                                     <input
                                                       type="number"
                                                       step="0.1"
                                                       disabled={globalMortgage.active}
                                                       value={globalMortgage.active ? globalMortgage.tin : prop.tin}
                                                       onChange={(e) => handleUpdatePropertyField(prop.id, 'tin', Number(e.target.value))}
                                                       className="w-16 h-7 text-right px-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold disabled:opacity-40 bg-slate-950"
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
                                                   <span>Máx: 8%</span>
                                                 </div>
                                               </div>
                                                 {/* Plazo Amortización en Ajustes Rápidos */}
                                                 <div className="space-y-1">
                                                   <div className="flex justify-between items-center text-xs font-semibold">
                                                     <span className="text-slate-550 text-[10px]">Plazo Hipoteca:</span>
                                                     <div className="flex items-center gap-1">
                                                       <input
                                                         type="number"
                                                         disabled={globalMortgage.active}
                                                         value={globalMortgage.active ? globalMortgage.plazo : prop.plazo}
                                                         onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))}
                                                         className="w-12 h-6 text-right px-1 bg-slate-950 border border-slate-800 text-slate-100 rounded text-xs focus:outline-none focus:border-blue-500 font-bold disabled:opacity-40 bg-slate-950 text-slate-100"
                                                       />
                                                       <span className="text-slate-455">años</span>
                                                     </div>
                                                   </div>
                                                   <input 
                                                     type="range" 
                                                     min="10" 
                                                     max="40" 
                                                     step="5" 
                                                     disabled={globalMortgage.active}
                                                     value={globalMortgage.active ? globalMortgage.plazo : prop.plazo} 
                                                     onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))} 
                                                     className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 disabled:cursor-not-allowed" 
                                                   />
                                                   <div className="text-[9px] text-slate-500 flex justify-between font-medium">
                                                     <span>Mín: 10a</span>
                                                     <span>Máx: 40a</span>
                                                   </div>
                                                 </div>
                                             </div>
                                           )}
                                         </div>
                                       </div>
 
                                        {/* Collapsible toggle for extra options */}
                                        <div className="flex justify-center py-1">
                                          <button
                                            type="button"
                                            onClick={() => setShowExtraSimulatorOptions(!showExtraSimulatorOptions)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-750 hover:border-slate-700 rounded-xl text-[10px] font-bold text-slate-350 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                          >
                                            <Settings className="h-3 w-3 text-slate-455" />
                                            <span>{showExtraSimulatorOptions ? 'Ocultar Parámetros Adicionales' : 'Mostrar Parámetros Adicionales (Gastos, Plazos...)'}</span>
                                            <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-300 ${showExtraSimulatorOptions ? 'rotate-180' : ''}`} />
                                          </button>
                                        </div>

                                        {showExtraSimulatorOptions && (
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-900/60 border border-slate-850 rounded-xl p-4 shadow-inner animate-slide-up text-left mt-2">
                                            
                                            {/* Gastos Mensuales */}
                                            <div className="col-span-2 sm:col-span-3 border-b border-slate-800/85 pb-1 flex items-center gap-1.5">
                                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Gastos de Operativa (Mensuales/Anuales)</span>
                                            </div>

                                            {/* Comunidad */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Comunidad (€/mes)</label>
                                              <input
                                                type="number"
                                                value={prop.comunidad}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'comunidad', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* IBI */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">IBI Anual (€/año)</label>
                                              <input
                                                type="number"
                                                value={prop.ibi}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'ibi', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Seguro */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Seguro Anual (€/año)</label>
                                              <input
                                                type="number"
                                                value={prop.seguro}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'seguro', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Gastos de Compra */}
                                            <div className="col-span-2 sm:col-span-3 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Gastos de Compra (Adquisición)</span>
                                            </div>

                                            {/* ITP */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">ITP (%)</label>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={prop.itp}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'itp', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Honorarios */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Honorarios Inmo. (€)</label>
                                              <input
                                                type="number"
                                                value={prop.honorarios}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'honorarios', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Notaría / Registro */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Notaría y Reg. (%)</label>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={prop.notariaRegistro}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'notariaRegistro', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Parámetros Técnicos */}
                                            <div className="col-span-2 sm:col-span-3 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Otros Parámetros de Simulación</span>
                                            </div>

                                            {/* Zona */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Zona</label>
                                              <select
                                                value={prop.zona}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  handleUpdatePropertyField(prop.id, 'zona', val);
                                                  const targetZone = zonesConfig[val];
                                                  if (targetZone && targetZone.itp !== undefined) {
                                                    handleUpdatePropertyField(prop.id, 'itp', targetZone.itp);
                                                    handleUpdatePropertyField(prop.id, 'notariaRegistro', Math.max(0, 10 - targetZone.itp));
                                                  }
                                                }}
                                                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer text-slate-100"
                                              >
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

                                            {/* Precio Idealista */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Precio Idealista (€)</label>
                                              <input
                                                type="number"
                                                value={prop.precioOriginal || ''}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'precioOriginal', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                                placeholder="Opcional"
                                              />
                                            </div>

                                            {/* Plazo Hipoteca */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Plazo Hipoteca</label>
                                              <select
                                                disabled={prop.sinHipoteca || globalMortgage.active}
                                                value={prop.plazo}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'plazo', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-slate-950 text-slate-100"
                                              >
                                                <option value={10}>10 años</option>
                                                <option value={15}>15 años</option>
                                                <option value={20}>20 años</option>
                                                <option value={25}>25 años</option>
                                                <option value={30}>30 años</option>
                                                <option value={35}>35 años</option>
                                                <option value={40}>40 años</option>
                                              </select>
                                            </div>

                                            {/* Superficie */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Superficie (m²)</label>
                                              <input
                                                type="number"
                                                value={prop.m2}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'm2', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold"
                                              />
                                            </div>

                                            {/* Planta */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Planta</label>
                                              <select
                                                value={prop.planta}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'planta', e.target.value)}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold cursor-pointer bg-slate-950 text-slate-100"
                                              >
                                                {PLANTAS.map(p => <option key={p.id} value={p.id} className="bg-slate-950">{p.label}</option>)}
                                              </select>
                                            </div>

                                            {/* Parámetros Fiscales e Impuestos */}
                                            <div className="col-span-2 sm:col-span-3 border-b border-slate-800/85 pb-1 pt-1 flex items-center gap-1.5">
                                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Parámetros Fiscales y Proyección</span>
                                            </div>

                                            {/* IRPF Marginal */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">IRPF Marginal (%)</label>
                                              <input
                                                type="number"
                                                value={prop.irpfMarginal !== undefined ? prop.irpfMarginal : 30}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'irpfMarginal', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                              />
                                            </div>

                                            {/* % Construcción */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">% Construcción (Edificación)</label>
                                              <input
                                                type="number"
                                                value={prop.porcentajeConstruccion !== undefined ? prop.porcentajeConstruccion : 70}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'porcentajeConstruccion', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                              />
                                            </div>

                                            {/* Alquiler Habitual */}
                                            <div className="space-y-1.5 flex flex-col justify-end pb-1.5 col-span-2 sm:col-span-1">
                                              <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer select-none">
                                                <input
                                                  type="checkbox"
                                                  checked={prop.viviendaHabitual !== undefined ? prop.viviendaHabitual : true}
                                                  onChange={(e) => handleUpdatePropertyField(prop.id, 'viviendaHabitual', e.target.checked)}
                                                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-blue-500/20 h-4 w-4 cursor-pointer"
                                                />
                                                <span>Alquiler Habitual (50% red.)</span>
                                              </label>
                                            </div>

                                            {/* IPC/Inflación */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">IPC / Inflación Anual (%)</label>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={prop.ipcAnual !== undefined ? prop.ipcAnual : 2}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'ipcAnual', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                              />
                                            </div>

                                            {/* Revalorización Anual */}
                                            <div className="space-y-1.5">
                                              <label className="block text-[10px] font-bold text-slate-455">Revalorización Anual (%)</label>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={prop.revalorizacionAnual !== undefined ? prop.revalorizacionAnual : 2}
                                                onChange={(e) => handleUpdatePropertyField(prop.id, 'revalorizacionAnual', Number(e.target.value))}
                                                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs focus:outline-none focus:border-blue-500/50 font-bold bg-slate-950"
                                              />
                                            </div>

                                          </div>
                                        )}

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

                                    {/* Fiscalidad y Proyección (TIR a 10 Años) */}
                                    <div className="lg:col-span-3 border-t border-slate-850/60 pt-5 mt-2 space-y-4 animate-slide-up">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/40 rounded-xl border border-slate-850 p-5 shadow-lg">
                                        {/* Ficha Fiscal */}
                                        <div className="space-y-3 text-left">
                                          <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                                            <Calculator className="h-4 w-4 text-blue-450" />
                                            <span>Ficha Fiscal Anual (Año 1)</span>
                                          </h4>
                                          <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
                                            <div className="flex justify-between">
                                              <span>Ingresos Brutos Anuales:</span>
                                              <span className="font-semibold text-slate-200">{formatCurrency(prop.alquiler * 12)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Intereses Hipoteca Deducibles:</span>
                                              <span className="font-semibold text-red-400">-{formatCurrency(m.interesesPrimerAno)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Amortización Edificación (3%):</span>
                                              <span className="font-semibold text-red-400">-{formatCurrency(m.amortizacionConstruccion)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span>Otros Gastos Deducibles:</span>
                                              <span className="font-semibold text-red-400">-{formatCurrency((prop.comunidad * 12) + prop.ibi + prop.seguro)}</span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-semibold text-slate-300">
                                              <span>Base Imponible Estimada:</span>
                                              <span className="text-slate-100">{formatCurrency(Math.max(0, (prop.alquiler * 12) - ((prop.comunidad * 12) + prop.ibi + prop.seguro + m.interesesPrimerAno + m.amortizacionConstruccion)))}</span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-500">
                                              <span>Base Reducida (Habitual):</span>
                                              <span>
                                                {prop.viviendaHabitual !== false ? '50% aplicado' : 'Sin reducción'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-bold text-slate-200">
                                              <span>IRPF Anual ({prop.irpfMarginal !== undefined ? prop.irpfMarginal : 30}%):</span>
                                              <span className="text-red-400">{formatCurrency(m.impuestosIRPFAnuales)}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Proyección y Rentabilidad TIR */}
                                        <div className="md:col-span-2 space-y-3 flex flex-col justify-between text-left">
                                          <div>
                                            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
                                              <TrendingUp className="h-4 w-4 text-emerald-450" />
                                              <span>Proyección de Flujos y TIR Estimada</span>
                                            </h4>
                                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                                              Proyección financiera a 10 años con incremento de alquileres y gastos de <strong>{prop.ipcAnual !== undefined ? prop.ipcAnual : 2}% (IPC)</strong> y revalorización del inmueble del <strong>{prop.revalorizacionAnual !== undefined ? prop.revalorizacionAnual : 2}% anual</strong>.
                                            </p>
                                          </div>
                                          
                                          {/* Minibarras de Flujo de Caja */}
                                          <div className="grid grid-cols-10 gap-1.5 py-2">
                                            {m.cashFlowsTIR && m.cashFlowsTIR.slice(1).map((cf, idx) => {
                                              const isPositive = cf >= 0;
                                              return (
                                                <div key={idx} className="flex flex-col items-center group relative">
                                                  <div className="text-[8px] text-slate-500 font-bold">A{idx+1}</div>
                                                  <div className="w-full h-12 bg-slate-950 rounded border border-slate-880/60 flex items-end justify-center overflow-hidden">
                                                    <div 
                                                      style={{ height: `${Math.min(100, Math.max(10, Math.abs(cf) / 100))}%` }} 
                                                      className={`w-full ${isPositive ? 'bg-emerald-500/30 border-t border-emerald-400' : 'bg-red-500/30 border-t border-red-400'}`}
                                                    />
                                                  </div>
                                                  <div className="absolute bottom-14 hidden group-hover:block bg-slate-900 border border-slate-800 text-[10px] text-slate-200 rounded px-2 py-1 whitespace-nowrap z-10 shadow-xl font-bold">
                                                    CF Año {idx+1}: {formatCurrency(cf)}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>

                                          <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-950/80 border border-slate-850 rounded-xl p-3.5 mt-2 gap-4">
                                            <div className="text-left">
                                              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Rentabilidad Neta Fiscal (ROE Post-Imp.)</span>
                                              <span className="text-sm font-extrabold text-emerald-450">
                                                {formatPercent(m.rentabilidadNetaPostImpuestos)}
                                              </span>
                                            </div>
                                            
                                            <div className="text-right sm:text-right w-full sm:w-auto">
                                              <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">TIR Estimada a 10 Años (Venta)</span>
                                              <span className={`text-base font-extrabold px-3 py-1 rounded-md border ${m.tir !== null && m.tir >= 8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-glow-emerald' : m.tir !== null && m.tir >= 4 ? 'text-blue-450 bg-blue-500/10 border-blue-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20'}`}>
                                                {m.tir !== null ? `${formatPercent(m.tir)}` : 'N/A'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Rangos de Precio de Compra sugeridos para Negociación */}
                                    {(() => {
                                      const priceRanges = getPriceRangesForGrades(prop);
                                      return (
                                        <div className="lg:col-span-3 border-t border-slate-850/60 pt-5 mt-2 space-y-4 animate-slide-up">
                                          <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                              <TrendingUp className="h-4 w-4 text-emerald-450" />
                                              <span>Rangos de Precio de Compra sugeridos para Negociación</span>
                                            </h4>
                                            <p className="text-[10px] text-slate-500 font-medium mt-1">
                                              Rango de precios de adquisición simulados y la calificación de inversión que obtendrías en cada uno de ellos.
                                            </p>
                                          </div>
                                          
                                          {priceRanges === null ? (
                                            <div className="bg-red-950/15 border border-red-900/40 rounded-xl p-4 flex items-start gap-3 shadow-md">
                                              <AlertTriangle className="h-5 w-5 text-red-450 shrink-0 mt-0.5" />
                                              <div className="space-y-1">
                                                <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider">Inmueble Bloqueado (Grado F)</h5>
                                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                                  Este inmueble tiene asignado un Grado F (Bloqueado) debido a que no cumple con criterios esenciales de la inversión (por ejemplo: tercera planta o superior sin ascensor). Ajustar el precio de compra no alterará su exclusión ni su calificación actual.
                                                </p>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                              {Object.entries(priceRanges).map(([grade, range]) => {
                                                if (range.min === Infinity) return null;
                                                const isCurrent = grade === score.grade;
                                                
                                                let gradeStyle = {
                                                  bg: 'bg-slate-900/60',
                                                  border: 'border-slate-800/80',
                                                  text: 'text-slate-350',
                                                  badge: 'bg-slate-800 text-slate-400 border-slate-700/60',
                                                  label: ''
                                                };
                                                
                                                if (grade === 'A+') {
                                                  gradeStyle = { bg: 'bg-emerald-950/10', border: 'border-emerald-500/15', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Excelente' };
                                                } else if (grade === 'A') {
                                                  gradeStyle = { bg: 'bg-teal-950/10', border: 'border-teal-500/15', text: 'text-teal-300', badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20', label: 'Muy Bueno' };
                                                } else if (grade === 'B') {
                                                  gradeStyle = { bg: 'bg-blue-950/10', border: 'border-blue-500/15', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Bueno' };
                                                } else if (grade === 'C') {
                                                  gradeStyle = { bg: 'bg-amber-950/10', border: 'border-amber-500/15', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Aceptable' };
                                                } else if (grade === 'D') {
                                                  gradeStyle = { bg: 'bg-orange-950/10', border: 'border-orange-500/15', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'Riesgoso' };
                                                } else if (grade === 'E') {
                                                  gradeStyle = { bg: 'bg-red-950/10', border: 'border-red-500/15', text: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'No Recomendado' };
                                                }
                                                
                                                return (
                                                  <div
                                                    key={grade}
                                                    className={`relative p-3.5 rounded-xl border flex flex-col justify-between transition-all duration-300 shadow-md ${
                                                      isCurrent
                                                        ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                                                        : `${gradeStyle.border} ${gradeStyle.bg}`
                                                    }`}
                                                  >
                                                    {isCurrent && (
                                                      <span className="absolute -top-2 left-3 px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase bg-emerald-500 text-slate-950 rounded shadow-glow-emerald">
                                                        Actual
                                                      </span>
                                                    )}
                                                    
                                                    <div className="flex justify-between items-center mb-2">
                                                      <span className={`text-sm font-extrabold ${isCurrent ? 'text-emerald-450' : gradeStyle.text}`}>
                                                        Grado {grade}
                                                      </span>
                                                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border ${gradeStyle.badge}`}>
                                                        {gradeStyle.label}
                                                      </span>
                                                    </div>
                                                    
                                                    <div className="space-y-2.5 mt-3 border-t border-slate-850 pt-2.5 flex flex-col gap-1">
                                                       <div>
                                                         <div className="text-slate-500 font-bold uppercase text-[8px] tracking-wider mb-0.5">Precio de Compra</div>
                                                         <div className="font-extrabold text-slate-100 text-[11px] whitespace-nowrap">
                                                           {range.min === range.max
                                                             ? formatCurrency(range.min)
                                                             : `${formatCurrency(range.min)} - ${formatCurrency(range.max)}`}
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <div className="text-slate-500 font-bold uppercase text-[8px] tracking-wider mb-0.5">ROE (Neta)</div>
                                                         <div className="font-extrabold text-emerald-450 text-[11px] whitespace-nowrap">
                                                           {range.minRoe === range.maxRoe
                                                             ? formatPercent(range.minRoe)
                                                             : `${formatPercent(range.minRoe)} - ${formatPercent(range.maxRoe)}`}
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <div className="text-slate-500 font-bold uppercase text-[8px] tracking-wider mb-0.5">Flujo de Caja</div>
                                                         <div className="font-extrabold text-blue-400 text-[11px] whitespace-nowrap">
                                                           {range.minCf === range.maxCf
                                                             ? `${formatCurrency(range.minCf)}/mes`
                                                             : `${formatCurrency(range.minCf)} - ${formatCurrency(range.maxCf)}/mes`}
                                                         </div>
                                                       </div>
                                                       <div>
                                                         <div className="text-slate-500 font-bold uppercase text-[8px] tracking-wider mb-0.5">Rent. Bruta</div>
                                                         <div className="font-extrabold text-slate-300 text-[11px] whitespace-nowrap">
                                                           {range.minBruta === range.maxBruta
                                                             ? formatPercent(range.minBruta)
                                                             : `${formatPercent(range.minBruta)} - ${formatPercent(range.maxBruta)}`}
                                                         </div>
                                                       </div>
                                                     </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {/* Módulo: Gestión de Contacto y Seguimiento (Módulo Nuevo) */}
                                    <div className="lg:col-span-3 border-t border-slate-850/60 pt-5 mt-4 space-y-3 animate-slide-up text-left">
                                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📞 Gestión de Contacto y Citas de Visita</span>
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/60 border border-slate-850 rounded-xl p-5 shadow-lg font-medium">
                                        
                                        {/* Col 1: Estado y Cita */}
                                        <div className="space-y-4">
                                          <div className="space-y-1.5">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado Actual</label>
                                            <select
                                              value={prop.contactStatus || 'pending'}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'contactStatus', e.target.value)}
                                              className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 cursor-pointer bg-slate-950 text-slate-100"
                                            >
                                              <option value="pending">🔘 No contactado</option>
                                              <option value="contacted">📞 Contactado</option>
                                              <option value="visit_scheduled">📅 Visita programada</option>
                                              <option value="visit_done">✅ Visita realizada</option>
                                              <option value="offer_submitted">✉️ Oferta presentada</option>
                                              <option value="negotiation">🤝 En negociación</option>
                                              <option value="reserved">🏆 Reservado / Comprado</option>
                                              <option value="discarded">❌ Descartado</option>
                                            </select>
                                          </div>

                                          <div className="space-y-1.5">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                              <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                                              <span>Fecha y Hora de Cita</span>
                                            </label>
                                            <input
                                              type="datetime-local"
                                              value={prop.contactDate || ''}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'contactDate', e.target.value)}
                                              className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                            />
                                          </div>
                                        </div>

                                        {/* Col 2: Vendedor / Contacto */}
                                        <div className="space-y-4">
                                          <div className="space-y-1.5">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                              <User className="h-3.5 w-3.5 text-blue-405" />
                                              <span>Nombre del Contacto</span>
                                            </label>
                                            <input
                                              type="text"
                                              value={prop.contactName || ''}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'contactName', e.target.value)}
                                              placeholder="Ej: Inmobiliaria Tecnocasa / Particular"
                                              className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                            />
                                          </div>

                                          <div className="space-y-1.5">
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                              <Phone className="h-3.5 w-3.5 text-emerald-450" />
                                              <span>Teléfono de Contacto</span>
                                            </label>
                                            <input
                                              type="tel"
                                              value={prop.contactPhone || ''}
                                              onChange={(e) => handleUpdatePropertyField(prop.id, 'contactPhone', e.target.value)}
                                              placeholder="Ej: 600 123 456"
                                              className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 bg-slate-950 text-slate-100"
                                            />
                                          </div>
                                        </div>

                                        {/* Col 3: Notas */}
                                        <div className="space-y-1.5 h-full flex flex-col">
                                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                                            <span>Notas de la Conversación y Seguimiento</span>
                                          </label>
                                          <textarea
                                            value={prop.contactNotes || ''}
                                            onChange={(e) => handleUpdatePropertyField(prop.id, 'contactNotes', e.target.value)}
                                            placeholder="Registra precio mínimo aceptado, estado real, reformas requeridas, comentarios adicionales..."
                                            rows={4}
                                            className="w-full flex-grow p-2.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500/50 resize-y bg-slate-950 text-slate-100 min-h-[90px]"
                                          />
                                        </div>

                                      </div>
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* Resumen Global Info */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${mobileTab !== 'analisis' ? 'hidden lg:grid' : ''}`}>
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

      {/* NAVEGACIÓN MÓVIL (Bottom Tab Bar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 p-2 flex justify-around items-center">
        <button
          onClick={() => setMobileTab('cartera')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            mobileTab === 'cartera' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-450 hover:text-slate-200'
          }`}
        >
          <Building className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Cartera</span>
        </button>
        <button
          onClick={() => setMobileTab('analisis')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            mobileTab === 'analisis' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-450 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Análisis</span>
        </button>
        <button
          onClick={() => setMobileTab('añadir')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            mobileTab === 'añadir' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-450 hover:text-slate-200'
          }`}
        >
          <Plus className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Añadir</span>
        </button>
      </nav>

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
              <div className="space-y-4 bg-slate-950/25 p-4 rounded-xl border border-slate-850/65 shadow-md">
                <div className="flex items-center gap-2 text-slate-450 font-semibold">
                  <Cloud className="h-4 w-4 text-blue-400" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-350">Opción B: Sincronización Nube</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Guarda y carga carteras mediante un código. Si configuras una contraseña, tus datos serán cifrados localmente en tu navegador (Zero-Knowledge) para máxima privacidad.
                </p>

                {syncMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                    syncMessage.type === 'error' ? 'bg-red-950/30 text-red-300 border-red-900/50' :
                    syncMessage.type === 'success' ? 'bg-emerald-950/30 text-emerald-300 border-emerald-900/50' :
                    'bg-blue-950/30 text-blue-300 border-blue-900/50'
                  }`}>
                    <div className="font-bold shrink-0">
                      {syncMessage.type === 'error' ? '⚠️' : syncMessage.type === 'success' ? '✅' : 'ℹ️'}
                    </div>
                    <div className="font-medium leading-tight">{syncMessage.text}</div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Código de Sincronización</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputSyncCode}
                        onChange={(e) => setInputSyncCode(e.target.value)}
                        placeholder="Ej. mi-cartera-secreta"
                        className="flex-1 h-11 px-4 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-slate-600 disabled:opacity-40 transition-all"
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

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Contraseña de Cifrado (Opcional)</span>
                      <span className="text-blue-400 text-[9px] lowercase font-normal flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" /> cifrado AES-256
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={inputSyncPassword}
                        onChange={(e) => setInputSyncPassword(e.target.value)}
                        placeholder="Sin contraseña (público) o añade una"
                        className="w-full h-11 pl-4 pr-10 border border-slate-800 bg-slate-950 text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder-slate-600 disabled:opacity-40 transition-all"
                        disabled={isSyncing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-200 transition-colors p-1"
                        disabled={isSyncing}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {!inputSyncPassword && (
                      <p className="text-[9px] text-amber-500/80 leading-normal flex items-center gap-1 font-medium bg-amber-500/5 p-1.5 rounded-md border border-amber-500/10">
                        ⚠️ Sin contraseña, la cartera será pública y cualquiera con el código podrá verla/sobrescribirla.
                      </p>
                    )}
                    {inputSyncPassword && (
                      <p className="text-[9px] text-emerald-400/85 leading-normal flex items-center gap-1 font-medium bg-emerald-500/5 p-1.5 rounded-md border border-emerald-500/10">
                        🔒 Cifrado Zero-Knowledge. Nadie (ni en el servidor) puede ver tus datos. ¡No olvides tu contraseña!
                      </p>
                    )}
                  </div>
                </div>

                {syncCode && (
                  <div className="text-[10px] text-slate-500 bg-slate-950/50 p-2.5 rounded-lg border border-slate-850/50 flex flex-col gap-1 font-semibold">
                    <div className="flex justify-between">
                      <span>Código activo: <strong className="text-slate-400 font-bold">{syncCode}</strong></span>
                      <span>Modo: <strong className="text-slate-400 font-bold">{cloudMode === 'cloud' ? '☁️ Vercel KV' : '💾 Servidor Local'}</strong></span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-850/55 pt-1 mt-1 text-[9px]">
                      <span>Estado de privacidad:</span>
                      <span className={`flex items-center gap-1 font-bold ${syncPassword ? "text-emerald-400" : "text-amber-500"}`}>
                        {syncPassword ? (
                          <>
                            <Lock className="h-3 w-3" /> Cifrado y Privado
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3" /> Público y Compartido
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <button
                    onClick={() => handleLoadCloud(inputSyncCode)}
                    className="flex items-center justify-center gap-1.5 h-11 px-4 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-350 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
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
                          const itp = override.itp ?? base.itp ?? 8;
 
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
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                                <div>
                                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">ITP (%)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={itp}
                                    onChange={(e) => handleUpdateProvinceOverride(key, 'itp', e.target.value)}
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

      {/* Barra de acción flotante para comparación directa (Módulo 2) */}
      {selectedPropertyIds.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-5 animate-slide-up z-40">
          <div className="flex items-center gap-2">
            <div className="h-5.5 w-5.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-black shadow-glow-blue animate-pulse">
              {selectedPropertyIds.length}
            </div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Inmuebles seleccionados</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowComparisonModal(true)}
              className="flex items-center gap-1.5 h-9 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white rounded-xl shadow-lg hover:from-blue-500 hover:to-indigo-500 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
              <span>Comparar Inmuebles</span>
            </button>
            <button
              onClick={() => setSelectedPropertyIds([])}
              className="h-9 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-xs font-bold text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Comparación Cara a Cara (Módulo 2) */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-scale-up overflow-hidden">
            {/* Header del Modal */}
            <div className="px-6 py-4 border-b border-slate-850 flex justify-between items-center bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ArrowUpDown className="h-5 w-5 rotate-90" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Comparación Cara a Cara</h3>
                  <p className="text-xs text-slate-455 mt-0.5">Métricas financieras comparadas para {selectedPropertiesToCompare.length} inmuebles</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopyComparisonMarkdown}
                  className="flex items-center gap-1.5 h-9 px-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-750 hover:border-slate-700 text-xs font-bold text-slate-400 hover:text-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Copiar en Markdown</span>
                </button>
                <button
                  onClick={() => setShowComparisonModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-750 hover:border-slate-700 transition-all cursor-pointer"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </button>
              </div>
            </div>

            {/* Body del Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="overflow-x-auto border border-slate-850 rounded-2xl bg-slate-950/45 shadow-inner">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-855 bg-slate-900/60 font-bold text-slate-400 uppercase tracking-wider text-[9px]">
                      <th className="px-5 py-4 w-48 sticky left-0 bg-slate-900 z-10 border-r border-slate-855">Concepto</th>
                      {selectedPropertiesToCompare.map(p => {
                        const score = getPropertyScore(p, p.metrics, zonesConfig);
                        return (
                          <th key={p.id} className="px-5 py-4 text-center border-r border-slate-855 last:border-0 min-w-[150px]">
                            <div className="space-y-1.5">
                              <span className="block text-slate-200 font-extrabold text-xs tracking-normal truncate">{p.nombre}</span>
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`px-1.5 py-0.5 text-[8px] font-black rounded border ${score.color}`}>{score.grade}</span>
                                <span className="text-[10px] text-slate-500 font-medium">({zonesConfig[p.zona]?.name || p.zona})</span>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-855 text-slate-400">
                    
                    {/* SECCIÓN GENERAL */}
                    <tr className="bg-slate-900/30 font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">
                      <td colSpan={1 + selectedPropertiesToCompare.length} className="px-5 py-2 border-r border-slate-855">Calificación General</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Puntuación Score</td>
                      {selectedPropertiesToCompare.map(p => {
                        const score = getPropertyScore(p, p.metrics, zonesConfig);
                        const winnerId = (() => {
                          let win = selectedPropertiesToCompare[0];
                          selectedPropertiesToCompare.forEach(x => {
                            if (getPropertyScore(x, x.metrics, zonesConfig).points > getPropertyScore(win, win.metrics, zonesConfig).points) {
                              win = x;
                            }
                          });
                          return win.id;
                        })();
                        const points = score.points ?? 0;
                        return (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {points} pts ({score.label})
                          </td>
                        );
                      })}
                    </tr>

                    {/* GASTOS INICIALES */}
                    <tr className="bg-slate-900/30 font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">
                      <td colSpan={1 + selectedPropertiesToCompare.length} className="px-5 py-2 border-r border-slate-855">Costes de Adquisición</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Precio de Compra</td>
                      {(() => {
                        const winnerId = getWinnerId('precio', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatCurrency(p.precio)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Reforma Estimada</td>
                      {(() => {
                        const winnerId = getWinnerId('reforma', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatCurrency(p.reforma)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Gastos de Compra (ITP, Notaría...)</td>
                      {(() => {
                        const winnerId = getWinnerId('gastosAdquisicion', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatCurrency(p.metrics.gastosAdquisicion)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Capital Aportado Inicial</td>
                      {(() => {
                        const winnerId = getWinnerId('capitalAportadoTotal', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatCurrency(p.metrics.capitalAportadoTotal)}
                          </td>
                        ));
                      })()}
                    </tr>

                    {/* OPERATIVA MENSUAL */}
                    <tr className="bg-slate-900/30 font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">
                      <td colSpan={1 + selectedPropertiesToCompare.length} className="px-5 py-2 border-r border-slate-855">Simulación Operativa Mensual</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Alquiler Estimado</td>
                      {(() => {
                        const winnerId = getWinnerId('alquiler', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            +{formatCurrency(p.alquiler)}/mes
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Cuota de Hipoteca</td>
                      {(() => {
                        const winnerId = getWinnerId('cuotaMensual', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {p.sinHipoteca ? 'No aplica (Contado)' : `-${formatCurrency(p.metrics.cuotaMensual)}/mes`}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Cash Flow (Antes Imp.)</td>
                      {(() => {
                        const winnerId = getWinnerId('cashFlowMensual', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatCurrency(p.metrics.cashFlowMensual)}/mes
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Retención IRPF</td>
                      {(() => {
                        const winnerId = getWinnerId('impuestoIRPFMensual', true);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            -{formatCurrency(p.metrics.impuestoIRPFMensual)}/mes
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Cash Flow Neto Real (Post-Imp.)</td>
                      {(() => {
                        const winnerId = getWinnerId('cashFlowMensualPostImpuestos', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-extrabold ${p.id === winnerId ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black shadow-glow-emerald' : ''}`}>
                            {formatCurrency(p.metrics.cashFlowMensualPostImpuestos)}/mes
                          </td>
                        ));
                      })()}
                    </tr>

                    {/* RENTABILIDADES */}
                    <tr className="bg-slate-900/30 font-extrabold text-[9px] uppercase text-slate-500 tracking-wider">
                      <td colSpan={1 + selectedPropertiesToCompare.length} className="px-5 py-2 border-r border-slate-855">Rentabilidades y Proyecciones</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Rentabilidad Bruta</td>
                      {(() => {
                        const winnerId = getWinnerId('rentabilidadBruta', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatPercent(p.metrics.rentabilidadBruta)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Rentabilidad Neta (ROE Antes Imp.)</td>
                      {(() => {
                        const winnerId = getWinnerId('rentabilidadNeta', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-medium ${p.id === winnerId ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15 font-extrabold' : ''}`}>
                            {formatPercent(p.metrics.rentabilidadNeta)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">Rentabilidad Neta Real (ROE Post-Imp.)</td>
                      {(() => {
                        const winnerId = getWinnerId('rentabilidadNetaPostImpuestos', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-extrabold ${p.id === winnerId ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black shadow-glow-emerald' : ''}`}>
                            {formatPercent(p.metrics.rentabilidadNetaPostImpuestos)}
                          </td>
                        ));
                      })()}
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold sticky left-0 bg-slate-900/40 border-r border-slate-855">TIR a 10 Años (Venta)</td>
                      {(() => {
                        const winnerId = getWinnerId('tir', false);
                        return selectedPropertiesToCompare.map(p => (
                          <td key={p.id} className={`px-5 py-3 text-center border-r border-slate-855 last:border-0 font-extrabold ${p.id === winnerId ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black shadow-glow-emerald' : ''}`}>
                            {p.metrics.tir !== null ? formatPercent(p.metrics.tir) : 'N/A'}
                          </td>
                        ));
                      })()}
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}