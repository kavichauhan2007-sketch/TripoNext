// Translations Dictionary
const translations = {
    en: {
        nav_dashboard: "Dashboard", nav_explore: "Explore", nav_mytrips: "My Trips", nav_community: "Community",
        hero_title: "Plan Your Dream Trip in Seconds",
        hero_subtitle: "One smart platform for maps, weather, places, itineraries, and budget.",
        btn_plan: "Plan It", badge_budget: "On Budget",
        title_map: "Live Interactive Map", title_budget: "Budget Overview",
        label_total: "Total Budget", label_spent: "Estimated Cost",
        budget_desc: "Automatically adjusted to your selected regional currency.",
        title_weather: "Weather Forecast", title_places: "Actual Local Places (Live Data)",
        places_desc: "Fetching real restaurants near your destination from OpenStreetMap."
    },
    es: {
        nav_dashboard: "Tablero", nav_explore: "Explorar", nav_mytrips: "Mis Viajes", nav_community: "Comunidad",
        hero_title: "Planea el viaje de tus sueños en segundos",
        hero_subtitle: "Una plataforma inteligente para mapas, clima, lugares, itinerarios y presupuesto.",
        btn_plan: "Planear", badge_budget: "En Presupuesto",
        title_map: "Mapa Interactivo en Vivo", title_budget: "Resumen de Presupuesto",
        label_total: "Presupuesto Total", label_spent: "Costo Estimado",
        budget_desc: "Ajustado automáticamente a su moneda regional seleccionada.",
        title_weather: "Pronóstico del Clima", title_places: "Lugares Locales Reales (Datos en Vivo)",
        places_desc: "Obteniendo restaurantes reales cerca de su destino desde OpenStreetMap."
    },
    fr: {
        nav_dashboard: "Tableau de Bord", nav_explore: "Explorer", nav_mytrips: "Mes Voyages", nav_community: "Communauté",
        hero_title: "Planifiez le voyage de vos rêves en quelques secondes",
        hero_subtitle: "Une plateforme intelligente pour cartes, météo, lieux, itinéraires et budget.",
        btn_plan: "Planifier", badge_budget: "Dans le Budget",
        title_map: "Carte Interactive en Direct", title_budget: "Aperçu du Budget",
        label_total: "Budget Total", label_spent: "Coût Estimé",
        budget_desc: "Ajusté automatiquement à votre devise régionale sélectionnée.",
        title_weather: "Prévisions Météo", title_places: "Lieux Locaux Réels (Données en Direct)",
        places_desc: "Recherche de vrais restaurants près de votre destination via OpenStreetMap."
    }
};

let map = null;
let currentBudget = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
    }

    if (document.getElementById('dates-input')) {
        flatpickr("#dates-input", {
            mode: "range",
            dateFormat: "Y-m-d",
            minDate: "today",
            theme: "dark",
            onChange: function(selectedDates, dateStr, instance) {
                if (selectedDates.length === 2) {
                    const diffTime = Math.abs(selectedDates[1] - selectedDates[0]);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // Store globally for AI planner
                    window._selectedNumDays = diffDays;
                    if(document.getElementById('calc-days')) {
                        document.getElementById('calc-days').value = diffDays;
                    }
                    // Update visible label
                    const el = document.getElementById('dates-input');
                    if(el) el.setAttribute('data-days', diffDays + ' days');
                    // Show days badge near input
                    let badge = document.getElementById('days-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.id = 'days-badge';
                        badge.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:var(--primary);color:white;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;pointer-events:none;';
                        el.parentElement.style.position = 'relative';
                        el.parentElement.appendChild(badge);
                    }
                    badge.textContent = diffDays + ' days';
                }
            }
        });
    }

    // Set user name & inject notification bell
    const user = JSON.parse(localStorage.getItem('user'));
    if(user) {
        const logo = document.querySelector('.logo');
        if(logo) logo.innerHTML = `<i class="fa-solid fa-plane-departure"></i> TripoNext`;
        const profile = document.querySelector('.user-profile');
        if(profile) {
            profile.innerHTML = `
                <div class="notif-wrapper" style="margin-right: 14px;">
                    <button class="notif-bell-btn" onclick="toggleNotifications(event)" title="Notifications">
                        <i class="fa-solid fa-bell"></i>
                        <span class="notif-badge" id="notif-count">3</span>
                    </button>
                    <div class="notif-dropdown" id="notif-dropdown">
                        <div class="notif-header">
                            <h4><i class="fa-solid fa-bell" style="color:var(--primary)"></i> Notifications</h4>
                            <button onclick="markAllNotificationsRead()" style="background:none; border:none; color:var(--primary); font-size:0.75rem; cursor:pointer;">Mark all read</button>
                        </div>
                        <div class="notif-list" id="notif-list"></div>
                    </div>
                </div>
                <span style="margin-right:10px; font-weight:bold;">${user.name}</span>
                <a href="#" onclick="logout()" style="color:var(--danger); text-decoration:none;"><i class="fa-solid fa-right-from-bracket"></i></a>
            `;
            setTimeout(loadNotifications, 100);
        }
    }

    // Initialize global utilities
    injectFloatingToolbox();
    setupOfflineDetection();

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(15, 23, 42, 0.95)';
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        } else {
            navbar.style.background = 'rgba(15, 23, 42, 0.8)';
            navbar.style.boxShadow = 'none';
        }
    });

    // Auto-fill from URL parameters (e.g., coming from Explore page)
    const urlParams = new URLSearchParams(window.location.search);
    const prefillDest = urlParams.get('dest');
    if(prefillDest && document.getElementById('destination-input')) {
        document.getElementById('destination-input').value = prefillDest;
        // Optionally auto-plan
        setTimeout(() => planTrip(), 500);
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function changeLanguage() {
    const lang = document.getElementById('lang-selector').value;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
}

function updateCurrency() {
    if (currentBudget > 0) {
        const currencySelect = document.getElementById('budget-currency');
        const selectedCurrency = currencySelect ? currencySelect.value : 'INR';
        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: selectedCurrency });
        
        // The budget entered is assumed to be in the SELECTED currency.
        // We do not need to multiply it by exchange rates for the main display!
        const dispTotal = document.getElementById('total-budget-disp');
        const dispSpent = document.getElementById('spent-budget-disp');
        
        if (dispTotal) dispTotal.innerText = formatter.format(currentBudget);
        if (dispSpent) dispSpent.innerText = formatter.format(currentBudget * 0.6); // mock spent
        
        if(document.getElementById('currency-input')) {
            // Update the live converter input to match the current budget
            // If the selected currency is not INR, we should convert it to INR to act as the base for the live converter?
            // Actually, the live converter assumes the input is INR.
            // Let's convert the currentBudget to INR for the converter.
            let inrValue = currentBudget;
            if (window.exchangeRates && selectedCurrency !== 'INR' && window.exchangeRates[selectedCurrency]) {
                inrValue = currentBudget / window.exchangeRates[selectedCurrency];
            }
            document.getElementById('currency-input').value = Math.round(inrValue);
            updateCurrencyValues();
        }
    }
}

async function planTrip() {
    const dest = document.getElementById('destination-input').value;
    const dates = document.getElementById('dates-input').value;
    let budgetRaw = document.getElementById('budget-input').value;
    const travelers = parseInt(document.getElementById('people-input').value) || 1;
    const currencySelect = document.getElementById('budget-currency');
    const selectedCurrency = currencySelect ? currencySelect.value : 'INR';
    
    // Auto-calculate budget if 0 or empty, based on the selected currency!
    if (!budgetRaw || parseFloat(budgetRaw) === 0) {
        let baseRandom = Math.floor(Math.random() * 20) + 10; // 10 to 30
        if (selectedCurrency === 'INR') {
            budgetRaw = baseRandom * 1000; // 10k to 30k INR
        } else if (selectedCurrency === 'USD' || selectedCurrency === 'EUR' || selectedCurrency === 'GBP') {
            budgetRaw = baseRandom * 100; // 1000 to 3000 USD/EUR/GBP
        } else {
            budgetRaw = baseRandom * 1000;
        }
        if (document.getElementById('budget-input')) {
            document.getElementById('budget-input').value = budgetRaw;
        }
    }
    
    currentBudget = (parseFloat(budgetRaw) || 0) * travelers;
    
    if(!dest) {
        alert("Please enter a destination to start planning!");
        return;
    }

    const btn = document.querySelector('.search-btn');
    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Planning...';
    btn.style.opacity = '0.8';
    
    // Show Dashboard
    const dashboard = document.getElementById('dashboard');
    dashboard.style.display = 'block';
    
    // Update Title
    document.getElementById('trip-title').innerText = `Trip to ${dest.charAt(0).toUpperCase() + dest.slice(1)}`;
    updateCurrency();
    
    // Smooth scroll
    window.scrollTo({ top: window.innerHeight - 80, behavior: 'smooth' });

    try {
        // 1. Geocode Destination using Nominatim (OpenStreetMap)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dest)}&format=json&limit=1`);
        const geoData = await geoRes.json();
        
        let lat = 48.8566; // default Paris
        let lon = 2.3522;
        
        if(geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
        }

        // 2. Initialize or Update Map
        if (!map) {
            map = L.map('real-map').setView([lat, lon], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);
        } else {
            map.setView([lat, lon], 13);
        }
        L.marker([lat, lon]).addTo(map)
            .bindPopup(`<b>${dest}</b><br>Destination Center.`).openPopup();
            
        // Calculate Distance from User
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                
                // Haversine formula
                const R = 6371; // Radius of the earth in km
                const dLat = (lat - userLat) * (Math.PI/180);
                const dLon = (lon - userLon) * (Math.PI/180);
                const a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(userLat * (Math.PI/180)) * Math.cos(lat * (Math.PI/180)) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2); 
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
                const distance = Math.round(R * c);
                
                document.getElementById('distance-badge').style.display = 'inline-block';
                document.getElementById('trip-distance').innerText = `${distance} km away`;
                
                // Draw line from user to dest
                const latlngs = [
                    [userLat, userLon],
                    [lat, lon]
                ];
                L.polyline(latlngs, {color: 'var(--accent)', weight: 3, dashArray: '5, 10'}).addTo(map);
                L.circleMarker([userLat, userLon], {color: 'var(--accent)', radius: 6}).addTo(map).bindPopup('Your Location');
                map.fitBounds(L.polyline(latlngs).getBounds(), {padding: [50, 50]});
            }, (err) => {
                console.log("Geolocation error:", err);
            });
        }
            
        // Fix Leaflet map sizing issue
        setTimeout(() => map.invalidateSize(), 300);

        // 2a. Fetch Real Weather
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        if(weatherData && weatherData.current_weather) {
            document.getElementById('real-weather-temp').innerText = `${weatherData.current_weather.temperature}°C`;
            const wc = weatherData.current_weather.weathercode;
            let cond = "Clear";
            let icon = "☀️";
            if (wc > 0 && wc <= 3) { cond = "Partly Cloudy"; icon = "⛅"; }
            if (wc >= 45 && wc <= 48) { cond = "Foggy"; icon = "🌫️"; }
            if (wc >= 51 && wc <= 67) { cond = "Rainy"; icon = "🌧️"; }
            if (wc >= 71 && wc <= 77) { cond = "Snowy"; icon = "❄️"; }
            if (wc >= 95) { cond = "Thunderstorm"; icon = "⛈️"; }
            document.getElementById('real-weather-cond').innerText = cond;
            if(document.getElementById('weather-anim-icon')) {
                document.getElementById('weather-anim-icon').innerText = icon;
                // Add a small animation toggle class
                document.getElementById('weather-anim-icon').style.animation = "float 3s ease-in-out infinite";
            }
            
            // Set Local Time using timezone from Open-Meteo
            if(weatherData.timezone && document.getElementById('dest-local-time')) {
                const timeStr = new Intl.DateTimeFormat('en-US', {
                    timeZone: weatherData.timezone,
                    hour: '2-digit', minute: '2-digit', hour12: true
                }).format(new Date());
                document.getElementById('dest-local-time').innerText = timeStr;
            }
        }

        // 2b. Destination Photo - Wikipedia real photo + full card clickable + forcefully clean up old DOM
        try {
            const imgEl = document.getElementById('real-dest-img');
            if (imgEl) {
                // Force remove LIVE badge if it is still cached in the user's DOM
                const destCard = document.getElementById('dest-photo-card');
                if (destCard) {
                    const spans = destCard.querySelectorAll('span');
                    spans.forEach(span => {
                        if (span.parentElement && span.parentElement.textContent.includes('LIVE')) {
                            span.parentElement.remove();
                        }
                    });
                }

                // Fetch high-quality image from Wikipedia instead of deprecated Unsplash
                const wikiThumbRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(dest)}`);
                if(wikiThumbRes.ok) {
                    const wikiData = await wikiThumbRes.json();
                    if(wikiData.originalimage && wikiData.originalimage.source) {
                        imgEl.src = wikiData.originalimage.source;
                    } else if(wikiData.thumbnail && wikiData.thumbnail.source) {
                        imgEl.src = wikiData.thumbnail.source;
                    } else {
                        imgEl.src = 'https://picsum.photos/seed/' + encodeURIComponent(dest) + '/800/400';
                    }
                } else {
                    imgEl.src = 'https://picsum.photos/seed/' + encodeURIComponent(dest) + '/800/400';
                }

                // Update label and data attribute for the quick buttons
                const lblEl = document.getElementById('dest-photo-label');
                if (lblEl) {
                    lblEl.textContent = '📍 ' + dest;
                    lblEl.setAttribute('data-dest', dest);
                }
            }
        } catch(e) {
            const imgEl = document.getElementById('real-dest-img');
            if (imgEl) imgEl.src = 'https://picsum.photos/seed/' + encodeURIComponent(dest) + '/800/400';
        }

        // 3. Fetch Real Restaurants using Overpass API (OSM)
        const overpassQuery = `
            [out:json];
            nwr(around:15000, ${lat}, ${lon})[amenity=restaurant];
            out 4;
        `;
        let overpassData = { elements: [] };
        try {
            const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: overpassQuery
            });
            overpassData = await overpassRes.json();
        } catch(e) {}
        
        const placesContainer = document.getElementById('real-places-container');
        placesContainer.innerHTML = ''; // clear spinner
        
        if(!overpassData.elements || overpassData.elements.length === 0) {
            // Fallback premium data if API fails or is empty
            overpassData.elements = [
                { tags: { name: "Premium Local Dining", cuisine: "Authentic" } },
                { tags: { name: "City Center Cafe", cuisine: "Coffee & Snacks" } },
                { tags: { name: "Sunset Grill & Bar", cuisine: "Grill" } }
            ];
        }

        let html = "";
        for (let el of overpassData.elements) {
            const name = el.tags.name || "Local Restaurant";
            const cuisine = el.tags.cuisine || "Local Cuisine";
            
            let img = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"; // Premium default if no real image
            try {
                // Use robust wiki search
                const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name + ' ' + dest)}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=400&origin=*`);
                const wikiData = await wikiRes.json();
                if (wikiData.query && wikiData.query.pages) {
                    const pages = wikiData.query.pages;
                    const firstPageId = Object.keys(pages)[0];
                    if (pages[firstPageId].thumbnail) {
                        img = pages[firstPageId].thumbnail.source;
                    }
                }
            } catch(e) {}
            
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + dest)}`;
            
            html += `
                <div class="rec-item" onclick="window.open('${googleSearchUrl}', '_blank')" title="Search on Google">
                    <img src="${img}" alt="${name}">
                    <div class="rec-info">
                        <h4>${name}</h4>
                        <span><i class="fa-solid fa-utensils"></i> ${cuisine}</span>
                    </div>
                </div>
            `;
        }
        placesContainer.innerHTML = html;
        // else block removed intentionally since it is handled by fallback

        // Save to Database / Local Storage
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/trips', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ destination: dest, dates: dates, budget: currentBudget })
            });
            if(!res.ok) throw new Error("API failed");
        } catch(e) {
            console.warn("Backend unavailable, saving to local storage fallback", e);
            let localTrips = JSON.parse(localStorage.getItem('localTrips') || '[]');
            localTrips.push({
                id: Date.now(),
                destination: dest,
                dates: dates,
                budget: currentBudget
            });
            localStorage.setItem('localTrips', JSON.stringify(localTrips));
        }

    } catch(e) {
        console.error("Error fetching live data", e);
    }

    // Reset button
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Planned!';
    btn.style.background = 'var(--success)';
    btn.style.opacity = '1';
    
    setTimeout(() => {
        btn.innerHTML = originalBtnHTML;
        btn.style.background = 'linear-gradient(135deg, var(--primary), var(--accent))';
    }, 2000);
}

// --- Budget Calculator Modal Logic ---

function openBudgetCalculator() {
    const mainDest = document.getElementById('destination-input').value;
    if(mainDest) document.getElementById('calc-dest').value = mainDest;
    document.getElementById('budget-modal').style.display = 'flex';
}

function closeBudgetCalculator() {
    document.getElementById('budget-modal').style.display = 'none';
}

// Haversine formula to calculate distance between two lat/lon points in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
}

async function fetchUserLocation() {
    if (navigator.geolocation) {
        const btn = document.querySelector('button[onclick="fetchUserLocation()"]');
        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await res.json();
                if(data && data.address) {
                    const city = data.address.city || data.address.town || data.address.village || data.address.state || "My Location";
                    document.getElementById('calc-origin').value = city;
                }
            } catch(e) {
                document.getElementById('calc-origin').value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
            }
            btn.innerHTML = origText;
        }, (error) => {
            alert("Could not get your location. Please type it manually.");
            btn.innerHTML = origText;
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

async function calculateAndSetBudget() {
    const origin = document.getElementById('calc-origin').value;
    const dest = document.getElementById('calc-dest').value;
    const days = parseInt(document.getElementById('calc-days').value) || 1;
    const transportMode = document.getElementById('calc-transport').value;
    const hotel = parseFloat(document.getElementById('calc-hotel').value) || 0;
    const food = parseFloat(document.getElementById('calc-food').value) || 0;

    if(!origin || !dest) {
        alert("Please enter both Origin and Destination to calculate travel costs!");
        return;
    }

    const btn = document.querySelector('#budget-modal .btn-primary');
    const originalBtn = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculating Distance...';
    btn.disabled = true;

    try {
        // 1. Get Origin Coordinates
        const res1 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origin)}&format=json&limit=1`);
        const data1 = await res1.json();
        
        // 2. Get Destination Coordinates
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dest)}&format=json&limit=1`);
        const data2 = await res2.json();

        let transportCost = 0;

        if(data1.length > 0 && data2.length > 0) {
            const lat1 = parseFloat(data1[0].lat);
            const lon1 = parseFloat(data1[0].lon);
            const lat2 = parseFloat(data2[0].lat);
            const lon2 = parseFloat(data2[0].lon);
            
            const distanceKm = getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2);
            document.getElementById('dist-display').innerText = `Actual Distance: ${distanceKm.toFixed(1)} km`;

            // Cost calculation logic based on distance (Values in INR)
            if(transportMode === 'flight') transportCost = 4000 + (distanceKm * 10); // Base ₹4000 + ₹10/km
            else if(transportMode === 'train') transportCost = 1000 + (distanceKm * 4); // Base ₹1000 + ₹4/km
            else if(transportMode === 'bus') transportCost = 500 + (distanceKm * 2); // Base ₹500 + ₹2/km
        } else {
            alert("Could not find one of the locations on the map. Using a default travel cost.");
            transportCost = 5000; // fallback in INR
        }

        // Base cost is in INR natively
        const estimatedTotalPerPerson = Math.round(transportCost + ((hotel + food) * days));

        // Set the value back to the main search bar
        document.getElementById('budget-input').value = estimatedTotalPerPerson;
        document.getElementById('destination-input').value = dest; // auto fill dest too
        
        closeBudgetCalculator();

    } catch (e) {
        alert("Error calculating distance. Please try again.");
    } finally {
        btn.innerHTML = originalBtn;
        btn.disabled = false;
    }
}

// Global UI Additions (Settings Modal & Welcome Toast)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Settings Button in Navbar
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'btn-small';
        settingsBtn.style.background = 'transparent';
        settingsBtn.style.border = '1px solid var(--primary)';
        settingsBtn.style.color = 'var(--text-main)';
        settingsBtn.style.marginRight = '10px';
        settingsBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
        settingsBtn.onclick = openGlobalSettings;
        navLinks.insertBefore(settingsBtn, navLinks.lastElementChild);
        
        // Restore theme
        if(localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
        }
    }

    // 2. Inject Settings Modal
    const settingsHTML = `
    <div id="global-settings-modal" class="modal-overlay" style="display:none; z-index:9999;">
        <div class="modal-content glassmorphism">
            <h3><i class="fa-solid fa-gear"></i> App Settings</h3>
            
            <div style="margin-top: 1.5rem;">
                <label>Theme Display</label>
                <select id="settings-theme" class="glass-select" style="width:100%; border: 1px solid var(--glass-border); color: var(--text-main); background: var(--glass-bg);">
                    <option value="dark">Dark Mode</option>
                    <option value="light">Light Mode</option>
                </select>
            </div>
            
            <div style="margin-top: 1.5rem;">
                <label>Pop-up Notifications</label>
                <select id="settings-toasts" class="glass-select" style="width:100%; border: 1px solid var(--glass-border); color: var(--text-main); background: var(--glass-bg);">
                    <option value="on">Enabled</option>
                    <option value="off">Disabled</option>
                </select>
            </div>

            <div style="margin-top: 1.5rem;">
                <label>Crazy Mode (Confetti)</label>
                <select id="settings-crazy" class="glass-select" style="width:100%; border: 1px solid var(--glass-border); color: var(--text-main); background: var(--glass-bg);">
                    <option value="off">Off</option>
                    <option value="on">On</option>
                </select>
            </div>

            <div class="modal-btns">
                <button class="btn-small" style="background:var(--text-muted); color:#fff;" onclick="closeGlobalSettings()">Cancel</button>
                <button class="btn-small btn-primary" onclick="saveGlobalSettings()">Save Changes</button>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', settingsHTML);

    // 3. Welcome Toast
    if (localStorage.getItem('toasts') !== 'off') {
        const toast = document.createElement('div');
        toast.className = 'toast-popup';
        toast.id = 'welcome-toast';
        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid fa-plane-departure"></i></div>
            <div class="toast-content">
                <h4>Welcome Aboard!</h4>
                <p>Ready to plan your next crazy adventure?</p>
            </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 5000);
        }, 1500);
    }

    // 4. "Surprise Me!" Magic Button in Navbar
    if (navLinks) {
        const surpriseBtn = document.createElement('button');
        surpriseBtn.className = 'btn-small';
        surpriseBtn.style.background = 'linear-gradient(45deg, var(--accent), var(--primary))';
        surpriseBtn.style.border = 'none';
        surpriseBtn.style.color = '#fff';
        surpriseBtn.style.fontWeight = 'bold';
        surpriseBtn.style.marginRight = '15px';
        surpriseBtn.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.5)';
        surpriseBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Surprise Me!';
        surpriseBtn.onclick = triggerSurpriseTrip;
        
        navLinks.appendChild(surpriseBtn);
    }

    // 5. Magic Glowing Cursor
    const cursorDot = document.createElement('div');
    cursorDot.style.position = 'fixed';
    cursorDot.style.width = '20px';
    cursorDot.style.height = '20px';
    cursorDot.style.borderRadius = '50%';
    cursorDot.style.background = 'radial-gradient(circle, rgba(59,130,246,0.8) 0%, transparent 70%)';
    cursorDot.style.boxShadow = '0 0 15px rgba(59,130,246,0.5)';
    cursorDot.style.pointerEvents = 'none';
    cursorDot.style.zIndex = '99999';
    cursorDot.style.transform = 'translate(-50%, -50%)';
    cursorDot.style.transition = 'top 0.05s ease-out, left 0.05s ease-out';
    document.body.appendChild(cursorDot);

    document.addEventListener('mousemove', (e) => {
        cursorDot.style.left = e.clientX + 'px';
        cursorDot.style.top = e.clientY + 'px';
    });

    // Removed 3D Hover Tilt

    // Packing List Logic
    window.addPackingItem = function() {
        const input = document.getElementById('new-pack-item');
        const val = input.value.trim();
        if(!val) return;
        
        const list = document.getElementById('packing-list');
        const id = 'pack' + (list.children.length + 1);
        const li = document.createElement('li');
        li.className = 'packing-item';
        li.style.marginBottom = '0.5rem';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '0.5rem';
        
        li.innerHTML = `<input type="checkbox" id="${id}" style="accent-color: var(--primary); transform: scale(1.2);"> <label for="${id}" style="cursor: pointer;">${val}</label>`;
        list.appendChild(li);
        input.value = '';
    };

    // Live Currency Converter Logic
    window.exchangeRates = null;
    async function initCurrencyConverter() {
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
            const data = await res.json();
            window.exchangeRates = data.rates;
            window.updateCurrency();
        } catch(e) {
            console.error("Failed to fetch exchange rates", e);
        }
    }
    
    window.updateCurrencyValues = function() {
        if(!window.exchangeRates) return;
        const inputEl = document.getElementById('currency-input');
        if(!inputEl) return;
        const val = parseFloat(inputEl.value) || 0;
        
        const usd = (val * window.exchangeRates.USD).toFixed(2);
        const eur = (val * window.exchangeRates.EUR).toFixed(2);
        const gbp = (val * window.exchangeRates.GBP).toFixed(2);
        const aed = (val * window.exchangeRates.AED).toFixed(2);
        
        if(document.getElementById('conv-usd')) document.getElementById('conv-usd').innerText = usd;
        if(document.getElementById('conv-eur')) document.getElementById('conv-eur').innerText = eur;
        if(document.getElementById('conv-gbp')) document.getElementById('conv-gbp').innerText = gbp;
        if(document.getElementById('conv-aed')) document.getElementById('conv-aed').innerText = aed;
    };
    
    // Initialize on load
    initCurrencyConverter();

    // AI Itinerary Generator Logic
    window.generateAIItinerary = async function() {
    const destInput = document.getElementById('destination-input');
    const destination = (destInput && destInput.value.trim() !== "") ? destInput.value : "Your Destination";
    
    let budgetRaw = document.getElementById('budget-input') ? document.getElementById('budget-input').value : 0;
    const travelers = document.getElementById('people-input') ? (parseInt(document.getElementById('people-input').value) || 1) : 1;
    const currencySelect = document.getElementById('budget-currency');
    const selectedCurrency = currencySelect ? currencySelect.value : 'INR';
    
    if (!budgetRaw || parseFloat(budgetRaw) === 0) {
        let baseRandom = Math.floor(Math.random() * 20) + 10;
        if (selectedCurrency === 'INR') budgetRaw = baseRandom * 1000;
        else if (['USD', 'EUR', 'GBP'].includes(selectedCurrency)) budgetRaw = baseRandom * 100;
        else budgetRaw = baseRandom * 1000;
    }
    currentBudget = (parseFloat(budgetRaw) || 0) * travelers;
    
    const btn = document.getElementById('generate-ai-btn');
    const loading = document.getElementById('ai-loading');
    const result = document.getElementById('ai-result');
    const progress = document.getElementById('ai-progress-bar');
    const status = document.getElementById('ai-status-text');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Planning...';
    result.style.display = 'none';
    loading.style.display = 'block';
    
    let weatherData = null;
    let wikiSummary = "Enjoy exploring this wonderful place and all its culture!";
    
    let defaultImages = [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1504150558240-1bdf2a0ce11b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    ];
    
    const themeImages = [
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1504150558240-1bdf2a0ce11b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1514933651103-005eec06c04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    ];

    let famousAttractions = [
        { name: `${destination} Downtown Walk`, img: themeImages[0] },
        { name: `${destination} Historical Museum`, img: themeImages[1] },
        { name: `${destination} City Square`, img: themeImages[2] },
        { name: `${destination} Viewpoint`, img: themeImages[3] },
        { name: `${destination} Cultural Center`, img: themeImages[4] },
        { name: `${destination} Art Gallery`, img: themeImages[5] },
        { name: `${destination} Central Park`, img: themeImages[6] },
        { name: `${destination} Heritage Site`, img: themeImages[7] },
        { name: `${destination} Waterfront`, img: themeImages[8] },
        { name: `${destination} Botanical Garden`, img: themeImages[9] }
    ];
    let famousRestaurants = [
        { name: `Authentic ${destination} Dining`, img: themeImages[5] },
        { name: `Famous Local Cafe`, img: themeImages[6] },
        { name: `${destination} Street Food Hub`, img: themeImages[7] },
        { name: `Classic Bistro`, img: themeImages[8] },
        { name: `Sunset View Restaurant`, img: themeImages[9] },
        { name: `Gourmet Kitchen`, img: themeImages[0] },
        { name: `${destination} Seafood Bar`, img: themeImages[1] },
        { name: `Hidden Gem Eatery`, img: themeImages[2] },
        { name: `Rooftop Lounge`, img: themeImages[3] },
        { name: `Traditional Feast`, img: themeImages[4] }
    ];
    
    progress.style.width = '30%';
    status.innerText = "Analyzing destination geography...";
    
    try {
        if (destination !== "Your Destination") {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`);
            const geoData = await geoRes.json();
            
            if (geoData && geoData.length > 0) {
                const lat = geoData[0].lat;
                const lon = geoData[0].lon;
                
                const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const wxData = await wxRes.json();
                if(wxData.current_weather) {
                    weatherData = wxData.current_weather;
                }
                
                progress.style.width = '50%';
                status.innerText = "Finding famous locations and restaurants...";
                
                // Fetch wikipedia summary
                const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exchars=200&titles=${encodeURIComponent(destination)}&format=json&origin=*`);
                const wikiData = await wikiRes.json();
                const pages = wikiData.query.pages;
                const pageId = Object.keys(pages)[0];
                if (pageId != -1 && pages[pageId].extract) {
                    wikiSummary = pages[pageId].extract;
                    if(wikiSummary.length > 150) wikiSummary = wikiSummary.substring(0, 150) + "...";
                }

                // Fetch real places via Overpass
                const overpassQuery = `
                    [out:json];
                    (
                      node(around:15000, ${lat}, ${lon})[tourism=attraction];
                      node(around:15000, ${lat}, ${lon})[amenity=restaurant];
                    );
                    out 20;
                `;
                const overpassRes = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: overpassQuery });
                const overpassData = await overpassRes.json();
                
                if (overpassData.elements && overpassData.elements.length > 0) {
                    let attrNames = [...new Set(overpassData.elements.filter(e => e.tags.tourism === 'attraction' && e.tags.name).map(e => e.tags.name))].slice(0, 8);
                    let restNames = [...new Set(overpassData.elements.filter(e => e.tags.amenity === 'restaurant' && e.tags.name).map(e => e.tags.name))].slice(0, 8);
                    
                    progress.style.width = '70%';
                    status.innerText = "Gathering beautiful photos for the itinerary...";
                    
                    // Concurrent fetch for photos
                    async function fetchPhoto(name, isRest) {
                        try {
                            const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name + ' ' + destination)}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json&origin=*`);
                            const data = await res.json();
                            let img = defaultImages[Math.floor(Math.random() * defaultImages.length)];
                            if (data.query && data.query.pages) {
                                const pid = Object.keys(data.query.pages)[0];
                                if (data.query.pages[pid].thumbnail) img = data.query.pages[pid].thumbnail.source;
                            }
                            return { name: name, img: img, isRest: isRest };
                        } catch(e) {
                            return { name: name, img: defaultImages[Math.floor(Math.random() * defaultImages.length)], isRest: isRest };
                        }
                    }
                    
                    let promises = [];
                    attrNames.forEach(n => promises.push(fetchPhoto(n, false)));
                    restNames.forEach(n => promises.push(fetchPhoto(n, true)));
                    
                    const results = await Promise.all(promises);
                    let fetchedAttr = results.filter(r => !r.isRest);
                    let fetchedRest = results.filter(r => r.isRest);
                    
                    if(fetchedAttr.length > 0) famousAttractions = fetchedAttr;
                    if(fetchedRest.length > 0) famousRestaurants = fetchedRest;
                }
            }
        }
    } catch (err) {
        console.warn("Failed to fetch real data", err);
    }
    
    progress.style.width = '90%';
    
    let datesInput = document.getElementById('dates-input') ? document.getElementById('dates-input').value.trim() : "";
    // Calculate numDays from flatpickr date range or calc-days
    let numDays = 3;
    try {
        if (window._selectedNumDays && window._selectedNumDays >= 1) {
            numDays = window._selectedNumDays;
        } else {
            const datesVal = document.getElementById('dates-input') ? document.getElementById('dates-input').value : '';
            if (datesVal && datesVal.includes(' to ')) {
                const parts = datesVal.split(' to ');
                const start = new Date(parts[0].trim());
                const end = new Date(parts[1].trim());
                const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
                if (!isNaN(diff) && diff >= 1) numDays = diff;
            } else {
                const cd = parseInt(document.getElementById('calc-days') ? document.getElementById('calc-days').value : 3);
                if (!isNaN(cd) && cd >= 1) numDays = cd;
            }
        }
    } catch(ex) { numDays = 3; }
    if (numDays > 30) numDays = 30;
    if (numDays < 1) numDays = 1;

    status.innerText = `Putting together your perfect ${numDays}-day trip!`;
    await new Promise(r => setTimeout(r, 800)); // smooth visual transition
    
    progress.style.width = '100%';
    
    loading.style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Plan';
    
    let weatherHTML = "";
    if (weatherData) {
        weatherHTML = `<div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem;">
            <i class="fa-solid fa-cloud-sun fa-2x" style="color: #facc15;"></i>
            <div>
                <h5 style="margin: 0; color: #f8fafc;">Current Weather in ${destination}</h5>
                <p style="margin: 0; font-size: 1.2rem; font-weight: bold; color: var(--primary);">${weatherData.temperature}°C, Wind: ${weatherData.windspeed} km/h</p>
            </div>
        </div>`;
    }
    
    // Transport recommendation
    let distanceText = document.getElementById('trip-distance') ? document.getElementById('trip-distance').innerText : "";
    let distanceNum = parseInt(distanceText);
    let transportRec = "";
    if (!isNaN(distanceNum)) {
        if (distanceNum < 200) transportRec = "🚗 Recommended: Cab/Car (Short Distance)";
        else if (distanceNum < 800) transportRec = "🚆 Recommended: Train/Bus (Medium Distance)";
        else transportRec = "✈️ Recommended: Flight (Long Distance)";
    }
    
    let recBadge = transportRec ? `<div style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; display: inline-block; margin-bottom: 1rem; font-weight: bold;">${transportRec}</div>` : '';
    
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: selectedCurrency });
    const displayBudget = formatter.format(currentBudget);
    
    const flightLink = `https://www.google.com/travel/flights?q=flights+to+${encodeURIComponent(destination)}`;
    const hotelLink = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`;
    const cabLink = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(destination)}`;
    const busLink = `https://www.redbus.in/bus-tickets/${encodeURIComponent(destination)}`; // For buses
    
    let itineraryHTML = '';
    for (let d = 1; d <= numDays; d++) {
        let attr1 = famousAttractions[(d * 2 - 2) % famousAttractions.length];
        let rest1 = famousRestaurants[(d - 1) % famousRestaurants.length];
        
        let place1Name = attr1.name;
        let place1Img = attr1.img;
        let place2Name = rest1.name;
        let place2Img = rest1.img;
        
        const themes = [
            "Explore & Taste", "Culture & Heritage", "Hidden Gems", 
            "Nature & Relaxation", "Local Markets & Vibe", "Adventure & Fun",
            "Art & Inspiration", "Iconic Landmarks", "Street Food Journey"
        ];
        let dayTheme = themes[(d - 2 + themes.length) % themes.length];
        let icon = "fa-mountain";
        let color = "var(--primary)";
        if (d === 1) { dayTheme = "Arrival & First Glances"; icon = "fa-sun"; color = "var(--primary)"; }
        else if (d === numDays && numDays > 1) { dayTheme = "Farewell & Souvenirs"; icon = "fa-plane-departure"; color = "var(--success)"; }
        else if (d % 2 === 0) { icon = "fa-camera-retro"; }
        else { icon = "fa-map-location-dot"; }

        itineraryHTML += `
        <div style="border-left: 2px solid ${color}; padding-left: 1rem; margin-bottom: 2rem;">
            <h4 style="color: ${color}; margin-bottom: 0.8rem; font-size: 1.2rem;"><i class="fa-solid ${icon}"></i> Day ${d}: ${dayTheme}</h4>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <!-- Attraction -->
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place1Name + ' ' + destination)}" target="_blank" style="text-decoration: none; color: inherit; display: block; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="height: 120px; background: url('${place1Img}') center/cover;"></div>
                    <div style="padding: 0.8rem;">
                        <p style="font-size: 0.8rem; color: var(--primary); margin: 0 0 0.3rem 0; font-weight: bold;">Sightseeing</p>
                        <h5 style="margin: 0; font-size: 1rem; color: white;">${place1Name} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.8rem; opacity: 0.7;"></i></h5>
                    </div>
                </a>
                
                <!-- Restaurant -->
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place2Name + ' ' + destination)}" target="_blank" style="text-decoration: none; color: inherit; display: block; background: rgba(255,255,255,0.05); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="height: 120px; background: url('${place2Img}') center/cover;"></div>
                    <div style="padding: 0.8rem;">
                        <p style="font-size: 0.8rem; color: var(--accent); margin: 0 0 0.3rem 0; font-weight: bold;">Food & Dining</p>
                        <h5 style="margin: 0; font-size: 1rem; color: white;">${place2Name} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.8rem; opacity: 0.7;"></i></h5>
                    </div>
                </a>
            </div>
        </div>`;
    }


    let packingHTML = '';
    if (typeof weather !== 'undefined' && weather.temp !== undefined) {
        let items = ['Power Bank & Charger', 'Travel Documents / ID', 'Basic First-Aid Kit', 'Comfortable Walking Shoes'];
        if (weather.temp > 25) {
            items.push('Sunscreen & Sunglasses', 'Light Breathable Clothes', 'Swimwear (just in case)');
        } else if (weather.temp < 15) {
            items.push('Heavy Jacket / Coat', 'Thermals & Warm Socks', 'Beanie & Gloves');
        } else {
            items.push('Light Jacket / Cardigan', 'Comfortable Layers');
        }
        if (weather.condition && weather.condition.toLowerCase().includes('rain')) {
            items.push('Umbrella / Raincoat', 'Waterproof Bag');
        }
        
        let listHTML = items.map(item => `<li><label><input type="checkbox" style="margin-right:8px; transform: scale(1.2);"> ${item}</label></li>`).join('');
        
        packingHTML = `
            <div style="margin-top: 2rem; background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                <h4 style="color: var(--accent); margin-bottom: 1rem;"><i class="fa-solid fa-suitcase"></i> Smart AI Packing List</h4>
                <ul style="list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.95rem; color: #cbd5e1;">
                    ${listHTML}
                </ul>
            </div>
        `;
    }

    result.innerHTML = `
        ${weatherHTML}
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <p style="font-size: 0.9rem; font-style: italic; color: #94a3b8;">"${wikiSummary}"</p>
            <div style="margin-top: 1rem; color: var(--primary); font-weight: bold; font-size: 1.1rem;">
                <i class="fa-solid fa-wallet"></i> Total Trip Budget: ${displayBudget} <span style="font-size: 0.9rem; color: #cbd5e1; font-weight: normal;">(for ${travelers} traveler${travelers>1?'s':''})</span>
            </div>
        </div>

        ${recBadge}
        <!-- Booking Section -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
            <a href="${flightLink}" target="_blank" class="btn-small" style="background: rgba(255,255,255,0.1); color: white; text-decoration: none; border-radius: 8px; padding: 0.8rem 1rem; flex: 1; text-align: center; border: 1px solid rgba(255,255,255,0.2);"><i class="fa-solid fa-plane" style="color:var(--primary);"></i> Flight</a>
            <a href="${hotelLink}" target="_blank" class="btn-small" style="background: rgba(255,255,255,0.1); color: white; text-decoration: none; border-radius: 8px; padding: 0.8rem 1rem; flex: 1; text-align: center; border: 1px solid rgba(255,255,255,0.2);"><i class="fa-solid fa-hotel" style="color:var(--accent);"></i> Hotel</a>
            <a href="${cabLink}" target="_blank" class="btn-small" style="background: rgba(255,255,255,0.1); color: white; text-decoration: none; border-radius: 8px; padding: 0.8rem 1rem; flex: 1; text-align: center; border: 1px solid rgba(255,255,255,0.2);"><i class="fa-solid fa-taxi" style="color:#facc15;"></i> Cab</a>
            <a href="${busLink}" target="_blank" class="btn-small" style="background: rgba(255,255,255,0.1); color: white; text-decoration: none; border-radius: 8px; padding: 0.8rem 1rem; flex: 1; text-align: center; border: 1px solid rgba(255,255,255,0.2);"><i class="fa-solid fa-bus" style="color:#ef4444;"></i> Bus</a>
        </div>
        
        ${itineraryHTML}
        ${packingHTML}
        
        <div id="itinerary-action-btns" style="display: flex; gap: 1rem; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem;">
            <button onclick="exportItineraryPDF()" class="btn-primary" style="flex:1; border-radius:8px;"><i class="fa-solid fa-file-pdf"></i> Download PDF</button>
            <button onclick="shareOnWhatsApp('${destination}', ${numDays})" class="btn-small" style="flex:1; background: #25D366; color: white; border: none; border-radius:8px; cursor: pointer;"><i class="fa-brands fa-whatsapp"></i> Share to WhatsApp</button>
        </div>
    `;
    result.style.display = 'block';

    // Automatically save the AI generated trip
    const token = localStorage.getItem('token');
    let dates = document.getElementById('dates-input') ? document.getElementById('dates-input').value : "";
    if (!dates || dates.trim() === "") dates = `${numDays} Days (AI Suggested)`;
    
    try {
        const res = await fetch('/api/trips', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ destination: destination, dates: dates, budget: currentBudget })
        });
        if(!res.ok) throw new Error("API failed");
    } catch(e) {
        console.warn("Backend unavailable, saving to local storage fallback", e);
        let localTrips = JSON.parse(localStorage.getItem('localTrips') || '[]');
        localTrips.push({
            id: Date.now(),
            destination: destination,
            dates: dates,
            budget: currentBudget
        });
        localStorage.setItem('localTrips', JSON.stringify(localTrips));
    }
};


    // 7. Terminal Typing Effect for Hero Title
    const heroTitle = document.querySelector('h1[data-i18n="hero_title"]');
    if (heroTitle) {
        const text = heroTitle.innerText;
        heroTitle.innerText = '';
        heroTitle.style.borderRight = '3px solid var(--primary)';
        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                heroTitle.innerHTML += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            } else {
                heroTitle.style.borderRight = 'none';
            }
        }
        setTimeout(typeWriter, 500);
    }
});

window.triggerSurpriseTrip = function() {
    const destinations = ['Bali', 'Santorini', 'Kyoto', 'Machu Picchu', 'Maldives', 'Reykjavik', 'Maui', 'Dubai'];
    const randomDest = destinations[Math.floor(Math.random() * destinations.length)];
    
    const plane = document.createElement('div');
    plane.innerHTML = '<i class="fa-solid fa-plane"></i>';
    plane.style.position = 'fixed';
    plane.style.fontSize = '80px';
    plane.style.color = 'var(--primary)';
    plane.style.top = '50%';
    plane.style.left = '-150px';
    plane.style.transform = 'translateY(-50%)';
    plane.style.zIndex = '999999';
    plane.style.transition = 'left 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    plane.style.filter = 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))';
    document.body.appendChild(plane);
    
    setTimeout(() => { plane.style.left = '120vw'; }, 50);
    
    setTimeout(() => {
        window.location.href = `explore.html?dest=${encodeURIComponent(randomDest)}`;
    }, 1000);
}

window.openGlobalSettings = function() {
    document.getElementById('settings-theme').value = localStorage.getItem('theme') || 'dark';
    document.getElementById('settings-toasts').value = localStorage.getItem('toasts') || 'on';
    document.getElementById('settings-crazy').value = localStorage.getItem('crazyMode') || 'off';
    document.getElementById('global-settings-modal').style.display = 'flex';
}

window.closeGlobalSettings = function() {
    document.getElementById('global-settings-modal').style.display = 'none';
}

window.saveGlobalSettings = function() {
    const theme = document.getElementById('settings-theme').value;
    const toasts = document.getElementById('settings-toasts').value;
    const crazy = document.getElementById('settings-crazy').value;
    
    localStorage.setItem('theme', theme);
    localStorage.setItem('toasts', toasts);
    localStorage.setItem('crazyMode', crazy);
    
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }

    if (crazy === 'on') {
        triggerCrazyMode();
    }
    
    closeGlobalSettings();
}

function triggerCrazyMode() {
    const canvas = document.createElement('div');
    canvas.style.position = 'fixed';
    canvas.style.top = '0'; canvas.style.left = '0'; canvas.style.width = '100%'; canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '9998';
    canvas.style.overflow = 'hidden';
    document.body.appendChild(canvas);
    
    const colors = ['var(--primary)', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    for(let i=0; i<80; i++) {
        const p = document.createElement('div');
        p.style.position = 'absolute';
        p.style.width = '12px'; p.style.height = '12px';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.top = '-20px';
        p.style.opacity = Math.random() * 0.8 + 0.2;
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        p.style.transition = 'top ' + (Math.random()*2 + 1.5) + 's cubic-bezier(0.25, 0.46, 0.45, 0.94), transform ' + (Math.random()*2 + 1.5) + 's linear';
        canvas.appendChild(p);
        
        setTimeout(() => { 
            p.style.top = '110vh'; 
            p.style.transform = `rotate(${Math.random() * 720}deg)`;
        }, 100);
    }
    setTimeout(() => canvas.remove(), 4000);
}




// ==========================================
// NEW FEATURES: Voice Search, PDF, WhatsApp
// ==========================================

// 1. Voice Search for Destination — Smart NLP Parser
// Parses: "from India to Dubai for 5 days" → fills all fields automatically
function parseVoiceCommand(transcript) {
    let text = transcript.toLowerCase().trim();

    let fromCity = null, toCity = null, numDays = null;

    // --- Extract number of days ---
    // Patterns: "for 5 days", "5 days", "five days"
    const wordNums = {
        'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,
        'eight':8,'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,
        'fourteen':14,'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,
        'nineteen':19,'twenty':20,'thirty':30
    };
    let daysMatch = text.match(/for\s+(\d+|[a-z]+)\s+days?/);
    if (!daysMatch) daysMatch = text.match(/(\d+|[a-z]+)\s+days?/);
    if (daysMatch) {
        const raw = daysMatch[1];
        numDays = parseInt(raw);
        if (isNaN(numDays)) numDays = wordNums[raw] || null;
    }

    // --- Extract TO destination ---
    // Patterns: "to Dubai", "to Dubai for"
    let toMatch = text.match(/\bto\s+([a-z\s]+?)(?:\s+for\s+|\s+in\s+|$)/);
    if (toMatch) toCity = toMatch[1].trim();

    // --- Extract FROM origin ---
    // Patterns: "from India to"
    let fromMatch = text.match(/\bfrom\s+([a-z\s]+?)\s+to\b/);
    if (fromMatch) fromCity = fromMatch[1].trim();

    // --- Fallback: if no from/to found, treat whole text as destination ---
    if (!toCity) {
        let clean = text
            .replace(/plan (a |my )?trip to/i, '')
            .replace(/trip to/i, '')
            .replace(/take me to/i, '')
            .replace(/for \d+ days?/i, '')
            .replace(/for [a-z]+ days?/i, '')
            .trim();
        toCity = clean || transcript.trim();
    }

    // Capitalize city names properly
    const capitalize = str => str.replace(/\b\w/g, c => c.toUpperCase());
    if (toCity) toCity = capitalize(toCity);
    if (fromCity) fromCity = capitalize(fromCity);

    return { fromCity, toCity, numDays };
}

document.addEventListener('DOMContentLoaded', () => {
    const voiceBtn = document.getElementById('voice-search-btn');
    const destInput = document.getElementById('destination-input');

    if (voiceBtn && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        voiceBtn.addEventListener('click', () => {
            voiceBtn.style.color = 'var(--primary)';
            voiceBtn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-beat"></i>';
            recognition.start();
        });

        recognition.addEventListener('result', (e) => {
            const transcript = e.results[0][0].transcript;
            const { fromCity, toCity, numDays } = parseVoiceCommand(transcript);

            // ✅ Fill destination field (TO city)
            if (toCity && destInput) {
                destInput.value = toCity;
            }

            // ✅ Fill origin field in Budget Calculator (FROM city)
            if (fromCity) {
                const calcOrigin = document.getElementById('calc-origin');
                if (calcOrigin) calcOrigin.value = fromCity;
                // Also fill destination in budget calculator
                const calcDest = document.getElementById('calc-dest');
                if (calcDest && toCity) calcDest.value = toCity;
            }

            // ✅ Fill number of days
            if (numDays && numDays > 0) {
                const calcDays = document.getElementById('calc-days');
                if (calcDays) calcDays.value = numDays;
                window._selectedNumDays = numDays;

                // Show a friendly days badge on dates input
                let badge = document.getElementById('days-badge');
                const datesEl = document.getElementById('dates-input');
                if (datesEl) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.id = 'days-badge';
                        badge.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:var(--primary);color:white;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;pointer-events:none;';
                        datesEl.parentElement.style.position = 'relative';
                        datesEl.parentElement.appendChild(badge);
                    }
                    badge.textContent = numDays + ' days';
                }
            }

            // ✅ Visual feedback
            voiceBtn.style.color = 'var(--success)';
            voiceBtn.innerHTML = '<i class="fa-solid fa-check"></i>';

            // Show a brief toast showing what was parsed
            const toastMsg = [
                toCity ? `✈️ To: ${toCity}` : '',
                fromCity ? `🛫 From: ${fromCity}` : '',
                numDays ? `📅 ${numDays} days` : ''
            ].filter(Boolean).join(' | ');

            if (toastMsg) {
                const t = document.createElement('div');
                t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(30,41,59,0.95);color:white;padding:0.8rem 1.5rem;border-radius:20px;font-size:0.9rem;z-index:99999;border:1px solid var(--primary);backdrop-filter:blur(10px);box-shadow:0 8px 25px rgba(0,0,0,0.4);';
                t.innerHTML = `<i class="fa-solid fa-microphone" style="color:var(--primary);margin-right:8px;"></i>${toastMsg}`;
                document.body.appendChild(t);
                setTimeout(() => t.remove(), 3500);
            }

            setTimeout(() => {
                voiceBtn.style.color = 'var(--text-muted)';
                voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }, 2000);
        });

        recognition.addEventListener('error', () => {
            voiceBtn.style.color = '#ef4444';
            setTimeout(() => {
                voiceBtn.style.color = 'var(--text-muted)';
                voiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }, 2000);
        });
    } else if (voiceBtn) {
        voiceBtn.style.display = 'none';
    }
});

// 2. Export to PDF — CSS variables resolved, dark background guaranteed
window.exportItineraryPDF = async function() {
    const dest = (document.getElementById('destination-input') || {}).value || 'Trip';
    const resultEl = document.getElementById('ai-result');

    if (!resultEl || !resultEl.innerHTML.trim() || resultEl.style.display === 'none') {
        alert('Please generate your trip plan first!');
        return;
    }

    // Show loading state
    const dlBtn = document.querySelector('[onclick="exportItineraryPDF()"]');
    const origBtnHTML = dlBtn ? dlBtn.innerHTML : '';
    if (dlBtn) {
        dlBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating PDF...';
        dlBtn.disabled = true;
    }

    // --- KEY FIX: Get innerHTML and replace ALL CSS variables with real colors ---
    let rawHTML = resultEl.innerHTML;
    const cssVarMap = {
        'var(--primary)':    '#2563eb', // slightly darker blue for better print contrast
        'var(--accent)':     '#7c3aed',
        'var(--success)':    '#059669',
        'var(--danger)':     '#dc2626',
        'var(--warning)':    '#d97706',
        'var(--text-main)':  '#1e293b', // Dark text for light background cards
        'var(--text-muted)': '#475569',
        'var(--glass-bg)':   'rgba(255,255,255,0.94)', 
        'var(--glass-border)':'rgba(0,0,0,0.1)',
        'white':             '#0f172a'
    };
    for (const [varName, value] of Object.entries(cssVarMap)) {
        while (rawHTML.includes(varName)) {
            rawHTML = rawHTML.split(varName).join(value);
        }
    }
    // Fix hardcoded transparent dark backgrounds to clean white cards for contrast on dark PDF wallpaper
    rawHTML = rawHTML.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);?/gi, 'background: rgba(255, 255, 255, 0.94); border-radius: 14px; padding: 18px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.5);');
    rawHTML = rawHTML.replace(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.2\);?/gi, 'background: rgba(255, 255, 255, 0.94); border-radius: 14px; padding: 18px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.5);');

    // Fix hardcoded text colors inside cards so they are dark & crisp
    rawHTML = rawHTML.replace(/color:\s*white;?/gi, 'color: #1e293b;');
    rawHTML = rawHTML.replace(/color:\s*#cbd5e1;?/gi, 'color: #475569;');
    rawHTML = rawHTML.replace(/color:\s*#f8fafc;?/gi, 'color: #0f172a;');
    rawHTML = rawHTML.replace(/color:\s*#94a3b8;?/gi, 'color: #475569;');

    // Remove the action buttons div from the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHTML;
    const actionBtns = tempDiv.querySelector('#itinerary-action-btns');
    if (actionBtns) {
        actionBtns.remove();
    }

    const date = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

    // Use the actual destination image we fetched (Wikipedia/Picsum) instead of deprecated Unsplash
    let destImgSrc = document.getElementById('real-dest-img') ? document.getElementById('real-dest-img').src : ('https://picsum.photos/seed/' + encodeURIComponent(dest) + '/800/400');
    
    // Convert to Base64 to bypass ANY html2canvas CORS limitations completely!
    try {
        const res = await fetch(destImgSrc);
        const blob = await res.blob();
        destImgSrc = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch(e) {
        console.warn("Failed to convert image to base64, falling back to raw url", e);
    }

    // Build complete self-contained HTML with a beautiful, rich dark location background image for the entire PDF
    const fullHTML = '<div style="background: url(\'' + destImgSrc + '\') center/cover; position: relative; color:#0f172a; font-family:\'Outfit\', Arial, Helvetica, sans-serif; width:750px; box-sizing:border-box;">'
      + '<style>* { box-sizing: border-box !important; word-wrap: break-word; }</style>'
      + '<div style="position: absolute; inset: 0; background: rgba(15, 23, 42, 0.65); z-index: 0;"></div>' // Darkened background photo overlay
      + '<div style="position: relative; z-index: 1; padding: 32px;">'
      + '<div style="background: url(\'' + destImgSrc + '\') center/cover; border-radius:16px; padding:36px 26px; margin-bottom:24px; display:flex; align-items:center; position:relative; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">'
      + '<div style="position:absolute; inset:0; background:linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,58,138,0.8) 100%);"></div>'
      + '<div style="position:relative; z-index:2; display:flex; align-items:center; gap:18px;">'
      + '<div style="background:#2563eb;color:#ffffff;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;box-shadow:0 4px 15px rgba(37,99,235,0.4);">✈️</div>'
      + '<div>'
      + '<div style="font-size:30px;font-weight:800;color:#ffffff; margin-bottom:4px; text-shadow:0 2px 8px rgba(0,0,0,0.6); letter-spacing:-0.5px;">TripoNext Itinerary</div>'
      + '<div style="font-size:15px;color:#e2e8f0;font-weight:600; text-shadow:0 1px 4px rgba(0,0,0,0.6);">📍 ' + dest + ' &nbsp;&bull;&nbsp; 📅 ' + date + '</div>'
      + '</div>'
      + '</div>'
      + '</div>'
      + tempDiv.innerHTML
      + '<div style="margin-top:30px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.2);font-size:13px;color:#f1f5f9;text-align:center;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,0.8);">'
      + 'Generated by TripoNext &bull; Plan smarter, travel better.'
      + '</div>'
      + '</div>'
      + '</div>';

    // Position container absolute at left: 0 top: 0 behind content (z-index: -9999) so html2canvas renders with 0 X-offset
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;top:0;left:0;z-index:-9999;width:750px;overflow:hidden;pointer-events:none;background:#0f172a;';
    container.innerHTML = fullHTML;
    document.body.appendChild(container);

    const opt = {
        margin:      [5, 5, 5, 5],
        filename:    dest.replace(/\s+/g, '_') + '_TripoNext.pdf',
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale:           2,
            useCORS:         true,
            backgroundColor: '#0f172a',
            windowWidth:     800,
            logging:         false,
            allowTaint:      true,
            scrollX:         0,
            scrollY:         0,
            x:               0,
            y:               0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container.firstChild).save()
      .then(() => {
          document.body.removeChild(container);
          if (dlBtn) { dlBtn.innerHTML = origBtnHTML; dlBtn.disabled = false; }
          const t = document.createElement('div');
          t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#10b981;color:white;padding:1rem 1.6rem;border-radius:14px;font-size:0.9rem;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,0.5);font-weight:bold;display:flex;align-items:center;gap:8px;';
          t.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF Downloaded Successfully!';
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3500);
      })
      .catch(err => {
          document.body.removeChild(container);
          if (dlBtn) { dlBtn.innerHTML = origBtnHTML; dlBtn.disabled = false; }
          console.error('PDF error:', err);
          alert('PDF export failed. Please try again.');
      });
};

// 3. Share on WhatsApp
window.shareOnWhatsApp = function(dest, days) {
    const text = `Hey! Check out my upcoming ${days}-day trip to ${dest} planned via TripoNext. Let's travel!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
};

// ========================================================
// 8. NOTIFICATION CENTER SYSTEM
// ========================================================
window.toggleNotifications = function(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
};

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    const bellBtn = document.querySelector('.notif-bell-btn');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && (!bellBtn || !bellBtn.contains(e.target))) {
            dropdown.classList.remove('show');
        }
    }
});

window.loadNotifications = async function() {
    const countBadge = document.getElementById('notif-count');
    const listEl = document.getElementById('notif-list');
    if (!listEl) return;

    let notifs = [];
    try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
            notifs = await res.json();
        }
    } catch (e) {
        console.warn('Backend notifications unavailable.');
    }

    if (!notifs || notifs.length === 0) {
        notifs = [
            { id: 1, title: "Buddy Request Accepted 🎉", message: "Rahul S. accepted your join request for the Manali Roadtrip! You can now chat in Find Buddies.", is_read: 0 },
            { id: 2, title: "Weather Update ☀️", message: "Sunny skies (22°C) expected for your upcoming destination.", is_read: 0 },
            { id: 3, title: "Expense Splitter Active 💸", message: "Split hotel and cab bills with your travel buddies in My Trips.", is_read: 0 }
        ];
    }

    const unreadCount = notifs.filter(n => !n.is_read).length;
    if (countBadge) {
        countBadge.textContent = unreadCount;
        countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    listEl.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-desc">${n.message}</div>
        </div>
    `).join('');
};

window.markAllNotificationsRead = async function() {
    try {
        await fetch('/api/notifications/read-all', { method: 'POST' });
    } catch(e) {}
    const countBadge = document.getElementById('notif-count');
    if (countBadge) countBadge.style.display = 'none';
    const items = document.querySelectorAll('.notif-item');
    items.forEach(it => it.classList.remove('unread'));
};

// ========================================================
// 9. OFFLINE MODE DETECTION & STATUS BANNER
// ========================================================
window.setupOfflineDetection = function() {
    let banner = document.getElementById('offline-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.className = 'offline-banner';
        banner.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> <span>Offline Mode: Using cached itineraries & plans</span>';
        document.body.appendChild(banner);
    }

    function updateOnlineStatus() {
        if (!navigator.onLine) {
            banner.classList.add('active');
            banner.innerHTML = '<i class="fa-solid fa-wifi-slash"></i> <span>Offline Mode: Using cached itineraries & plans</span>';
        } else {
            if (banner.classList.contains('active')) {
                banner.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#10b981"></i> <span>Back Online! Changes synchronized.</span>';
                setTimeout(() => { banner.classList.remove('active'); }, 3000);
            }
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    if (!navigator.onLine) {
        banner.classList.add('active');
    }
};

// ========================================================
// 10. FLOATING TRAVEL TOOLBOX (Currency + Audio Phrases + SOS)
// ========================================================
const TOOLBOX_EXCHANGE_RATES = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095,
    JPY: 1.85,
    AED: 0.044,
    THB: 0.42,
    AUD: 0.018,
    CAD: 0.016
};

const TRAVEL_PHRASES = [
    { text: "Hello / Greetings", hi: "नमस्ते (Namaste)", es: "¡Hola! (OH-lah)", fr: "Bonjour (bon-ZHOOR)", ja: "こんにちは (Konnichiwa)", de: "Hallo (HAH-loh)", it: "Ciao (CHOW)" },
    { text: "Where is the hospital?", hi: "अस्पताल कहाँ है?", es: "¿Dónde está el hospital?", fr: "Où est l'hôpital?", ja: "病院はどこですか？", de: "Wo ist das Krankenhaus?", it: "Dov'è l'ospedale?" },
    { text: "How much is this?", hi: "यह कितने का है?", es: "¿Cuánto cuesta esto?", fr: "Combien ça coûte?", ja: "これはいくらですか？", de: "Wie viel kostet das?", it: "Quanto costa questo?" },
    { text: "Please help me!", hi: "कृपया मेरी मदद करें!", es: "¡Por favor, ayúdame!", fr: "Aidez-moi s'il vous plaît!", ja: "助けてください！", de: "Bitte helfen Sie mir!", it: "Per favore aiutami!" },
    { text: "Where is the police station?", hi: "पुलिस स्टेशन कहाँ है?", es: "¿Dónde está la policía?", fr: "Où est le commissariat?", ja: "警察署はどこですか？", de: "Wo ist die Polizeiwache?", it: "Dov'è la stazione di polizia?" },
    { text: "Thank you so much!", hi: "बहुत-बहुत धन्यवाद!", es: "¡Muchas gracias!", fr: "Merci beaucoup!", ja: "どうもありがとうございます！", de: "Vielen Dank!", it: "Grazie mille!" }
];

window.injectFloatingToolbox = function() {
    if (document.getElementById('floating-toolbox-btn')) return;

    // Floating Button
    const btn = document.createElement('button');
    btn.id = 'floating-toolbox-btn';
    btn.className = 'floating-toolbox-btn';
    btn.title = 'Travel Toolbox (Currency, Translator, SOS)';
    btn.innerHTML = '<i class="fa-solid fa-toolbox"></i>';
    btn.onclick = toggleToolbox;
    document.body.appendChild(btn);

    // Modal
    const modal = document.createElement('div');
    modal.id = 'toolbox-modal';
    modal.className = 'toolbox-modal';
    modal.innerHTML = `
        <div class="toolbox-header">
            <h4 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-compass" style="color:var(--primary)"></i> Travel Toolbox
            </h4>
            <button onclick="toggleToolbox()" style="background:none; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="toolbox-tabs">
            <button class="toolbox-tab-btn active" onclick="switchToolboxTab('currency', this)"><i class="fa-solid fa-coins"></i> Currency</button>
            <button class="toolbox-tab-btn" onclick="switchToolboxTab('phrases', this)"><i class="fa-solid fa-language"></i> Phrases</button>
            <button class="toolbox-tab-btn" onclick="switchToolboxTab('sos', this)"><i class="fa-solid fa-triangle-exclamation"></i> SOS</button>
        </div>
        <div class="toolbox-body" id="toolbox-body">
            <!-- Injected by tab -->
        </div>
    `;
    document.body.appendChild(modal);

    renderCurrencyTab();
};

window.toggleToolbox = function() {
    const m = document.getElementById('toolbox-modal');
    if (m) m.classList.toggle('show');
};

window.switchToolboxTab = function(tabName, btn) {
    document.querySelectorAll('.toolbox-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    if (tabName === 'currency') renderCurrencyTab();
    else if (tabName === 'phrases') renderPhrasesTab();
    else if (tabName === 'sos') renderSOSTab();
};

function renderCurrencyTab() {
    const body = document.getElementById('toolbox-body');
    if (!body) return;
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.8rem;">
            <label style="font-size:0.8rem; color:#94a3b8; margin-bottom:-4px;">Convert Amount</label>
            <div style="display:flex; gap:0.5rem;">
                <input type="number" id="tb-amount" value="1000" min="1" oninput="runToolboxConversion()" style="flex:1; padding:0.6rem; border-radius:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none;">
                <select id="tb-from" onchange="runToolboxConversion()" style="padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none;">
                    <option value="INR">₹ INR</option>
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GBP">£ GBP</option>
                    <option value="AED">AED</option>
                    <option value="THB">฿ THB</option>
                    <option value="JPY">¥ JPY</option>
                </select>
            </div>
            <div style="text-align:center; color:#94a3b8; font-size:0.9rem;">
                <i class="fa-solid fa-arrow-down"></i>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <input type="text" id="tb-result" readonly style="flex:1; padding:0.6rem; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#4ade80; font-weight:700; outline:none;">
                <select id="tb-to" onchange="runToolboxConversion()" style="padding:0.6rem; border-radius:8px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); color:#fff; outline:none;">
                    <option value="USD">$ USD</option>
                    <option value="INR">₹ INR</option>
                    <option value="EUR">€ EUR</option>
                    <option value="GBP">£ GBP</option>
                    <option value="AED">AED</option>
                    <option value="THB">฿ THB</option>
                    <option value="JPY">¥ JPY</option>
                </select>
            </div>
            <div id="tb-rate-hint" style="font-size:0.75rem; color:#94a3b8; text-align:center; margin-top:4px;">Live conversion calculator</div>
        </div>
    `;
    runToolboxConversion();
}

window.runToolboxConversion = function() {
    const amt = parseFloat(document.getElementById('tb-amount')?.value) || 0;
    const from = document.getElementById('tb-from')?.value || 'INR';
    const to = document.getElementById('tb-to')?.value || 'USD';
    const resultEl = document.getElementById('tb-result');
    const hintEl = document.getElementById('tb-rate-hint');

    const inINR = amt / (TOOLBOX_EXCHANGE_RATES[from] || 1);
    const finalVal = inINR * (TOOLBOX_EXCHANGE_RATES[to] || 1);

    if (resultEl) resultEl.value = `${to} ${finalVal.toFixed(2)}`;
    if (hintEl) {
        const singleRate = (1 / (TOOLBOX_EXCHANGE_RATES[from] || 1)) * (TOOLBOX_EXCHANGE_RATES[to] || 1);
        hintEl.textContent = `1 ${from} ≈ ${singleRate.toFixed(4)} ${to}`;
    }
};

function renderPhrasesTab() {
    const body = document.getElementById('toolbox-body');
    if (!body) return;
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:0.8rem; color:#94a3b8;">Select Language:</span>
                <select id="phrase-lang" onchange="renderPhraseList()" style="padding:0.3rem 0.6rem; border-radius:6px; background:#1e293b; border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:0.8rem; outline:none;">
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="fr">🇫🇷 French</option>
                    <option value="ja">🇯🇵 Japanese</option>
                    <option value="hi">🇮🇳 Hindi</option>
                    <option value="de">🇩🇪 German</option>
                    <option value="it">🇮🇹 Italian</option>
                </select>
            </div>
            <div id="phrase-cards-container" style="display:flex; flex-direction:column; gap:0.5rem; max-height:280px; overflow-y:auto;"></div>
        </div>
    `;
    renderPhraseList();
}

window.renderPhraseList = function() {
    const lang = document.getElementById('phrase-lang')?.value || 'es';
    const container = document.getElementById('phrase-cards-container');
    if (!container) return;

    container.innerHTML = TRAVEL_PHRASES.map(p => {
        const trans = p[lang] || p.es;
        return `
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.6rem 0.8rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${p.text}</div>
                    <div style="font-size:0.88rem; font-weight:600; color:#fff; margin-top:2px;">${trans}</div>
                </div>
                <button onclick="speakPhrase('${trans.replace(/'/g, "\\'")}', '${lang}')" style="background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.3); color:var(--primary); width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Listen Pronunciation">
                    <i class="fa-solid fa-volume-high"></i>
                </button>
            </div>
        `;
    }).join('');
};

window.speakPhrase = function(text, lang) {
    if (!('speechSynthesis' in window)) {
        alert('Voice synthesis not supported in this browser.');
        return;
    }
    const cleanText = text.split('(')[0].trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langCodes = { es: 'es-ES', fr: 'fr-FR', ja: 'ja-JP', hi: 'hi-IN', de: 'de-DE', it: 'it-IT' };
    utterance.lang = langCodes[lang] || 'en-US';
    window.speechSynthesis.speak(utterance);
};

function renderSOSTab() {
    const body = document.getElementById('toolbox-body');
    if (!body) return;
    body.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.6rem;">
            <p style="font-size:0.8rem; color:#cbd5e1; margin-bottom:4px;">Direct emergency speed-dial services:</p>
            <a href="tel:112" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); border-radius:10px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; color:#f87171; text-decoration:none;">
                <div>
                    <strong style="display:block; font-size:0.95rem;"><i class="fa-solid fa-shield-halved"></i> Universal Emergency / Police</strong>
                    <span style="font-size:0.75rem; color:#fca5a5;">Dial 112 (India, EU, Global)</span>
                </div>
                <i class="fa-solid fa-phone"></i>
            </a>
            <a href="tel:102" style="background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.35); border-radius:10px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; color:#60a5fa; text-decoration:none;">
                <div>
                    <strong style="display:block; font-size:0.95rem;"><i class="fa-solid fa-truck-medical"></i> Ambulance Service</strong>
                    <span style="font-size:0.75rem; color:#93c5fd;">Dial 102 / 108</span>
                </div>
                <i class="fa-solid fa-phone"></i>
            </a>
            <a href="tel:1363" style="background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.35); border-radius:10px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; color:#facc15; text-decoration:none;">
                <div>
                    <strong style="display:block; font-size:0.95rem;"><i class="fa-solid fa-circle-info"></i> Tourist Helpline (24/7)</strong>
                    <span style="font-size:0.75rem; color:#fde047;">Dial 1363 (Multi-lingual)</span>
                </div>
                <i class="fa-solid fa-phone"></i>
            </a>
            <button onclick="shareEmergencyLocation()" style="margin-top:4px; background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:white; border:none; padding:0.75rem; border-radius:10px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-location-crosshairs"></i> Share My Live GPS with Emergency Contact
            </button>
        </div>
    `;
}

window.shareEmergencyLocation = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const mapLink = `https://maps.google.com/?q=${lat},${lon}`;
            const msg = `EMERGENCY ALERT: I am using TripoNext SOS. My current location is: ${mapLink}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        }, err => {
            alert('Unable to access location. Please check browser GPS permissions.');
        });
    } else {
        alert('Geolocation is not supported by your browser.');
    }
};

// ========================================================
// 11. AI MAGIC ITINERARY MODAL (Day-by-Day Gemini Planner)
// ========================================================
window.openMagicPlanner = async function(destination, days, budget, currency = "INR") {
    const dest = destination || document.getElementById('destination-input')?.value || "Paris";
    const numDays = days || window._selectedNumDays || 3;
    const bgt = budget || document.getElementById('budget-input')?.value || 15000;

    let modal = document.getElementById('magic-itinerary-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'magic-itinerary-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 720px; width: 95vw; max-height: 85vh; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; margin-bottom: 1rem;">
                    <div>
                        <h2 style="margin: 0; color: #fff; display: flex; align-items: center; gap: 8px; font-size: 1.5rem;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--primary);"></i> AI Magic Itinerary
                        </h2>
                        <span id="magic-modal-subtitle" style="color: #94a3b8; font-size: 0.85rem;">Generating custom plan...</span>
                    </div>
                    <button onclick="closeMagicPlanner()" style="background: none; border: none; color: #cbd5e1; font-size: 1.2rem; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div id="magic-modal-body" style="flex: 1; overflow-y: auto; padding-right: 0.5rem;">
                    <div style="text-align: center; padding: 3rem 1rem;">
                        <i class="fa-solid fa-spinner fa-spin fa-3x" style="color: var(--primary);"></i>
                        <p style="color: #e2e8f0; margin-top: 1rem; font-weight: 500;">TripoNext AI is crafting your day-by-day plan for ${dest}...</p>
                    </div>
                </div>
                <div id="magic-modal-footer" style="display: none; justify-content: flex-end; gap: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem; margin-top: 1rem;">
                    <button class="btn-small" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer;" onclick="closeMagicPlanner()">Close</button>
                    <button id="save-magic-trip-btn" class="btn-small btn-primary" style="padding: 0.6rem 1.4rem; border-radius: 8px; cursor: pointer;"><i class="fa-solid fa-bookmark"></i> Save to My Trips</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    document.getElementById('magic-modal-subtitle').textContent = `${numDays} Days in ${dest}`;
    document.getElementById('magic-modal-body').innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
            <i class="fa-solid fa-spinner fa-spin fa-3x" style="color: var(--primary);"></i>
            <p style="color: #e2e8f0; margin-top: 1rem; font-weight: 500;">TripoNext AI is generating your personalized ${numDays}-day plan...</p>
        </div>
    `;
    document.getElementById('magic-modal-footer').style.display = 'none';

    try {
        const res = await fetch('/api/ai-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: dest, days: numDays, budget: bgt, currency })
        });
        const data = await res.json();
        renderMagicItineraryPlan(data);
    } catch (e) {
        console.error('AI itinerary error:', e);
        document.getElementById('magic-modal-body').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fa-solid fa-circle-exclamation fa-2x"></i>
                <p>Could not generate itinerary right now. Please check your internet connection.</p>
            </div>
        `;
    }
};

window.closeMagicPlanner = function() {
    const modal = document.getElementById('magic-itinerary-modal');
    if (modal) modal.style.display = 'none';
};

function renderMagicItineraryPlan(plan) {
    const body = document.getElementById('magic-modal-body');
    const footer = document.getElementById('magic-modal-footer');
    if (!body) return;

    let html = `
        <div style="background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.25); border-radius: 12px; padding: 1rem; margin-bottom: 1.2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 700;">AI Trip Overview</span>
                <span style="background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">${plan.vibe || 'Curated'}</span>
            </div>
            <p style="margin: 0.4rem 0 0; color: #f8fafc; font-size: 0.95rem; line-height: 1.5;">${plan.summary}</p>
        </div>

        <div style="margin-bottom: 1.2rem;">
            <h4 style="color: #fff; margin-bottom: 0.5rem; font-size: 1rem;"><i class="fa-solid fa-wallet" style="color: var(--accent);"></i> Estimated Budget Split</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem;">
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.75rem; color: #94a3b8;">🏨 Stay</div>
                    <div style="font-weight: 700; color: #fff;">${plan.budgetBreakdown?.stay || '40%'}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.75rem; color: #94a3b8;">🥘 Food</div>
                    <div style="font-weight: 700; color: #fff;">${plan.budgetBreakdown?.food || '25%'}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.75rem; color: #94a3b8;">🎟️ Activities</div>
                    <div style="font-weight: 700; color: #fff;">${plan.budgetBreakdown?.activities || '20%'}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.75rem; color: #94a3b8;">🚕 Travel</div>
                    <div style="font-weight: 700; color: #fff;">${plan.budgetBreakdown?.transport || '15%'}</div>
                </div>
            </div>
        </div>

        <h4 style="color: #fff; margin-bottom: 0.75rem; font-size: 1.05rem;"><i class="fa-solid fa-calendar-days" style="color: #38bdf8;"></i> Day-by-Day Schedule</h4>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
    `;

    (plan.dailyPlan || []).forEach(d => {
        html += `
            <div style="background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                    <span style="font-weight: 700; color: var(--primary); font-size: 1rem;">Day ${d.day}: ${d.theme}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.88rem;">
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(234,179,8,0.2); color: #facc15; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; min-width: 70px; text-align: center;">🌅 Morning</span>
                        <div>
                            <strong style="color: #fff;">${d.morning?.act || d.morning?.activity || 'Morning highlights'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem;">📍 ${d.morning?.loc || d.morning?.location || ''} • 💡 ${d.morning?.tip || ''}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(59,130,246,0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; min-width: 70px; text-align: center;">☀️ Afternoon</span>
                        <div>
                            <strong style="color: #fff;">${d.afternoon?.act || d.afternoon?.activity || 'Afternoon exploration'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem;">📍 ${d.afternoon?.loc || d.afternoon?.location || ''} • 💡 ${d.afternoon?.tip || ''}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(168,85,247,0.2); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; min-width: 70px; text-align: center;">🌙 Evening</span>
                        <div>
                            <strong style="color: #fff;">${d.evening?.act || d.evening?.activity || 'Dinner & sunset views'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem;">📍 ${d.evening?.loc || d.evening?.location || ''} • 💡 ${d.evening?.tip || ''}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    if (plan.packingList && plan.packingList.length > 0) {
        html += `
            <div style="margin-top: 1rem;">
                <h4 style="color: #fff; margin-bottom: 0.5rem; font-size: 0.95rem;"><i class="fa-solid fa-suitcase" style="color: #4ade80;"></i> Smart Packing Checklist</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    ${plan.packingList.map(item => `<span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 10px; font-size: 0.8rem; color: #e2e8f0;"><i class="fa-solid fa-check" style="color: #4ade80; margin-right: 4px;"></i> ${item}</span>`).join('')}
                </div>
            </div>
        `;
    }

    html += `</div>`;
    body.innerHTML = html;

    if (footer) {
        footer.style.display = 'flex';
        const saveBtn = document.getElementById('save-magic-trip-btn');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
                await saveMagicTripToMyTrips(plan);
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                setTimeout(() => {
                    closeMagicPlanner();
                    window.location.href = 'mytrips.html';
                }, 1000);
            };
        }
    }
}

async function saveMagicTripToMyTrips(plan) {
    const token = localStorage.getItem('token');
    const tripPayload = {
        destination: plan.destination,
        dates: `${plan.days} Days Itinerary`,
        budget: 15000,
        itinerary: plan
    };

    if (token) {
        try {
            await fetch('/api/trips', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(tripPayload)
            });
        } catch (e) {
            console.warn('Backend save failed, using local storage.');
        }
    }

    const localTrips = JSON.parse(localStorage.getItem('localTrips') || '[]');
    localTrips.push({
        id: 'magic-' + Date.now(),
        destination: plan.destination,
        dates: `${plan.days} Days Itinerary`,
        budget: 15000,
        itinerary: plan
    });
    localStorage.setItem('localTrips', JSON.stringify(localTrips));
}

