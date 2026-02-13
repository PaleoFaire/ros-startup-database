// ═══════════════════════════════════════════════════════════════════════════
// ROS STARTUP DATABASE - Application Logic
// ═══════════════════════════════════════════════════════════════════════════

// ─── INITIALIZATION ───
document.addEventListener('DOMContentLoaded', () => {
  initStats();
  initMap();
  initFilters();
  initDatabase();
  initModal();
});

// ─── STATS ───
function initStats() {
  const companyCount = COMPANIES.length;
  const sectors = new Set(COMPANIES.map(c => c.sector));

  // Calculate total funding
  let totalFunding = 0;
  COMPANIES.forEach(c => {
    if (c.totalRaised) {
      const match = c.totalRaised.match(/\$([\d.]+)([MB])/);
      if (match) {
        const value = parseFloat(match[1]);
        const multiplier = match[2] === 'B' ? 1000 : 1;
        totalFunding += value * multiplier;
      }
    }
  });

  // Animate stats
  animateNumber('company-count', companyCount);
  animateNumber('sector-count', sectors.size);

  const fundingDisplay = totalFunding >= 1000
    ? `$${(totalFunding / 1000).toFixed(1)}B+`
    : `$${totalFunding.toFixed(0)}M+`;
  document.getElementById('funding-total').textContent = fundingDisplay;
}

function animateNumber(elementId, target) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let current = 0;
  const increment = Math.ceil(target / 30);
  const interval = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    element.textContent = current;
  }, 30);
}

// ─── MAP ───
let map = null;
let markers = [];

function initMap() {
  const mapContainer = document.getElementById('startup-map');
  if (!mapContainer) return;

  // Initialize Leaflet map
  map = L.map('startup-map', {
    center: [37.5, -98],
    zoom: 4,
    zoomControl: true,
    scrollWheelZoom: true
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Add markers
  addMarkers();
}

function getSectorColor(sector) {
  const colors = {
    'Defense & Security': '#ef4444',
    'Nuclear Energy': '#22c55e',
    'Robotics & Manufacturing': '#3b82f6',
    'Space & Aerospace': '#8b5cf6',
    'Supersonic & Hypersonic': '#8b5cf6',
    'Climate & Energy': '#22c55e',
    'Biotech & Health': '#f59e0b',
    'Consumer Tech': '#f59e0b',
    'Education': '#f59e0b',
    'Ocean Tech': '#3b82f6'
  };
  return colors[sector] || '#f59e0b';
}

function getSectorClass(sector) {
  if (sector.includes('Defense')) return 'defense';
  if (sector.includes('Nuclear') || sector.includes('Climate') || sector.includes('Energy')) return 'energy';
  if (sector.includes('Space') || sector.includes('Supersonic') || sector.includes('Hypersonic')) return 'space';
  if (sector.includes('Robotics') || sector.includes('Manufacturing') || sector.includes('Ocean')) return 'manufacturing';
  return 'other';
}

function addMarkers() {
  markers = [];

  COMPANIES.forEach(company => {
    if (!company.lat || !company.lng) return;

    const color = getSectorColor(company.sector);

    // Create custom icon
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 14px;
        height: 14px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.8);
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([company.lat, company.lng], { icon })
      .addTo(map);

    // Popup content
    const popupContent = `
      <div class="map-popup">
        <div class="map-popup-name">${company.name}</div>
        <div class="map-popup-sector">${company.sector}</div>
        <div class="map-popup-description">${truncate(company.description, 120)}</div>
        <button class="map-popup-btn" onclick="openModal('${company.name}')">View Details</button>
      </div>
    `;

    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'custom-popup'
    });

    markers.push({ marker, company });
  });
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

// ─── FILTERS ───
function initFilters() {
  const searchInput = document.getElementById('search-input');
  const sectorFilter = document.getElementById('sector-filter');
  const stageFilter = document.getElementById('stage-filter');

  // Populate sector filter
  if (sectorFilter) {
    SECTORS.forEach(sector => {
      const option = document.createElement('option');
      option.value = sector;
      option.textContent = sector;
      sectorFilter.appendChild(option);
    });
  }

  // Populate stage filter
  if (stageFilter) {
    STAGES.forEach(stage => {
      const option = document.createElement('option');
      option.value = stage;
      option.textContent = stage;
      stageFilter.appendChild(option);
    });
  }

  // Event listeners
  if (searchInput) {
    searchInput.addEventListener('input', filterCompanies);
  }
  if (sectorFilter) {
    sectorFilter.addEventListener('change', filterCompanies);
  }
  if (stageFilter) {
    stageFilter.addEventListener('change', filterCompanies);
  }
}

function filterCompanies() {
  const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
  const sectorValue = document.getElementById('sector-filter')?.value || 'all';
  const stageValue = document.getElementById('stage-filter')?.value || 'all';

  const filtered = COMPANIES.filter(company => {
    const matchesSearch = !searchTerm ||
      company.name.toLowerCase().includes(searchTerm) ||
      company.description.toLowerCase().includes(searchTerm) ||
      (company.tags && company.tags.some(tag => tag.toLowerCase().includes(searchTerm)));

    const matchesSector = sectorValue === 'all' || company.sector === sectorValue;
    const matchesStage = stageValue === 'all' || company.fundingStage === stageValue;

    return matchesSearch && matchesSector && matchesStage;
  });

  renderDatabase(filtered);
}

// ─── DATABASE ───
function initDatabase() {
  renderDatabase(COMPANIES);
}

function renderDatabase(companies) {
  const grid = document.getElementById('database-grid');
  if (!grid) return;

  if (companies.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No companies match your filters</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = companies.map(company => `
    <div class="company-card" onclick="openModal('${company.name}')">
      <div class="card-header">
        <div class="card-name">${company.name}</div>
        <span class="card-sector ${getSectorClass(company.sector)}">${getSectorShort(company.sector)}</span>
      </div>
      <div class="card-description">${company.description}</div>
      <div class="card-meta">
        ${company.location ? `
          <div class="card-meta-item">
            <span class="card-meta-label">📍</span>
            <span class="card-meta-value">${company.location}</span>
          </div>
        ` : ''}
        ${company.fundingStage ? `
          <div class="card-meta-item">
            <span class="card-meta-label">Stage:</span>
            <span class="card-meta-value">${company.fundingStage}</span>
          </div>
        ` : ''}
        ${company.totalRaised ? `
          <div class="card-meta-item">
            <span class="card-meta-label">Raised:</span>
            <span class="card-meta-value">${company.totalRaised}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function getSectorShort(sector) {
  const shorts = {
    'Defense & Security': 'Defense',
    'Nuclear Energy': 'Nuclear',
    'Robotics & Manufacturing': 'Mfg',
    'Space & Aerospace': 'Space',
    'Supersonic & Hypersonic': 'Aviation',
    'Climate & Energy': 'Climate',
    'Biotech & Health': 'Bio',
    'Consumer Tech': 'Consumer',
    'Education': 'Edu',
    'Ocean Tech': 'Ocean'
  };
  return shorts[sector] || sector;
}

// ─── MODAL ───
function initModal() {
  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

function openModal(companyName) {
  const company = COMPANIES.find(c => c.name === companyName);
  if (!company) return;

  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  if (!overlay || !content) return;

  content.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-name">${company.name}</h2>
      <p class="modal-sector">${company.sector}</p>
    </div>

    <div class="modal-section">
      <h3 class="modal-section-title">Description</h3>
      <p class="modal-section-content">${company.description}</p>
    </div>

    ${company.thesis ? `
      <div class="modal-section">
        <h3 class="modal-section-title">Investment Thesis</h3>
        <p class="modal-section-content">${company.thesis}</p>
      </div>
    ` : ''}

    <div class="modal-section">
      <div class="modal-meta-grid">
        ${company.location ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Location</div>
            <div class="modal-meta-value">${company.location}</div>
          </div>
        ` : ''}
        ${company.founded ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Founded</div>
            <div class="modal-meta-value">${company.founded}</div>
          </div>
        ` : ''}
        ${company.fundingStage ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Stage</div>
            <div class="modal-meta-value">${company.fundingStage}</div>
          </div>
        ` : ''}
        ${company.totalRaised ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Total Raised</div>
            <div class="modal-meta-value">${company.totalRaised}</div>
          </div>
        ` : ''}
        ${company.valuation ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Valuation</div>
            <div class="modal-meta-value">${company.valuation}</div>
          </div>
        ` : ''}
        ${company.founder ? `
          <div class="modal-meta-item">
            <div class="modal-meta-label">Founder(s)</div>
            <div class="modal-meta-value">${company.founder}</div>
          </div>
        ` : ''}
      </div>
    </div>

    ${company.investors && company.investors.length > 0 ? `
      <div class="modal-section">
        <h3 class="modal-section-title">Key Investors</h3>
        <p class="modal-section-content">${company.investors.join(', ')}</p>
      </div>
    ` : ''}

    ${company.tags && company.tags.length > 0 ? `
      <div class="modal-section">
        <h3 class="modal-section-title">Tags</h3>
        <div class="modal-tags">
          ${company.tags.map(tag => `<span class="modal-tag">${tag}</span>`).join('')}
        </div>
      </div>
    ` : ''}

    ${company.rosCoverage ? `
      <div class="modal-section">
        <h3 class="modal-section-title">ROS Coverage</h3>
        <p class="modal-section-content">${company.rosCoverage}</p>
      </div>
    ` : ''}

    ${company.rosLink ? `
      <div class="modal-section">
        <a href="${company.rosLink}" target="_blank" class="modal-ros-link">
          📰 Read ROS Coverage ↗
        </a>
      </div>
    ` : ''}
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Make openModal globally accessible
window.openModal = openModal;
