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

    // Set user name & inject notification bell and profile button
    let user = { name: 'Traveler', email: 'user@triponext.com' };
    try {
        const rawUser = localStorage.getItem('user');
        if (rawUser) user = JSON.parse(rawUser);
    } catch(e) {}
    const logo = document.querySelector('.logo');
    if(logo) {
        logo.innerHTML = `<i class="fa-solid fa-plane-departure" style="color:var(--primary)"></i> TripoNext`;
        logo.style.cursor = 'pointer';
        logo.onclick = () => window.location.href = 'index.html';
    }

    const profile = document.querySelector('.user-profile');
    if(profile) {
        profile.innerHTML = `
            <div class="notif-wrapper" style="margin-right: 8px;">
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
            <button class="top-profile-btn" onclick="openGlobalSettings()" title="Profile & Settings" style="background:linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,179,8,0.2)); border:1px solid rgba(249,115,22,0.4); color:white; border-radius:50%; width:38px; height:38px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.15rem;">
                <i class="fa-solid fa-user"></i>
            </button>
        `;
        setTimeout(loadNotifications, 100);
    }

    // Initialize global utilities safely
    if (typeof injectFloatingToolbox === 'function') injectFloatingToolbox();
    else if (window.injectFloatingToolbox) window.injectFloatingToolbox();

    if (typeof setupOfflineDetection === 'function') setupOfflineDetection();
    else if (window.setupOfflineDetection) window.setupOfflineDetection();

    if (typeof renderMobileBottomNav === 'function') renderMobileBottomNav();
    else if (window.renderMobileBottomNav) window.renderMobileBottomNav();

    if (typeof initPhoneMode === 'function') initPhoneMode();
    else if (window.initPhoneMode) window.initPhoneMode();

    if (typeof injectQuickBookingPills === 'function') injectQuickBookingPills();
    else if (window.injectQuickBookingPills) window.injectQuickBookingPills();

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
window.updateCurrency = updateCurrency;

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

// Global UI Additions (Settings Hub, Mobile Bottom Nav, Bookings Hub)
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
        settingsBtn.title = 'Profile & Settings';
        settingsBtn.onclick = () => {
            if (typeof openGlobalSettings === 'function') openGlobalSettings();
            else if (window.openGlobalSettings) window.openGlobalSettings();
        };
        navLinks.insertBefore(settingsBtn, navLinks.lastElementChild);
        
        // Restore theme
        if(localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
        }
    }

    // 2. Render Mobile Bottom Navigation Bar & Phone Frame Mode
    if (typeof renderMobileBottomNav === 'function') renderMobileBottomNav();
    else if (window.renderMobileBottomNav) window.renderMobileBottomNav();

    if (typeof initPhoneMode === 'function') initPhoneMode();
    else if (window.initPhoneMode) window.initPhoneMode();

    // 3. Inject Quick Booking Pills on Dashboard
    if (typeof injectQuickBookingPills === 'function') injectQuickBookingPills();
    else if (window.injectQuickBookingPills) window.injectQuickBookingPills();

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
        surpriseBtn.onclick = () => {
            if (typeof triggerSurpriseTrip === 'function') triggerSurpriseTrip();
            else if (window.triggerSurpriseTrip) window.triggerSurpriseTrip();
        };
        
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
                let overpassData = null;
                try {
                    const ctl = new AbortController();
                    const tid = setTimeout(() => ctl.abort(), 2000);
                    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: overpassQuery, signal: ctl.signal });
                    clearTimeout(tid);
                    if (overpassRes.ok) overpassData = await overpassRes.json();
                } catch(e) {
                    console.log('Overpass timeout/fallback, using curated travel places.');
                }
                
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

// ========================================================
// GLOBAL NOTIFICATION TOAST
// ========================================================
window.showAppToast = function(msg, type = 'info') {
    let container = document.getElementById('app-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-toast-container';
        container.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:99999; display:flex; flex-direction:column; gap:8px; pointer-events:none; max-width:92%; width:420px;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))' 
             : type === 'error' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))'
             : 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))';
    const border = type === 'success' ? 'rgba(52, 211, 153, 0.6)' : type === 'error' ? 'rgba(248, 113, 113, 0.6)' : 'rgba(99, 102, 241, 0.6)';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
    
    toast.style.cssText = `background:${bg}; border:1px solid ${border}; color:#ffffff; padding:12px 18px; border-radius:12px; box-shadow:0 12px 30px -5px rgba(0,0,0,0.5); font-size:0.9rem; font-weight:500; display:flex; align-items:center; gap:12px; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); pointer-events:auto; opacity:0; transform:translateY(-15px); transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1);`;
    toast.innerHTML = `<i class="fa-solid ${icon}" style="font-size:1.15rem; flex-shrink:0;"></i><span style="flex:1; line-height:1.4;">${msg}</span><button style="background:none; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:1rem; padding:0; display:flex; align-items:center;" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-15px)';
        setTimeout(() => toast.remove(), 350);
    }, 3800);
};

// ========================================================
// MOBILE-FIRST BOTTOM NAVIGATION & QUICK LAUNCHERS
// ========================================================
window.renderMobileBottomNav = function() {
    if (document.getElementById('mobile-bottom-nav')) return;

    const currentPath = window.location.pathname;
    const isHome = currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/');
    const isExplore = currentPath.endsWith('explore.html');
    const isTrips = currentPath.endsWith('mytrips.html');
    const isCommunity = currentPath.endsWith('community.html');
    const isBuddies = currentPath.endsWith('buddies.html');

    const navHTML = `
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav">
        <a href="index.html" class="mobile-nav-item ${isHome ? 'active' : ''}">
            <i class="fa-solid fa-house"></i>
            <span>Home</span>
        </a>
        <a href="explore.html" class="mobile-nav-item ${isExplore ? 'active' : ''}">
            <i class="fa-solid fa-compass"></i>
            <span>Explore</span>
        </a>
        <button class="mobile-nav-item" onclick="openBookingsHub('hotels')">
            <i class="fa-solid fa-ticket"></i>
            <span>Book</span>
            <span class="mobile-nav-badge">NEW</span>
        </button>
        <a href="mytrips.html" class="mobile-nav-item ${isTrips ? 'active' : ''}">
            <i class="fa-solid fa-suitcase-rolling"></i>
            <span>My Trips</span>
        </a>
        <button class="mobile-nav-item" onclick="openGlobalSettings()">
            <i class="fa-solid fa-user-gear"></i>
            <span>Profile</span>
        </button>
    </nav>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);
};

window.togglePhoneMode = function() {
    const isPhoneMode = document.body.classList.toggle('phone-mode-active');
    localStorage.setItem('triponext_phone_mode', isPhoneMode ? '1' : '0');
    const toggleBtn = document.getElementById('view-mode-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = isPhoneMode ? '<i class="fa-solid fa-desktop"></i> Desktop View' : '<i class="fa-solid fa-mobile-screen-button"></i> Mobile App View';
    }
    if (window.showAppToast) {
        window.showAppToast(isPhoneMode ? 'Switched to Mobile App View 📱' : 'Switched to Full Desktop View 🖥️', 'info');
    }
};

window.initPhoneMode = function() {
    if (window.innerWidth > 868 && !document.getElementById('view-mode-toggle')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'view-mode-toggle';
        toggleBtn.className = 'view-mode-toggle-btn';
        toggleBtn.onclick = () => {
            if (typeof togglePhoneMode === 'function') togglePhoneMode();
            else if (window.togglePhoneMode) window.togglePhoneMode();
        };
        const savedMode = localStorage.getItem('triponext_phone_mode');
        if (savedMode === '1') {
            document.body.classList.add('phone-mode-active');
            toggleBtn.innerHTML = '<i class="fa-solid fa-desktop"></i> Desktop View';
        } else {
            toggleBtn.innerHTML = '<i class="fa-solid fa-mobile-screen-button"></i> Mobile App View';
        }
        document.body.appendChild(toggleBtn);
    }
};

window.injectQuickBookingPills = function() {
    const heroContent = document.querySelector('.hero-content');
    if (!heroContent || document.getElementById('quick-pills-bar')) return;

    const pillsHTML = `
    <div class="quick-pills-bar" id="quick-pills-bar">
        <button class="quick-pill-btn pill-highlight" onclick="openMagicPlanner()">
            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Planner
        </button>
        <button class="quick-pill-btn" onclick="openBookingsHub('hotels')">
            <i class="fa-solid fa-hotel" style="color:#eab308;"></i> Hotels
        </button>
        <button class="quick-pill-btn" onclick="openBookingsHub('cabs')">
            <i class="fa-solid fa-taxi" style="color:#10b981;"></i> Cabs
        </button>
        <button class="quick-pill-btn" onclick="openBookingsHub('flights')">
            <i class="fa-solid fa-plane-departure" style="color:#38bdf8;"></i> Flights
        </button>
        <button class="quick-pill-btn" onclick="openBookingsHub('buses')">
            <i class="fa-solid fa-bus" style="color:#f97316;"></i> Buses
        </button>
        <a href="buddies.html" class="quick-pill-btn">
            <i class="fa-solid fa-user-group" style="color:#a855f7;"></i> Travel Buddies
        </a>
        <button class="quick-pill-btn" onclick="openOffersModal()">
            <i class="fa-solid fa-tag" style="color:#ec4899;"></i> Offers & Deals
        </button>
    </div>
    `;
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
        searchBar.insertAdjacentHTML('afterend', pillsHTML);
    }
};

// ========================================================
// PROFILE & SETTINGS HUB (Profile, Edit, Refer, Feedback, Help, Offers)
// ========================================================
let _userProfileCache = null;

window.openGlobalSettings = async function() {
    let modal = document.getElementById('settings-hub-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'settings-hub-modal';
        modal.className = 'settings-hub-modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }

    // Fetch user profile from API or local storage
    const token = localStorage.getItem('token');
    let user = JSON.parse(localStorage.getItem('user')) || { name: 'Rahul Sharma', email: 'rahul@triponext.com' };
    
    if (!_userProfileCache) {
        try {
            const res = await fetch('/api/user/profile', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                _userProfileCache = await res.json();
            }
        } catch (e) {
            console.warn('Backend profile fetch fallback to local:', e);
        }
    }
    const profile = _userProfileCache || {
        name: user.name || "Rahul Sharma",
        email: user.email || "rahul@triponext.com",
        phone: "+91 98765 43210",
        bio: "Explorer & Mountain Wanderer",
        avatar: "avatar-1",
        home_city: "Delhi, India",
        travel_style: "Adventure & Cultural",
        referral_code: "TRIP-7492",
        referral_credits: 500
    };

    const isOnline = navigator.onLine;
    const localTripsCount = (JSON.parse(localStorage.getItem('localTrips') || '[]')).length;

    modal.innerHTML = `
    <div class="settings-hub-dialog">
        <!-- Close Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-gear" style="color:var(--primary)"></i> Account & Settings
            </h3>
            <button onclick="closeGlobalSettings()" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <!-- 1. USER PROFILE CARD -->
        <div class="profile-card-header">
            <div class="profile-avatar-large" id="profile-avatar-display">
                ${profile.avatar === 'avatar-2' ? '🏖️' : profile.avatar === 'avatar-3' ? '🎒' : profile.avatar === 'avatar-4' ? '🏛️' : profile.avatar === 'avatar-5' ? '✈️' : profile.avatar === 'avatar-6' ? '📸' : '🏔️'}
            </div>
            <div class="profile-info" style="flex:1;">
                <h3 id="profile-name-display">${profile.name}</h3>
                <p><i class="fa-regular fa-envelope"></i> ${profile.email}</p>
                <p><i class="fa-solid fa-phone"></i> ${profile.phone || '+91 98765 43210'}</p>
                <div class="profile-tags">
                    <span class="profile-tag-pill"><i class="fa-solid fa-location-dot" style="color:var(--primary)"></i> ${profile.home_city || 'Delhi, India'}</span>
                    <span class="profile-tag-pill"><i class="fa-solid fa-compass" style="color:#38bdf8"></i> ${profile.travel_style || 'Adventure'}</span>
                </div>
            </div>
            <button class="profile-edit-btn" onclick="toggleEditProfileView()">
                <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
        </div>

        <!-- Inline Edit Profile Form (Hidden by default) -->
        <div id="edit-profile-form" style="display:none; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.2rem; margin-bottom:1.2rem;">
            <h4 style="margin:0 0 1rem 0; color:var(--primary); font-size:1rem;">
                <i class="fa-solid fa-user-pen"></i> Edit Personal Profile
            </h4>
            
            <div style="margin-bottom:0.8rem;">
                <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Select Avatar Icon</label>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-1', '🏔️')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">🏔️</button>
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-2', '🏖️')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">🏖️</button>
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-3', '🎒')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">🎒</button>
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-4', '🏛️')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">🏛️</button>
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-5', '✈️')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">✈️</button>
                    <button type="button" class="avatar-select-btn" onclick="selectAvatar('avatar-6', '📸')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); font-size:1.3rem; border-radius:10px; width:40px; height:40px; cursor:pointer;">📸</button>
                </div>
                <input type="hidden" id="edit-avatar-val" value="${profile.avatar || 'avatar-1'}">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:0.8rem;">
                <div>
                    <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Full Name</label>
                    <input type="text" id="edit-name" value="${profile.name}" style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
                </div>
                <div>
                    <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Phone Number</label>
                    <input type="text" id="edit-phone" value="${profile.phone || '+91 98765 43210'}" style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:0.8rem;">
                <div>
                    <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Home City</label>
                    <input type="text" id="edit-city" value="${profile.home_city || 'Delhi, India'}" style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
                </div>
                <div>
                    <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Travel Style</label>
                    <select id="edit-style" style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
                        <option value="Adventure & Trekking" ${profile.travel_style?.includes('Adventure') ? 'selected' : ''}>Adventure & Trekking</option>
                        <option value="Budget Backpacker" ${profile.travel_style?.includes('Budget') ? 'selected' : ''}>Budget Backpacker</option>
                        <option value="Luxury & Relaxation" ${profile.travel_style?.includes('Luxury') ? 'selected' : ''}>Luxury & Relaxation</option>
                        <option value="Heritage & Culture" ${profile.travel_style?.includes('Culture') ? 'selected' : ''}>Heritage & Culture</option>
                        <option value="Solo Explorer" ${profile.travel_style?.includes('Solo') ? 'selected' : ''}>Solo Explorer</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom:0.8rem;">
                <label style="font-size:0.75rem; color:#cbd5e1; display:block; margin-bottom:4px;">Bio / Travel Motto</label>
                <input type="text" id="edit-bio" value="${profile.bio || 'Living for spontaneous trips and secret sunset spots.'}" style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button onclick="toggleEditProfileView()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:#cbd5e1; padding:0.5rem 1rem; border-radius:8px; cursor:pointer;">Cancel</button>
                <button onclick="saveProfileChanges()" style="background:var(--primary); border:none; color:white; padding:0.5rem 1.2rem; border-radius:8px; font-weight:600; cursor:pointer;">Save Changes</button>
            </div>
        </div>

        <!-- 2. QUICK SETTINGS MENU LIST -->
        <div class="settings-menu-list">
            <!-- My Trips -->
            <div class="settings-item-row" onclick="window.location.href='mytrips.html'">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(59,130,246,0.15); color:#38bdf8;">
                        <i class="fa-solid fa-suitcase-rolling"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">My Trips & Itineraries</div>
                        <div class="settings-item-subtitle">Manage saved plans, bookings & expenses</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">View</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>

            <!-- Refer and Earn -->
            <div class="settings-item-row" onclick="openReferEarnModal()">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(168,85,247,0.15); color:#c084fc;">
                        <i class="fa-solid fa-gift"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">Refer & Earn Rewards</div>
                        <div class="settings-item-subtitle">Earn ₹250 travel credits for every friend invited</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="background:rgba(168,85,247,0.2); color:#c084fc; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">₹500 Bonus</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>

            <!-- Offers and Discount -->
            <div class="settings-item-row" onclick="openOffersModal()">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(236,72,153,0.15); color:#f472b6;">
                        <i class="fa-solid fa-percent"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">Offers & Discounts</div>
                        <div class="settings-item-subtitle">Verified promo codes for Flights, Stays & Cabs</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="background:rgba(236,72,153,0.2); color:#f472b6; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">5 Active</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>

            <!-- Feedback and Rating -->
            <div class="settings-item-row" onclick="openFeedbackModal()">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(234,179,8,0.15); color:#facc15;">
                        <i class="fa-solid fa-star"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">Feedback & Rating</div>
                        <div class="settings-item-subtitle">Rate your experience & suggest features</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="color:#facc15; font-size:0.85rem;">★★★★★</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>

            <!-- Help and Support -->
            <div class="settings-item-row" onclick="openHelpSupportModal()">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(16,185,129,0.15); color:#34d399;">
                        <i class="fa-solid fa-headset"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">Help & Support</div>
                        <div class="settings-item-subtitle">24x7 AI assistant, WhatsApp & FAQs</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="background:rgba(16,185,129,0.2); color:#34d399; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">24/7 Live</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>

            <!-- Offline Data Manager -->
            <div class="settings-item-row" onclick="openOfflineManager()">
                <div class="settings-item-left">
                    <div class="settings-item-icon" style="background:rgba(249,115,22,0.15); color:var(--primary);">
                        <i class="fa-solid fa-wifi"></i>
                    </div>
                    <div>
                        <div class="settings-item-title">Offline Mode & Cache Manager</div>
                        <div class="settings-item-subtitle">Network status, clear cached offline data</div>
                    </div>
                </div>
                <div class="settings-item-right">
                    <span style="background:${isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color:${isOnline ? '#34d399' : '#f87171'}; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:700;">
                        ${isOnline ? 'Online' : 'Offline'}
                    </span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        </div>

        <!-- 3. APP THEME & PREFERENCES -->
        <div style="margin-top:1.2rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:1rem;">
            <div style="font-size:0.85rem; color:#cbd5e1; font-weight:600; margin-bottom:0.75rem;">
                <i class="fa-solid fa-sliders"></i> App Preferences
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                <span style="font-size:0.85rem; color:#94a3b8;">Theme Color Scheme</span>
                <select id="settings-theme" onchange="toggleAppTheme(this.value)" style="background:#1e293b; border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 10px; border-radius:8px; font-size:0.82rem;">
                    <option value="dark" ${localStorage.getItem('theme') !== 'light' ? 'selected' : ''}>🌙 Dark Mode</option>
                    <option value="light" ${localStorage.getItem('theme') === 'light' ? 'selected' : ''}>☀️ Light Mode</option>
                </select>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.85rem; color:#94a3b8;">Pop-up Alert Toasts</span>
                <select id="settings-toasts" onchange="localStorage.setItem('toasts', this.value)" style="background:#1e293b; border:1px solid rgba(255,255,255,0.2); color:white; padding:4px 10px; border-radius:8px; font-size:0.82rem;">
                    <option value="on" ${localStorage.getItem('toasts') !== 'off' ? 'selected' : ''}>Enabled</option>
                    <option value="off" ${localStorage.getItem('toasts') === 'off' ? 'selected' : ''}>Disabled</option>
                </select>
            </div>
        </div>

        <!-- 4. LOGOUT & FOOTER -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.2rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:0.75rem; color:#64748b;">TripoNext v2.5 Mobile • Gemini AI Powered</span>
            <button onclick="logout()" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:8px; padding:0.4rem 0.9rem; font-size:0.82rem; font-weight:600; cursor:pointer;">
                <i class="fa-solid fa-right-from-bracket"></i> Log Out
            </button>
        </div>
    </div>
    `;

    modal.style.display = 'flex';
};

window.closeGlobalSettings = function() {
    const modal = document.getElementById('settings-hub-modal');
    if (modal) modal.style.display = 'none';
};

window.toggleEditProfileView = function() {
    const form = document.getElementById('edit-profile-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
};

window.selectAvatar = function(avatarId, emoji) {
    document.getElementById('edit-avatar-val').value = avatarId;
    const avatarDisplay = document.getElementById('profile-avatar-display');
    if (avatarDisplay) avatarDisplay.textContent = emoji;
    showAppToast(`Avatar updated to ${emoji}!`, 'success');
};

window.saveProfileChanges = async function() {
    const name = document.getElementById('edit-name').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();
    const home_city = document.getElementById('edit-city').value.trim();
    const travel_style = document.getElementById('edit-style').value;
    const bio = document.getElementById('edit-bio').value.trim();
    const avatar = document.getElementById('edit-avatar-val').value;

    const token = localStorage.getItem('token');
    const updatedData = { name, phone, home_city, travel_style, bio, avatar };

    try {
        const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(updatedData)
        });
        if (res.ok) {
            _userProfileCache = { ...(_userProfileCache || {}), ...updatedData };
            // Update local user storage
            const localUser = JSON.parse(localStorage.getItem('user')) || {};
            localUser.name = name;
            localStorage.setItem('user', JSON.stringify(localUser));

            // Update UI elements
            const nameEl = document.getElementById('profile-name-display');
            if (nameEl) nameEl.textContent = name;
            const topUserSpan = document.querySelector('.user-profile span');
            if (topUserSpan) topUserSpan.textContent = name;

            showAppToast('Profile updated successfully! ✨', 'success');
            toggleEditProfileView();
        } else {
            showAppToast('Failed to save profile changes.', 'error');
        }
    } catch (e) {
        console.warn('Saving profile offline:', e);
        _userProfileCache = { ...(_userProfileCache || {}), ...updatedData };
        showAppToast('Profile saved in local storage! ✨', 'success');
        toggleEditProfileView();
    }
};

window.toggleAppTheme = function(theme) {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    showAppToast(`Switched to ${theme === 'light' ? 'Light' : 'Dark'} theme!`, 'info');
};

// ========================================================
// REFER & EARN MODAL
// ========================================================
window.openReferEarnModal = async function() {
    let data = { referral_code: "TRIP-7492", referral_credits: 500, per_invite_bonus: 250 };
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/user/referrals', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) data = await res.json();
    } catch (e) {}

    let subModal = document.getElementById('sub-feature-modal');
    if (!subModal) {
        subModal = document.createElement('div');
        subModal.id = 'sub-feature-modal';
        subModal.className = 'modal-overlay';
        document.body.appendChild(subModal);
    }

    subModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:500px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-gift" style="color:#c084fc"></i> Refer & Earn
            </h3>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <div class="refer-earn-box">
            <div style="font-size:2.4rem; margin-bottom:0.4rem;">🎁</div>
            <h4 style="margin:0; font-size:1.2rem; color:#fff;">Invite Friends, Travel for Free</h4>
            <p style="margin:6px 0; color:#cbd5e1; font-size:0.85rem;">
                Share your personal code. You both receive <strong>₹250</strong> when your buddy signs up and explores!
            </p>
            
            <div class="referral-code-pill" onclick="copyReferralCode('${data.referral_code}')" title="Tap to copy">
                <span>${data.referral_code}</span>
                <i class="fa-regular fa-copy"></i>
            </div>
            
            <div style="display:flex; gap:8px; justify-content:center; margin-top:0.8rem;">
                <button onclick="copyReferralCode('${data.referral_code}')" class="btn-small btn-primary" style="flex:1;">
                    <i class="fa-solid fa-copy"></i> Copy Code
                </button>
                <button onclick="shareReferralLink('${data.referral_code}')" class="btn-small" style="flex:1; background:linear-gradient(135deg, #8b5cf6, #3b82f6); color:white; border:none;">
                    <i class="fa-solid fa-share-nodes"></i> Share Link
                </button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-top:1rem;">
            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:0.8rem;">
                <div style="font-size:0.75rem; color:#94a3b8;">Wallet Credits</div>
                <div style="font-size:1.4rem; font-weight:800; color:#10b981;">₹${data.referral_credits}</div>
            </div>
            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:0.8rem;">
                <div style="font-size:0.75rem; color:#94a3b8;">Buddies Invited</div>
                <div style="font-size:1.4rem; font-weight:800; color:#38bdf8;">${data.friends_invited || 2}</div>
            </div>
        </div>
    </div>
    `;
    subModal.style.display = 'flex';
};

window.copyReferralCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAppToast(`Referral Code ${code} copied to clipboard! 📋`, 'success');
    });
};

window.shareReferralLink = function(code) {
    const shareData = {
        title: 'Join me on TripoNext!',
        text: `Hey! Plan dream trips and split travel costs with me on TripoNext. Use my code ${code} for ₹250 free credits!`,
        url: window.location.origin + `/login.html?ref=${code}`
    };
    if (navigator.share) {
        navigator.share(shareData).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareData.url).then(() => {
            showAppToast('Invite link copied! Share it anywhere.', 'success');
        });
    }
};

// ========================================================
// FEEDBACK & RATING MODAL
// ========================================================
let _selectedRating = 5;

window.openFeedbackModal = function() {
    let subModal = document.getElementById('sub-feature-modal');
    if (!subModal) {
        subModal = document.createElement('div');
        subModal.id = 'sub-feature-modal';
        subModal.className = 'modal-overlay';
        document.body.appendChild(subModal);
    }

    _selectedRating = 5;
    subModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-star" style="color:#eab308"></i> Feedback & Rating
            </h3>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <p style="margin:0 0 1rem 0; color:#cbd5e1; font-size:0.85rem; text-align:center;">
            Your feedback shapes TripoNext! How has your travel planning experience been?
        </p>

        <!-- Star Rating -->
        <div class="rating-stars-container" id="stars-row">
            <span class="rating-star-icon active" onclick="setStarRating(1)">★</span>
            <span class="rating-star-icon active" onclick="setStarRating(2)">★</span>
            <span class="rating-star-icon active" onclick="setStarRating(3)">★</span>
            <span class="rating-star-icon active" onclick="setStarRating(4)">★</span>
            <span class="rating-star-icon active" onclick="setStarRating(5)">★</span>
        </div>
        <div id="star-desc" style="text-align:center; color:#eab308; font-size:0.85rem; font-weight:600; margin-bottom:1rem;">
            Excellent! (5/5)
        </div>

        <!-- Feedback Category -->
        <div style="margin-bottom:0.8rem;">
            <label style="font-size:0.78rem; color:#cbd5e1; display:block; margin-bottom:4px;">Category</label>
            <select id="feedback-cat" style="width:100%; padding:0.65rem 0.8rem; border-radius:10px; background:#1e293b; border:1px solid rgba(255,255,255,0.15); color:white; outline:none;">
                <option value="Overall App Experience">Overall App Experience</option>
                <option value="AI Itinerary Generator">AI Itinerary Generator</option>
                <option value="Hotel & Cab Bookings">Hotel & Cab Bookings</option>
                <option value="Find Buddies Feature">Find Buddies Feature</option>
                <option value="Report an Issue or Bug">Report an Issue or Bug</option>
                <option value="New Feature Request">New Feature Request</option>
            </select>
        </div>

        <!-- Comments Textarea -->
        <div style="margin-bottom:1rem;">
            <label style="font-size:0.78rem; color:#cbd5e1; display:block; margin-bottom:4px;">Your Comments & Suggestions</label>
            <textarea id="feedback-comments" rows="3" placeholder="Tell us what you loved or what we can improve..." style="width:100%; padding:0.7rem; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:white; outline:none; resize:none; font-family:inherit;"></textarea>
        </div>

        <button onclick="submitUserFeedback()" class="btn-primary" style="width:100%; padding:0.75rem; border-radius:12px; font-weight:700; border:none; cursor:pointer;">
            <i class="fa-solid fa-paper-plane"></i> Submit Feedback
        </button>
    </div>
    `;
    subModal.style.display = 'flex';
};

window.setStarRating = function(rating) {
    _selectedRating = rating;
    const stars = document.querySelectorAll('#stars-row .rating-star-icon');
    stars.forEach((star, idx) => {
        if (idx < rating) star.classList.add('active');
        else star.classList.remove('active');
    });
    const labels = ["Poor (1/5)", "Fair (2/5)", "Good (3/5)", "Very Good (4/5)", "Excellent (5/5)"];
    document.getElementById('star-desc').textContent = labels[rating - 1];
};

window.submitUserFeedback = async function() {
    const category = document.getElementById('feedback-cat').value;
    const comment = document.getElementById('feedback-comments').value.trim();
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Traveler' };

    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: user.name,
                rating: _selectedRating,
                category,
                comment
            })
        });
    } catch (e) {
        console.warn('Feedback saved locally fallback:', e);
    }

    showAppToast('Thank you! Your feedback and rating have been recorded. 🎉', 'success');
    document.getElementById('sub-feature-modal').style.display = 'none';
};

// ========================================================
// OFFERS & DISCOUNTS MODAL
// ========================================================
window.openOffersModal = async function() {
    let offers = [
        { code: 'AIRFLY25', title: 'Flat 25% OFF Flights', desc: 'Up to ₹2,500 on all domestic & intl routes.', type: 'flight' },
        { code: 'STAYLUXE', title: 'Flat ₹1,500 OFF Hotels', desc: 'Valid on 4-star & 5-star luxury resorts.', type: 'hotel' },
        { code: 'CABSAFE', title: '20% OFF Cabs', desc: 'Instant discount on city & outstation cabs.', type: 'cab' },
        { code: 'BUSWAY150', title: 'Flat ₹150 OFF Volvo Buses', desc: 'Save on all AC Volvo sleeper bus seats.', type: 'bus' },
        { code: 'TRIPNEXT500', title: '₹500 Welcome Voucher', desc: 'Special signup bonus voucher across any booking.', type: 'general' }
    ];

    try {
        const res = await fetch('/api/offers');
        if (res.ok) {
            const json = await res.json();
            if (json.offers) offers = json.offers;
        }
    } catch (e) {}

    let subModal = document.getElementById('sub-feature-modal');
    if (!subModal) {
        subModal = document.createElement('div');
        subModal.id = 'sub-feature-modal';
        subModal.className = 'modal-overlay';
        document.body.appendChild(subModal);
    }

    let cardsHTML = '';
    offers.forEach(o => {
        const icon = o.type === 'flight' ? 'fa-plane' : o.type === 'hotel' ? 'fa-hotel' : o.type === 'cab' ? 'fa-taxi' : o.type === 'bus' ? 'fa-bus' : 'fa-tag';
        cardsHTML += `
        <div class="offer-coupon-card">
            <div>
                <div style="font-weight:700; color:#fff; font-size:0.95rem; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid ${icon}" style="color:var(--primary)"></i> ${o.title}
                </div>
                <div style="font-size:0.78rem; color:#94a3b8; margin:3px 0;">${o.desc}</div>
                <span style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); padding:2px 8px; border-radius:6px; font-family:monospace; font-weight:700; color:#fbbf24; font-size:0.8rem;">
                    ${o.code}
                </span>
            </div>
            <button onclick="copyOfferCode('${o.code}')" style="background:var(--primary); color:white; border:none; padding:0.45rem 0.9rem; border-radius:8px; font-weight:600; font-size:0.75rem; cursor:pointer;">
                Copy Code
            </button>
        </div>
        `;
    });

    subModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:520px; max-height:85vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-percent" style="color:#ec4899"></i> Exclusive Travel Deals & Coupons
            </h3>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        <div style="margin-bottom:0.8rem; font-size:0.82rem; color:#cbd5e1;">
            Apply these verified coupon codes during checkout in our Bookings Hub to save big!
        </div>
        ${cardsHTML}
    </div>
    `;
    subModal.style.display = 'flex';
};

window.copyOfferCode = function(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAppToast(`Promo Code ${code} copied! Applied to your booking. 🎟️`, 'success');
    });
};

// ========================================================
// HELP & SUPPORT MODAL
// ========================================================
window.openHelpSupportModal = async function() {
    let faqs = [
        { q: "How do I cancel or reschedule my hotel or flight booking?", a: "Go to Profile > My Trips or Bookings Hub, select the booking, and tap 'Cancel Booking'. Free cancellations are processed automatically within 2-4 business days." },
        { q: "How does Offline Mode work without internet?", a: "When you have internet, save any plan. The app stores all details locally on your phone so you can view it even in airplane mode." },
        { q: "How do I clear cached offline trips if old data is showing?", a: "Open Profile > Offline Mode & Cache Manager, and tap 'Clear Offline Cache'. This purges all old cached records and syncs fresh data from the cloud." },
        { q: "How does the Refer and Earn program reward me?", a: "Share your referral code. When your friend joins, both of you get ₹250 wallet credits instantly." }
    ];

    try {
        const res = await fetch('/api/support/faqs');
        if (res.ok) {
            const json = await res.json();
            if (json.faqs) faqs = json.faqs;
        }
    } catch (e) {}

    let subModal = document.getElementById('sub-feature-modal');
    if (!subModal) {
        subModal = document.createElement('div');
        subModal.id = 'sub-feature-modal';
        subModal.className = 'modal-overlay';
        document.body.appendChild(subModal);
    }

    let faqHTML = '';
    faqs.forEach((f, idx) => {
        faqHTML += `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:0.8rem 1rem; margin-bottom:0.6rem;">
            <div style="font-weight:600; color:#fff; font-size:0.88rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                <span>❓ ${f.q}</span>
                <i class="fa-solid fa-chevron-down" style="font-size:0.75rem; color:#94a3b8;"></i>
            </div>
            <div style="display:none; margin-top:0.5rem; font-size:0.8rem; color:#cbd5e1; line-height:1.45; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.4rem;">
                ${f.a}
            </div>
        </div>
        `;
    });

    subModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:540px; max-height:85vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-headset" style="color:#34d399"></i> Help & Support Center
            </h3>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <!-- 24/7 Support Channels -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-bottom:1.2rem;">
            <div onclick="document.getElementById('sub-feature-modal').style.display='none'; toggleChatbot();" style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.25); border-radius:14px; padding:1rem; text-align:center; cursor:pointer;">
                <i class="fa-solid fa-robot" style="font-size:1.6rem; color:#38bdf8; margin-bottom:6px;"></i>
                <div style="font-weight:700; color:#fff; font-size:0.9rem;">AI Travel Assistant</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Instant 24x7 Answers</div>
            </div>
            <a href="mailto:support@triponext.com?subject=TripoNext%20Support%20Request" style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); border-radius:14px; padding:1rem; text-align:center; text-decoration:none; cursor:pointer;">
                <i class="fa-regular fa-envelope" style="font-size:1.6rem; color:#34d399; margin-bottom:6px;"></i>
                <div style="font-weight:700; color:#fff; font-size:0.9rem;">Email Support</div>
                <div style="font-size:0.75rem; color:#94a3b8;">support@triponext.com</div>
            </a>
        </div>

        <h4 style="margin:0 0 0.6rem 0; font-size:0.95rem; color:#fff;">Frequently Asked Questions</h4>
        ${faqHTML}

        <!-- Quick Ticket Form -->
        <div style="margin-top:1.2rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:1rem;">
            <div style="font-weight:700; color:#fff; font-size:0.9rem; margin-bottom:0.6rem;">Send Support Message</div>
            <input type="text" id="ticket-subject" placeholder="Issue Subject (e.g., Booking problem)" style="width:100%; padding:0.6rem; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:white; margin-bottom:0.6rem; outline:none; font-size:0.85rem;">
            <textarea id="ticket-message" rows="2" placeholder="Describe how we can help you..." style="width:100%; padding:0.6rem; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:white; outline:none; resize:none; font-family:inherit; font-size:0.85rem; margin-bottom:0.6rem;"></textarea>
            <button onclick="submitSupportTicket()" class="btn-small btn-primary" style="width:100%;">
                <i class="fa-solid fa-paper-plane"></i> Submit Support Ticket
            </button>
        </div>
    </div>
    `;
    subModal.style.display = 'flex';
};

window.submitSupportTicket = async function() {
    const subject = document.getElementById('ticket-subject').value.trim();
    const message = document.getElementById('ticket-message').value.trim();
    if (!message) {
        showAppToast('Please enter your support message.', 'error');
        return;
    }
    const user = JSON.parse(localStorage.getItem('user')) || { name: 'Traveler', email: 'user@triponext.com' };

    try {
        await fetch('/api/support/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: user.name, email: user.email, subject, message })
        });
    } catch(e) {}

    showAppToast('Support Ticket submitted! Our team will respond shortly. 💬', 'success');
    document.getElementById('sub-feature-modal').style.display = 'none';
};

// ========================================================
// OFFLINE MANAGER & CACHE CLEARING
// (Solves: "Offine wala mein data dikha rha hai Isha change krna hai")
// ========================================================
window.openOfflineManager = function() {
    const isOnline = navigator.onLine;
    const localTrips = JSON.parse(localStorage.getItem('localTrips') || '[]');

    let subModal = document.getElementById('sub-feature-modal');
    if (!subModal) {
        subModal = document.createElement('div');
        subModal.id = 'sub-feature-modal';
        subModal.className = 'modal-overlay';
        document.body.appendChild(subModal);
    }

    subModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-wifi" style="color:var(--primary)"></i> Offline Mode & Cache Manager
            </h3>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <div class="offline-status-card ${isOnline ? 'is-online' : ''}">
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid ${isOnline ? 'fa-signal' : 'fa-plane-slash'}" style="font-size:1.4rem; color:${isOnline ? '#10b981' : '#ef4444'};"></i>
                <div>
                    <div style="font-weight:700; color:#fff;">Network Status: ${isOnline ? 'Connected (Online)' : 'No Internet (Offline)'}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${isOnline ? 'Live cloud sync active with servers' : 'Serving only explicitly saved itineraries'}</div>
                </div>
            </div>
        </div>

        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:1rem; margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                <span style="font-size:0.85rem; color:#cbd5e1;">Cached Offline Trips</span>
                <span style="background:rgba(249,115,22,0.2); color:var(--primary); font-weight:700; padding:2px 8px; border-radius:10px; font-size:0.8rem;">
                    ${localTrips.length} Saved
                </span>
            </div>
            <p style="margin:0; font-size:0.78rem; color:#94a3b8; line-height:1.4;">
                TripoNext allows viewing saved itineraries without cellular connectivity. If old test trips or stale data are displaying, purge the offline cache below.
            </p>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.6rem;">
            <button onclick="clearOfflineCache()" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); color:#f87171; padding:0.75rem; border-radius:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <i class="fa-solid fa-trash-can"></i> Clear All Offline Cached Data
            </button>
            <button onclick="document.getElementById('sub-feature-modal').style.display='none'" class="btn-small" style="background:rgba(255,255,255,0.1); color:white; border:none; padding:0.7rem; border-radius:12px; cursor:pointer;">
                Done
            </button>
        </div>
    </div>
    `;
    subModal.style.display = 'flex';
};

window.clearOfflineCache = function() {
    // 1. Purge localTrips
    localStorage.removeItem('localTrips');
    localStorage.removeItem('tripExpenses');
    
    // 2. Clear Service Worker cache if supported
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ action: 'CLEAR_OFFLINE_CACHE' });
    }
    if ('caches' in window) {
        caches.keys().then(keys => {
            keys.forEach(k => caches.delete(k));
        });
    }

    showAppToast('Offline cached data cleared! Fresh data will load now. 🧹', 'success');
    
    const subModal = document.getElementById('sub-feature-modal');
    if (subModal) subModal.style.display = 'none';

    // If on mytrips.html, reload trips
    if (typeof loadTrips === 'function') {
        loadTrips();
    }
};

// ========================================================
// TRAVEL & TRANSIT BOOKINGS HUB (Hotels, Cabs, Flights, Buses)
// ========================================================
let _currentBookingTab = 'hotels';

window.openBookingsHub = function(activeTab = 'hotels') {
    _currentBookingTab = activeTab;
    let modal = document.getElementById('bookings-hub-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'bookings-hub-modal';
        modal.className = 'booking-hub-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
    <div class="booking-modal-content">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="margin:0; color:#fff; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-plane-departure" style="color:var(--primary)"></i> Travel & Bookings Hub
            </h3>
            <button onclick="closeBookingsHub()" style="background:none; border:none; color:#94a3b8; font-size:1.3rem; cursor:pointer;">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>

        <!-- 4 Transit Tabs -->
        <div class="booking-nav-tabs">
            <button class="booking-tab-btn ${_currentBookingTab === 'hotels' ? 'active' : ''}" onclick="switchBookingTab('hotels')">
                <i class="fa-solid fa-hotel"></i>
                <span>Hotels</span>
            </button>
            <button class="booking-tab-btn ${_currentBookingTab === 'cabs' ? 'active' : ''}" onclick="switchBookingTab('cabs')">
                <i class="fa-solid fa-taxi"></i>
                <span>Cabs</span>
            </button>
            <button class="booking-tab-btn ${_currentBookingTab === 'flights' ? 'active' : ''}" onclick="switchBookingTab('flights')">
                <i class="fa-solid fa-plane"></i>
                <span>Flights</span>
            </button>
            <button class="booking-tab-btn ${_currentBookingTab === 'buses' ? 'active' : ''}" onclick="switchBookingTab('buses')">
                <i class="fa-solid fa-bus"></i>
                <span>Buses</span>
            </button>
        </div>

        <!-- Tab Content Container -->
        <div id="booking-tab-content">
            <div style="text-align:center; padding:2rem; color:#94a3b8;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i>
                <div style="margin-top:8px;">Fetching best travel fares...</div>
            </div>
        </div>
    </div>
    `;

    modal.style.display = 'flex';
    renderBookingTabContent(_currentBookingTab);
};

window.closeBookingsHub = function() {
    const modal = document.getElementById('bookings-hub-modal');
    if (modal) modal.style.display = 'none';
};

window.switchBookingTab = function(tab) {
    _currentBookingTab = tab;
    const buttons = document.querySelectorAll('.booking-tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
    renderBookingTabContent(tab);
};

async function renderBookingTabContent(tab) {
    const container = document.getElementById('booking-tab-content');
    if (!container) return;

    if (tab === 'hotels') {
        const destInput = document.getElementById('destination-input');
        const defaultCity = (destInput && destInput.value.trim()) || "Manali";
        
        container.innerHTML = `
        <div class="booking-filter-bar">
            <input type="text" id="hotel-city-input" class="booking-filter-input" placeholder="City / Destination" value="${defaultCity}">
            <button onclick="fetchHotelResults()" class="btn-primary" style="padding:0.65rem 1.2rem; border-radius:10px; border:none; cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i> Search
            </button>
        </div>
        <div id="hotels-results-list">
            <div style="text-align:center; padding:1.5rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Loading hotels...</div>
        </div>
        `;
        fetchHotelResults();
    } 
    else if (tab === 'cabs') {
        container.innerHTML = `
        <div class="booking-filter-bar">
            <input type="text" id="cab-pickup-input" class="booking-filter-input" placeholder="Pickup (e.g. Airport / Station)" value="Delhi Airport T3">
            <input type="text" id="cab-drop-input" class="booking-filter-input" placeholder="Drop Location" value="Connaught Place, Central Delhi">
            <button onclick="fetchCabResults()" class="btn-primary" style="padding:0.65rem 1.2rem; border-radius:10px; border:none; cursor:pointer;">
                <i class="fa-solid fa-magnifying-glass"></i> Find Cabs
            </button>
        </div>
        <div id="cabs-results-list">
            <div style="text-align:center; padding:1.5rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Finding nearby drivers...</div>
        </div>
        `;
        fetchCabResults();
    }
    else if (tab === 'flights') {
        container.innerHTML = `
        <div class="booking-filter-bar">
            <input type="text" id="flight-from-input" class="booking-filter-input" placeholder="From (e.g. DEL)" value="DEL">
            <input type="text" id="flight-to-input" class="booking-filter-input" placeholder="To (e.g. BOM)" value="BOM">
            <button onclick="fetchFlightResults()" class="btn-primary" style="padding:0.65rem 1.2rem; border-radius:10px; border:none; cursor:pointer;">
                <i class="fa-solid fa-plane"></i> Search
            </button>
        </div>
        <div id="flights-results-list">
            <div style="text-align:center; padding:1.5rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Searching best airline rates...</div>
        </div>
        `;
        fetchFlightResults();
    }
    else if (tab === 'buses') {
        container.innerHTML = `
        <div class="booking-filter-bar">
            <input type="text" id="bus-from-input" class="booking-filter-input" placeholder="From City" value="Delhi">
            <input type="text" id="bus-to-input" class="booking-filter-input" placeholder="To City" value="Manali">
            <button onclick="fetchBusResults()" class="btn-primary" style="padding:0.65rem 1.2rem; border-radius:10px; border:none; cursor:pointer;">
                <i class="fa-solid fa-bus"></i> Find Buses
            </button>
        </div>
        <div id="buses-results-list">
            <div style="text-align:center; padding:1.5rem; color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching Volvo & Sleeper buses...</div>
        </div>
        `;
        fetchBusResults();
    }
}

// 1. Fetch Hotels
window.fetchHotelResults = async function() {
    const listEl = document.getElementById('hotels-results-list');
    const city = document.getElementById('hotel-city-input').value.trim() || 'Manali';
    try {
        const res = await fetch(`/api/bookings/hotels?city=${encodeURIComponent(city)}`);
        const data = await res.json();
        const hotels = data.hotels || [];

        let html = '';
        hotels.forEach(h => {
            const amenitiesPills = (h.amenities || []).slice(0, 3).map(a => `<span style="background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:6px; font-size:0.72rem; color:#cbd5e1;">✓ ${a}</span>`).join('');
            html += `
            <div class="booking-item-card">
                <div class="booking-item-top">
                    <div>
                        <div style="font-weight:700; color:#fff; font-size:1rem;">${h.name}</div>
                        <div style="font-size:0.78rem; color:#94a3b8; margin:2px 0;">📍 ${h.address}</div>
                        <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
                            <span style="background:#10b981; color:white; padding:1px 6px; border-radius:4px; font-size:0.75rem; font-weight:700;">★ ${h.rating}</span>
                            <span style="font-size:0.75rem; color:#64748b;">(${h.reviewsCount} verified reviews)</span>
                        </div>
                    </div>
                    <span style="background:rgba(234,179,8,0.15); border:1px solid rgba(234,179,8,0.3); color:#facc15; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:700;">
                        ${h.tag}
                    </span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${amenitiesPills}
                </div>
                <div class="booking-item-bottom">
                    <div>
                        <span class="booking-price">₹${h.pricePerNight.toLocaleString()}</span>
                        <span style="font-size:0.75rem; color:#94a3b8;"> / night</span>
                    </div>
                    <button class="book-now-btn" onclick="confirmInstantBooking('hotel', '${h.name.replace(/'/g, "\\'")}', 'Room for 2 Guests', ${h.pricePerNight}, '${city}')">
                        Book Room
                    </button>
                </div>
            </div>
            `;
        });
        listEl.innerHTML = html;
    } catch (e) {
        listEl.innerHTML = '<div style="color:#ef4444; padding:1rem; text-align:center;">Failed to load hotels. Check internet connection.</div>';
    }
};

// 2. Fetch Cabs
window.fetchCabResults = async function() {
    const listEl = document.getElementById('cabs-results-list');
    const pickup = document.getElementById('cab-pickup-input').value.trim() || 'Current Location';
    const drop = document.getElementById('cab-drop-input').value.trim() || 'Destination';

    try {
        const res = await fetch(`/api/bookings/cabs?pickup=${encodeURIComponent(pickup)}&drop=${encodeURIComponent(drop)}`);
        const data = await res.json();
        const cabs = data.cabs || [];

        let html = '';
        cabs.forEach(c => {
            html += `
            <div class="booking-item-card">
                <div class="booking-item-top">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; font-size:1.4rem; color:${c.badgeColor};">
                            <i class="fa-solid ${c.icon}"></i>
                        </div>
                        <div>
                            <div style="font-weight:700; color:#fff; font-size:1rem;">${c.category} • <span style="font-size:0.85rem; color:#94a3b8; font-weight:normal;">${c.vehicle}</span></div>
                            <div style="font-size:0.75rem; color:#94a3b8;">${c.capacity} • <i class="fa-solid fa-clock" style="color:#38bdf8;"></i> ${c.eta}</div>
                        </div>
                    </div>
                    <span style="background:${c.badgeColor}22; border:1px solid ${c.badgeColor}55; color:${c.badgeColor}; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:700;">
                        ${c.tag}
                    </span>
                </div>
                <div class="booking-item-bottom">
                    <div>
                        <span class="booking-price">₹${c.estimatedFare}</span>
                        <span style="font-size:0.75rem; color:#94a3b8;"> (₹${c.perKm}/km)</span>
                    </div>
                    <button class="book-now-btn" onclick="confirmInstantBooking('cab', '${c.category} (${c.vehicle})', '${pickup} to ${drop}', ${c.estimatedFare}, '${drop}')">
                        Book Cab
                    </button>
                </div>
            </div>
            `;
        });
        listEl.innerHTML = html;
    } catch(e) {
        listEl.innerHTML = '<div style="color:#ef4444; padding:1rem; text-align:center;">Failed to load cabs. Check connection.</div>';
    }
};

// 3. Fetch Flights
window.fetchFlightResults = async function() {
    const listEl = document.getElementById('flights-results-list');
    const from = document.getElementById('flight-from-input').value.trim() || 'DEL';
    const to = document.getElementById('flight-to-input').value.trim() || 'BOM';

    try {
        const res = await fetch(`/api/bookings/flights?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        const data = await res.json();
        const flights = data.flights || [];

        let html = '';
        flights.forEach(f => {
            html += `
            <div class="booking-item-card">
                <div class="booking-item-top">
                    <div>
                        <div style="font-weight:700; color:#fff; font-size:1rem; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-plane" style="color:#38bdf8"></i> ${f.airline} • <span style="font-size:0.8rem; color:#94a3b8;">${f.flightNumber}</span>
                        </div>
                        <div style="font-size:0.85rem; color:#cbd5e1; margin-top:4px; font-weight:600;">
                            ${f.departureTime} (${f.origin}) ➔ ${f.arrivalTime} (${f.destination})
                        </div>
                        <div style="font-size:0.75rem; color:#94a3b8;">${f.duration} • ${f.stops} • ${f.baggage}</div>
                    </div>
                    <span style="background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:700;">
                        ${f.tag}
                    </span>
                </div>
                <div class="booking-item-bottom">
                    <div>
                        <span class="booking-price">₹${f.price.toLocaleString()}</span>
                        <span style="font-size:0.75rem; color:#94a3b8;"> / passenger</span>
                    </div>
                    <button class="book-now-btn" onclick="confirmInstantBooking('flight', '${f.airline} ${f.flightNumber}', '${f.origin} to ${f.destination} (${f.departureTime})', ${f.price}, '${to}')">
                        Book Flight
                    </button>
                </div>
            </div>
            `;
        });
        listEl.innerHTML = html;
    } catch(e) {
        listEl.innerHTML = '<div style="color:#ef4444; padding:1rem; text-align:center;">Failed to load flights.</div>';
    }
};

// 4. Fetch Buses
window.fetchBusResults = async function() {
    const listEl = document.getElementById('buses-results-list');
    const from = document.getElementById('bus-from-input').value.trim() || 'Delhi';
    const to = document.getElementById('bus-to-input').value.trim() || 'Manali';

    try {
        const res = await fetch(`/api/bookings/buses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        const data = await res.json();
        const buses = data.buses || [];

        let html = '';
        buses.forEach(b => {
            html += `
            <div class="booking-item-card">
                <div class="booking-item-top">
                    <div>
                        <div style="font-weight:700; color:#fff; font-size:1rem; display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-bus" style="color:var(--primary)"></i> ${b.operator}
                        </div>
                        <div style="font-size:0.78rem; color:#94a3b8; margin:2px 0;">${b.busType}</div>
                        <div style="font-size:0.85rem; color:#cbd5e1; font-weight:600;">
                            ${b.departureTime} (${from}) ➔ ${b.arrivalTime} (${to})
                        </div>
                        <div style="font-size:0.75rem; color:#94a3b8;">${b.duration} • 💺 ${b.seatsAvailable} seats left • ★ ${b.rating}</div>
                    </div>
                    <span style="background:rgba(249,115,22,0.15); border:1px solid rgba(249,115,22,0.3); color:var(--primary); padding:2px 8px; border-radius:12px; font-size:0.72rem; font-weight:700;">
                        ${b.tag}
                    </span>
                </div>
                <div class="booking-item-bottom">
                    <div>
                        <span class="booking-price">₹${b.price.toLocaleString()}</span>
                        <span style="font-size:0.75rem; color:#94a3b8;"> / seat</span>
                    </div>
                    <button class="book-now-btn" onclick="confirmInstantBooking('bus', '${b.operator}', '${from} to ${to} (${b.departureTime})', ${b.price}, '${to}')">
                        Book Seat
                    </button>
                </div>
            </div>
            `;
        });
        listEl.innerHTML = html;
    } catch(e) {
        listEl.innerHTML = '<div style="color:#ef4444; padding:1rem; text-align:center;">Failed to load buses.</div>';
    }
};

// 5. Confirm Instant Booking with Digital Ticket
window.confirmInstantBooking = async function(type, title, subtitle, price, destination) {
    const token = localStorage.getItem('token');
    let bookingResult = {
        booking_ref: `${type.toUpperCase().slice(0,3)}-${Math.floor(100000 + Math.random()*900000)}`,
        status: 'Confirmed'
    };

    try {
        const res = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                type,
                title,
                subtitle,
                price,
                destination: destination || 'Trip Destination'
            })
        });
        if (res.ok) {
            bookingResult = await res.json();
        }
    } catch (e) {
        console.warn('Booking offline simulated:', e);
    }

    // Persist to local bookings storage so it appears immediately on My Trips
    try {
        const localBookings = JSON.parse(localStorage.getItem('myBookings') || '[]');
        localBookings.unshift({
            id: bookingResult.id || Date.now(),
            booking_ref: bookingResult.booking_ref,
            type,
            title,
            item_name: title,
            subtitle: subtitle || '',
            price: Number(price),
            date: new Date().toISOString().split('T')[0],
            status: 'Confirmed'
        });
        localStorage.setItem('myBookings', JSON.stringify(localBookings));
    } catch(e) {}

    // Display Digital Boarding Pass / Ticket Voucher
    let ticketModal = document.getElementById('ticket-voucher-modal');
    if (!ticketModal) {
        ticketModal = document.createElement('div');
        ticketModal.id = 'ticket-voucher-modal';
        ticketModal.className = 'modal-overlay';
        ticketModal.style.zIndex = '9998';
        document.body.appendChild(ticketModal);
    }

    const typeEmoji = type === 'hotel' ? '🏨' : type === 'cab' ? '🚕' : type === 'flight' ? '✈️' : '🚌';

    ticketModal.innerHTML = `
    <div class="modal-content glassmorphism" style="max-width:480px; text-align:center;">
        <div style="font-size:3rem; margin-bottom:0.5rem; animation: bounce 0.6s ease;">🎉</div>
        <h3 style="margin:0; color:#fff; font-size:1.3rem;">Booking Confirmed!</h3>
        <p style="margin:4px 0 1rem 0; color:#10b981; font-weight:700; font-size:0.9rem;">
            <i class="fa-solid fa-circle-check"></i> E-Ticket Voucher Issued
        </p>

        <div class="booking-ticket-card">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.2); padding-bottom:0.6rem; margin-bottom:0.8rem;">
                <span style="font-size:0.8rem; text-transform:uppercase; color:var(--primary); font-weight:800; letter-spacing:1px;">TripoNext E-Ticket</span>
                <span style="font-family:monospace; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:6px; font-weight:700; color:#fbbf24; font-size:0.85rem;">
                    PNR: ${bookingResult.booking_ref}
                </span>
            </div>
            
            <div style="text-align:left; margin-bottom:0.8rem;">
                <div style="font-size:1.1rem; font-weight:700; color:#fff;">${typeEmoji} ${title}</div>
                <div style="font-size:0.82rem; color:#94a3b8; margin-top:3px;">${subtitle}</div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:0.6rem 0.8rem; border-radius:10px;">
                <div style="text-align:left;">
                    <div style="font-size:0.72rem; color:#94a3b8;">Total Paid</div>
                    <div style="font-size:1.15rem; font-weight:800; color:#10b981;">₹${price.toLocaleString()}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.72rem; color:#94a3b8;">Status</div>
                    <div style="font-size:0.85rem; font-weight:700; color:#38bdf8;">✓ Confirmed</div>
                </div>
            </div>
        </div>

        <div style="display:flex; gap:8px;">
            <button onclick="document.getElementById('ticket-voucher-modal').style.display='none'; closeBookingsHub(); window.location.href='mytrips.html';" class="btn-small btn-primary" style="flex:1;">
                <i class="fa-solid fa-suitcase"></i> View in My Trips
            </button>
            <button onclick="document.getElementById('ticket-voucher-modal').style.display='none';" class="btn-small" style="background:rgba(255,255,255,0.12); color:white; border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer;">
                Done
            </button>
        </div>
    </div>
    `;

    ticketModal.style.display = 'flex';
    showAppToast(`Booking ${bookingResult.booking_ref} confirmed successfully! 🎫`, 'success');
};

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
    btn.onclick = () => {
        if (typeof toggleToolbox === 'function') toggleToolbox();
        else if (window.toggleToolbox) window.toggleToolbox();
    };
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
// 11. AI MAGIC ITINERARY MODAL (Interactive & Mobile-Ready)
// ========================================================

// Client-side authentic destination database (Zero failure guarantee)
const CLIENT_CURATED_TRIPS = {
    "goa": {
        vibe: "Tropical Beaches & Portuguese Heritage",
        summary: "A sun-soaked coastal adventure of golden shores, secret cliff viewpoints, iconic beach shacks, and vibrant Latin Quarter heritage walks.",
        days: [
            { day: 1, theme: "North Goa Coast, Sunset Cliffs & Seafood Feast", morning: { time: "09:00 AM", act: "Aguada Fort & Portuguese Lighthouse Walk", loc: "Candolim Coast", tip: "Rent a scooty early near Candolim (₹350/day) for easy coastal hopping." }, afternoon: { time: "01:30 PM", act: "Authentic Goan Fish Curry Thali & Kingfish Rawa Fry", loc: "Ritz Classic or Martin's Corner", tip: "Pair with chilled kokum sol kadhi for a refreshing local palate cleanser." }, evening: { time: "06:00 PM", act: "Sunset Cocktails at Thalassa Cliffside Lounge & Anjuna Market", loc: "Vagator Cliff Edge", tip: "Reach 30 mins before 6 PM for golden rays sinking into the Arabian Sea." } },
            { day: 2, theme: "Latin Quarter Heritage & Old Goa History", morning: { time: "08:30 AM", act: "UNESCO Basilica of Bom Jesus & Se Cathedral", loc: "Old Goa (Velha Goa)", tip: "Marvel at 400-year-old gilded baroque altars and marble relics." }, afternoon: { time: "01:00 PM", act: "Colorful Heritage Photography Walk in Fontainhas", loc: "Panjim Latin Quarter", tip: "Snap pastel yellow and indigo havelis; sample fresh bebinca at Viva Panjim." }, evening: { time: "06:30 PM", act: "Mandovi River Sunset Cruise with Live Konkani Music", loc: "Panjim Jetty Promenade", tip: "Enjoy traditional Goan folk performances against the sunset breeze." } },
            { day: 3, theme: "South Goa Serenity & Crescent Bay Kayaking", morning: { time: "08:00 AM", act: "Cabo de Rama Fort Secret Ocean Drop-off", loc: "Cabo de Rama, Canacona", tip: "Uncrowded dramatic ocean drop-off; bring drinking water." }, afternoon: { time: "01:30 PM", act: "Palolem Crescent Bay Kayaking & Beach Shack Lunch", loc: "Palolem Beach & Dropadi", tip: "Rent a double kayak for ₹300/hour to paddle out to quiet rocky islets." }, evening: { time: "06:30 PM", act: "Agonda Beach Stargazing Dinner & Bonfire", loc: "Agonda Beachfront", tip: "Peaceful turtle-nesting sanctuary; zero noise pollution, pure ocean sounds." } }
        ]
    },
    "manali": {
        vibe: "Snowy Alpine & Bohemian Mountain Charm",
        summary: "A thrilling Himalayan journey featuring ancient deodar pine forests, gushing river rapids, cozy bohemian cafés, and high-altitude mountain passes.",
        days: [
            { day: 1, theme: "Old Manali Bohemian Vibes & Pine Forests", morning: { time: "09:00 AM", act: "Hidimba Devi Temple & Ancient Pine Forest Walk", loc: "Dhungri Van Vihar", tip: "Built in 1553 with tiered wooden pagodas; friendly rabbits in the woods." }, afternoon: { time: "01:30 PM", act: "Wood-fired Pizza & Hot Ginger Lemon Honey Tea by River Rapids", loc: "Café 1947, Old Manali", tip: "Sit on the riverside wooden deck overlooking gushing clear stream waters." }, evening: { time: "06:00 PM", act: "Mall Road Stroll, Hot Steamed Momos & Woolen Shawl Shopping", loc: "The Mall, Manali", tip: "Buy certified Kullu handwoven shawls and dried Himalayan apricots." } },
            { day: 2, theme: "Atal Tunnel Engineering Marvel & Sissu Snow Valley", morning: { time: "08:00 AM", act: "Drive through the 9.02 km Atal Tunnel into Lahaul", loc: "Atal Tunnel Highway", tip: "Landscape dramatically transforms from lush green to snowy high-altitude peaks." }, afternoon: { time: "01:00 PM", act: "Hike to Frozen Sissu Waterfall & Riverside Maggi", loc: "Sissu, Lahaul Valley", tip: "Zip-lining over the glacial river is available here for ₹500 - ₹800." }, evening: { time: "06:00 PM", act: "Solang Valley Snow Point Fun & ATV Quad Riding", loc: "Solang Valley", tip: "Experience mountain quad rides and paragliding launch viewpoints." } },
            { day: 3, theme: "Jogini Waterfall Trek & Natural Sulphur Springs", morning: { time: "08:30 AM", act: "Apple Orchard Hike to Jogini Waterfall", loc: "Vashisht Village Trail", tip: "The top cascade offers mist spray and panoramic Beas valley views." }, afternoon: { time: "01:30 PM", act: "Natural Sulphur Hot Spring Bath & Hot Himachali Siddu", loc: "Vashisht Temple Baths", tip: "Natural warm mineral water relieves muscle fatigue from mountain walks." }, evening: { time: "06:30 PM", act: "Live Acoustic Night & Fresh Cinnamon Cookies", loc: "Dylan's Toasted & Roasted", tip: "Legendary cozy backpacker haven with famous warm chocolate cookies." } }
        ]
    },
    "jaipur": {
        vibe: "Royal Heritage & Vibrant Rajasthani Splendor",
        summary: "A grand royal expedition across the Pink City with majestic hilltop forts, vibrant artisan bazaars, regal palaces, and legendary Rajasthani delicacies.",
        days: [
            { day: 1, theme: "Pink City Landmarks & Street Gastronomy", morning: { time: "08:30 AM", act: "Sunrise Photography from Wind View Café facing Hawa Mahal", loc: "Badi Chaupar, Old Jaipur", tip: "Early morning sunlight illuminates the 953 honeycomb casements." }, afternoon: { time: "01:00 PM", act: "City Palace Courtyards, Peacock Gate & Jantar Mantar", loc: "City Palace Complex", tip: "Intricate colored glass and peacock feather motifs make incredible portraits." }, evening: { time: "06:00 PM", act: "Legendary Pyaaz Kachori & Thick Makhaniya Lassi Feast", loc: "Rawat Mishthan Bhandar", tip: "Crispy piping-hot onion kachori served with sweet tamarind chutney." } },
            { day: 2, theme: "Amer Fort Grandeur & Nahargarh Sunset Ridge", morning: { time: "08:30 AM", act: "Amer Fort Exploration & Sheesh Mahal (Mirror Palace)", loc: "Amer Fort Hilltop", tip: "A single candle light reflects across thousands of convex Belgian mirrors." }, afternoon: { time: "01:30 PM", act: "Panna Meena Ka Kund Stepwell & Royal Rajasthani Lunch", loc: "Amer Heritage Quarter", tip: "Symmetrical geometric steps make for world-famous photography." }, evening: { time: "05:30 PM", act: "Nahargarh Fort Sunset Ledge overlooking Glowing Pink City", loc: "Nahargarh Fort Ridge", tip: "Watch the entire pink city light up like golden embers beneath you." } },
            { day: 3, theme: "Albert Hall Museum & Rooftop Chai at Tapri", morning: { time: "09:30 AM", act: "Albert Hall Museum & Royal Weaponry Collection", loc: "Ram Niwas Garden", tip: "Feed the friendly pigeons in the grand open museum plaza." }, afternoon: { time: "01:30 PM", act: "Bapu Bazaar Blue Pottery & Bandhani Saree Shopping", loc: "Old City Bazaars", tip: "Politely bargain with shopkeepers; check for authentic block-prints." }, evening: { time: "06:30 PM", act: "Rooftop Chai & Hand-cut Nachos at Tapri Central", loc: "Tapri Central, C-Scheme", tip: "Trendy rooftop overlooking Central Park with artisanal chai in cutting glasses." } }
        ]
    },
    "paris": {
        vibe: "Haussmann Elegance & Romantic Boulevards",
        summary: "A timeless journey through romantic Parisian boulevards, world-class art collections, hidden hilltop bistros, and golden hour river views.",
        days: [
            { day: 1, theme: "Eiffel Tower Golden Hour & Seine River Cruise", morning: { time: "08:30 AM", act: "Sunrise Photography from Place du Trocadéro", loc: "Trocadéro Esplanade", tip: "Beat tourist crowds before 9 AM for unobstructed Eiffel Tower views." }, afternoon: { time: "01:30 PM", act: "Scenic 1-Hour Seine River Boat Cruise", loc: "Pont de l'Alma / Bateaux-Mouches", tip: "Glides past Notre-Dame, Musée d'Orsay, and historic stone bridges." }, evening: { time: "06:30 PM", act: "Montmartre Cobblestone Walk & Steak-Frites Dinner", loc: "Sacré-Cœur & Le Relais de l'Entrecôte", tip: "Watch street musicians on the steps of Sacré-Cœur with city views." } },
            { day: 2, theme: "World Art, Tuileries Gardens & Arc de Triomphe", morning: { time: "09:00 AM", act: "The Louvre Museum Treasures", loc: "Cour Napoléon Glass Pyramid", tip: "Enter via the underground Carrousel shopping mall entrance to skip outdoor queues." }, afternoon: { time: "01:30 PM", act: "Stroll through Jardin des Tuileries & Angelina Hot Chocolate", loc: "Rue de Rivoli", tip: "Order the famous thick African hot chocolate and Mont-Blanc pastry." }, evening: { time: "06:00 PM", act: "Arc de Triomphe Rooftop Golden Hour & Champs-Élysées Walk", loc: "Place Charles de Gaulle", tip: "Climb the 284 steps for 12 radiating grand avenue sunset views." } },
            { day: 3, theme: "Latin Quarter, Vintage Books & Wine by the Seine", morning: { time: "09:30 AM", act: "Shakespeare and Company Historic Bookstore", loc: "Latin Quarter / Rue de la Bûcherie", tip: "Browse ceiling-high antique books in the legendary 1920s literary haven." }, afternoon: { time: "01:30 PM", act: "Artisanal Falafel in Le Marais Trendy Quarter", loc: "L'As du Fallafel, Rue des Rosiers", tip: "Warm pita packed with fried eggplant, tahini, and crispy chickpeas." }, evening: { time: "07:00 PM", act: "Sunset Baguette & Cheese Picnic along Pont des Arts", loc: "Seine Riverbank", tip: "Every hour on the hour after dark, the Eiffel Tower sparkles for 5 magical minutes." } }
        ]
    }
};

let _currentActivePlan = null;

window.openMagicPlanner = function(destination, days, budget, currency = "INR") {
    let initialDest = destination || document.getElementById('destination-input')?.value || "";
    let initialDays = days || window._selectedNumDays || 3;
    let initialBudget = budget || document.getElementById('budget-input')?.value || 15000;

    let modal = document.getElementById('magic-itinerary-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'magic-itinerary-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 12px;";
        modal.innerHTML = `
            <div class="modal-card" style="max-width: 760px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; background: rgba(15, 23, 42, 0.98); border: 1px solid rgba(255,255,255,0.18); border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.8); overflow: hidden; padding: 0;">
                
                <!-- Modal Top Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.4rem; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="background: linear-gradient(135deg, #8b5cf6, #3b82f6); width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div>
                            <h2 style="margin: 0; color: #fff; font-size: 1.25rem; font-family: 'Outfit', sans-serif;">TripoNext AI Day-by-Day Planner</h2>
                            <span style="color: #94a3b8; font-size: 0.78rem;">Smart, authentic morning-to-night travel itineraries</span>
                        </div>
                    </div>
                    <button onclick="closeMagicPlanner()" style="background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer; padding: 4px 8px;"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <!-- Scrollable Body Content -->
                <div id="magic-modal-scroll" style="flex: 1; overflow-y: auto; padding: 1.2rem 1.4rem;">
                    
                    <!-- Trip Config Input Form Bar -->
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 1rem; margin-bottom: 1.2rem;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                            <div>
                                <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">Destination</label>
                                <input type="text" id="magic-input-dest" placeholder="e.g. Goa, Manali, Paris, Jaipur" class="glass-select" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: 8px; font-size: 0.9rem;">
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">Days (1-7)</label>
                                <select id="magic-input-days" class="glass-select" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: 8px; font-size: 0.9rem;">
                                    <option value="1">1 Day</option>
                                    <option value="2">2 Days</option>
                                    <option value="3" selected>3 Days</option>
                                    <option value="4">4 Days</option>
                                    <option value="5">5 Days</option>
                                    <option value="6">6 Days</option>
                                    <option value="7">7 Days</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 4px; font-weight: 600;">Currency</label>
                                <select id="magic-input-curr" class="glass-select" style="width: 100%; padding: 0.65rem 0.8rem; border-radius: 8px; font-size: 0.9rem;">
                                    <option value="INR">₹ INR</option>
                                    <option value="USD">$ USD</option>
                                    <option value="EUR">€ EUR</option>
                                    <option value="GBP">£ GBP</option>
                                </select>
                            </div>
                        </div>

                        <!-- Quick Popular Destination Chips -->
                        <div style="margin-bottom: 0.9rem;">
                            <span style="font-size: 0.72rem; color: #64748b; margin-right: 6px; font-weight: 600;">Quick Pick:</span>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                                <button type="button" onclick="selectMagicChip('Goa')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">🏖️ Goa</button>
                                <button type="button" onclick="selectMagicChip('Manali')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">❄️ Manali</button>
                                <button type="button" onclick="selectMagicChip('Jaipur')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">🏰 Jaipur</button>
                                <button type="button" onclick="selectMagicChip('Paris')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">🗼 Paris</button>
                                <button type="button" onclick="selectMagicChip('Tokyo')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">⛩️ Tokyo</button>
                                <button type="button" onclick="selectMagicChip('Bali')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">🌴 Bali</button>
                                <button type="button" onclick="selectMagicChip('Dubai')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; border-radius: 20px; padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">🏜️ Dubai</button>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <button type="button" id="magic-submit-btn" onclick="executeMagicPlannerGeneration()" class="btn-primary" style="width: 100%; padding: 0.75rem; font-weight: 700; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Authentic Day-by-Day Plan
                        </button>
                    </div>

                    <!-- Output Container -->
                    <div id="magic-plan-output">
                        <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8;">
                            <i class="fa-solid fa-compass fa-2x" style="color: var(--primary); margin-bottom: 0.75rem;"></i>
                            <p style="margin: 0; font-size: 0.95rem;">Enter your destination above and hit generate to see a realistic morning-to-night itinerary!</p>
                        </div>
                    </div>
                </div>

                <!-- Modal Sticky Footer Actions -->
                <div id="magic-modal-footer" style="display: none; padding: 1rem 1.4rem; background: rgba(0,0,0,0.5); border-top: 1px solid rgba(255,255,255,0.1); justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
                    <button type="button" onclick="exportItineraryPDF()" class="btn-small" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0.55rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-file-pdf" style="color: #ef4444;"></i> Export PDF
                    </button>
                    <div style="display: flex; gap: 0.6rem;">
                        <button type="button" onclick="closeMagicPlanner()" class="btn-small" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 8px; padding: 0.55rem 1rem; cursor: pointer;">Close</button>
                        <button type="button" id="save-magic-trip-btn" class="btn-small btn-primary" style="border-radius: 8px; padding: 0.55rem 1.3rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <i class="fa-solid fa-bookmark"></i> Save to My Trips
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    // Prefill inputs
    const destInput = document.getElementById('magic-input-dest');
    const daysSelect = document.getElementById('magic-input-days');
    const currSelect = document.getElementById('magic-input-curr');
    
    if (destInput && initialDest) destInput.value = initialDest;
    if (daysSelect && initialDays) daysSelect.value = Math.min(Math.max(initialDays, 1), 7);
    if (currSelect && currency) currSelect.value = currency;

    // If destination was explicitly provided, auto-generate immediately!
    if (initialDest && initialDest.trim()) {
        executeMagicPlannerGeneration();
    }
};

window.closeMagicPlanner = function() {
    const modal = document.getElementById('magic-itinerary-modal');
    if (modal) modal.style.display = 'none';
};

window.selectMagicChip = function(name) {
    const input = document.getElementById('magic-input-dest');
    if (input) input.value = name;
    executeMagicPlannerGeneration();
};

window.executeMagicPlannerGeneration = async function() {
    const destInput = document.getElementById('magic-input-dest');
    const destination = (destInput && destInput.value.trim()) ? destInput.value.trim() : "Goa";
    const daysSelect = document.getElementById('magic-input-days');
    const numDays = parseInt(daysSelect ? daysSelect.value : 3) || 3;
    const currSelect = document.getElementById('magic-input-curr');
    const currency = currSelect ? currSelect.value : "INR";
    const budget = currency === "INR" ? 15000 : 800;

    const output = document.getElementById('magic-plan-output');
    const submitBtn = document.getElementById('magic-submit-btn');
    const footer = document.getElementById('magic-modal-footer');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Itinerary...';
    }
    if (footer) footer.style.display = 'none';

    output.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
            <i class="fa-solid fa-compass fa-spin fa-3x" style="color: var(--primary);"></i>
            <p style="color: #e2e8f0; margin-top: 1rem; font-weight: 500;">TripoNext AI is curating your ${numDays}-day journey in ${destination}...</p>
            <p style="color: #94a3b8; font-size: 0.8rem;">Gathering genuine landmarks, authentic eateries & scenic viewpoints...</p>
        </div>
    `;

    let planData = null;

    try {
        const res = await fetch('/api/ai-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination, days: numDays, budget, currency })
        });
        if (res.ok) {
            planData = await res.json();
        }
    } catch (e) {
        console.warn('Backend unavailable, using client-side curated engine:', e);
    }

    // Client fallback if network failed or server offline
    if (!planData || !planData.dailyPlan) {
        planData = generateClientCuratedPlan(destination, numDays, budget, currency);
    }

    _currentActivePlan = planData;
    renderMagicPlanUI(planData);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate Itinerary';
    }
    if (footer) footer.style.display = 'flex';

    // Hook Save button
    const saveBtn = document.getElementById('save-magic-trip-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Save to My Trips';
        saveBtn.onclick = async () => {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            await saveMagicTripToMyTrips(planData);
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved to My Trips!';
            setTimeout(() => {
                closeMagicPlanner();
                window.location.href = 'mytrips.html';
            }, 900);
        };
    }
};

function renderMagicPlanUI(plan) {
    const output = document.getElementById('magic-plan-output');
    if (!output) return;

    let html = `
        <div id="printable-itinerary">
            <!-- Vibe & Summary Header Card -->
            <div style="background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--primary); font-weight: 700;">${plan.destination} Itinerary</span>
                    <span style="background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">${plan.vibe || 'Curated Tour'}</span>
                </div>
                <p style="margin: 0; color: #f8fafc; font-size: 0.95rem; line-height: 1.45;">${plan.summary}</p>
            </div>

            <!-- Budget Breakdown Pills -->
            <div style="margin-bottom: 1.2rem;">
                <div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem;"><i class="fa-solid fa-wallet" style="color: #38bdf8; margin-right: 6px;"></i> Estimated Budget Allocation</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem;">
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #94a3b8;">🏨 Stay / Hotel</div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${plan.budgetBreakdown?.stay || '40%'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #94a3b8;">🥘 Food & Dining</div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${plan.budgetBreakdown?.food || '25%'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #94a3b8;">🎟️ Activities / Passes</div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${plan.budgetBreakdown?.activities || '20%'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #94a3b8;">🚕 Local Transit</div>
                        <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${plan.budgetBreakdown?.transport || '15%'}</div>
                    </div>
                </div>
            </div>

            <!-- Daily Schedule Cards -->
            <div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600; margin-bottom: 0.75rem;"><i class="fa-solid fa-calendar-days" style="color: #38bdf8; margin-right: 6px;"></i> Day-by-Day Detailed Schedule</div>
            <div style="display: flex; flex-direction: column; gap: 0.9rem;">
    `;

    (plan.dailyPlan || []).forEach(d => {
        html += `
            <div style="background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 1rem;">
                <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.4rem; margin-bottom: 0.7rem; font-weight: 700; color: var(--primary); font-size: 0.95rem;">
                    Day ${d.day}: ${d.theme}
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(234,179,8,0.2); color: #facc15; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; min-width: 72px; text-align: center;">🌅 Morning</span>
                        <div>
                            <strong style="color: #fff; font-size: 0.88rem;">${d.morning?.act || d.morning?.activity || 'Morning Discovery'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 2px;">📍 ${d.morning?.loc || d.morning?.location || ''} • 💡 ${d.morning?.tip || ''}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(59,130,246,0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; min-width: 72px; text-align: center;">☀️ Afternoon</span>
                        <div>
                            <strong style="color: #fff; font-size: 0.88rem;">${d.afternoon?.act || d.afternoon?.activity || 'Afternoon Food & Culture'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 2px;">📍 ${d.afternoon?.loc || d.afternoon?.location || ''} • 💡 ${d.afternoon?.tip || ''}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: flex-start;">
                        <span style="background: rgba(168,85,247,0.2); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; min-width: 72px; text-align: center;">🌙 Evening</span>
                        <div>
                            <strong style="color: #fff; font-size: 0.88rem;">${d.evening?.act || d.evening?.activity || 'Sunset & Night Dining'}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem; margin-top: 2px;">📍 ${d.evening?.loc || d.evening?.location || ''} • 💡 ${d.evening?.tip || ''}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    if (plan.packingList && plan.packingList.length > 0) {
        html += `
            <div style="margin-top: 1rem;">
                <div style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600; margin-bottom: 0.4rem;"><i class="fa-solid fa-suitcase" style="color: #4ade80; margin-right: 6px;"></i> Smart Packing Checklist</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${plan.packingList.map(item => `<span style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 3px 8px; font-size: 0.78rem; color: #e2e8f0;"><i class="fa-solid fa-check" style="color: #4ade80; margin-right: 4px;"></i> ${item}</span>`).join('')}
                </div>
            </div>
        `;
    }

    if (plan.insiderTips && plan.insiderTips.length > 0) {
        html += `
            <div style="margin-top: 1rem; background: rgba(56,189,248,0.07); border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 0.8rem;">
                <div style="font-size: 0.82rem; color: #38bdf8; font-weight: 700; margin-bottom: 0.3rem;"><i class="fa-solid fa-lightbulb"></i> Local Insider Hacks</div>
                <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #94a3b8; line-height: 1.4;">
                    ${plan.insiderTips.map(t => `<li style="margin-bottom: 3px;">${t}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    html += `</div></div>`;
    output.innerHTML = html;
}

function generateClientCuratedPlan(destination, numDays, budget, currency) {
    const key = destination.toLowerCase().trim();
    for (const [destKey, data] of Object.entries(CLIENT_CURATED_TRIPS)) {
        if (key.includes(destKey) || destKey.includes(key)) {
            const bVal = parseFloat(budget) || 15000;
            return {
                destination: destination.charAt(0).toUpperCase() + destination.slice(1),
                days: numDays,
                summary: data.summary,
                vibe: data.vibe,
                budgetBreakdown: {
                    stay: `${currency} ${Math.round(bVal * 0.40).toLocaleString()}`,
                    food: `${currency} ${Math.round(bVal * 0.25).toLocaleString()}`,
                    activities: `${currency} ${Math.round(bVal * 0.20).toLocaleString()}`,
                    transport: `${currency} ${Math.round(bVal * 0.15).toLocaleString()}`
                },
                packingList: [
                    "Comfortable all-day walking sneakers",
                    "Universal travel adapter & power bank",
                    "Light rain jacket / layer for evening breezes",
                    "Reusable water bottle & personal essentials kit"
                ],
                insiderTips: [
                    `Download offline maps of ${destination} before leaving your hotel.`,
                    "Start morning activities before 9:00 AM to beat tourist crowds.",
                    "Ask local café owners for their favorite neighborhood food spots instead of tourist traps."
                ],
                dailyPlan: data.days.slice(0, numDays)
            };
        }
    }

    // Universal fallback
    const bVal = parseFloat(budget) || 12000;
    const cleanDest = destination.trim();
    const fallbackDays = [];
    for (let d = 1; d <= numDays; d++) {
        fallbackDays.push({
            day: d,
            theme: d === 1 ? "Old Quarter Heritage, Scenic Viewpoint & Regional Flavors" : d === 2 ? "Cultural Deep-Dive, Iconic Monuments & Artisan Bazaars" : "Nature Escapes, Local Cafés & Twilight Atmosphere",
            morning: { time: "09:00 AM", act: `Historic Heritage Trail & Architecture Walk in ${cleanDest}`, loc: `${cleanDest} Old Town`, tip: "Arrive early before 9 AM for peaceful morning photography." },
            afternoon: { time: "01:30 PM", act: `Signature Regional Gastronomy & Bistro Crawl`, loc: `Traditional Market in ${cleanDest}`, tip: "Sample the famous local specialty dish accompanied by artisanal tea." },
            evening: { time: "06:30 PM", act: `Sunset Terrace Viewpoint & Evening Night Market Walk`, loc: `${cleanDest} Panoramic Overlook`, tip: "Catch golden hour rays over the city skyline." }
        });
    }

    return {
        destination: cleanDest,
        days: numDays,
        summary: `A personalized ${numDays}-day journey across ${cleanDest} designed for memorable sights, authentic regional eats, and unmissable photo viewpoints.`,
        vibe: "Balanced Cultural Exploration",
        budgetBreakdown: {
            stay: `${currency} ${Math.round(bVal * 0.40).toLocaleString()}`,
            food: `${currency} ${Math.round(bVal * 0.25).toLocaleString()}`,
            activities: `${currency} ${Math.round(bVal * 0.20).toLocaleString()}`,
            transport: `${currency} ${Math.round(bVal * 0.15).toLocaleString()}`
        },
        packingList: [
            "Comfortable broken-in walking shoes",
            "Universal travel adapter & high-capacity power bank",
            "Breathable layers & light windbreaker",
            "Reusable insulated water bottle"
        ],
        insiderTips: [
            `Download offline navigation maps of ${cleanDest} on your phone before departing.`,
            "Always keep a small amount of local physical currency for small transit.",
            "Ask local café baristas for their favorite neighborhood eats."
        ],
        dailyPlan: fallbackDays
    };
}

window.exportItineraryPDF = function() {
    const elem = document.getElementById('printable-itinerary');
    if (!elem) return;
    if (typeof html2pdf === 'undefined') {
        window.print();
        return;
    }
    const dest = (_currentActivePlan && _currentActivePlan.destination) ? _currentActivePlan.destination : 'Trip';
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `${dest}_TripoNext_Itinerary.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elem).save();
};

async function saveMagicTripToMyTrips(plan) {
    const token = localStorage.getItem('token');
    const tripPayload = {
        destination: plan.destination,
        dates: `${plan.days} Days Itinerary`,
        budget: 15000,
        itinerary: plan
    };

    let savedToBackend = false;
    if (token) {
        try {
            const res = await fetch('/api/trips', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(tripPayload)
            });
            if (res.ok) savedToBackend = true;
        } catch (e) {
            console.warn('Backend save failed, using local storage.');
        }
    }

    if (!savedToBackend) {
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
}
