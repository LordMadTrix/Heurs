/**
 * ==========================================================================
 * SHARED JAVASCRIPT UTILITIES - HEURES MENSUELLES
 * ==========================================================================
 */

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const MOIS_COURTS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
];

const ABSENCE_TYPES = {
  travail: { label: "Travail", code: "T", icon: "🔨" },
  ferie: { label: "Férié", code: "F", icon: "🇧🇪" },
  conge: { label: "Congé", code: "CP", icon: "🏖️" },
  maladie: { label: "Maladie", code: "M", icon: "🏥" },
  intemperies: { label: "Intempéries", code: "INT", icon: "🌧️" },
  rcr: { label: "Repos RCR", code: "RCR", icon: "🛋️" }
};

const DEFAULT_CONFIG = {
  plaques: ["1-TQP-700", "2-BSW-604"],
  chantiers: [],
  email_destinataire: "deutsch.isabelle@eecocur.be",
  heures_normales_par_jour: 8,
  tarif_km_chauffeur: 0,
  tarif_km_accompagnateur: 0,
  nom_entreprise: "",
  logo_entreprise: "",
  nom_ouvrier_defaut: "Petit",
  prenom_ouvrier_defaut: "Sébastien",
  gemini_api_key: ""
};

/**
 * ==========================================================================
 * SUPABASE CLOUD SYNCHRONIZATION
 * ==========================================================================
 */
const DEFAULT_SUPABASE_URL = "https://xwjgjwnzafdjrabgvpcy.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_XtDomCqVldj_nhJp21fzaQ_ReK3bdFt";

let _supabaseClient = null;
let _cloudSyncTimeout = null;

function cleanSupabaseUrl(url) {
  if (!url) return "";
  let cleaned = String(url).trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, "");
  cleaned = cleaned.replace(/\/+$/, "");
  return cleaned;
}

function getSupabaseCredentials() {
  const rawUrl = localStorage.getItem("supabase_url") || DEFAULT_SUPABASE_URL;
  return {
    url: cleanSupabaseUrl(rawUrl),
    key: (localStorage.getItem("supabase_key") || DEFAULT_SUPABASE_KEY).trim()
  };
}

function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  const { url, key } = getSupabaseCredentials();
  if (typeof supabase !== "undefined" && supabase.createClient && url && key) {
    try {
      _supabaseClient = supabase.createClient(url, key);
    } catch (e) {
      console.warn("Impossible d'initialiser le client Supabase:", e);
    }
  }
  return _supabaseClient;
}

function resetSupabaseClient() {
  _supabaseClient = null;
  return getSupabaseClient();
}

function updateCloudStatusBadge(status = "connected", tooltip = "Synchronisé avec le cloud Supabase") {
  const dot = document.getElementById("navCloudStatusDot");
  const icon = document.getElementById("navCloudIcon");
  const btn = document.getElementById("navCloudSyncBtn");
  if (!dot || !btn) return;

  dot.className = `cloud-status-dot ${status}`;
  btn.title = tooltip;

  if (icon) {
    if (status === "syncing") {
      icon.classList.add("is-spinning");
    } else {
      icon.classList.remove("is-spinning");
    }
  }
}

async function testSupabaseConnection() {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "SDK Supabase non chargé ou clé API manquante." };
  }
  try {
    const { data, error } = await client.from("app_config").select("id").limit(1);
    if (error) throw error;
    return { ok: true, message: "Connexion réussie à Supabase !" };
  } catch (err) {
    console.error("Erreur test Supabase:", err);
    return { ok: false, message: err.message || "Erreur de connexion à Supabase." };
  }
}

async function cloudSaveConfig(config) {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from("app_config").upsert({
      id: "main",
      data: config,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("Échec sauvegarde config cloud:", e);
    return false;
  }
}

async function cloudFetchConfig() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from("app_config").select("data").eq("id", "main").maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      return data.data;
    }
  } catch (e) {
    console.warn("Échec chargement config cloud:", e);
  }
  return null;
}

async function cloudSaveFeuille(key, formData) {
  const client = getSupabaseClient();
  if (!client || !key || !formData) return false;
  try {
    const parts = key.split("_");
    const mois = parseInt(formData.mois !== undefined ? formData.mois : parts[2]);
    const annee = parseInt(formData.annee !== undefined ? formData.annee : parts[3]);

    const { error } = await client.from("feuilles_heures").upsert({
      key: key,
      mois: isNaN(mois) ? null : mois,
      annee: isNaN(annee) ? null : annee,
      nom: (formData.nom || "").trim(),
      prenom: (formData.prenom || "").trim(),
      data: formData,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`Échec sauvegarde cloud pour ${key}:`, e);
    return false;
  }
}

function debouncedCloudSave(key, formData, delay = 1200) {
  if (_cloudSyncTimeout) clearTimeout(_cloudSyncTimeout);
  updateCloudStatusBadge("syncing", "Sauvegarde cloud en cours...");

  _cloudSyncTimeout = setTimeout(async () => {
    const success = await cloudSaveFeuille(key, formData);
    if (success) {
      updateCloudStatusBadge("connected", "Toutes les modifications sont synchronisées sur Supabase");
    } else {
      updateCloudStatusBadge("error", "Erreur lors de la synchronisation cloud");
    }
  }, delay);
}

async function cloudDeleteFeuille(key) {
  const client = getSupabaseClient();
  if (!client || !key) return false;
  try {
    const { error } = await client.from("feuilles_heures").delete().eq("key", key);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`Échec suppression cloud ${key}:`, e);
    return false;
  }
}

async function cloudFullSync(showToasts = false) {
  const client = getSupabaseClient();
  if (!client) {
    if (showToasts) showToast("Client Supabase indisponible", "error");
    updateCloudStatusBadge("error", "Supabase déconnecté");
    return;
  }

  updateCloudStatusBadge("syncing", "Synchronisation cloud en cours...");
  let uploaded = 0;
  let downloaded = 0;

  try {
    // 1. Synchroniser la configuration
    const cloudCfg = await cloudFetchConfig();
    if (cloudCfg && Object.keys(cloudCfg).length > 0) {
      const localCfg = JSON.parse(localStorage.getItem("heures_config") || "{}");
      const merged = { ...DEFAULT_CONFIG, ...localCfg, ...cloudCfg };
      localStorage.setItem("heures_config", JSON.stringify(merged));
    } else {
      const localCfg = JSON.parse(localStorage.getItem("heures_config") || "{}");
      if (Object.keys(localCfg).length > 0) {
        await cloudSaveConfig(localCfg);
      }
    }

    // 2. Récupérer toutes les feuilles distantes
    const { data: remoteRows, error } = await client.from("feuilles_heures").select("*");
    if (error) throw error;

    const remoteMap = new Map();
    if (remoteRows) {
      remoteRows.forEach(row => {
        remoteMap.set(row.key, row);
        const localRaw = localStorage.getItem(row.key);
        if (!localRaw) {
          localStorage.setItem(row.key, JSON.stringify(row.data));
          downloaded++;
        }
      });
    }

    // 3. Envoyer les feuilles locales manquantes vers le cloud
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("heures_v2_")) {
        if (!remoteMap.has(k)) {
          try {
            const localData = JSON.parse(localStorage.getItem(k));
            await cloudSaveFeuille(k, localData);
            uploaded++;
          } catch (e) {}
        }
      }
    }

    const totalCloud = remoteMap.size + uploaded;
    updateCloudStatusBadge("connected", `Synchronisé avec Supabase (${totalCloud} feuille${totalCloud > 1 ? 's' : ''})`);
    if (showToasts) {
      showToast(`Synchronisation terminée ! (+${uploaded} envoyée${uploaded > 1 ? 's' : ''}, +${downloaded} reçue${downloaded > 1 ? 's' : ''})`, "success");
    }
    window.dispatchEvent(new CustomEvent("heures-synced", { detail: { uploaded, downloaded } }));
  } catch (err) {
    console.error("Erreur synchronisation globale:", err);
    updateCloudStatusBadge("error", "Erreur de synchronisation Supabase");
    if (showToasts) {
      showToast("Échec de la synchronisation : " + (err.message || "Erreur réseau"), "error");
    }
  }
}

/**
 * Calcul précis des jours fériés légaux belges pour une année donnée
 */
function getBelgianHolidays(annee) {
  const holidays = {};

  holidays[`${annee}-01-01`] = "Nouvel An";
  holidays[`${annee}-05-01`] = "Fête du Travail";
  holidays[`${annee}-07-21`] = "Fête Nationale";
  holidays[`${annee}-08-15`] = "Assomption";
  holidays[`${annee}-11-01`] = "Toussaint";
  holidays[`${annee}-11-11`] = "Armistice";
  holidays[`${annee}-12-25`] = "Noël";

  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(annee, month - 1, day);

  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);
  holidays[formatDateKey(easterMonday)] = "Lundi de Pâques";

  const ascension = new Date(easterDate);
  ascension.setDate(easterDate.getDate() + 39);
  holidays[formatDateKey(ascension)] = "Ascension";

  const pentecoteMonday = new Date(easterDate);
  pentecoteMonday.setDate(easterDate.getDate() + 50);
  holidays[formatDateKey(pentecoteMonday)] = "Lundi de Pentecôte";

  return holidays;
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBelgianHoliday(jour, moisIdx, annee) {
  const m = String(moisIdx + 1).padStart(2, "0");
  const j = String(jour).padStart(2, "0");
  const key = `${annee}-${m}-${j}`;
  const holidays = getBelgianHolidays(annee);
  return holidays[key] || null;
}

/**
 * Gestion du Thème Clair / Sombre
 */
function initTheme() {
  const savedTheme = localStorage.getItem("app_theme");
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = (cur === "dark") ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("app_theme", next);

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.innerHTML = (next === "dark") ? "☀️" : "🌙";
    btn.title = (next === "dark") ? "Passer en mode clair" : "Passer en mode sombre";
  }
}

initTheme();

/**
 * Charge la configuration depuis Supabase (Cloud First), avec fallback localStorage et config.json
 */
async function loadConfig() {
  let config = { ...DEFAULT_CONFIG };

  // 1. Lecture du cache local pour affichage instantané
  try {
    const stored = localStorage.getItem("heures_config");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.tarif_km && !parsed.tarif_km_chauffeur) {
        parsed.tarif_km_chauffeur = parsed.tarif_km;
      }
      config = { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("Erreur lecture cache local config:", e);
  }

  // 2. Récupération directe depuis la base de données Supabase
  try {
    const cloudCfg = await cloudFetchConfig();
    if (cloudCfg && Object.keys(cloudCfg).length > 0) {
      config = { ...config, ...cloudCfg };
      localStorage.setItem("heures_config", JSON.stringify(config));
      if (config.gemini_api_key) {
        localStorage.setItem("gemini_api_key", config.gemini_api_key);
      }
    } else if (!localStorage.getItem("heures_config")) {
      // Si la base est encore vide, on tente de charger le config.json initial
      const res = await fetch("config.json");
      if (res.ok) {
        const json = await res.json();
        config = { ...DEFAULT_CONFIG, ...json };
        localStorage.setItem("heures_config", JSON.stringify(config));
        // Enregistrer la configuration initiale dans la base Supabase
        await cloudSaveConfig(config);
      }
    }
  } catch (err) {
    console.warn("Connexion cloud indisponible, utilisation du cache local pour la config.", err);
  }

  return config;
}

async function saveConfig(config) {
  localStorage.setItem("heures_config", JSON.stringify(config));
  if (config.gemini_api_key) {
    localStorage.setItem("gemini_api_key", config.gemini_api_key);
  }
  // Enregistrement immédiat dans la base Supabase
  const ok = await cloudSaveConfig(config);
  return ok;
}

/**
 * Utilitaires temps
 */
function parseHHMM(str) {
  if (!str) return 0;
  const m = String(str).trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0);
}

function toHHMM(sec) {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600);
  const mn = Math.floor((s % 3600) / 60);
  return (neg ? "-" : "") + String(h).padStart(2, "0") + ":" + String(mn).padStart(2, "0");
}

function parseHM(str) {
  if (!str) return 0;
  const [h, m] = String(str).split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

function getStorageKey(mois, annee) {
  return `heures_v2_${mois}_${annee}`;
}

function isChauffeur(chauffeurVal, nom, prenom) {
  const c = (chauffeurVal || "").trim().toLowerCase();
  if (!c) return true;
  const n = (nom || "").trim().toLowerCase();
  const p = (prenom || "").trim().toLowerCase();

  if (n && c.includes(n)) return true;
  if (p && c.includes(p)) return true;
  if (n && n.includes(c)) return true;
  if (p && p.includes(c)) return true;

  return false;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  if (type === "warning") icon = "⚠️";

  toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px) scale(0.9)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Initialise la barre de navigation universelle avec mode sombre et indicateur Cloud
 */
function initNavBar(activePage = "") {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const navHtml = `
    <nav class="app-nav no-print">
      <div class="app-nav-inner">
        <a href="index.html" class="app-brand">
          <div class="app-brand-icon">⏱️</div>
          <span>Heures Mensuelles</span>
        </a>
        <div class="app-nav-right">
          <ul class="app-nav-links">
            <li><a href="index.html" class="nav-link ${activePage === 'index' ? 'active' : ''}">📅 Saisie</a></li>
            <li><a href="historique.html" class="nav-link ${activePage === 'historique' ? 'active' : ''}">📋 Historique</a></li>
            <li><a href="resume.html" class="nav-link ${activePage === 'resume' ? 'active' : ''}">📊 Résumé</a></li>
            <li><a href="import_photo.html" class="nav-link ${activePage === 'import_photo' ? 'active' : ''}">📷 Import Photo / PDF</a></li>
            <li><a href="config.html" class="nav-link ${activePage === 'config' ? 'active' : ''}">⚙️ Paramètres</a></li>
          </ul>
          <button type="button" class="cloud-sync-btn" id="navCloudSyncBtn" onclick="cloudFullSync(true)" title="Synchroniser avec le Cloud Supabase">
            <span class="cloud-status-dot connected" id="navCloudStatusDot"></span>
            <span id="navCloudIcon" class="cloud-sync-icon">☁️</span>
            <span>Cloud</span>
          </button>
          <button type="button" class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()" title="${isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}">
            ${isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  `;
  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // Synchronisation automatique silencieuse
  setTimeout(() => {
    cloudFullSync(false);
  }, 400);
}

/**
 * Sauvegarde et Restauration Globale
 */
function exportGlobalBackup() {
  const backup = {
    version: "2.0",
    exportDate: new Date().toISOString(),
    config: JSON.parse(localStorage.getItem("heures_config") || "{}"),
    feuilles: {}
  };

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("heures_v2_")) {
      try {
        backup.feuilles[k] = JSON.parse(localStorage.getItem(k));
      } catch (e) {}
    }
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const filename = `sauvegarde_globale_heures_${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
  showToast("Sauvegarde globale exportée !", "success");
}

function importGlobalBackup(jsonData) {
  if (!jsonData || !jsonData.feuilles) {
    throw new Error("Format de sauvegarde globale invalide.");
  }

  if (jsonData.config && Object.keys(jsonData.config).length > 0) {
    localStorage.setItem("heures_config", JSON.stringify(jsonData.config));
    cloudSaveConfig(jsonData.config);
  }

  let count = 0;
  Object.entries(jsonData.feuilles).forEach(([key, val]) => {
    if (key.startsWith("heures_v2_")) {
      localStorage.setItem(key, JSON.stringify(val));
      cloudSaveFeuille(key, val);
      count++;
    }
  });

  return count;
}
