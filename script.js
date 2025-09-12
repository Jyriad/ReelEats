// --- Supabase Client Initialization ---
const SUPABASE_URL = 'https://jsuxrpnfofkigdfpnuua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // --- UI Element References ---
        const mapElement = document.getElementById('map');
        const restaurantList = document.getElementById('restaurant-list');
        const videoModal = document.getElementById('video-modal');
        const videoContainer = videoModal.querySelector('.video-container');
        const videoTitleEl = document.getElementById('video-title');
        const closeVideoBtn = videoModal.querySelector('.close-video-btn');
        const citySelect = document.getElementById('city-select');
        
        // --- State Management ---
        let currentRestaurants = [];
        let restaurantMarkers = [];
        let map; // Define map in a broader scope

        // --- Initialization ---
        initializeMap();
        await loadCitiesAndInitialRestaurants();

        // --- Core Functions ---

        function initializeMap() {
            map = L.map(mapElement, { preferCanvas: true }).setView([51.5074, -0.1278], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);
        }

        async function loadCitiesAndInitialRestaurants() {
            const t0 = performance.now();
            await loadCities();
            const t1 = performance.now();
            console.log(`Cities query and processing took: ${t1 - t0} ms`);

            if (citySelect.options.length > 0) {
                const initialCityId = citySelect.value;
                await loadRestaurantsForCity(initialCityId);
                const selectedOption = citySelect.options[citySelect.selectedIndex];
                map.flyTo([selectedOption.dataset.lat, selectedOption.dataset.lon], 12);
            }
            const t2 = performance.now();
            console.log(`Total initial load time: ${t2 - t0} ms`);
        }

        async function loadCities() {
            const CACHE_KEY = 'reelEats_citiesCache';
            const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

            // Try to load from cache first
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                const { cities, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log("Loading cities from cache.");
                    populateCitySelect(cities);
                    // Fetch in background to check for updates, but don't block
                    fetchAndCacheCities(); 
                    return;
                }
            }
            
            // If no valid cache, fetch from network
            console.log("Fetching cities from network...");
            await fetchAndCacheCities();
        }

        async function fetchAndCacheCities() {
             const { data: cities, error } = await supabaseClient.from('cities').select('id, name, lat, lon');
             if (error) {
                console.error("Error fetching cities:", error);
                return;
             }
             localStorage.setItem('reelEats_citiesCache', JSON.stringify({ cities, timestamp: Date.now() }));
             populateCitySelect(cities);
        }

        function populateCitySelect(cities) {
            citySelect.innerHTML = '';
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                option.dataset.lat = city.lat;
                option.dataset.lon = city.lon;
                citySelect.appendChild(option);
            });
        }
        
        async function loadRestaurantsForCity(cityId) {
            // --- FIX: Use a more robust two-query approach ---

            // 1. Fetch all restaurants for the selected city.
            const { data: restaurants, error: restaurantsError } = await supabaseClient
                .from('restaurants')
                .select('*')
                .eq('city_id', cityId);

            if (restaurantsError) {
                console.error("Error fetching restaurants:", restaurantsError);
                throw restaurantsError;
            }

            if (!restaurants || restaurants.length === 0) {
                currentRestaurants = [];
                displayRestaurants([]);
                return;
            }

            // 2. Fetch only the featured TikToks for those specific restaurants.
            const restaurantIds = restaurants.map(r => r.id);
            const { data: tiktoks, error: tiktoksError } = await supabaseClient
                .from('tiktoks')
                .select('restaurant_id, embed_html')
                .in('restaurant_id', restaurantIds)
                .eq('is_featured', true);

            if (tiktoksError) {
                // Log the error but don't stop execution, so restaurants still display.
                console.error("Error fetching tiktoks:", tiktoksError);
            }

            // 3. Join the data together in JavaScript.
            const tiktokMap = new Map();
            if (tiktoks) {
                tiktoks.forEach(t => {
                    tiktokMap.set(t.restaurant_id, t.embed_html);
                });
            }

            currentRestaurants = restaurants.map(r => ({
                ...r,
                tiktok_embed_html: tiktokMap.get(r.id) || null
            }));
            
            displayRestaurants(currentRestaurants);
        }

        function displayRestaurants(restaurants) {
            restaurantList.innerHTML = '';
            restaurantMarkers.forEach(marker => map.removeLayer(marker));
            restaurantMarkers = [];

            if (restaurants.length === 0) {
                restaurantList.innerHTML = `<p class="text-gray-500 text-center">No restaurants found for this city.</p>`;
                return;
            }

            restaurants.forEach((restaurant, index) => {
                const listItem = createListItem(restaurant, index);
                restaurantList.appendChild(listItem);
                
                const marker = createNumberedMarker(restaurant, index);
                marker.addTo(map);
                restaurantMarkers.push(marker);
            });
        }
        
        function createListItem(restaurant, index) {
            const listItem = document.createElement('div');
            listItem.className = 'bg-white p-2 md:p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition border border-gray-200 flex items-start';
            listItem.innerHTML = `
                <div class="flex-1 min-w-0">
                    <h3 class="text-gray-900 text-base md:text-lg font-bold truncate">${restaurant.name}</h3>
                    <p class="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">${restaurant.description || ''}</p>
                </div>
            `;
            listItem.addEventListener('click', () => {
                showVideoFor(restaurant);
                map.flyTo([restaurant.lat, restaurant.lon], 15);
            });
            return listItem;
        }

        function createNumberedMarker(restaurant, index) {
            const marker = L.marker([restaurant.lat, restaurant.lon], { title: restaurant.name });
            marker.on('click', () => showVideoFor(restaurant));
            return marker;
        }

        // script.js

function showVideoFor(restaurant) {
    console.log('Video function called for:', restaurant.name);
    console.log('Embed HTML exists:', !!restaurant.tiktok_embed_html);
    
    if (!restaurant.tiktok_embed_html) {
        videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">No video available for ${restaurant.name}</div>`;
        videoModal.classList.add('show');
        return;
    }

    console.log('Embed HTML content:', restaurant.tiktok_embed_html);
    
    // Show modal and inject the exact embed HTML
    videoModal.classList.add('show');
    videoContainer.innerHTML = restaurant.tiktok_embed_html;
    
    console.log('Modal shown, HTML injected');
    console.log('Container content after injection:', videoContainer.innerHTML);
    
    // Give TikTok script time to process
    setTimeout(() => {
        console.log('Checking for tiktokEmbed:', !!window.tiktokEmbed);
        if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
            console.log('Calling tiktokEmbed.load()');
            window.tiktokEmbed.load();
        } else {
            console.log('tiktokEmbed not available or no load function');
        }
        
        // Check what elements exist after processing
        setTimeout(() => {
            const iframes = videoContainer.querySelectorAll('iframe');
            const blockquotes = videoContainer.querySelectorAll('blockquote');
            console.log(`Found ${iframes.length} iframes and ${blockquotes.length} blockquotes`);
        }, 1000);
    }, 500);
}

        function closeVideo() {
            videoModal.classList.remove('show');
            videoContainer.innerHTML = '';
        }

        // --- Event Listeners ---
        citySelect.addEventListener('change', async function() {
            const selectedOption = citySelect.options[citySelect.selectedIndex];
            await loadRestaurantsForCity(selectedOption.value);
            map.flyTo([selectedOption.dataset.lat, selectedOption.dataset.lon], 12);
        });
        closeVideoBtn.addEventListener('click', closeVideo);
        videoModal.addEventListener('click', (e) => e.target === videoModal && closeVideo());
    
    } catch (error) {
        console.error("An error occurred during initialization:", error);
        document.body.innerHTML = `<div style="color: black; background: white; padding: 20px;"><h1>Something went wrong</h1><p>Could not load the map. Please check the developer console for more details.</p></div>`;
    }
});

