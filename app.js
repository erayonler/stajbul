// App State
let allCompanies = [];
let map;
let markerClusterGroup;

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

    // Update Stats
    totalCountEl.textContent = companies.length;
    const uniqueCities = new Set(companies.map(c => c.province));
    const uniqueFields = new Set(companies.map(c => c.field));
    locationsCountEl.textContent = uniqueCities.size;
    fieldsCountEl.textContent = uniqueFields.size;

    // Render Items
    companies.forEach(company => {
        // 1. Add Card to List
        const card = createCompanyCard(company);
        listContainer.appendChild(card);

        // 2. Add Marker to Cluster Group
        addMapMarker(company);
    });

    // Fit map to markers if there are any
    if (companies.length > 0) {
        const bounds = markerClusterGroup.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 });
        }
    }
}

function createCompanyCard(company) {
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
            <a href="#" onclick="focusOnMap(${company.lat}, ${company.lng}); return false;" class="view-btn">Haritada Gör</a>
        </div>
    `;
    return div;
}

function addMapMarker(company) {
    const marker = L.marker([company.lat, company.lng]);

    const popupContent = `
        <div class="marker-popup">
            <strong>${company.company}</strong><br>
            <span class="popup-province">${company.province}</span><br>
            <span class="popup-field">${company.field}</span>
            ${company.contact ? `<br><a href="${company.contact}" target="_blank">Web Sitesi</a>` : ''}
        </div>
    `;

    marker.bindPopup(popupContent);
    markerClusterGroup.addLayer(marker);
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
