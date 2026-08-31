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

const DEFAULT_CONFIG = {
  plaques: ["1-TQP-700", "2-BSW-604"],
  chantiers: [],
  email_destinataire: "deutsch.isabelle@eecocur.be",
  heures_normales_par_jour: 8,
  tarif_km_chauffeur: 0,
  tarif_km_accompagnateur: 0,
  nom_entreprise: ""
};

/**
 * Charge la configuration depuis localStorage ou fetch config.json
 */
async function loadConfig() {
  let config = { ...DEFAULT_CONFIG };
  try {
    const stored = localStorage.getItem("heures_config");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration éventuelle de tarif_km vers tarif_km_chauffeur
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

/**
 * Sauvegarde la configuration dans localStorage
 */
function saveConfig(config) {
  localStorage.setItem("heures_config", JSON.stringify(config));
}

/**
 * Convertit "HH:MM" ou "HH:MM:SS" en secondes
 */
function parseHHMM(str) {
  if (!str) return 0;
  const m = String(str).trim().match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return 0;
  return +m[1] * 3600 + +m[2] * 60 + (m[3] ? +m[3] : 0);
}

/**
 * Convertit des secondes en "HH:MM"
 */
function toHHMM(sec) {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600);
  const mn = Math.floor((s % 3600) / 60);
  return (neg ? "-" : "") + String(h).padStart(2, "0") + ":" + String(mn).padStart(2, "0");
}

/**
 * Convertit "HH:MM" en heures décimales
 */
function parseHM(str) {
  if (!str) return 0;
  const [h, m] = String(str).split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

/**
 * Clé de stockage pour un mois et une année donnés
 */
function getStorageKey(mois, annee) {
  return `heures_v2_${mois}_${annee}`;
}

/**
 * Vérifie si le champ chauffeur correspond à l'ouvrier (ou s'il est vide => ouvrier conduit)
 */
function isChauffeur(chauffeurVal, nom, prenom) {
  const c = (chauffeurVal || "").trim().toLowerCase();
  if (!c) return true; // Par défaut, s'il n'y a rien d'écrit, l'ouvrier est chauffeur
  const n = (nom || "").trim().toLowerCase();
  const p = (prenom || "").trim().toLowerCase();

  if (n && c.includes(n)) return true;
  if (p && c.includes(p)) return true;
  if (n && n.includes(c)) return true;
  if (p && p.includes(c)) return true;

  return false;
}

/**
 * Échappe le HTML pour éviter les failles XSS
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Affiche une notification toast
 */
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
 * Initialise la barre de navigation universelle
 */
function initNavBar(activePage = "") {
  const navHtml = `
    <nav class="app-nav no-print">
      <div class="app-nav-inner">
        <a href="index.html" class="app-brand">
          <div class="app-brand-icon">⏱️</div>
          <span>Heures Mensuelles</span>
        </a>
        <ul class="app-nav-links">
          <li><a href="index.html" class="nav-link ${activePage === 'index' ? 'active' : ''}">📅 Saisie</a></li>
          <li><a href="historique.html" class="nav-link ${activePage === 'historique' ? 'active' : ''}">📋 Historique</a></li>
          <li><a href="resume.html" class="nav-link ${activePage === 'resume' ? 'active' : ''}">📊 Résumé</a></li>
          <li><a href="import_photo.html" class="nav-link ${activePage === 'import_photo' ? 'active' : ''}">📷 Import IA</a></li>
          <li><a href="config.html" class="nav-link ${activePage === 'config' ? 'active' : ''}">⚙️ Configuration</a></li>
        </ul>
      </div>
    </nav>
  `;
  document.body.insertAdjacentHTML("afterbegin", navHtml);
}
