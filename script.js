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
        let mapInitialized = false; // Prevent double initialization
        let allCuisines = []; // Store all available cuisines for filtering

        // --- Initialization ---
        initializeMap();
        await loadCitiesAndInitialRestaurants();
        setupCuisineFilter();

        // --- Core Functions ---

        function initializeMap() {
            if (mapInitialized) {
                console.log('Map already initialized, skipping...');
                return;
            }
            
            try {
                console.log('Initializing map...');
                // Check if map is already initialized
                if (map) {
                    map.remove();
                    map = null;
                }
                
                // Clear any existing content
                mapElement.innerHTML = '';
                mapElement._leaflet_id = null;
                
                map = L.map(mapElement, { preferCanvas: true }).setView([51.5074, -0.1278], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);
                
                // Add geolocation functionality
                addUserLocationMarker();
                
                mapInitialized = true;
                console.log('Map initialized successfully');
            } catch (error) {
                console.error('Map initialization error:', error);
                mapInitialized = false;
            }
        }

        function addUserLocationMarker() {
            if (!navigator.geolocation) {
                console.log('Geolocation is not supported by this browser');
                return;
            }

            console.log('Requesting user location...');
            
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                function(position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    console.log('User location found:', userLat, userLon);
                    
                    // Store user location globally for distance calculations
                    window.userLocation = { lat: userLat, lon: userLon };
                    
                    // Center map on user location
                    map.setView([userLat, userLon], 15);
                    
                    // Add user location marker with distinct styling
                    const userIcon = L.divIcon({
                        className: 'user-location-icon',
                        html: '<div class="user-icon">📍</div>',
                        iconSize: [35, 35],
                        iconAnchor: [17, 17]
                    });
                    
                    const userMarker = L.marker([userLat, userLon], { 
                        icon: userIcon,
                        title: 'Your Location'
                    }).addTo(map);
                    
                    // Add a pulsing circle around user location for better visibility
                    const userCircle = L.circle([userLat, userLon], {
                        color: '#ef4444',
                        fillColor: '#ef4444',
                        fillOpacity: 0.2,
                        radius: 150, // 150 meters
                        weight: 3
                    }).addTo(map);
                    
                    // Add pulsing animation
                    userCircle.setStyle({
                        fillOpacity: 0.1
                    });
                    
                    // Update restaurant cards with distances
                    updateRestaurantCardsWithDistance();
                    
                    console.log('User location marker added');
                },
                function(error) {
                    console.log('Geolocation error:', error.message);
                    // Fallback to default London location
                    console.log('Using default London location');
                },
                options
            );
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

            // 3. Fetch cuisine information for restaurants
            const { data: restaurantCuisines, error: cuisineError } = await supabaseClient
                .from('restaurant_cuisines')
                .select(`
                    restaurant_id,
                    cuisines (name)
                `)
                .in('restaurant_id', restaurantIds);

            if (cuisineError) {
                console.error("Error fetching cuisines:", cuisineError);
            }

            // 4. Join the data together in JavaScript.
            const tiktokMap = new Map();
            if (tiktoks) {
                tiktoks.forEach(t => {
                    tiktokMap.set(t.restaurant_id, t.embed_html);
                });
            }

            const cuisineMap = new Map();
            if (restaurantCuisines) {
                restaurantCuisines.forEach(rc => {
                    if (!cuisineMap.has(rc.restaurant_id)) {
                        cuisineMap.set(rc.restaurant_id, []);
                    }
                    cuisineMap.get(rc.restaurant_id).push(rc.cuisines.name);
                });
            }

            currentRestaurants = restaurants.map(r => ({
                ...r,
                tiktok_embed_html: tiktokMap.get(r.id) || null,
                cuisines: cuisineMap.get(r.id) || []
            }));
            
            displayRestaurants(currentRestaurants);
        }

        // Setup cuisine filter functionality
        function setupCuisineFilter() {
            const cuisineFilter = document.getElementById('cuisine-filter');
            
            // Populate cuisine filter dropdown
            populateCuisineFilter();
            
            // Add event listener for filter changes
            cuisineFilter.addEventListener('change', function() {
                const selectedCuisine = this.value;
                filterRestaurantsByCuisine(selectedCuisine);
            });
        }
        
        // Populate cuisine filter dropdown with all available cuisines
        async function populateCuisineFilter() {
            try {
                const { data: cuisines, error } = await supabaseClient
                    .from('cuisines')
                    .select('name')
                    .order('name');
                
                if (error) throw error;
                
                allCuisines = cuisines.map(c => c.name);
                const cuisineFilter = document.getElementById('cuisine-filter');
                
                // Clear existing options except "All Cuisines"
                cuisineFilter.innerHTML = '<option value="">All Cuisines</option>';
                
                // Add cuisine options
                allCuisines.forEach(cuisine => {
                    const option = document.createElement('option');
                    option.value = cuisine;
                    option.textContent = cuisine;
                    cuisineFilter.appendChild(option);
                });
                
            } catch (error) {
                console.error('Error loading cuisines for filter:', error);
            }
        }
        
        // Filter restaurants by selected cuisine
        function filterRestaurantsByCuisine(selectedCuisine) {
            if (!selectedCuisine) {
                // Show all restaurants
                displayRestaurants(currentRestaurants);
            } else {
                // Filter restaurants that have the selected cuisine
                const filteredRestaurants = currentRestaurants.filter(restaurant => {
                    return restaurant.cuisines && restaurant.cuisines.includes(selectedCuisine);
                });
                displayRestaurants(filteredRestaurants);
            }
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
            listItem.dataset.restaurantId = restaurant.id;
            
            // Create cuisine tags
            const cuisineTags = restaurant.cuisines && restaurant.cuisines.length > 0 
                ? restaurant.cuisines.map(cuisine => 
                    `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">${cuisine}</span>`
                  ).join('')
                : '<span class="text-gray-400 text-xs">No cuisine info</span>';
            
            // Calculate distance if user location is available (both mobile and desktop)
            let distanceHtml = '';
            if (window.userLocation) {
                const distance = calculateDistance(
                    window.userLocation.lat, 
                    window.userLocation.lon, 
                    restaurant.lat, 
                    restaurant.lon
                );
                distanceHtml = `<div class="mt-1 text-xs text-gray-500 flex items-center">
                    <span class="mr-1">📍</span>
                    <span>${distance} away</span>
                </div>`;
            }
            
            const number = index + 1; // Start numbering from 1
            listItem.innerHTML = `
                <div class="flex-shrink-0 mr-3">
                    <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        ${number}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-gray-900 text-base md:text-lg font-bold truncate">${restaurant.name}</h3>
                    <p class="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">${restaurant.description || ''}</p>
                    <div class="mt-2 flex flex-wrap">
                        ${cuisineTags}
                    </div>
                    ${distanceHtml}
                </div>
            `;
            listItem.addEventListener('click', () => {
                // Remove active class from all cards
                document.querySelectorAll('#restaurant-list .bg-white').forEach(card => {
                    card.classList.remove('active-list-item');
                });
                // Add active class to clicked card
                listItem.classList.add('active-list-item');
                
                showVideoFor(restaurant);
                map.flyTo([restaurant.lat, restaurant.lon], 15);
            });
            return listItem;
        }

        function createNumberedMarker(restaurant, index) {
            // Create a custom numbered icon
            const number = index + 1; // Start numbering from 1
            const icon = L.divIcon({
                className: 'numbered-marker',
                html: `<div class="numbered-marker-content">${number}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker([restaurant.lat, restaurant.lon], { 
                icon: icon,
                title: `${number}. ${restaurant.name}`
            });
            
            marker.on('click', () => {
                // Remove active class from all cards
                document.querySelectorAll('#restaurant-list .bg-white').forEach(card => {
                    card.classList.remove('active-list-item');
                });
                // Add active class to corresponding card
                const correspondingCard = document.querySelector(`[data-restaurant-id="${restaurant.id}"]`);
                if (correspondingCard) {
                    correspondingCard.classList.add('active-list-item');
                }
                
                showVideoFor(restaurant);
            });
            return marker;
        }

        // Calculate distance between two coordinates using Haversine formula
        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // Earth's radius in kilometers
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c; // Distance in kilometers
            
            if (distance < 1) {
                return Math.round(distance * 1000) + 'm';
            } else {
                return Math.round(distance * 10) / 10 + 'km';
            }
        }

        // Update restaurant cards with distance information
        function updateRestaurantCardsWithDistance() {
            if (!window.userLocation) return;
            
            const restaurantCards = document.querySelectorAll('#restaurant-list .bg-white');
            restaurantCards.forEach(card => {
                const restaurantId = card.dataset.restaurantId;
                const restaurant = currentRestaurants.find(r => r.id == restaurantId);
                
                if (restaurant) {
                    const distance = calculateDistance(
                        window.userLocation.lat, 
                        window.userLocation.lon, 
                        restaurant.lat, 
                        restaurant.lon
                    );
                    
                    // Check if distance is already shown
                    const existingDistance = card.querySelector('.distance-info');
                    if (!existingDistance) {
                        const distanceDiv = document.createElement('div');
                        distanceDiv.className = 'mt-1 text-xs text-gray-500 flex items-center distance-info';
                        distanceDiv.innerHTML = `<span class="mr-1">📍</span><span>${distance} away</span>`;
                        card.querySelector('.flex-1').appendChild(distanceDiv);
                    } else {
                        // Update existing distance
                        existingDistance.innerHTML = `<span class="mr-1">📍</span><span>${distance} away</span>`;
                    }
                }
            });
        }

        // script.js

function showVideoFor(restaurant) {
    if (!restaurant.tiktok_embed_html) {
        videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">No video available for ${restaurant.name}</div>`;
        videoModal.classList.add('show');
        return;
    }

    // Extract video ID from embed HTML
    const videoIdMatch = restaurant.tiktok_embed_html.match(/data-video-id="(\d+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    console.log('🎬 Loading video:', videoId);

    // Show modal
    videoModal.classList.add('show');
    
    if (videoId) {
        // Try direct iframe approach first
        console.log('Trying direct iframe approach...');
        videoContainer.innerHTML = `
            <iframe 
                src="https://www.tiktok.com/embed/v2/${videoId}?lang=en-US" 
                width="330" 
                height="585" 
                frameborder="0" 
                allowfullscreen
                allow="encrypted-media"
                style="border: none; background: white;">
            </iframe>
        `;
        
        // If iframe doesn't work after 3 seconds, try blockquote approach
        setTimeout(() => {
            const iframe = videoContainer.querySelector('iframe');
            if (iframe) {
                iframe.onload = () => {
                    console.log('✅ Direct iframe loaded');
                };
                iframe.onerror = () => {
                    console.log('❌ Direct iframe failed, trying blockquote...');
                    fallbackToBlockquote();
                };
                
                // Also check if iframe content is loading after 3 seconds
                setTimeout(() => {
                    try {
                        // Check if iframe has content
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (!iframeDoc || iframeDoc.body.children.length === 0) {
                            console.log('⚠️ Iframe appears empty, trying blockquote...');
                            fallbackToBlockquote();
                        }
                    } catch (e) {
                        // Cross-origin, which is expected - iframe is probably working
                        console.log('✅ Iframe cross-origin (likely working)');
                    }
                }, 3000);
            }
        }, 100);
    } else {
        console.log('No video ID found, using blockquote...');
        fallbackToBlockquote();
    }
    
    function fallbackToBlockquote() {
        console.log('🔄 Falling back to blockquote approach...');
        videoContainer.innerHTML = restaurant.tiktok_embed_html;
        
        // Make blockquote visible
        const blockquotes = videoContainer.querySelectorAll('blockquote.tiktok-embed');
        blockquotes.forEach(bq => {
            bq.style.visibility = 'visible';
            bq.style.display = 'block';
        });
        
        // Trigger TikTok script
        setTimeout(() => {
            if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                window.tiktokEmbed.load();
            }
        }, 100);
    }
}

        function closeVideo() {
            videoModal.classList.remove('show');
            videoContainer.innerHTML = '';
        }

        // --- Mobile Drawer Functionality ---
        function setupMobileDrawer() {
            const drawerHandle = document.getElementById('drawer-handle');
            const aside = document.querySelector('aside');
            let isDragging = false;
            let startY = 0;
            let startHeight = 0;
            let lastTap = 0;

            if (!drawerHandle || !aside) {
                console.log('Drawer handle or aside not found');
                return;
            }

            console.log('Setting up mobile drawer functionality');

            // Set initial height on mobile
            if (window.innerWidth <= 768) {
                aside.style.height = '33vh';
            }

            // Unified event handler for both touch and mouse
            function startDrag(e) {
                console.log('Start drag event');
                isDragging = true;
                
                // Get coordinates from either touch or mouse event
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startY = clientY;
                startHeight = parseInt(getComputedStyle(aside).height);
                
                e.preventDefault();
                e.stopPropagation();
                
                // Visual feedback
                drawerHandle.style.backgroundColor = '#e5e7eb';
            }

            function drag(e) {
                if (!isDragging) return;
                
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const deltaY = startY - clientY; // Inverted because we want to drag up to expand
                const newHeight = Math.max(150, Math.min(window.innerHeight - 100, startHeight + deltaY));
                
                console.log('Drag event - startY:', startY, 'clientY:', clientY, 'deltaY:', deltaY, 'startHeight:', startHeight, 'newHeight:', newHeight);
                
                // Update both the style and the CSS variable
                aside.style.height = `${newHeight}px`;
                document.documentElement.style.setProperty('--drawer-height', `${newHeight}px`);
                e.preventDefault();
                e.stopPropagation();
            }

            function endDrag(e) {
                if (!isDragging) return;
                
                console.log('End drag event');
                isDragging = false;
                
                // Visual feedback
                drawerHandle.style.backgroundColor = '#f8fafc';
                
                // Persist the final height
                const finalHeight = parseInt(getComputedStyle(aside).height);
                document.documentElement.style.setProperty('--drawer-height', `${finalHeight}px`);
                
                // Double tap detection
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 500 && tapLength > 0) {
                    console.log('Double tap detected');
                    const currentHeight = parseInt(getComputedStyle(aside).height);
                    const collapsedHeight = 150;
                    const expandedHeight = Math.min(window.innerHeight * 0.7, window.innerHeight - 100);
                    
                    if (currentHeight < expandedHeight / 2) {
                        aside.style.height = `${expandedHeight}px`;
                        document.documentElement.style.setProperty('--drawer-height', `${expandedHeight}px`);
                    } else {
                        aside.style.height = `${collapsedHeight}px`;
                        document.documentElement.style.setProperty('--drawer-height', `${collapsedHeight}px`);
                    }
                }
                lastTap = currentTime;
            }

            // Add all event listeners
            drawerHandle.addEventListener('touchstart', startDrag, { passive: false });
            drawerHandle.addEventListener('mousedown', startDrag);
            
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('mousemove', drag);
            
            document.addEventListener('touchend', endDrag);
            document.addEventListener('mouseup', endDrag);

            // Debug: Log all touch events on the handle
            drawerHandle.addEventListener('touchstart', (e) => {
                console.log('Touch start detected on handle');
            });
            drawerHandle.addEventListener('touchmove', (e) => {
                console.log('Touch move detected on handle');
            });
            drawerHandle.addEventListener('touchend', (e) => {
                console.log('Touch end detected on handle');
            });

            // Add click event as fallback
            drawerHandle.addEventListener('click', (e) => {
                console.log('Click on drawer handle');
                const currentHeight = parseInt(getComputedStyle(aside).height);
                const collapsedHeight = 150;
                const expandedHeight = Math.min(window.innerHeight * 0.7, window.innerHeight - 100);
                
                if (currentHeight < expandedHeight / 2) {
                    aside.style.height = `${expandedHeight}px`;
                    document.documentElement.style.setProperty('--drawer-height', `${expandedHeight}px`);
                } else {
                    aside.style.height = `${collapsedHeight}px`;
                    document.documentElement.style.setProperty('--drawer-height', `${collapsedHeight}px`);
                }
            });

            // Prevent default touch behavior on the handle
            drawerHandle.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
        }

        // --- Event Listeners ---
        citySelect.addEventListener('change', async function() {
            const selectedOption = citySelect.options[citySelect.selectedIndex];
            await loadRestaurantsForCity(selectedOption.value);
            map.flyTo([selectedOption.dataset.lat, selectedOption.dataset.lon], 12);
        });
        closeVideoBtn.addEventListener('click', closeVideo);
        videoModal.addEventListener('click', (e) => e.target === videoModal && closeVideo());
        
        // Location button event listener
        const locationBtn = document.getElementById('location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                console.log('Location button clicked');
                addUserLocationMarker();
            });
        }
        
        // Setup mobile drawer after DOM is ready
        setupMobileDrawer();
    
    } catch (error) {
        console.error("An error occurred during initialization:", error);
        document.body.innerHTML = `<div style="color: black; background: white; padding: 20px;"><h1>Something went wrong</h1><p>Could not load the map. Please check the developer console for more details.</p></div>`;
    }
});

