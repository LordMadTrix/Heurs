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
  logo_entreprise: ""
};

/**
 * Calcul précis des jours fériés légaux belges pour une année donnée
 */
function getBelgianHolidays(annee) {
  const holidays = {};

  // Fêtes fixes
  holidays[`${annee}-01-01`] = "Nouvel An";
  holidays[`${annee}-05-01`] = "Fête du Travail";
  holidays[`${annee}-07-21`] = "Fête Nationale";
  holidays[`${annee}-08-15`] = "Assomption";
  holidays[`${annee}-11-01`] = "Toussaint";
  holidays[`${annee}-11-11`] = "Armistice";
  holidays[`${annee}-12-25`] = "Noël";

  // Calcul du dimanche de Pâques (Algorithme de Gauss / Meeus)
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Mars, 4 = Avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(annee, month - 1, day);

  // Lundi de Pâques (+1 jour)
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);
  holidays[formatDateKey(easterMonday)] = "Lundi de Pâques";

  // Jeudi de l'Ascension (+39 jours)
  const ascension = new Date(easterDate);
  ascension.setDate(easterDate.getDate() + 39);
  holidays[formatDateKey(ascension)] = "Ascension";

  // Lundi de Pentecôte (+50 jours)
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

// Initialise le thème dès le chargement du script
initTheme();

/**
 * Charge la configuration depuis localStorage ou fetch config.json
 */
async function loadConfig() {
  let config = { ...DEFAULT_CONFIG };
  try {
    const stored = localStorage.getItem("heures_config");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.tarif_km && !parsed.tarif_km_chauffeur) {
        parsed.tarif_km_chauffeur = parsed.tarif_km;
      }
      config = { ...DEFAULT_CONFIG, ...parsed };
    } else {
      const res = await fetch("config.json");
      if (res.ok) {
        const json = await res.json();
        config = { ...DEFAULT_CONFIG, ...json };
      }
    }
  } catch (e) {
    console.warn("Utilisation de la configuration par défaut.", e);
  }
  return config;
}

function saveConfig(config) {
  localStorage.setItem("heures_config", JSON.stringify(config));
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
 * Initialise la barre de navigation universelle avec mode sombre
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
            <li><a href="import_photo.html" class="nav-link ${activePage === 'import_photo' ? 'active' : ''}">📷 Import IA</a></li>
            <li><a href="config.html" class="nav-link ${activePage === 'config' ? 'active' : ''}">⚙️ Paramètres</a></li>
          </ul>
          <button type="button" class="theme-toggle-btn" id="themeToggleBtn" onclick="toggleTheme()" title="${isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}">
            ${isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  `;
  document.body.insertAdjacentHTML("afterbegin", navHtml);
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
  }

  let count = 0;
  Object.entries(jsonData.feuilles).forEach(([key, val]) => {
    if (key.startsWith("heures_v2_")) {
      localStorage.setItem(key, JSON.stringify(val));
      count++;
    }
  });

  return count;
}
