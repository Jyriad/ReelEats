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
    console.log('🎬 showVideoFor called for restaurant:', restaurant.name);
    console.log('🔍 Embed HTML:', restaurant.tiktok_embed_html);
    
    if (!restaurant.tiktok_embed_html) {
        console.log('❌ No embed HTML found for restaurant');
        videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">No video available for ${restaurant.name}</div>`;
        videoModal.classList.add('show');
        return;
    }

    // 1. Show the modal and prepare the loading HTML
    videoModal.classList.add('show');
    videoContainer.innerHTML = `
        <div class="video-loading">
            <div class="video-loading-spinner"></div>
            <div class="video-loading-text">Loading Reel...</div>
        </div>
    `;

    // 2. Add the loading class BEFORE injecting the TikTok HTML
    videoContainer.classList.add('loading-video');
    console.log('🔄 Loading state initiated');
    
    // 3. Inject the embed HTML (it will be transparent due to our new CSS)
    videoContainer.insertAdjacentHTML('beforeend', restaurant.tiktok_embed_html);
    console.log('📝 Embed HTML injected');
    console.log('🔍 Container after injection:', videoContainer.innerHTML);
    
    // 4. Enhanced detection for when the video is ready
    let loadingTimeout;
    let checkInterval;
    let checkCount = 0;
    
    const checkVideoReady = () => {
        checkCount++;
        console.log(`🔍 Check #${checkCount} - Looking for video elements`);
        
        // Look for various indicators that the TikTok embed is ready
        const iframe = videoContainer.querySelector('iframe');
        const tiktokEmbed = videoContainer.querySelector('.tiktok-embed, blockquote[data-video-id], blockquote[cite*="tiktok"]');
        const video = videoContainer.querySelector('video');
        const allElements = videoContainer.querySelectorAll('*');
        
        console.log('📊 Found elements:', {
            iframe: !!iframe,
            tiktokEmbed: !!tiktokEmbed, 
            video: !!video,
            totalElements: allElements.length
        });
        
        if (iframe) {
            console.log('🎯 Iframe found:', iframe.src);
        }
        if (tiktokEmbed) {
            console.log('🎯 TikTok embed found:', tiktokEmbed);
        }
        if (video) {
            console.log('🎯 Video element found:', video);
        }
        
        // Check if iframe has loaded content or video element exists
        if (iframe && iframe.src) {
            console.log('✅ TikTok iframe detected and ready');
            finishLoading();
        } else if (video) {
            console.log('✅ TikTok video element detected');
            finishLoading();
        } else if (tiktokEmbed && tiktokEmbed.querySelector('iframe, video')) {
            console.log('✅ TikTok embed with content detected');
            finishLoading();
        } else if (tiktokEmbed && tiktokEmbed.getAttribute('data-video-id')) {
            // TikTok blockquote is present and has video ID - this means it's ready for processing
            console.log('✅ TikTok blockquote with video ID detected - considering ready');
            // Give TikTok script a moment to process, then finish loading
            setTimeout(() => {
                const updatedIframe = videoContainer.querySelector('iframe');
                if (updatedIframe) {
                    console.log('✅ TikTok script created iframe');
                } else {
                    console.log('⚠️ TikTok script hasn\'t created iframe yet, but blockquote is valid');
                }
                finishLoading();
            }, 2000);
        }
    };
    
    const finishLoading = () => {
        console.log('🎉 Finishing loading - removing loading state');
        videoContainer.classList.remove('loading-video');
        if (loadingTimeout) clearTimeout(loadingTimeout);
        if (checkInterval) clearInterval(checkInterval);
    };
    
    // Use MutationObserver for immediate detection
    const observer = new MutationObserver((mutations, obs) => {
        console.log('🔄 DOM mutation detected');
        checkVideoReady();
    });
    observer.observe(videoContainer, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['src', 'data-video-id'] 
    });

    // Also check periodically in case MutationObserver misses something
    checkInterval = setInterval(checkVideoReady, 1000);
    
    // Fallback: Remove loading after 15 seconds regardless
    loadingTimeout = setTimeout(() => {
        console.log('⏰ TikTok embed loading timeout - removing loading state');
        finishLoading();
        observer.disconnect();
    }, 15000);

    // Do initial check
    setTimeout(checkVideoReady, 100);

    // 5. Fresh TikTok script loading approach
    const loadTikTokScript = () => {
        console.log('🚀 Loading TikTok script with fresh approach...');
        
        // Remove any existing TikTok scripts to start fresh
        const existingScripts = document.querySelectorAll('script[src*="tiktok.com/embed"]');
        existingScripts.forEach(script => {
            console.log('🗑️ Removing existing TikTok script');
            script.remove();
        });
        
        // Clear any existing tiktokEmbed reference
        if (window.tiktokEmbed) {
            delete window.tiktokEmbed;
            console.log('🗑️ Cleared existing tiktokEmbed');
        }
        
        // Load fresh script
        const script = document.createElement('script');
        script.src = 'https://www.tiktok.com/embed.js?t=' + Date.now(); // Cache busting
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Fresh TikTok embed script loaded');
            // Wait a bit for the script to initialize
            let waitCount = 0;
            const checkForEmbed = () => {
                waitCount++;
                console.log(`🔍 Check #${waitCount} for tiktokEmbed...`);
                if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                    console.log('🎉 TikTok embed is now available!');
                    try {
                        window.tiktokEmbed.load();
                        console.log('✅ Called tiktokEmbed.load() successfully');
                    } catch (error) {
                        console.error('❌ Error calling tiktokEmbed.load():', error);
                    }
                } else if (waitCount < 20) {
                    setTimeout(checkForEmbed, 250);
                } else {
                    console.log('⚠️ TikTok embed never became available');
                    // Try manual processing as fallback
                    tryManualProcessing();
                }
            };
            setTimeout(checkForEmbed, 100);
        };
        
        script.onerror = () => {
            console.error('❌ Failed to load fresh TikTok embed script');
            tryManualProcessing();
        };
        
        document.head.appendChild(script);
        console.log('📝 Fresh TikTok script added to head');
    };
    
    // Fallback: Try to manually trigger embed processing
    const tryManualProcessing = () => {
        console.log('🔧 Trying manual TikTok embed processing...');
        const blockquotes = videoContainer.querySelectorAll('blockquote[class*="tiktok"]');
        blockquotes.forEach((bq, index) => {
            console.log(`🔧 Processing blockquote #${index + 1}:`, bq);
            // Try to trigger any available TikTok processing
            if (window.tiktokEmbed) {
                try {
                    if (window.tiktokEmbed.process) window.tiktokEmbed.process(bq);
                    if (window.tiktokEmbed.load) window.tiktokEmbed.load();
                } catch (e) {
                    console.log('Manual processing attempt failed:', e);
                }
            }
        });
    };
    
    // Start the loading process
    setTimeout(loadTikTokScript, 200);
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

