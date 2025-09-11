// --- ** FIX #2: Make sure you replace these placeholder values! ** ---
const SUPABASE_URL = 'https://jsuxrpnfofkigdfpnuua.supabase.co'; // Replace with your URL from Settings > API
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8'; // Replace with your anon key from Settings > API

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async function() {
    try {
        const map = L.map('map', { preferCanvas: true }).setView([51.5074, -0.1278], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20, updateWhenIdle: true
        }).addTo(map);

    const restaurantList = document.getElementById('restaurant-list');
    const videoModal = document.getElementById('video-modal');
    const videoContainer = videoModal.querySelector('.video-container');
        const videoTitleEl = document.getElementById('video-title');
    const closeVideoBtn = videoModal.querySelector('.close-video-btn');
        const citySelect = document.getElementById('city-select');
        const headerEl = document.querySelector('header');
        const asideEl = document.querySelector('aside');
        const handleEl = document.getElementById('drawer-handle');
        
        let currentRestaurants = [];
        let restaurantMarkers = [];
        let videoCache = new Map();
        let preloadedVideos = new Set();
        let restaurantNumbering = new Map(); // Maps restaurant index to display number

        // Skeleton loading functions
        function showSkeletonLoading() {
            console.log('Showing skeleton loading...');
            if (!restaurantList) {
                console.error('restaurantList element not found!');
                return;
            }
            
            console.log('Restaurant list element found:', restaurantList);
            console.log('Restaurant list current content:', restaurantList.innerHTML);
            
            restaurantList.innerHTML = '';
            
            // Create 6 skeleton items for a realistic loading state
            for (let i = 0; i < 6; i++) {
                const skeletonItem = document.createElement('div');
                skeletonItem.className = 'skeleton-item';
                skeletonItem.innerHTML = `
                    <div class="skeleton-number"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-description"></div>
                        <div class="skeleton-description"></div>
                        <div class="skeleton-button"></div>
                    </div>
                `;
                restaurantList.appendChild(skeletonItem);
            }
            console.log('Skeleton items added:', restaurantList.children.length);
            console.log('Restaurant list after adding skeletons:', restaurantList.innerHTML.substring(0, 200) + '...');
        }

        function hideSkeletonLoading() {
            console.log('Hiding skeleton loading...');
            // Remove any remaining skeleton items
            const skeletonItems = restaurantList.querySelectorAll('.skeleton-item');
            console.log('Found skeleton items to remove:', skeletonItems.length);
            skeletonItems.forEach(item => item.remove());
        }

        async function loadCities() {
            // Show skeleton loading immediately
            showSkeletonLoading();
            
            // Add a small delay to ensure skeleton is visible
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const { data: cities, error } = await supabaseClient.from('cities').select('*');
            if (error) throw error;
            
            citySelect.innerHTML = '';
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                option.dataset.lat = city.lat;
                option.dataset.lon = city.lon;
                citySelect.appendChild(option);
            });

            if (cities.length > 0) {
                await loadRestaurantsForCity(cities[0].id);
                map.flyTo([cities[0].lat, cities[0].lon], 12);
                
                // Start aggressive preloading after initial load
                setTimeout(() => {
                    preloadVisibleVideos();
                }, 1000);
            }
        }
        
        async function loadRestaurantsForCity(cityId) {
            const startTime = Date.now();
            
            const { data: restaurants, error } = await supabaseClient
                .from('restaurants')
                .select('name, lat, lon, description, tiktok_embed_html, city_id')
                .eq('city_id', cityId);

            if (error) throw error;
            
            currentRestaurants = restaurants;
            // Filter restaurants based on current map bounds for initial load
            const bounds = map.getBounds();
            const visibleRestaurants = restaurants.filter(restaurant => 
                bounds.contains([restaurant.lat, restaurant.lon])
            );
            
            // Ensure skeleton is visible for at least 800ms for better UX
            const elapsed = Date.now() - startTime;
            const minDisplayTime = 800;
            if (elapsed < minDisplayTime) {
                await new Promise(resolve => setTimeout(resolve, minDisplayTime - elapsed));
            }
            
            // Load visible restaurants first, then others
            displayRestaurantsOptimized(visibleRestaurants, restaurants);
            
            // Start preloading videos after a short delay
            setTimeout(() => {
                preloadVisibleVideos();
            }, 500);
        }

        // Optimized restaurant display with viewport-based loading
        function displayRestaurantsOptimized(visibleRestaurants, allRestaurants) {
            // Hide skeleton loading and clear existing content
            hideSkeletonLoading();
            restaurantList.innerHTML = '';
            restaurantMarkers.forEach(marker => map.removeLayer(marker));
            restaurantMarkers = [];
            restaurantNumbering.clear();

            // Create a map of all restaurants for quick lookup
            const restaurantMap = new Map();
            allRestaurants.forEach((restaurant, index) => {
                restaurantMap.set(`${restaurant.lat},${restaurant.lon}`, { restaurant, index });
            });

            // Load visible restaurants immediately with numbering
            visibleRestaurants.forEach((restaurant, i) => {
                const originalIndex = restaurantMap.get(`${restaurant.lat},${restaurant.lon}`).index;
                const displayNumber = i + 1;
                restaurantNumbering.set(originalIndex, displayNumber);
                
                const listItem = createListItem(restaurant, originalIndex, displayNumber);
                listItem.id = `restaurant-item-${originalIndex}`;
                restaurantList.appendChild(listItem);
                
                const marker = createNumberedMarker(restaurant, originalIndex, displayNumber);
                marker.addTo(map);
                restaurantMarkers.push(marker);
            });

            // Set up Intersection Observer for lazy loading
            setupIntersectionObserver(allRestaurants, restaurantMap);
        }

        function setupIntersectionObserver(allRestaurants, restaurantMap) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.dataset.index);
                        const restaurant = allRestaurants[index];
                        
                        // Only add marker if not already added
                        if (!restaurantMarkers.find(m => 
                            m.getLatLng().lat === restaurant.lat && 
                            m.getLatLng().lng === restaurant.lon
                        )) {
                            // Get the next available number
                            const displayNumber = restaurantMarkers.length + 1;
                            restaurantNumbering.set(index, displayNumber);
                            
                            const marker = createNumberedMarker(restaurant, index, displayNumber);
                            marker.addTo(map);
                            restaurantMarkers.push(marker);
                        }
                        
                        observer.unobserve(entry.target);
                    }
                });
            }, { rootMargin: '50px' });

            // Add remaining restaurants to list with lazy loading
            allRestaurants.forEach((restaurant, index) => {
                if (!restaurantMarkers.find(m => 
                    m.getLatLng().lat === restaurant.lat && 
                    m.getLatLng().lng === restaurant.lon
                )) {
                    const listItem = createListItem(restaurant, index);
                    listItem.id = `restaurant-item-${index}`;
                    listItem.dataset.index = index;
                    restaurantList.appendChild(listItem);
                    observer.observe(listItem);
                }
            });
        }

        // Fallback function for backward compatibility
        function displayRestaurants(restaurants) {
            displayRestaurantsOptimized(restaurants, restaurants);
        }

        // Video preloading and caching functions
        function preloadVideo(videoId) {
            if (preloadedVideos.has(videoId)) return;
            
            const preloadDiv = document.createElement('div');
            preloadDiv.className = 'video-preload';
            
            const iframe = document.createElement('iframe');
            iframe.width = '330';
            iframe.height = '585';
            iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.style.background = '#000';
            iframe.style.border = 'none';
            iframe.src = `https://www.tiktok.com/embed/${videoId}?lang=en-US`;
            
            preloadDiv.appendChild(iframe);
            document.body.appendChild(preloadDiv);
            
            preloadedVideos.add(videoId);
            videoCache.set(videoId, iframe);
            
            // Clean up after 30 seconds
            setTimeout(() => {
                if (preloadDiv.parentNode) {
                    preloadDiv.parentNode.removeChild(preloadDiv);
                }
            }, 30000);
        }

        function preloadVisibleVideos() {
            const bounds = map.getBounds();
            const visibleRestaurants = currentRestaurants.filter(restaurant => 
                bounds.contains([restaurant.lat, restaurant.lon])
            );
            
            // Preload first 3 visible videos
            visibleRestaurants.slice(0, 3).forEach(restaurant => {
                const videoId = extractVideoId(restaurant.tiktok_embed_html);
                if (videoId && !preloadedVideos.has(videoId)) {
                    preloadVideo(videoId);
                }
            });
        }

        function extractVideoId(embedHtml) {
            if (!embedHtml) return '';
            
            try {
                const temp = document.createElement('div');
                temp.innerHTML = embedHtml;
                const el = temp.querySelector('.tiktok-embed');
                if (el) return el.getAttribute('data-video-id') || '';
            } catch (_) {}
            
            const m = embedHtml.match(/data-video-id=["'](\d+)["']/);
            return m ? m[1] : '';
        }

        function createNumberedMarker(restaurant, index, displayNumber) {
            const markerDiv = document.createElement('div');
            markerDiv.className = 'numbered-marker';
            markerDiv.textContent = displayNumber;
            markerDiv.title = restaurant.name;
            
            const icon = L.divIcon({
                html: markerDiv.outerHTML,
                className: 'custom-numbered-marker',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            
            const marker = L.marker([restaurant.lat, restaurant.lon], { icon });
            marker.on('click', () => { 
                showVideoFor(restaurant, index); 
                highlightListItem(index); 
            });
            
            return marker;
        }

        function openDirections(restaurant) {
            const lat = restaurant.lat;
            const lon = restaurant.lon;
            const name = encodeURIComponent(restaurant.name);
            
            // Try to detect the user's platform and open appropriate navigation app
            const userAgent = navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(userAgent);
            const isAndroid = /android/.test(userAgent);
            
            let directionsUrl;
            
            if (isIOS) {
                // Try Apple Maps first, fallback to Google Maps
                directionsUrl = `maps://maps.google.com/maps?daddr=${lat},${lon}&amp;ll=`;
            } else if (isAndroid) {
                // Use Google Maps for Android
                directionsUrl = `geo:${lat},${lon}?q=${lat},${lon}(${name})`;
            } else {
                // Desktop/other - use Google Maps web
                directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${name}`;
            }
            
            // Open the directions URL
            window.open(directionsUrl, '_blank');
        }
        
        citySelect.addEventListener('change', async function() {
            const selectedOption = citySelect.options[citySelect.selectedIndex];
            const cityId = selectedOption.value;
            const lat = selectedOption.dataset.lat;
            const lon = selectedOption.dataset.lon;
            
            if (cityId) {
                // Show skeleton loading when switching cities
                showSkeletonLoading();
                await loadRestaurantsForCity(cityId);
                map.flyTo([lat, lon], 12);
            }
        });

        await loadCities();

        // Add map bounds change listener for dynamic loading
        map.on('moveend zoomend', () => {
            if (currentRestaurants.length > 0) {
                updateRestaurantsForCurrentView();
                // Preload videos for new visible restaurants
                setTimeout(() => {
                    preloadVisibleVideos();
                }, 300);
            }
        });

        function updateRestaurantsForCurrentView() {
            const bounds = map.getBounds();
            const visibleRestaurants = currentRestaurants.filter(restaurant => 
                bounds.contains([restaurant.lat, restaurant.lon])
            );
            
            // Remove markers that are no longer visible
            const markersToRemove = [];
            restaurantMarkers.forEach((marker, index) => {
                const latLng = marker.getLatLng();
                if (!bounds.contains(latLng)) {
                    map.removeLayer(marker);
                    markersToRemove.push(index);
                }
            });
            
            // Remove markers from array (in reverse order to maintain indices)
            markersToRemove.reverse().forEach(index => {
                restaurantMarkers.splice(index, 1);
            });
            
            // Add markers for newly visible restaurants (keep existing numbers)
            visibleRestaurants.forEach(restaurant => {
                const hasMarker = restaurantMarkers.some(marker => 
                    marker.getLatLng().lat === restaurant.lat && 
                    marker.getLatLng().lng === restaurant.lon
                );
                
                if (!hasMarker) {
                    const index = currentRestaurants.findIndex(r => 
                        r.lat === restaurant.lat && r.lon === restaurant.lon
                    );
                    
                    // Use existing number if available, otherwise assign next available number
                    let displayNumber = restaurantNumbering.get(index);
                    if (!displayNumber) {
                        // Find the next available number
                        const usedNumbers = new Set(Array.from(restaurantNumbering.values()));
                        displayNumber = 1;
                        while (usedNumbers.has(displayNumber)) {
                            displayNumber++;
                        }
                    restaurantNumbering.set(index, displayNumber);
                    }
                    
                    const marker = createNumberedMarker(restaurant, index, displayNumber);
                    marker.addTo(map);
                    restaurantMarkers.push(marker);
                }
            });
        }

        // --- Geolocation: show user's location and compute distances ---
        let userMarker = null; let userCircle = null;
        const userIcon = L.divIcon({
            className: 'user-location-icon',
            html: '<div class="user-icon">👤</div>',
            iconSize: [30, 30], iconAnchor: [15, 15]
        });
        function plotUserLocation(lat, lon) {
            if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
            if (userCircle) { map.removeLayer(userCircle); userCircle = null; }
            userMarker = L.marker([lat, lon], { title: 'You are here', icon: userIcon }).addTo(map);
            userCircle = L.circle([lat, lon], { radius: 30, color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.2 }).addTo(map);
        }
        function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
            const R = 6371000; const toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        function formatDistanceMeters(m) {
            if (m < 1000) return `${Math.round(m)} m`;
            const km = m / 1000; return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
        }
        function updateListWithDistances(lat, lon) {
            // Don't reorder the list, just add distance information to existing items
            const listItems = restaurantList.querySelectorAll('[data-index]');
            listItems.forEach(item => {
                const idx = parseInt(item.dataset.index);
                const restaurant = currentRestaurants[idx];
                if (restaurant) {
                    const distance = haversineDistanceMeters(lat, lon, restaurant.lat, restaurant.lon);
                    const nameElement = item.querySelector('h3');
                    if (nameElement) {
                        // Update the name to include distance, but keep the same order
                        nameElement.innerHTML = `${restaurant.name} <span class="text-gray-500 text-sm">• ${formatDistanceMeters(distance)}</span>`;
                    }
                }
            });
        }
        function isMobileDevice() { return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
        if (isMobileDevice() && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude; const lon = pos.coords.longitude;
                plotUserLocation(lat, lon);
                updateListWithDistances(lat, lon);
            }, (_) => {}, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
        }

        // --- Drawer resize logic (mobile) ---
        function isMobile() { return window.innerWidth < 768; }
        function getMainHeight() {
            const headerH = headerEl ? headerEl.offsetHeight : 60;
            return Math.max(0, window.innerHeight - headerH);
        }
        function getDrawerHeightPx() {
            const cs = getComputedStyle(document.documentElement);
            const val = cs.getPropertyValue('--drawer-height').trim();
            if (val.endsWith('vh')) {
                const num = parseFloat(val);
                return getMainHeight() * (num / 100);
            }
            if (val.endsWith('px')) {
                return parseFloat(val);
            }
            return asideEl ? asideEl.getBoundingClientRect().height : 0;
        }
        function setDrawerHeightPx(px) {
            document.documentElement.style.setProperty('--drawer-height', px + 'px');
            requestAnimationFrame(() => { map.invalidateSize(); });
        }

        let dragging = false;
        let startY = 0;
        let startHeight = 0;

        function onMove(clientY) {
            const delta = startY - clientY;
            const mainH = getMainHeight();
            const minH = Math.min(220, Math.max(120, mainH * 0.2));
            const maxH = Math.max(mainH - 120, mainH * 0.85);
            const next = Math.max(minH, Math.min(maxH, startHeight + delta));
            setDrawerHeightPx(next);
        }

        function onEnd() {
            if (!dragging) return;
            dragging = false;
            const mainH = getMainHeight();
            const current = getDrawerHeightPx();
            const ratios = [0.25, 0.5, 0.75];
            let best = current;
            let bestDiff = Infinity;
            ratios.forEach(r => {
                const px = r * mainH;
                const d = Math.abs(px - current);
                if (d < bestDiff) { best = px; bestDiff = d; }
            });
            if (bestDiff <= mainH * 0.1) setDrawerHeightPx(best);
            map.invalidateSize();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onTouchMove, { passive: false });
            window.removeEventListener('touchend', onTouchEnd);
        }

        function onMouseMove(e) { if (dragging) onMove(e.clientY); }
        function onMouseUp() { onEnd(); }
        function onTouchMove(e) { if (dragging) { e.preventDefault(); onMove(e.touches[0].clientY); } }
        function onTouchEnd() { onEnd(); }

        let handleListenersAttached = false;
        function enableHandleIfMobile() {
            if (!handleEl) return;
            if (isMobile()) {
                handleEl.style.display = '';
                if (!handleListenersAttached) {
                    handleEl.addEventListener('mousedown', function(e) {
                        dragging = true;
                        startY = e.clientY;
                        startHeight = getDrawerHeightPx();
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                    });
                    handleEl.addEventListener('touchstart', function(e) {
                        dragging = true;
                        startY = e.touches[0].clientY;
                        startHeight = getDrawerHeightPx();
                        window.addEventListener('touchmove', onTouchMove, { passive: false });
                        window.addEventListener('touchend', onTouchEnd);
                    }, { passive: true });
                    handleListenersAttached = true;
                }
            } else {
                handleEl.style.display = 'none';
            }
        }

        enableHandleIfMobile();
        window.addEventListener('resize', function() {
            if (!isMobile()) {
                document.documentElement.style.removeProperty('--drawer-height');
                map.invalidateSize();
            }
            enableHandleIfMobile();
        });
        
        function createListItem(restaurant, index, displayNumber = null) {
            const listItem = document.createElement('div');
            listItem.setAttribute('data-index', index);
            listItem.id = `restaurant-item-${index}`;
            listItem.className = 'bg-white p-2 md:p-4 rounded cursor-pointer hover:bg-gray-100 transition border border-gray-200 flex items-start';
            
            // Get display number if not provided
            if (displayNumber === null) {
                displayNumber = restaurantNumbering.get(index) || (restaurantMarkers.length + 1);
            }
            
            listItem.innerHTML = `
                <div class="restaurant-number">${displayNumber}</div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-gray-900 text-base md:text-lg font-bold truncate">${restaurant.name}</h3>
                    <p class="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">${restaurant.description}</p>
                    <button class="directions-button">
                        <span class="directions-icon">🧭</span>
                        <span class="hidden md:inline">Directions</span>
                    </button>
                </div>
            `;
            
            // Add directions button event listener
            const directionsBtn = listItem.querySelector('.directions-button');
            directionsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDirections(restaurant);
            });
            
            // Preload video on hover for faster loading
            listItem.addEventListener('mouseenter', () => {
                const videoId = extractVideoId(restaurant.tiktok_embed_html);
                if (videoId && !preloadedVideos.has(videoId)) {
                    preloadVideo(videoId);
                }
            });
            
            listItem.addEventListener('click', () => {
                showVideoFor(restaurant, index);
                highlightListItem(index);
                map.flyTo([restaurant.lat, restaurant.lon], 15);
            });
            return listItem;
        }

        function highlightListItem(index) {
            const all = restaurantList.querySelectorAll('[data-index]');
            all.forEach(el => el.classList.remove('active-list-item'));
            const target = document.getElementById(`restaurant-item-${index}`);
            if (target) {
                target.classList.add('active-list-item');
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function showVideoFor(restaurant, index) {
            videoContainer.innerHTML = '';
            if (videoTitleEl) {
                videoTitleEl.textContent = restaurant.name || '';
                videoTitleEl.classList.remove('hidden');
            }
            videoModal.classList.add('show');
            highlightListItem(index);
            
            const videoId = extractVideoId(restaurant.tiktok_embed_html);
            
            if (!videoId) {
                showVideoErrorState();
                return;
            }

            // Check if video is already cached/preloaded
            if (videoCache.has(videoId)) {
                const cachedIframe = videoCache.get(videoId);
                const clonedIframe = cachedIframe.cloneNode(true);
                clonedIframe.style.opacity = '1';
                clonedIframe.style.transition = 'opacity 0.3s ease';
                videoContainer.appendChild(clonedIframe);
                return;
            }

            // Show loading state for non-cached videos
            showVideoLoadingState();
            
            // Create optimized iframe
            const iframe = document.createElement('iframe');
            iframe.width = '330';
            iframe.height = '585';
            iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('loading', 'eager');
            iframe.style.background = '#000';
            iframe.style.border = 'none';
            iframe.style.opacity = '0';
            iframe.style.transition = 'opacity 0.3s ease';
            
            // Optimize connection with preconnect hints
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = 'https://www.tiktok.com';
            document.head.appendChild(link);
            
            // Add load event listener
            iframe.addEventListener('load', () => {
                hideVideoLoadingState();
                iframe.style.opacity = '1';
                // Cache the loaded iframe for future use
                videoCache.set(videoId, iframe.cloneNode(true));
            });
            
            iframe.addEventListener('error', () => {
                showVideoErrorState();
            });
            
            // Set source with optimized parameters
            iframe.src = `https://www.tiktok.com/embed/${videoId}?lang=en-US&autoplay=0&mute=1`;
            
            videoContainer.appendChild(iframe);
        }

        function showVideoLoadingState() {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'video-loading';
            loadingDiv.innerHTML = `
                <div class="video-loading-spinner"></div>
                <div class="video-loading-text">Loading video...</div>
            `;
            videoContainer.appendChild(loadingDiv);
        }

        function hideVideoLoadingState() {
            const loadingDiv = videoContainer.querySelector('.video-loading');
            if (loadingDiv) {
                loadingDiv.remove();
            }
        }

        function showVideoErrorState() {
            hideVideoLoadingState();
            const errorDiv = document.createElement('div');
            errorDiv.className = 'video-loading';
            errorDiv.innerHTML = `
                <div class="tiktok-logo">⚠️</div>
                <div class="video-loading-text">Failed to load video</div>
            `;
            videoContainer.appendChild(errorDiv);
        }

    function closeVideo() {
        videoModal.classList.remove('show');
        videoContainer.innerHTML = '';
    }
    closeVideoBtn.addEventListener('click', closeVideo);
        videoModal.addEventListener('click', (e) => e.target === videoModal && closeVideo());
    
    } catch (error) {
        console.error("An error occurred during initialization:", error);
        // Optionally, display a user-friendly error message on the page
        document.body.innerHTML = `<div style="color: white; padding: 20px;">
            <h1>Something went wrong</h1>
            <p>Could not load the map. Please check the developer console for more details.</p>
        </div>`;
    }
});
