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
        // State management - Global scope for tests
        window.currentRestaurants = [];
        window.restaurantMarkers = [];
        window.map = null; // Define map in a broader scope
        window.mapInitialized = false; // Prevent double initialization
        window.allCuisines = []; // Store all available cuisines for filtering
        window.favoritedRestaurants = new Set();
        window.markerClusterGroup = null; // Marker cluster group for map clustering
        
        // Local references for backward compatibility
        let currentRestaurants = window.currentRestaurants;
        let restaurantMarkers = window.restaurantMarkers;
        let map = window.map;
        let mapInitialized = window.mapInitialized;
        let allCuisines = window.allCuisines;
        let favoritedRestaurants = window.favoritedRestaurants;
        let markerClusterGroup = window.markerClusterGroup;

        // --- Authentication ---
        const authContainer = document.getElementById('auth-container');
        const authBtn = document.getElementById('auth-btn');
        const authModal = document.getElementById('auth-modal');
        const closeAuthModalBtn = document.getElementById('close-auth-modal');
        const switchAuthModeLink = document.getElementById('switch-auth-mode');
        const authTitle = document.getElementById('auth-title');
        const authFeedback = document.getElementById('auth-feedback');

        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const googleLoginBtn = document.getElementById('google-login-btn');

        // Note: userDropdown, userEmailEl, and logoutBtn are no longer used
        // We now use a simple logout button instead of a dropdown

        // --- Auth UI Logic ---
        function openAuthModal() {
            authModal.classList.remove('hidden');
            authModal.classList.add('flex');
        }

        function closeAuthModal() {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
            authFeedback.classList.add('hidden'); // Hide feedback on close
        }

        function switchToSignUp() {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            authTitle.textContent = 'Sign Up';
            switchAuthModeLink.textContent = 'Already have an account? Login';
            authFeedback.classList.add('hidden');
        }

        function switchToLogin() {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authTitle.textContent = 'Login';
            switchAuthModeLink.textContent = 'Need an account? Sign Up';
            authFeedback.classList.add('hidden');
        }

        function showAuthFeedback(message, isError = true) {
            authFeedback.textContent = message;
            authFeedback.className = isError ? 'text-sm text-red-500 mb-4' : 'text-sm text-green-500 mb-4';
            authFeedback.classList.remove('hidden');
        }

        // --- Auth State Management ---
        async function updateUserUI(user) {
            if (user) {
                // User is logged in - show logout button instead of login button
                authBtn.classList.add('hidden');
                
                // Create or update logout button
                let logoutButton = document.getElementById('logout-button');
                if (!logoutButton) {
                    logoutButton = document.createElement('button');
                    logoutButton.id = 'logout-button';
                    logoutButton.className = 'bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm rounded px-2 py-1 md:px-3 md:py-2 transition-colors';
                    logoutButton.innerHTML = 'Logout';
                    
                    // Insert after auth button
                    authBtn.parentNode.insertBefore(logoutButton, authBtn.nextSibling);
                    
                    // Add click event
                    logoutButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        handleLogout();
                    });
                }
                
                logoutButton.classList.remove('hidden');

                // Fetch user's favorites
                const { data, error } = await supabaseClient
                    .from('user_favorites')
                    .select('restaurant_id')
                    .eq('user_id', user.id);

                if (error) {
                    console.error('Error fetching favorites:', error);
                } else {
                    favoritedRestaurants = new Set(data.map(fav => fav.restaurant_id));
                }

                // Re-display restaurants to show correct favorite status
                displayRestaurants(currentRestaurants);
                
            } else {
                // User is logged out - show login button
                authBtn.classList.remove('hidden');
                
                // Hide logout button if it exists
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.classList.add('hidden');
                }
                
                favoritedRestaurants.clear(); // Clear favorites on logout
                displayRestaurants(currentRestaurants); // Re-display to remove favorite icons
            }
        }

        // --- Supabase Auth Logic ---
        async function handleSignUp(email, password) {
            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                });
                if (error) throw error;
                showAuthFeedback('Success! Please check your email for a confirmation link.', false);
                signupForm.reset();
            } catch (error) {
                showAuthFeedback(error.message);
            }
        }

        async function handleLogin(email, password) {
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password,
                });
                if (error) throw error;
                closeAuthModal();
            } catch (error) {
                showAuthFeedback(error.message);
            }
        }

        async function handleOAuthLogin(provider) {
            try {
                console.log('Starting OAuth login with provider:', provider);
                console.log('Current URL:', window.location.href);
                
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: provider,
                    options: {
                        redirectTo: window.location.href
                    }
                });
                
                if (error) {
                    console.error('OAuth error:', error);
                    throw error;
                }
                
                console.log('OAuth redirect initiated:', data);
                
            } catch (error) {
                console.error('OAuth login failed:', error);
                showAuthFeedback('Error with social login: ' + error.message);
            }
        }

        async function handleLogout() {
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
                // The onAuthStateChange listener will handle the UI update
            } catch (error) {
                alert('Error logging out: ' + error.message);
            }
        }

        // --- Auth Event Listeners ---
        authBtn.addEventListener('click', openAuthModal);
        closeAuthModalBtn.addEventListener('click', closeAuthModal);
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });

        switchAuthModeLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginForm.classList.contains('hidden')) {
                switchToLogin();
            } else {
                switchToSignUp();
            }
        });

        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSignUp(
                document.getElementById('signup-email').value,
                document.getElementById('signup-password').value
            );
        });

        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin(
                document.getElementById('login-email').value,
                document.getElementById('login-password').value
            );
        });

        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Google login button clicked');
            handleOAuthLogin('google');
        });


        // Note: logoutBtn event listener removed - we now create the logout button dynamically

        // --- Handle OAuth redirects ---
        async function handleOAuthRedirect() {
            // Check for OAuth tokens in URL hash
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const error = hashParams.get('error');
            
            if (error) {
                console.error('OAuth error in URL:', error);
                showAuthFeedback('OAuth authentication failed: ' + error);
                // Clear the hash
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
            
            if (accessToken && refreshToken) {
                console.log('OAuth redirect detected, processing tokens...');
                
                try {
                    // Set the session manually
                    const { data, error } = await supabaseClient.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });
                    
                    if (error) {
                        console.error('Error setting session:', error);
                        showAuthFeedback('Failed to complete authentication: ' + error.message);
                    } else {
                        console.log('OAuth authentication successful:', data);
                        // Close the auth modal if it's open
                        closeAuthModal();
                    }
                } catch (error) {
                    console.error('Error processing OAuth tokens:', error);
                    showAuthFeedback('Failed to complete authentication: ' + error.message);
                }
                
                // Clear the hash from URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        // --- Check auth state on page load and when it changes ---
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            const user = session ? session.user : null;
            updateUserUI(user);
        });

        // Handle OAuth redirect on page load
        handleOAuthRedirect();

        // --- Initialization ---
        initializeMap();
        await loadCitiesAndInitialRestaurants();
        setupCuisineFilter();
        setupAdminLogin();
        
        // Handle window resize to ensure proper filter behavior
        window.addEventListener('resize', function() {
            const filterDesktop = document.getElementById('cuisine-filter-desktop');
            const filterModal = document.getElementById('filter-modal');
            
            // On mobile, hide desktop filter
            if (window.innerWidth < 768) {
                if (filterDesktop) filterDesktop.classList.add('hidden');
                if (filterModal) filterModal.classList.add('hidden');
            }
        });

        // --- Core Functions ---

        // Add this new function to script.js
        async function toggleFavorite(restaurantId) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                openAuthModal(); // Open the auth modal
                switchToSignUp(); // Switch to sign-up form
                return;
            }

            const userId = session.user.id;
            const isFavorited = favoritedRestaurants.has(restaurantId);
            const favoriteBtn = document.querySelector(`.favorite-btn[data-restaurant-id="${restaurantId}"]`);

            if (isFavorited) {
                // Remove from favorites
                const { error } = await supabaseClient
                    .from('user_favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('restaurant_id', restaurantId);

                if (error) {
                    console.error('Error removing favorite:', error);
                } else {
                    favoritedRestaurants.delete(restaurantId);
                    favoriteBtn?.classList.remove('favorited');
                    // Refresh markers to update gold border
                    displayRestaurants(currentRestaurants);
                }
            } else {
                // Add to favorites
                const { error } = await supabaseClient
                    .from('user_favorites')
                    .insert({ user_id: userId, restaurant_id: restaurantId });

                if (error) {
                    console.error('Error adding favorite:', error);
                } else {
                    favoritedRestaurants.add(restaurantId);
                    favoriteBtn?.classList.add('favorited');
                    // Refresh markers to update gold border
                    displayRestaurants(currentRestaurants);
                }
            }
        }

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

                // Initialize the marker cluster group with tighter clustering
                window.markerClusterGroup = L.markerClusterGroup({
                    maxClusterRadius: 20, // Only cluster markers within 20 pixels of each other
                    disableClusteringAtZoom: 18, // Disable clustering at high zoom levels
                    spiderfyOnMaxZoom: true, // Show individual markers when zoomed in
                    showCoverageOnHover: false, // Don't show coverage area on hover
                    zoomToBoundsOnClick: true, // Zoom to show all markers in cluster when clicked
                    chunkedLoading: true // Load markers in chunks for better performance
                });
                map.addLayer(window.markerClusterGroup);
                markerClusterGroup = window.markerClusterGroup;
                
                // Add geolocation functionality
                addUserLocationMarker();
                
                window.mapInitialized = true;
                mapInitialized = window.mapInitialized;
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
                    cuisines (name, icon, color_background, color_text)
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
                    // Push the whole cuisine object
                    if (rc.cuisines) {
                        cuisineMap.get(rc.restaurant_id).push(rc.cuisines);
                    }
                });
            }

            window.currentRestaurants = restaurants.map(r => ({
                ...r,
                tiktok_embed_html: tiktokMap.get(r.id) || null,
                cuisines: cuisineMap.get(r.id) || []
            }));
            currentRestaurants = window.currentRestaurants;
            
            displayRestaurants(currentRestaurants);
        }

        // Setup cuisine filter functionality
        function setupCuisineFilter() {
            // Populate cuisine filter checkboxes for both desktop and mobile
            populateCuisineFilter();
            
            // Setup filter toggle button
            setupFilterToggle();
            
            // Setup desktop filter modal
            setupDesktopFilterModal();
            
            // Setup mobile filter modal
            setupMobileFilterModal();
        }
        
        // Populate cuisine filter with all available cuisines
        async function populateCuisineFilter() {
            try {
                console.log('🍽️ Loading cuisines for filter from database...');
                
                // Fetch all categories and their cuisines from database
                const { data: categories, error } = await supabaseClient
                    .from('cuisine_categories')
                    .select(`
                        id,
                        name,
                        icon,
                        cuisines ( id, name, icon, color_background, color_text )
                    `)
                    .order('name');

                if (error) throw error;

                console.log('🍽️ Loaded cuisine categories:', categories.length);

                // Transform database data to match expected format
                const cuisineCategories = categories.map(category => ({
                    title: category.name,
                    emoji: category.icon || '🍽️',
                    color: 'blue', // Default color for categories
                    cuisines: category.cuisines.map(cuisine => ({
                        name: cuisine.name,
                        emoji: cuisine.icon || '🍽️',
                        color_background: cuisine.color_background,
                        color_text: cuisine.color_text
                    }))
                }));
                
                // Flatten all cuisines for filtering logic
                window.allCuisines = cuisineCategories.flatMap(category => 
                    category.cuisines.map(cuisine => cuisine.name)
                );
                allCuisines = window.allCuisines;
                
                // Populate desktop filter with categories
                populateDesktopFilterWithCategories(cuisineCategories);
                
                // Populate mobile filter with categories
                populateMobileFilterWithCategories(cuisineCategories);
                
                console.log('🍽️ Cuisine filter populated successfully');
            } catch (error) {
                console.error('🍽️ Error loading cuisines for filter:', error);
                // Fallback to empty state
                window.allCuisines = [];
                allCuisines = window.allCuisines;
                populateDesktopFilterWithCategories([]);
                populateMobileFilterWithCategories([]);
            }
        }
        
        // Populate desktop filter with beautiful categories
        function populateDesktopFilterWithCategories(cuisineCategories) {
            const container = document.getElementById('cuisine-filter-container-desktop');
            if (!container) {
                console.error('Desktop filter container not found!');
                return;
            }
            
            console.log('Populating desktop filter with categories:', cuisineCategories.length);
            container.innerHTML = '';
            
            cuisineCategories.forEach(category => {
                const categorySection = document.createElement('div');
                categorySection.className = 'space-y-3';
                
                // Category header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'flex items-center space-x-3 pb-2 border-b border-gray-200';
                categoryHeader.innerHTML = `
                    <span class="text-2xl">${category.emoji}</span>
                    <h4 class="text-lg font-semibold text-gray-800">${category.title}</h4>
                `;
                
                // Cuisine grid
                const cuisineGrid = document.createElement('div');
                cuisineGrid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3';
                
                category.cuisines.forEach(cuisine => {
                    const cuisineCard = document.createElement('div');
                    cuisineCard.className = 'cuisine-card relative group cursor-pointer';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `desktop-cuisine-${cuisine.name}`;
                    checkbox.value = cuisine.name;
                    checkbox.className = 'cuisine-checkbox absolute inset-0 opacity-0 cursor-pointer z-10';
                    
                    const cardContent = document.createElement('div');
                    const bgColor = cuisine.color_background || '#F3F4F6';
                    const textColor = cuisine.color_text || '#374151';
                    cardContent.className = 'cuisine-card-content p-4 border-2 border-gray-200 rounded-xl transition-all duration-200 group-hover:border-blue-300 group-hover:shadow-md h-full';
                    cardContent.style.backgroundColor = bgColor;
                    cardContent.style.color = textColor;
                    cardContent.innerHTML = `
                        <div class="text-center">
                            <div class="text-2xl mb-2">${cuisine.emoji}</div>
                            <div class="text-sm font-medium">${cuisine.name}</div>
                        </div>
                    `;
                    
                    cuisineCard.appendChild(cardContent);
                    cuisineCard.appendChild(checkbox);
                    cuisineGrid.appendChild(cuisineCard);
                    
                    // Add event listener for checkbox
                    checkbox.addEventListener('change', function() {
                        console.log('Desktop cuisine checkbox changed:', cuisine.name, 'checked:', this.checked);
                        updateCuisineCardStyle(cuisineCard, this.checked);
                        updateSelectedCount();
                    });
                    
                    // Add click listener to the entire card
                    cuisineCard.addEventListener('click', function(e) {
                        // Don't trigger if clicking the checkbox directly
                        if (e.target === checkbox) return;
                        
                        console.log('Card clicked for cuisine:', cuisine.name);
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    });
                });
                
                categorySection.appendChild(categoryHeader);
                categorySection.appendChild(cuisineGrid);
                container.appendChild(categorySection);
            });
        }
        
        // Update cuisine card style based on selection
        function updateCuisineCardStyle(card, isSelected) {
            const content = card.querySelector('.cuisine-card-content');
            if (isSelected) {
                content.classList.remove('border-gray-200', 'bg-white');
                content.classList.add('border-blue-500', 'bg-blue-50', 'shadow-md');
            } else {
                content.classList.remove('border-blue-500', 'bg-blue-50', 'shadow-md');
                content.classList.add('border-gray-200', 'bg-white');
            }
        }
        
        // Update selected count in filter button
        function updateSelectedCount() {
            const selectedCount = document.querySelectorAll('.cuisine-checkbox:checked').length;
            const countElement = document.getElementById('selected-count');
            
            console.log('Updating selected count:', selectedCount);
            
            if (selectedCount > 0) {
                countElement.textContent = selectedCount;
                countElement.classList.remove('hidden');
            } else {
                countElement.classList.add('hidden');
            }
        }
        
        // Populate mobile filter with categories
        function populateMobileFilterWithCategories(cuisineCategories) {
            const container = document.getElementById('cuisine-filter-container-mobile');
            if (!container) {
                console.error('Mobile filter container not found!');
                return;
            }
            
            console.log('Populating mobile filter with categories:', cuisineCategories.length);
            container.innerHTML = '';
            
            cuisineCategories.forEach(category => {
                const categorySection = document.createElement('div');
                categorySection.className = 'mb-6';
                
                // Category header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = 'flex items-center space-x-2 pb-2 mb-3 border-b border-gray-200';
                categoryHeader.innerHTML = `
                    <span class="text-xl">${category.emoji}</span>
                    <h4 class="text-base font-semibold text-gray-800">${category.title}</h4>
                `;
                
                // Cuisine list
                const cuisineList = document.createElement('div');
                cuisineList.className = 'space-y-2';
                
                category.cuisines.forEach(cuisine => {
                    const cuisineItem = document.createElement('div');
                    cuisineItem.className = 'flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `mobile-cuisine-${cuisine.name}`;
                    checkbox.value = cuisine.name;
                    checkbox.className = 'cuisine-checkbox mr-3 text-blue-600 focus:ring-blue-500';
                    
                    const label = document.createElement('label');
                    label.htmlFor = `mobile-cuisine-${cuisine.name}`;
                    label.className = 'flex items-center flex-1 cursor-pointer';
                    
                    const bgColor = cuisine.color_background || '#F3F4F6';
                    const textColor = cuisine.color_text || '#374151';
                    
                    label.innerHTML = `
                        <span class="text-lg mr-2">${cuisine.emoji}</span>
                        <span class="text-sm font-medium" style="color: ${textColor};">${cuisine.name}</span>
                    `;
                    
                    // Add subtle background color
                    cuisineItem.style.backgroundColor = bgColor;
                    cuisineItem.style.opacity = '0.8';
                    
                    cuisineItem.appendChild(checkbox);
                    cuisineItem.appendChild(label);
                    cuisineList.appendChild(cuisineItem);
                });
                
                categorySection.appendChild(categoryHeader);
                categorySection.appendChild(cuisineList);
                container.appendChild(categorySection);
            });
        }
        
        // Populate a specific filter container with checkboxes (for mobile)
        function populateFilterContainer(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            // Clear existing checkboxes
            container.innerHTML = '';
            
            // Add cuisine checkboxes
            allCuisines.forEach(cuisine => {
                const checkboxContainer = document.createElement('div');
                checkboxContainer.className = 'flex items-center mb-2';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `${containerId}-cuisine-${cuisine}`;
                checkbox.value = cuisine;
                checkbox.className = 'cuisine-checkbox mr-2 text-blue-600 focus:ring-blue-500';
                
                const label = document.createElement('label');
                label.htmlFor = `${containerId}-cuisine-${cuisine}`;
                label.textContent = cuisine;
                label.className = 'text-sm text-gray-700 cursor-pointer flex-1';
                
                checkboxContainer.appendChild(checkbox);
                checkboxContainer.appendChild(label);
                container.appendChild(checkboxContainer);
                
                // Add event listener for each checkbox (only for mobile)
                if (containerId === 'cuisine-filter-container-mobile') {
                    checkbox.addEventListener('change', function() {
                        updateSelectedCount();
                    });
                }
            });
        }
        
        // Filter restaurants by selected cuisines (multiple selection)
        function filterRestaurantsByCuisines() {
            const selectedCuisines = getSelectedCuisines();
            
            // Update filter button appearance
            updateFilterButtonAppearance();
            
            if (selectedCuisines.length === 0) {
                // Show all restaurants if no cuisines selected
                displayRestaurants(currentRestaurants);
                // Fit map to show all restaurants
                fitMapToRestaurants(currentRestaurants);
            } else {
                // Filter restaurants that have ANY of the selected cuisines
                const filteredRestaurants = currentRestaurants.filter(restaurant => {
                    if (!restaurant.cuisines || restaurant.cuisines.length === 0) {
                        return false;
                    }
                    // Check if restaurant has at least one of the selected cuisines
                    const hasMatchingCuisine = selectedCuisines.some(selectedCuisine => 
                        restaurant.cuisines.some(cuisine => cuisine.name === selectedCuisine)
                    );
                    return hasMatchingCuisine;
                });
                displayRestaurants(filteredRestaurants);
                // Fit map to show filtered restaurants
                fitMapToRestaurants(filteredRestaurants);
            }
        }
        
        // Get selected cuisines from checkboxes
        function getSelectedCuisines() {
            // Get checkboxes from both desktop and mobile filters
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox:checked');
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox:checked');
            
            // Combine both sets of checkboxes
            const allCheckboxes = [...desktopCheckboxes, ...mobileCheckboxes];
            return Array.from(allCheckboxes).map(checkbox => checkbox.value);
        }
        
        // Update filter button appearance based on active filters
        function updateFilterButtonAppearance() {
            const filterBtn = document.getElementById('filter-toggle-btn');
            const selectedCuisines = getSelectedCuisines();
            const hasActiveFilters = selectedCuisines.length > 0;
            
            // Find or create the count element
            let countElement = filterBtn.querySelector('.filter-count');
            if (!countElement) {
                countElement = document.createElement('div');
                countElement.className = 'filter-count ml-2 px-2 py-1 bg-blue-500 bg-opacity-20 rounded-full text-xs font-medium';
                filterBtn.appendChild(countElement);
            }
            
            if (hasActiveFilters) {
                // Show count
                countElement.textContent = selectedCuisines.length;
                countElement.classList.remove('hidden');
            } else {
                // Hide count
                countElement.classList.add('hidden');
            }
        }

        // Clear all cuisine filters
        function clearAllCuisineFilters() {
            const checkboxes = document.querySelectorAll('.cuisine-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
                // Update desktop card styles
                const card = checkbox.closest('.cuisine-card');
                if (card) {
                    updateCuisineCardStyle(card, false);
                }
            });
            updateSelectedCount();
            updateFilterButtonAppearance();
            displayRestaurants(currentRestaurants);
            // Fit map to show all restaurants when filter is cleared
            fitMapToRestaurants(currentRestaurants);
        }
        
        // Setup filter toggle functionality
        function setupFilterToggle() {
            const filterToggleBtn = document.getElementById('filter-toggle-btn');
            
            filterToggleBtn.addEventListener('click', function() {
                console.log('Filter button clicked, window width:', window.innerWidth);
                // On mobile, open the mobile modal
                if (window.innerWidth < 768) {
                    console.log('Opening mobile filter modal');
                    openMobileFilterModal();
                } else {
                    // On desktop, open the desktop modal
                    console.log('Opening desktop filter modal');
                    openDesktopFilterModal();
                }
            });
        }
        
        // Setup desktop filter modal
        function setupDesktopFilterModal() {
            const filterModal = document.getElementById('desktop-filter-modal');
            const closeBtn = document.getElementById('close-desktop-filter-modal');
            const applyBtn = document.getElementById('apply-desktop-filter');
            const cancelBtn = document.getElementById('cancel-desktop-filter');
            const clearBtn = document.getElementById('clear-cuisine-filter-desktop');
            
            console.log('Setting up desktop filter modal...');
            console.log('Elements found:', {
                filterModal: !!filterModal,
                closeBtn: !!closeBtn,
                applyBtn: !!applyBtn,
                cancelBtn: !!cancelBtn,
                clearBtn: !!clearBtn
            });
            
            // Close modal
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    console.log('Close button clicked');
                    closeDesktopFilterModal();
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    console.log('Cancel button clicked');
                    closeDesktopFilterModal();
                });
            }
            
            if (applyBtn) {
                applyBtn.addEventListener('click', function() {
                    console.log('Apply button clicked');
                    applyDesktopFilter();
                });
            }
            
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    console.log('Clear button clicked');
                    clearDesktopFilter();
                });
            }
            
            // Close modal when clicking outside
            if (filterModal) {
                filterModal.addEventListener('click', function(e) {
                    if (e.target === filterModal) {
                        console.log('Clicked outside modal');
                        closeDesktopFilterModal();
                    }
                });
            }
        }
        
        // Setup mobile filter modal
        function setupMobileFilterModal() {
            const filterModal = document.getElementById('filter-modal');
            const closeBtn = document.getElementById('close-filter-modal');
            const applyBtn = document.getElementById('apply-filter-btn');
            const clearBtn = document.getElementById('clear-cuisine-filter-mobile');
            
            // Close modal
            closeBtn.addEventListener('click', closeMobileFilterModal);
            applyBtn.addEventListener('click', applyMobileFilter);
            clearBtn.addEventListener('click', clearMobileFilter);
            
            // Close modal when clicking outside
            filterModal.addEventListener('click', function(e) {
                if (e.target === filterModal) {
                    closeMobileFilterModal();
                }
            });
        }
        
        // Open desktop filter modal
        function openDesktopFilterModal() {
            console.log('Opening desktop filter modal...');
            const filterModal = document.getElementById('desktop-filter-modal');
            if (!filterModal) {
                console.error('Desktop filter modal not found!');
                return;
            }
            
            filterModal.classList.remove('hidden');
            filterModal.classList.add('md:flex');
            
            // Check if the container has content
            const container = document.getElementById('cuisine-filter-container-desktop');
            if (container) {
                console.log('Desktop filter container children:', container.children.length);
            }
            
            // Sync desktop checkboxes with current state
            syncDesktopFilterWithCurrent();
        }
        
        // Close desktop filter modal
        function closeDesktopFilterModal() {
            console.log('Closing desktop filter modal...');
            const filterModal = document.getElementById('desktop-filter-modal');
            if (filterModal) {
                filterModal.classList.add('hidden');
                filterModal.classList.remove('md:flex');
                console.log('Modal closed successfully');
            } else {
                console.error('Desktop filter modal not found!');
            }
        }
        
        // Apply desktop filter
        function applyDesktopFilter() {
            const selectedCuisines = getSelectedCuisines();
            
            // Apply the filter
            filterRestaurantsByCuisines();
            
            // Close modal
            closeDesktopFilterModal();
        }
        
        // Clear desktop filter
        function clearDesktopFilter() {
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox');
            desktopCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                const card = checkbox.closest('.cuisine-card');
                if (card) {
                    updateCuisineCardStyle(card, false);
                }
            });
            updateSelectedCount();
        }
        
        // Sync desktop filter with current state
        function syncDesktopFilterWithCurrent() {
            const currentSelected = getSelectedCuisines();
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox');
            
            desktopCheckboxes.forEach(checkbox => {
                const isSelected = currentSelected.includes(checkbox.value);
                checkbox.checked = isSelected;
                const card = checkbox.closest('.cuisine-card');
                if (card) {
                    updateCuisineCardStyle(card, isSelected);
                }
            });
            updateSelectedCount();
        }
        
        // Open mobile filter modal
        function openMobileFilterModal() {
            const filterModal = document.getElementById('filter-modal');
            filterModal.classList.remove('hidden');
            
            // Sync mobile checkboxes with desktop state
            syncMobileFilterWithDesktop();
        }
        
        // Close mobile filter modal
        function closeMobileFilterModal() {
            const filterModal = document.getElementById('filter-modal');
            filterModal.classList.add('hidden');
        }
        
        // Apply mobile filter
        function applyMobileFilter() {
            // Sync desktop checkboxes with mobile state
            syncDesktopFilterWithMobile();
            
            // Apply the filter
            filterRestaurantsByCuisines();
            
            // Close modal
            closeMobileFilterModal();
        }
        
        // Clear mobile filter
        function clearMobileFilter() {
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox');
            mobileCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // Sync mobile filter with desktop state
        function syncMobileFilterWithDesktop() {
            const currentSelected = getSelectedCuisines();
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox');
            
            mobileCheckboxes.forEach(checkbox => {
                checkbox.checked = currentSelected.includes(checkbox.value);
            });
        }
        
        // Sync desktop filter with mobile state
        function syncDesktopFilterWithMobile() {
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox');
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox');
            
            mobileCheckboxes.forEach((mobileCheckbox, index) => {
                if (desktopCheckboxes[index]) {
                    desktopCheckboxes[index].checked = mobileCheckbox.checked;
                    const card = desktopCheckboxes[index].closest('.cuisine-card');
                    if (card) {
                        updateCuisineCardStyle(card, mobileCheckbox.checked);
                    }
                }
            });
        }

        // Setup admin login functionality
        function setupAdminLogin() {
            const adminLink = document.getElementById('admin-link');
            const loginModal = document.getElementById('admin-login-modal');
            const loginForm = document.getElementById('admin-login-form');
            const cancelBtn = document.getElementById('cancel-login');
            const errorDiv = document.getElementById('login-error');
            
            // Open login modal when admin link is clicked
            adminLink.addEventListener('click', async function(e) {
                e.preventDefault();
                console.log('Admin link clicked');
                
                // Check if user is already logged in and has admin privileges
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    try {
                        const { data: userRole, error: roleError } = await supabaseClient
                            .from('user_roles')
                            .select('role')
                            .eq('user_id', session.user.id)
                            .eq('role', 'admin')
                            .single();
                        
                        if (userRole) {
                            console.log('User already has admin privileges, redirecting to admin panel');
                            window.location.href = 'admin.html';
                            return;
                        }
                    } catch (error) {
                        console.log('Error checking admin role:', error);
                    }
                }
                
                console.log('Opening login modal');
                loginModal.classList.remove('hidden');
                loginModal.classList.add('flex');
            });
            
            // Close modal when cancel is clicked
            cancelBtn.addEventListener('click', function() {
                closeLoginModal();
            });
            
            // Close modal when clicking outside
            loginModal.addEventListener('click', function(e) {
                if (e.target === loginModal) {
                    closeLoginModal();
                }
            });
            
            // Handle form submission
            loginForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                await handleAdminLogin();
            });
            
            function closeLoginModal() {
                loginModal.classList.add('hidden');
                loginModal.classList.remove('flex');
                loginForm.reset();
                errorDiv.classList.add('hidden');
            }
            
            async function handleAdminLogin() {
                const email = document.getElementById('admin-email').value;
                const password = document.getElementById('admin-password').value;
                
                try {
                    console.log('Attempting admin login for:', email);
                    console.log('Password length:', password.length);
                    
                    // Test Supabase connection first
                    console.log('Testing Supabase connection...');
                    const { data: testData, error: testError } = await supabaseClient.auth.getSession();
                    console.log('Supabase connection test result:', { testData, testError });
                    
                    // Sign in with Supabase
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });
                    
                    if (error) {
                        console.error('Supabase auth error:', error);
                        console.error('Error code:', error.status);
                        console.error('Error message:', error.message);
                        throw error;
                    }
                    
                    console.log('Login successful, checking admin status...');
                    
                    // Check if user has admin role
                    const { data: userRole, error: roleError } = await supabaseClient
                        .from('user_roles')
                        .select('role')
                        .eq('user_id', data.user.id)
                        .eq('role', 'admin')
                        .single();
                    
                    if (roleError || !userRole) {
                        throw new Error('Access denied. Admin privileges required.');
                    }
                    
                    console.log('Admin access granted, redirecting to admin panel');
                    
                    // Close modal and redirect
                    closeLoginModal();
                    window.location.href = 'admin.html';
                    
                } catch (error) {
                    console.error('Login error:', error);
                    errorDiv.textContent = error.message || 'Login failed. Please try again.';
                    errorDiv.classList.remove('hidden');
                }
            }
        }

        function fitMapToRestaurants(restaurants) {
            if (!map || !restaurants || restaurants.length === 0) {
                return;
            }
            
            // Create a LatLngBounds object to contain all restaurant locations
            const bounds = L.latLngBounds();
            
            // Add each restaurant's location to the bounds
            restaurants.forEach(restaurant => {
                bounds.extend([restaurant.lat, restaurant.lon]);
            });
            
            // Fit the map to show all restaurants with some padding
            map.fitBounds(bounds, {
                padding: [20, 20], // Add 20px padding around the bounds
                maxZoom: 16 // Don't zoom in too close if there are only a few restaurants
            });
        }

        function displayRestaurants(restaurants) {
            restaurantList.innerHTML = '';
            markerClusterGroup.clearLayers(); // Clear the cluster group instead of individual markers
            window.restaurantMarkers = []; // Also clear the local array
            restaurantMarkers = window.restaurantMarkers;

            if (restaurants.length === 0) {
                restaurantList.innerHTML = `<p class="text-gray-500 text-center">No restaurants found for this city.</p>`;
                return;
            }

            restaurants.forEach((restaurant, index) => {
                const listItem = createListItem(restaurant, index);
                restaurantList.appendChild(listItem);

                const marker = createNumberedMarker(restaurant, index);
                window.restaurantMarkers.push(marker); // Keep track of markers for other interactions
                restaurantMarkers = window.restaurantMarkers;
                markerClusterGroup.addLayer(marker); // Add the marker to the cluster group
            });
        }
        
        function createListItem(restaurant, index) {
            const listItem = document.createElement('div');
            // Add position: relative to the list item for the button
            listItem.className = 'bg-white p-2 md:p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition border border-gray-200 flex items-start relative';
            listItem.dataset.restaurantId = restaurant.id;

            const isFavorited = favoritedRestaurants.has(restaurant.id);
            const favoriteClass = isFavorited ? 'favorited' : '';
            const number = index + 1;

            const cuisineTags = restaurant.cuisines && restaurant.cuisines.length > 0 
                ? restaurant.cuisines.map(cuisine => {
                    // Use the new color values, with fallbacks just in case
                    const bgColor = cuisine.color_background || '#E5E7EB'; // Default to light gray
                    const textColor = cuisine.color_text || '#1F2937';     // Default to dark gray
                    const icon = cuisine.icon || '🍽️'; // Default to fork and knife emoji
                    return `<span class="inline-block text-xs px-2 py-1 rounded-full mr-1 mb-1" 
                                  style="background-color: ${bgColor}; color: ${textColor};">
                                ${icon} ${cuisine.name}
                            </span>`;
                }).join('')
                : '<span class="text-gray-400 text-xs">No cuisine info</span>';

            let distanceHtml = '';
            if (window.userLocation) {
                const distance = calculateDistance(window.userLocation.lat, window.userLocation.lon, restaurant.lat, restaurant.lon);
                distanceHtml = `<div class="mt-1 text-xs text-gray-500 flex items-center">
                    <span class="mr-1">📍</span>
                    <span>${distance} away</span>
                </div>`;
            }

            listItem.innerHTML = `
                <div class="flex-shrink-0 mr-3">
                    <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        ${number}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-gray-900 text-base md:text-lg font-bold truncate pr-8">${restaurant.name}</h3>
                    <p class="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">${restaurant.description || ''}</p>
                    <div class="mt-2 flex flex-wrap">${cuisineTags}</div>
                    ${distanceHtml}
                </div>
                <button class="favorite-btn ${favoriteClass}" data-restaurant-id="${restaurant.id}" title="Add to favorites">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                </button>
            `;

            // Main click event to open video
            listItem.addEventListener('click', (e) => {
                // Prevent opening video if the favorite button was clicked
                if (e.target.closest('.favorite-btn')) return;

                document.querySelectorAll('#restaurant-list .bg-white').forEach(card => card.classList.remove('active-list-item'));
                listItem.classList.add('active-list-item');
                showVideoFor(restaurant);
                map.flyTo([restaurant.lat, restaurant.lon], 15);
            });

            // Event listener for the favorite button
            const favoriteBtn = listItem.querySelector('.favorite-btn');
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the main card click event from firing
                toggleFavorite(restaurant.id);
            });

            // Add hover effects to highlight corresponding marker
            listItem.addEventListener('mouseenter', () => {
                highlightMarker(restaurant.id);
            });

            listItem.addEventListener('mouseleave', () => {
                unhighlightMarker(restaurant.id);
            });

            return listItem;
        }

        function createNumberedMarker(restaurant, index) {
            // Get the first cuisine icon, fallback to number if no cuisines
            const firstCuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines[0] : null;
            const displayContent = firstCuisine ? firstCuisine.icon : (index + 1);
            const isFavorited = favoritedRestaurants.has(restaurant.id);
            const favoritedClass = isFavorited ? 'favorited' : '';
            const icon = L.divIcon({
                className: 'numbered-marker',
                html: `<div class="numbered-marker-content ${favoritedClass}">${displayContent}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            
            const marker = L.marker([restaurant.lat, restaurant.lon], { 
                icon: icon,
                title: restaurant.name
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

        // Highlight marker on map when hovering over restaurant card
        function highlightMarker(restaurantId) {
            // Find the marker for this restaurant
            const marker = window.restaurantMarkers.find(m => {
                // Check if this marker belongs to the restaurant
                const markerLat = m.getLatLng().lat;
                const markerLon = m.getLatLng().lng;
                return window.currentRestaurants.some(restaurant => 
                    restaurant.id === restaurantId && 
                    Math.abs(restaurant.lat - markerLat) < 0.0001 && 
                    Math.abs(restaurant.lon - markerLon) < 0.0001
                );
            });

            if (marker) {
                // Add highlight class to the marker's icon
                const iconElement = marker.getElement();
                if (iconElement) {
                    iconElement.classList.add('highlighted');
                }
            }
        }

        // Remove highlight from marker when mouse leaves restaurant card
        function unhighlightMarker(restaurantId) {
            // Find the marker for this restaurant
            const marker = window.restaurantMarkers.find(m => {
                const markerLat = m.getLatLng().lat;
                const markerLon = m.getLatLng().lng;
                return window.currentRestaurants.some(restaurant => 
                    restaurant.id === restaurantId && 
                    Math.abs(restaurant.lat - markerLat) < 0.0001 && 
                    Math.abs(restaurant.lon - markerLon) < 0.0001
                );
            });

            if (marker) {
                // Remove highlight class from the marker's icon
                const iconElement = marker.getElement();
                if (iconElement) {
                    iconElement.classList.remove('highlighted');
                }
            }
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
    
    // Scroll to the restaurant in the side panel (desktop only)
    scrollToRestaurant(restaurant.id);
    
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

        function scrollToRestaurant(restaurantId) {
            // Only scroll on desktop (when the side panel is visible)
            if (window.innerWidth < 768) {
                return; // Don't scroll on mobile
            }
            
            const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
            if (!restaurantCard) return;
            
            const restaurantList = document.getElementById('restaurant-list');
            if (!restaurantList) return;
            
            // Wait a bit for any layout changes to complete
            setTimeout(() => {
                const cardTop = restaurantCard.offsetTop;
                const cardHeight = restaurantCard.offsetHeight;
                const containerHeight = restaurantList.offsetHeight;
                const scrollPosition = cardTop - (containerHeight / 2) + (cardHeight / 2);
                
                restaurantList.scrollTo({
                    top: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                });
            }, 100);
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
        
        // Check location availability and hide button only if user denies permission
        function checkLocationAvailability() {
            const locationBtn = document.getElementById('location-btn');
            if (!locationBtn) return;
            
            // Check if geolocation is supported
            if (!navigator.geolocation) {
                console.log('Geolocation not supported, hiding location button');
                locationBtn.style.display = 'none';
                return;
            }
            
            // Test geolocation permission
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    // Permission granted, keep button visible
                    console.log('Location permission granted');
                    locationBtn.style.display = 'block';
                },
                function(error) {
                    // Only hide button if user explicitly denied permission
                    if (error.code === error.PERMISSION_DENIED) {
                        console.log('Location permission explicitly denied, hiding button');
                        locationBtn.style.display = 'none';
                    } else {
                        // Other errors (timeout, unavailable, etc.) - keep button visible
                        console.log('Location error (not permission denied):', error.message);
                        locationBtn.style.display = 'block';
                    }
                },
                {
                    timeout: 1000, // Quick timeout for permission check
                    maximumAge: 0 // Don't use cached location
                }
            );
        }
        
        checkLocationAvailability();
        
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

// ========================================
// TEST SUITE - Run with runAllTests()
// ========================================

// Test result tracking
let testResults = {
    passed: 0,
    failed: 0,
    total: 0
};

// Test helper functions
function testPass(testName) {
    testResults.passed++;
    testResults.total++;
    console.log(`✅ ${testName}`);
}

function testFail(testName, error = '') {
    testResults.failed++;
    testResults.total++;
    console.log(`❌ ${testName}${error ? ` - ${error}` : ''}`);
}

function testSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📊 Total: ${testResults.total}`);
    console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));
    
    if (testResults.failed === 0) {
        console.log('🎉 All tests passed!');
    } else {
        console.log('⚠️ Some tests failed. Check the details above.');
    }
}

// Individual test functions
async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient.from('cities').select('*').limit(1);
        if (error) throw error;
        testPass('Supabase Connection');
    } catch (error) {
        testFail('Supabase Connection', error.message);
    }
}

function testMapInitialization() {
    try {
        if (window.map && window.mapInitialized) {
            testPass('Map Initialization');
        } else {
            throw new Error('Map not initialized');
        }
    } catch (error) {
        testFail('Map Initialization', error.message);
    }
}

function testRestaurantDataLoading() {
    try {
        if (window.currentRestaurants && window.currentRestaurants.length > 0) {
            testPass('Restaurant Data Loading');
        } else {
            throw new Error('No restaurant data loaded');
        }
    } catch (error) {
        testFail('Restaurant Data Loading', error.message);
    }
}

function testCuisineDataStructure() {
    try {
        if (window.currentRestaurants && window.currentRestaurants.length > 0) {
            const sampleRestaurant = window.currentRestaurants[0];
            if (sampleRestaurant.cuisines && Array.isArray(sampleRestaurant.cuisines)) {
                if (sampleRestaurant.cuisines.length > 0) {
                    const sampleCuisine = sampleRestaurant.cuisines[0];
                    if (sampleCuisine.name && sampleCuisine.icon) {
                        testPass('Cuisine Data Structure');
                    } else {
                        throw new Error('Cuisine data missing name or icon');
                    }
                } else {
                    testPass('Cuisine Data Structure (no cuisines)');
                }
            } else {
                throw new Error('Cuisines array not found');
            }
        } else {
            throw new Error('No restaurant data to test');
        }
    } catch (error) {
        testFail('Cuisine Data Structure', error.message);
    }
}

function testMarkerCreation() {
    try {
        if (window.restaurantMarkers && window.restaurantMarkers.length > 0) {
            testPass('Marker Creation');
        } else {
            throw new Error('No markers created');
        }
    } catch (error) {
        testFail('Marker Creation', error.message);
    }
}

function testClusterGroup() {
    try {
        if (window.markerClusterGroup) {
            testPass('Marker Cluster Group');
        } else {
            throw new Error('Marker cluster group not initialized');
        }
    } catch (error) {
        testFail('Marker Cluster Group', error.message);
    }
}

function testFilterFunctionality() {
    try {
        const filterToggle = document.getElementById('filter-toggle-btn');
        const desktopFilter = document.getElementById('desktop-filter-modal');
        const mobileFilter = document.getElementById('filter-modal');
        
        if (filterToggle && desktopFilter && mobileFilter) {
            testPass('Filter UI Elements');
        } else {
            throw new Error('Filter UI elements missing');
        }
    } catch (error) {
        testFail('Filter UI Elements', error.message);
    }
}

function testAuthenticationUI() {
    try {
        const authContainer = document.getElementById('auth-container');
        const authModal = document.getElementById('auth-modal');
        const authBtn = document.getElementById('auth-btn');
        
        if (authContainer && authModal && authBtn) {
            testPass('Authentication UI');
        } else {
            throw new Error('Authentication UI elements missing');
        }
    } catch (error) {
        testFail('Authentication UI', error.message);
    }
}

function testVideoModal() {
    try {
        const videoModal = document.getElementById('video-modal');
        const videoContainer = document.getElementById('video-container');
        
        if (videoModal && videoContainer) {
            testPass('Video Modal');
        } else {
            throw new Error('Video modal elements missing');
        }
    } catch (error) {
        testFail('Video Modal', error.message);
    }
}

function testRestaurantList() {
    try {
        const restaurantList = document.getElementById('restaurant-list');
        if (restaurantList) {
            testPass('Restaurant List Container');
        } else {
            throw new Error('Restaurant list container missing');
        }
    } catch (error) {
        testFail('Restaurant List Container', error.message);
    }
}

function testCitySelector() {
    try {
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            testPass('City Selector');
        } else {
            throw new Error('City selector missing');
        }
    } catch (error) {
        testFail('City Selector', error.message);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🧪 Starting ReelEats Test Suite...\n');
    testResults = { passed: 0, failed: 0, total: 0 };
    
    // Core functionality tests
    await testSupabaseConnection();
    testMapInitialization();
    testRestaurantDataLoading();
    testCuisineDataStructure();
    testMarkerCreation();
    testClusterGroup();
    
    // UI tests
    testFilterFunctionality();
    testAuthenticationUI();
    testVideoModal();
    testRestaurantList();
    testCitySelector();
    
    // Show summary
    testSummary();
}

// Auto-run tests after page loads
async function autoRunTests() {
    // Wait a bit for everything to initialize
    setTimeout(async () => {
        console.log('🚀 Auto-running tests after page load...\n');
        await runAllTests();
    }, 2000); // 2 second delay to ensure everything is loaded
}

// Make test runner available globally
window.runAllTests = runAllTests;

// Auto-run tests on page load
autoRunTests();

