// App State
let allCompanies = [];
let filteredCompanies = [];
let displayedCount = 0;
const ITEMS_PER_PAGE = 12;
let map;
let markerClusterGroup;
let loadMoreObserver = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Initialize Map
    initMap();

    // 2. Load Data from data.js
    if (typeof ALUMNI_DATA !== 'undefined') {
        allCompanies = ALUMNI_DATA;
        populateFilters(allCompanies);
        renderData(allCompanies);
    } else {
        console.error("ALUMNI_DATA bulunamadı. data.js dosyasının yüklendiğinden emin olun.");
        alert("Veri yüklenirken hata oluştu. Konsolu kontrol edin.");
    }

    // 3. Load Hiring Companies
    if (typeof HIRING_COMPANIES !== 'undefined') {
        renderHiringCompanies(HIRING_COMPANIES);
    }

    // 4. Setup Event Listeners
    setupEventListeners();
}

function initMap() {
    // Center on Turkey
    map = L.map('map').setView([39.0, 35.0], 6);

    // Street layer
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });

    // Satellite layer (Esri)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    // Add street layer by default
    streetLayer.addTo(map);

    // Layer control
    const baseLayers = {
        "Sokak": streetLayer,
        "Uydu": satelliteLayer
    };

    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    // Add reset button
    const resetControl = L.control({ position: 'topleft' });
    resetControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'reset-control');
        div.innerHTML = '<a href="#" title="Görünümü ve Filtreleri Sıfırla" class="reset-btn"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></a>';
        div.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetMap();
            return false;
        };
        return div;
    };
    resetControl.addTo(map);

    // Initialize marker cluster group
    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 12,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count > 10) size = 'medium';
            if (count > 25) size = 'large';

            return L.divIcon({
                html: `<div class="cluster-icon cluster-${size}"><span>${count}</span></div>`,
                className: 'custom-cluster',
                iconSize: L.point(40, 40)
            });
        }
    });

    map.addLayer(markerClusterGroup);
}

function renderData(companies) {
    const listContainer = document.getElementById('companyList');
    const totalCountEl = document.getElementById('totalCompanies');
    const locationsCountEl = document.getElementById('locationsCount');
    const fieldsCountEl = document.getElementById('fieldsCount');

    // Clear current View
    listContainer.innerHTML = '';
    markerClusterGroup.clearLayers();

    // Reset lazy loading state
    filteredCompanies = companies;
    displayedCount = 0;

    // Update Stats
    totalCountEl.textContent = companies.length;
    const uniqueCities = new Set(companies.map(c => c.province));
    const uniqueFields = new Set(companies.map(c => c.field));
    locationsCountEl.textContent = uniqueCities.size;
    fieldsCountEl.textContent = uniqueFields.size;

    // Add all markers to map (for complete map view)
    companies.forEach(company => {
        addMapMarker(company);
    });

    // Render initial batch of cards
    loadMoreCards();

    // Setup intersection observer for infinite scroll
    setupInfiniteScroll();

    // Fit map to markers if there are any
    if (companies.length > 0) {
        const bounds = markerClusterGroup.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
        }
    }
}

function loadMoreCards() {
    const listContainer = document.getElementById('companyList');
    const startIndex = displayedCount;
    const endIndex = Math.min(displayedCount + ITEMS_PER_PAGE, filteredCompanies.length);

    for (let i = startIndex; i < endIndex; i++) {
        const card = createCompanyCard(filteredCompanies[i]);
        listContainer.appendChild(card);
    }

    displayedCount = endIndex;

    // Update or remove load more trigger
    updateLoadMoreTrigger();
}

function updateLoadMoreTrigger() {
    const listContainer = document.getElementById('companyList');
    const scrollIndicator = document.getElementById('scrollIndicator');

    // Remove existing trigger
    const existingTrigger = document.getElementById('loadMoreTrigger');
    if (existingTrigger) {
        existingTrigger.remove();
    }

    // Add new trigger if there are more items
    if (displayedCount < filteredCompanies.length) {
        const trigger = document.createElement('div');
        trigger.id = 'loadMoreTrigger';
        trigger.className = 'load-more-trigger';
        trigger.innerHTML = `
            <div class="load-more-content">
                <span class="load-more-text">${filteredCompanies.length - displayedCount} firma daha</span>
                <div class="load-more-spinner"></div>
            </div>
        `;
        listContainer.appendChild(trigger);

        // Observe new trigger
        if (loadMoreObserver) {
            loadMoreObserver.observe(trigger);
        }

        // Show scroll indicator
        if (scrollIndicator) {
            scrollIndicator.classList.remove('hidden');
        }
    } else {
        // Hide scroll indicator when all items loaded
        if (scrollIndicator) {
            scrollIndicator.classList.add('hidden');
        }
    }
}

function setupInfiniteScroll() {
    // Disconnect existing observer
    if (loadMoreObserver) {
        loadMoreObserver.disconnect();
    }

    // Create new intersection observer
    loadMoreObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && displayedCount < filteredCompanies.length) {
                loadMoreCards();
            }
        });
    }, {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    });

    // Observe initial trigger
    const trigger = document.getElementById('loadMoreTrigger');
    if (trigger) {
        loadMoreObserver.observe(trigger);
    }

    // Hide scroll indicator on scroll
    const scrollIndicator = document.getElementById('scrollIndicator');

    window.addEventListener('scroll', () => {
        if (scrollIndicator && !scrollIndicator.classList.contains('hidden')) {
            scrollIndicator.classList.add('hidden');
        }
    }, { passive: true });
}

function createCompanyCard(company) {
    const div = document.createElement('div');
    div.className = 'company-card';

    const contactLink = company.contact
        ? `<a href="${company.contact}" target="_blank" class="contact-link">Web Sitesi</a>`
        : '<span class="no-contact">Web sitesi yok</span>';

    // Generate internship history HTML
    const historyHTML = generateInternshipHistory(company.yearlyData);

    div.innerHTML = `
        <div class="company-header">
            <div class="company-name">${company.company}</div>
            <span class="badge field-badge">${company.field}</span>
        </div>
        <div class="detail-row location">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${company.province}
        </div>
        ${historyHTML}
        <div class="card-footer">
            ${contactLink}
            <a href="#" onclick="focusOnMap(${company.lat}, ${company.lng}); return false;" class="view-btn">Haritada Gör</a>
        </div>
    `;
    return div;
}

// Generate internship history visualization
function generateInternshipHistory(yearlyData) {
    if (!yearlyData || !yearlyData.years || Object.keys(yearlyData.years).length === 0) {
        return '';
    }

    const personSVG = `<svg class="person-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

    // Sort years
    const sortedYears = Object.keys(yearlyData.years).sort();
    const yearCount = sortedYears.length;

    // Helper function to generate year rows
    const generateYearRows = (years) => {
        return years.map(year => {
            const count = yearlyData.years[year];
            let peopleIcons = '';
            for (let i = 0; i < count; i++) {
                peopleIcons += personSVG;
            }
            return `
                <div class="year-row">
                    <span class="year-label">${year}</span>
                    <div class="people-icons">${peopleIcons}</div>
                </div>
            `;
        }).join('');
    };

    let histogramHTML = '';

    if (yearCount <= 3) {
        // Single column
        histogramHTML = `<div class="year-column">${generateYearRows(sortedYears)}</div>`;
    } else {
        // Split into two columns - consecutive years in same column
        const midPoint = Math.ceil(yearCount / 2);
        const firstColumnYears = sortedYears.slice(0, midPoint);
        const secondColumnYears = sortedYears.slice(midPoint);

        histogramHTML = `
            <div class="year-column">${generateYearRows(firstColumnYears)}</div>
            <div class="year-column">${generateYearRows(secondColumnYears)}</div>
        `;
    }

    return `
        <div class="internship-history">
            <div class="history-header">
                <span class="history-title">Staj Geçmişi</span>
                <span class="total-interns">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    ${yearlyData.total} stajyer
                </span>
            </div>
            <div class="year-histogram">
                ${histogramHTML}
            </div>
        </div>
    `;
}

function addMapMarker(company) {
    const marker = L.marker([company.lat, company.lng]);

    // Generate popup internship info
    const popupInternshipInfo = generatePopupInternshipInfo(company.yearlyData);

    const popupContent = `
        <div class="marker-popup">
            <strong>${company.company}</strong><br>
            <span class="popup-province">${company.province}</span><br>
            <span class="popup-field">${company.field}</span>
            ${popupInternshipInfo}
            ${company.contact ? `<br><a href="${company.contact}" target="_blank">Web Sitesi</a>` : ''}
        </div>
    `;

    marker.bindPopup(popupContent);
    markerClusterGroup.addLayer(marker);
}

// Generate compact internship info for map popups
function generatePopupInternshipInfo(yearlyData) {
    if (!yearlyData || !yearlyData.years || Object.keys(yearlyData.years).length === 0) {
        return '';
    }

    const sortedYears = Object.keys(yearlyData.years).sort();
    const yearDetails = sortedYears.map(year => `${year}: ${yearlyData.years[year]}`).join(', ');

    return `
        <div class="popup-internship">
            <span class="popup-intern-total">👥 ${yearlyData.total} stajyer</span>
            <span class="popup-intern-years">(${yearDetails})</span>
        </div>
    `;
}

function populateFilters(data) {
    const citySelect = document.getElementById('cityFilter');
    const fieldSelect = document.getElementById('fieldFilter');

    // Get unique cities sorted
    const cities = [...new Set(data.map(d => d.province))].filter(c => c).sort();

    // Get unique fields sorted
    const fields = [...new Set(data.map(d => d.field))].filter(f => f).sort();

    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });

    fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        fieldSelect.appendChild(option);
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const cityFilter = document.getElementById('cityFilter');
    const fieldFilter = document.getElementById('fieldFilter');

    function filterData() {
        const searchTerm = searchInput.value.toLocaleLowerCase('tr-TR');
        const cityValue = cityFilter.value;
        const fieldValue = fieldFilter.value;

        const filtered = allCompanies.filter(item => {
            const companyName = item.company.toLocaleLowerCase('tr-TR');
            const fieldName = item.field.toLocaleLowerCase('tr-TR');
            const provinceName = item.province.toLocaleLowerCase('tr-TR');

            const matchesSearch = companyName.includes(searchTerm) ||
                fieldName.includes(searchTerm) ||
                provinceName.includes(searchTerm);
            const matchesCity = cityValue ? item.province === cityValue : true;
            const matchesField = fieldValue ? item.field === fieldValue : true;

            return matchesSearch && matchesCity && matchesField;
        });

        renderData(filtered);
    }

    searchInput.addEventListener('input', filterData);
    cityFilter.addEventListener('change', filterData);
    fieldFilter.addEventListener('change', filterData);
}

// Global available function for inline onclick
window.focusOnMap = (lat, lng) => {
    // Scroll to map section first
    document.querySelector('.map-container').scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    // Then fly to the location
    setTimeout(() => {
        map.flyTo([lat, lng], 14, {
            animate: true,
            duration: 1.5
        });
    }, 300);
};

// Reset map and filters
function resetMap() {
    // Reset filters
    document.getElementById('searchInput').value = '';
    document.getElementById('cityFilter').value = '';
    document.getElementById('fieldFilter').value = '';

    // Reset data
    renderData(allCompanies);

    // Reset map view to Turkey
    map.flyTo([39.0, 35.0], 6, {
        animate: true,
        duration: 1
    });
}

// Hiring Companies Functions
function renderHiringCompanies(companies) {
    const listContainer = document.getElementById('hiringList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    companies.forEach(company => {
        const card = createHiringCard(company);
        listContainer.appendChild(card);
    });
}

function createHiringCard(company) {
    const div = document.createElement('div');
    div.className = 'company-card';

    const contactLink = company.contact
        ? `<a href="${company.contact}" target="_blank" class="contact-link">Web Sitesi</a>`
        : '<span class="no-contact">Web sitesi yok</span>';

    div.innerHTML = `
        <div class="company-header">
            <div class="company-name">${company.company}</div>
            <span class="badge field-badge">${company.field}</span>
        </div>
        <div class="detail-row location">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${company.province}
        </div>
        <div class="card-footer">
            ${contactLink}
        </div>
    `;
    return div;
}
