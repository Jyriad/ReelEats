// --- Supabase Client Initialization (Fallback) ---
const SUPABASE_URL = 'https://jsuxrpnfofkigdfpnuua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Configuration Constants ---
const CONFIG = {
    STORAGE_KEYS: {
        WATCHED_VIDEOS: 'reelEats_watchedVideos',
        CITY_DATA: 'reelEats_cityData'
    },
    VIDEO_CONFIG: {
        IFRAME_TIMEOUT: 3000,
        FALLBACK_DELAY: 100
    },
    FEATURE_FLAGS: {
        THUMBNAIL_MARKERS: true,
        CITY_COLLAGES: true
    }
};

// --- Video Helper Functions ---
function extractVideoId(embedHtml) {
    const videoIdMatch = embedHtml.match(/data-video-id="(\d+)"/);
    return videoIdMatch ? videoIdMatch[1] : null;
}

function createVideoIframe(videoId) {
    return `
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
}

function handleIframeLoading(videoContainer, embedHtml, fallbackFunction) {
    setTimeout(() => {
        const iframe = videoContainer.querySelector('iframe');
        if (iframe) {
            iframe.onload = () => {
                console.log('✅ Direct iframe loaded');
            };
            iframe.onerror = () => {
                console.log('❌ Direct iframe failed, trying blockquote...');
                fallbackFunction();
            };
            
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (!iframeDoc || iframeDoc.body.children.length === 0) {
                        console.log('⚠️ Iframe appears empty, trying blockquote...');
                        fallbackFunction();
                    }
                } catch (e) {
                    console.log('✅ Iframe cross-origin (likely working)');
                }
            }, CONFIG.VIDEO_CONFIG.IFRAME_TIMEOUT);
        }
    }, CONFIG.VIDEO_CONFIG.FALLBACK_DELAY);
}

function showNoVideoMessage(videoContainer, restaurantName, additionalInfo = '') {
    const message = additionalInfo ? `No video available for ${restaurantName}. ${additionalInfo}` : `No video available for ${restaurantName}`;
    videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">${message}</div>`;
}

// --- Skeleton Loader Functions ---
function createSkeletonCard() {
    const skeletonCard = document.createElement('div');
    skeletonCard.className = 'bg-white rounded-lg border border-gray-200 p-3 md:p-4 relative touch-manipulation';
    skeletonCard.innerHTML = `
        <div class="w-full">
            <div class="flex items-start">
                <div class="flex-shrink-0 mr-3 flex flex-col items-center">
                    <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mb-2"></div>
                    <div class="skeleton-thumbnail"></div>
                </div>
                <div class="flex-1 min-w-0 pr-16">
            <div class="skeleton-title"></div>
            <div class="skeleton-description"></div>
            <div class="skeleton-description"></div>
            <div class="skeleton-tags">
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
            </div>
        </div>
            </div>
        </div>
        <div class="absolute top-2 right-2 flex items-center space-x-1">
            <div class="w-8 h-8 bg-gray-200 rounded"></div>
            <div class="w-8 h-8 bg-gray-200 rounded"></div>
        </div>
    `;
    return skeletonCard;
}

function showSkeletonLoaders(count = 6) {
    const restaurantList = document.getElementById('restaurant-list');
    if (!restaurantList) return;
    
    restaurantList.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const skeletonCard = createSkeletonCard();
        restaurantList.appendChild(skeletonCard);
    }
}

async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from('cities')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        return { testData: data, testError: null };
    } catch (error) {
        return { testData: null, testError: error };
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // --- Handle Email Confirmation First ---
        handleEmailConfirmation();
        
        // --- UI Element References ---
        const mapElement = document.getElementById('map');
        const restaurantList = document.getElementById('restaurant-list');
        const videoModal = document.getElementById('video-modal');
        const videoContainer = videoModal ? videoModal.querySelector('.video-container') : null;
        const videoTitleEl = document.getElementById('video-title');
        const closeVideoBtn = document.getElementById('close-video-btn');
        // City select removed - now using city switcher modal
        
        // Check if essential elements exist (skip for homepage)
        const isHomepage = window.location.pathname.includes('index.html') || window.location.pathname === '/';

        if (!mapElement) {
            if (isHomepage) {
                console.log('Homepage detected - no map element needed');
                return; // Exit early for homepage
            }
            throw new Error('Map element not found');
        }
        if (!restaurantList) {
            if (isHomepage) {
                console.log('Homepage detected - no restaurant list needed');
                return; // Exit early for homepage
            }
            throw new Error('Restaurant list element not found');
        }
        // Video modal is optional - don't throw error if not found
        
        // --- State Management ---
        // State management - Global scope for tests
        window.currentRestaurants = [];
        window.restaurantMarkers = [];
        window.map = null; // Define map in a broader scope
        window.mapInitialized = false; // Prevent double initialization
        window.allCuisines = []; // Store all available cuisines for filtering
        window.favoritedRestaurants = new Set();
        window.markerClusterGroup = null; // Marker cluster group for map clustering
        
        // Watched videos state management (session-only)
        let watchedVideos = new Set();
        
        // Collected restaurants state management
        let collectedRestaurants = new Set();
        let selectedCollections = new Set();
        let userCollections = [];
        
        // Filter state persistence
        let selectedCuisines = new Set();
        
        // --- Router Function ---
        async function initializeApp() {
            // Determine route: explore all, city, or creator handle (/@handle)
            const path = window.location.pathname;
            const firstSegment = path.split('/')[1] || '';

            // Check for URL query parameters
            const urlParams = new URLSearchParams(window.location.search);
            const queryCity = urlParams.get('city');

            let city = null;
            let creatorHandle = null; // lowercase without leading @
            let formattedHeading = 'Explore All';

            if (firstSegment === '' || firstSegment === 'explore') {
                // Check for city query parameter first
                if (queryCity) {
                    city = queryCity;
                    formattedHeading = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
                    document.title = `ReelGrub - ${formattedHeading}`;
                    console.log(`🏙️ Loading restaurants for city (query): ${formattedHeading}`);
                } else {
                formattedHeading = 'Explore All';
                document.title = 'ReelGrub - Discover Your Next Spot';
                console.log('🌍 Loading all restaurants (explore all)');
                }
            } else if (firstSegment === 'city') {
                // New city route: /city/:city
                const cityParam = (path.split('/')[2] || '').trim();
                if (cityParam) {
                    city = cityParam;
                    formattedHeading = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
                    document.title = `ReelGrub - ${formattedHeading}`;
                    console.log(`🏙️ Loading restaurants for city: ${formattedHeading}`);
                }
            } else if (firstSegment.startsWith('@')) {
                // Creator route: /@handle
                creatorHandle = firstSegment.substring(1).toLowerCase();
                formattedHeading = `@${creatorHandle}`;
                document.title = `ReelGrub - ${formattedHeading}`;
                console.log(`👤 Loading restaurants for creator: ${formattedHeading}`);
            } else {
                // Back-compat: treat bare /:city as city until old links fade
                city = firstSegment;
                formattedHeading = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
                document.title = `ReelGrub - ${formattedHeading}`;
                console.log(`🏙️ Loading restaurants for city (legacy): ${formattedHeading}`);
                // Redirect to new query parameter format
                window.location.href = `/explore?city=${encodeURIComponent(city)}`;
                return; // Exit early since we're redirecting
            }
            
            // Display the current city name in the new UI elements
            const currentCityHeading = document.getElementById('current-city-heading');
            const currentCityMobile = document.getElementById('current-city-mobile');
            
            if (currentCityHeading) currentCityHeading.textContent = formattedHeading;
            if (currentCityMobile) currentCityMobile.textContent = formattedHeading;
            
            // Fetch ALL unique cities to populate the switcher modal
            try {
                const { data: allCities, error: citiesError } = await supabaseClient
                    .from('cities')
                    .select('name')
                    .order('name', { ascending: true });

                if (allCities) {
                    populateCitySwitcher(allCities);
                } else if (citiesError) {
                    console.error('Error fetching cities:', citiesError);
                }
            } catch (error) {
                console.error('Error fetching cities for switcher:', error);
            }
            
            // Load restaurants filtered by city OR creator
            if (creatorHandle) {
                await loadRestaurantsForCreator(creatorHandle);
            } else {
                await loadRestaurantsForCity(city);
            }
        }
        
        // Populate city switcher modal with all available cities
        function populateCitySwitcher(cities) {
            const cityList = document.getElementById('modal-city-list');
            if (!cityList) return;
            
            cityList.innerHTML = ''; // Clear previous list
            
            // Add "Explore All" option at the top
            const allLi = document.createElement('li');
            allLi.textContent = 'Explore All';
            allLi.dataset.city = '';
            cityList.appendChild(allLi);
            
            // Add all cities
            cities.forEach(cityObj => {
                const li = document.createElement('li');
                li.textContent = cityObj.name;
                li.dataset.city = cityObj.name.toLowerCase();
                cityList.appendChild(li);
            });
        }
        
        // Load watched videos from localStorage
        // Removed loadWatchedVideos() - now using session-only tracking
        
        // Load filter states from localStorage
        function loadFilterStates() {
            // Load selected cuisines
            const savedCuisines = localStorage.getItem('selectedCuisines');
            if (savedCuisines) {
                selectedCuisines = new Set(JSON.parse(savedCuisines));
                console.log('🔄 Loaded saved cuisines:', Array.from(selectedCuisines));
            }
            
            // Load selected collections
            const savedCollections = localStorage.getItem('selectedCollections');
            if (savedCollections) {
                selectedCollections = new Set(JSON.parse(savedCollections));
                console.log('🔄 Loaded saved collections:', Array.from(selectedCollections));
            }
        }
        
        // Save filter states to localStorage
        function saveFilterStates() {
            localStorage.setItem('selectedCuisines', JSON.stringify(Array.from(selectedCuisines)));
            localStorage.setItem('selectedCollections', JSON.stringify(Array.from(selectedCollections)));
            console.log('💾 Saved filter states:', {
                cuisines: Array.from(selectedCuisines),
                collections: Array.from(selectedCollections)
            });
        }
        
        // Sync cuisine checkboxes with persistent state
        function syncCuisineCheckboxes() {
            const allCheckboxes = document.querySelectorAll('.cuisine-checkbox');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = selectedCuisines.has(checkbox.value);
            });
        }
        
        // Sync collection checkboxes with persistent state
        function syncCollectionCheckboxes() {
            const allCheckboxes = document.querySelectorAll('.collection-checkbox input[type="checkbox"]');
            allCheckboxes.forEach(checkbox => {
                checkbox.checked = selectedCollections.has(checkbox.value);
            });
        }

        // Show collection selection modal (works on both mobile and desktop)
        async function showCollectionModal(restaurantId) {
            // Fetch user's collections
            const { data: collections } = await supabaseClient.from('user_collections').select('id, name').eq('user_id', (await supabaseClient.auth.getUser()).data.user.id);
            
            // Create modal HTML
            const modal = document.createElement('div');
            modal.id = 'collection-selection-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4';
            
            let collectionsList = '';
            if (collections && collections.length > 0) {
                collectionsList = collections.map(c => `
                    <div class="collection-option p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" data-collection-id="${c.id}" data-restaurant-id="${restaurantId}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-3 h-3 rounded-full bg-purple-500 mr-3"></div>
                                <span class="text-lg font-medium text-gray-900">${c.name}</span>
                            </div>
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </div>
                    </div>
                `).join('');
            } else {
                collectionsList = `
                    <div class="p-8 text-center text-gray-500">
                        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                        <p class="text-lg font-medium mb-2">No collections yet</p>
                        <p class="text-sm">Create your first collection to organize your favorite restaurants</p>
                    </div>
                `;
            }
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b border-gray-200 bg-gray-50">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-gray-900">Add to Collection</h3>
                            <button id="close-collection-modal" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                    </div>
                    <div class="max-h-96 overflow-y-auto">
                        ${collectionsList}
                        <div class="create-collection-option p-4 border-t border-gray-200 cursor-pointer hover:bg-green-50 transition-colors" data-restaurant-id="${restaurantId}">
                            <div class="flex items-center text-green-600">
                                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                </svg>
                                <span class="text-lg font-medium">Create New Collection</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add to body
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-collection-modal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }

        // Show comprehensive collection management modal
        async function showCollectionManagementModal(restaurantId) {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            // Fetch all user collections
            const { data: allCollections } = await supabaseClient
                .from('user_collections')
                .select('id, name')
                .eq('user_id', user.id);

            // Fetch collections that contain this restaurant
            const { data: restaurantCollections } = await supabaseClient
                .from('collection_restaurants')
                .select('collection_id')
                .eq('restaurant_id', restaurantId);

            if (!allCollections || allCollections.length === 0) {
                showToast('No collections found. Create your first collection!', 'info');
                return;
            }

            // Create sets for easy lookup
            const restaurantCollectionIds = new Set(restaurantCollections?.map(rc => rc.collection_id) || []);
            
            // Create modal HTML
            const modal = document.createElement('div');
            modal.id = 'collection-management-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4';
            
            const collectionsList = allCollections.map(collection => {
                const isInCollection = restaurantCollectionIds.has(collection.id);
                const actionClass = isInCollection ? 'hover:bg-red-50' : 'hover:bg-green-50';
                const actionText = isInCollection ? 'Remove' : 'Add';
                const actionColor = isInCollection ? 'text-red-500' : 'text-green-500';
                
                return `
                    <div class="collection-management-option p-4 border-b border-gray-200 cursor-pointer ${actionClass} transition-colors" 
                         data-collection-id="${collection.id}" 
                         data-restaurant-id="${restaurantId}"
                         data-action="${isInCollection ? 'remove' : 'add'}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <span class="text-lg font-medium text-gray-900">${collection.name}</span>
                            </div>
                            <div class="${actionColor} text-sm font-medium">${actionText}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
                    <div class="p-4 border-b border-gray-200 bg-gray-50">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-gray-900">Manage Collections</h3>
                            <button id="close-management-modal" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>
                    </div>
                    <div class="max-h-96 overflow-y-auto">
                        ${collectionsList}
                        <div class="create-collection-option p-4 border-t border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors" data-restaurant-id="${restaurantId}">
                            <div class="flex items-center text-blue-600">
                                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                </svg>
                                <span class="text-lg font-medium">Create New Collection</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add to body
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('close-management-modal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        }

        // Load user collections from database
        async function loadUserCollections() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            try {
                const { data, error } = await supabaseClient
                    .from('user_collections')
                    .select('id, name')
                    .eq('user_id', user.id);

                if (error) {
                    console.error('Error loading user collections:', error);
                } else {
                    userCollections = data || [];
                }
            } catch (error) {
                console.error('Error loading user collections:', error);
            }
        }

        // Load collected restaurants from database
        async function loadCollectedRestaurants() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            try {
                const { data, error } = await supabaseClient
                    .from('collection_restaurants')
                    .select('restaurant_id, user_collections!inner(user_id)')
                    .eq('user_collections.user_id', user.id);

                if (error) {
                    console.error('Error loading collected restaurants:', error);
                } else {
                    // Store both string and numeric versions for compatibility
                    collectedRestaurants = new Set();
                    data.forEach(item => {
                        collectedRestaurants.add(item.restaurant_id); // numeric version
                        collectedRestaurants.add(String(item.restaurant_id)); // string version
                    });
                    console.log('Loaded collected restaurants:', collectedRestaurants);
                }
            } catch (error) {
                console.error('Error loading collected restaurants:', error);
            }
        }

        // Show collection filter modal
        async function showCollectionFilterModal() {
            await loadUserCollections();
            
            const isMobile = window.innerWidth < 768;

            if (isMobile) {
                showMobileCollectionFilterModal();
            } else {
                showDesktopCollectionFilterModal();
            }
        }

        async function showDesktopCollectionFilterModal() {
            const modal = document.getElementById('collection-filter-modal');
            const container = document.getElementById('collection-filter-container-desktop');
            
            if (userCollections.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                        <p class="text-lg font-medium mb-2">No collections yet</p>
                        <p class="text-sm mb-4">Create collections to organize and filter your favorite restaurants</p>
                        <button id="create-first-collection-btn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                            Create Your First Collection
                        </button>
                    </div>
                `;
            } else {
                container.innerHTML = userCollections.map(collection => {
                    const collectionId = String(collection.id); // Convert to string for consistency
                    const isSelected = selectedCollections.has(collectionId) || selectedCollections.has(collection.id);
                    return `
                    <div class="collection-filter-card p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 mb-3 ${isSelected ? 'border-purple-500 bg-purple-100' : ''}" data-collection-id="${collectionId}">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-3 h-3 rounded-full bg-purple-500 mr-3"></div>
                                <span class="font-medium text-gray-900">${collection.name}</span>
                            </div>
                            <div class="w-5 h-5 border-2 border-gray-300 rounded ${isSelected ? 'bg-purple-500 border-purple-500' : ''} flex items-center justify-center">
                                ${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
            }
            
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        async function showMobileCollectionFilterModal() {
            const modal = document.getElementById('collection-filter-modal-mobile');
            const container = document.getElementById('collection-filter-container-mobile');

            if (userCollections.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                        <p class="text-lg font-medium mb-2">No collections yet</p>
                        <p class="text-sm mb-4">Create collections to organize and filter your favorite restaurants</p>
                        <button id="create-first-collection-btn-mobile" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                            Create Your First Collection
                        </button>
                    </div>
                `;
            } else {
                container.innerHTML = userCollections.map(collection => {
                    const collectionId = String(collection.id); // Convert to string for consistency
                    const isSelected = selectedCollections.has(collectionId) || selectedCollections.has(collection.id);
                    return `
                    <label class="collection-checkbox flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 mb-3 ${isSelected ? 'border-purple-500 bg-purple-100' : ''}" data-collection-id="${collectionId}">
                        <input type="checkbox" class="sr-only" ${isSelected ? 'checked' : ''}>
                        <div class="w-4 h-4 border-2 border-gray-300 rounded mr-3 flex items-center justify-center ${isSelected ? 'bg-purple-500 border-purple-500' : ''}">
                            ${isSelected ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' : ''}
                        </div>
                        <span class="font-medium text-gray-900">${collection.name}</span>
                    </label>
                    `;
                }).join('');
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        // Store collection-specific restaurant mappings
        let collectionRestaurantMappings = new Map();

        // Load restaurants for specific collections
        async function loadRestaurantsForCollections(collectionIds) {
            console.log('🔄 Loading restaurants for collections:', collectionIds);
            console.log('🔄 Collection IDs type and values:', collectionIds.map(id => ({ id, type: typeof id })));
            if (collectionIds.length === 0) return;

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                console.error('❌ No user found when loading collections');
                return;
            }

            try {
                // Convert collection IDs to numbers in case they're strings
                const numericCollectionIds = collectionIds.map(id => parseInt(id, 10));
                console.log('🔢 Converted to numeric IDs:', numericCollectionIds);

                const { data, error } = await supabaseClient
                    .from('collection_restaurants')
                    .select('restaurant_id, collection_id')
                    .in('collection_id', numericCollectionIds);

                if (error) {
                    console.error('❌ Error loading collection restaurants:', error);
                    // Try without conversion as fallback
                    console.log('🔄 Trying with original IDs as fallback...');
                    const { data: fallbackData, error: fallbackError } = await supabaseClient
                        .from('collection_restaurants')
                        .select('restaurant_id, collection_id')
                        .in('collection_id', collectionIds);
                    
                    if (fallbackError) {
                        console.error('❌ Fallback also failed:', fallbackError);
                    } else {
                        console.log('✅ Fallback succeeded with data:', fallbackData);
                        data = fallbackData;
                    }
                } else {
                    console.log('✅ Collection restaurant data found:', data);
                    console.log('📊 Number of records found:', data?.length || 0);
                }

                if (data && data.length > 0) {
                    // Store mappings for each collection with both string and numeric keys
                    data.forEach(item => {
                        console.log(`🔗 Mapping: Collection ${item.collection_id} -> Restaurant ${item.restaurant_id}`);
                        
                        const numericCollectionId = parseInt(item.collection_id, 10);
                        const stringCollectionId = String(item.collection_id);
                        
                        // Store with numeric key
                        if (!collectionRestaurantMappings.has(numericCollectionId)) {
                            collectionRestaurantMappings.set(numericCollectionId, new Set());
                        }
                        collectionRestaurantMappings.get(numericCollectionId).add(item.restaurant_id);
                        
                        // Store with string key as backup
                        if (!collectionRestaurantMappings.has(stringCollectionId)) {
                            collectionRestaurantMappings.set(stringCollectionId, new Set());
                        }
                        collectionRestaurantMappings.get(stringCollectionId).add(item.restaurant_id);
                        
                        console.log(`✅ Stored mapping for both ${numericCollectionId} (number) and "${stringCollectionId}" (string)`);
                    });
                    console.log('🗺️ Final collection restaurant mappings:', collectionRestaurantMappings);
                } else {
                    console.warn('⚠️ No restaurant mappings found for collections:', collectionIds);
                    
                    // Let's also check if the collections actually exist
                    const { data: collectionCheck, error: collectionError } = await supabaseClient
                        .from('user_collections')
                        .select('id, name')
                        .in('id', numericCollectionIds);
                    
                    if (collectionError) {
                        console.error('❌ Error checking collections:', collectionError);
                    } else {
                        console.log('🏷️ Collections that exist:', collectionCheck);
                    }
                }
            } catch (error) {
                console.error('❌ Error in loadRestaurantsForCollections:', error);
            }
        }

        // Combined filter function that applies both cuisine and collection filters
        async function applyAllFilters(restaurants) {
            console.log('🎯 Starting combined filter process');
            console.log('Total restaurants to filter:', restaurants.length);
            console.log('selectedCollections.size:', selectedCollections.size);
            console.log('selectedCollections contents:', Array.from(selectedCollections));
            
            let filteredRestaurants = [...restaurants]; // Start with all restaurants
            window.filteredRestaurants = filteredRestaurants; // Make it globally accessible
            
            // Apply cuisine filter first
            const selectedCuisines = getSelectedCuisines();
            console.log('Selected cuisines:', selectedCuisines);
            
            if (selectedCuisines.length > 0) {
                filteredRestaurants = filteredRestaurants.filter(restaurant => {
                    return restaurant.cuisines && restaurant.cuisines.some(cuisine => 
                        selectedCuisines.includes(cuisine.name)
                    );
                });
                console.log(`🍽️ After cuisine filter: ${filteredRestaurants.length} restaurants`);
            }
            
            // Apply collection filter second
            console.log('Selected collections:', Array.from(selectedCollections));
            
            if (selectedCollections.size > 0) {
                filteredRestaurants = await filterRestaurantsByCollections(filteredRestaurants);
                console.log(`📚 After collection filter: ${filteredRestaurants.length} restaurants`);
            } else {
                console.log('📚 No collection filter applied - showing all restaurants');
            }
            
            console.log(`🎉 Final filtered results: ${filteredRestaurants.length} restaurants`);
            return filteredRestaurants;
        }

        // Filter restaurants by selected collections
        async function filterRestaurantsByCollections(restaurants) {
            console.log('🔍 Starting collection filter process');
            console.log('Selected collections:', Array.from(selectedCollections));
            console.log('Total restaurants to filter:', restaurants.length);
            console.log('Current collectionRestaurantMappings size:', collectionRestaurantMappings.size);
            console.log('Current collectionRestaurantMappings contents:', Array.from(collectionRestaurantMappings.entries()));

            if (selectedCollections.size === 0) {
                console.log('No collections selected, returning all restaurants');
                return restaurants;
            }
            
            try {
                // Load restaurant mappings for selected collections
                console.log('🔄 Loading restaurant mappings for collections:', Array.from(selectedCollections));
                await loadRestaurantsForCollections(Array.from(selectedCollections));
                console.log('🔄 After loading - collectionRestaurantMappings size:', collectionRestaurantMappings.size);
                console.log('🔄 After loading - collectionRestaurantMappings contents:', Array.from(collectionRestaurantMappings.entries()));

                // Get all restaurant IDs that are in any of the selected collections
                const restaurantIdsInCollections = new Set();
                selectedCollections.forEach(collectionId => {
                    // Try both string and numeric versions of the collection ID
                    const numericId = parseInt(collectionId, 10);
                    const stringId = String(collectionId);
                    
                    console.log(`🔍 Looking for collection ${collectionId} (type: ${typeof collectionId})`);
                    console.log(`🔍 Trying numeric version: ${numericId}`);
                    console.log(`🔍 Trying string version: "${stringId}"`);
                    
                    let restaurantsInCollection = collectionRestaurantMappings.get(collectionId);
                    if (!restaurantsInCollection) {
                        restaurantsInCollection = collectionRestaurantMappings.get(numericId);
                    }
                    if (!restaurantsInCollection) {
                        restaurantsInCollection = collectionRestaurantMappings.get(stringId);
                    }
                    
                    console.log(`Collection ${collectionId} has restaurants:`, restaurantsInCollection ? Array.from(restaurantsInCollection) : 'none');
                    console.log('🗺️ Available mappings keys:', Array.from(collectionRestaurantMappings.keys()));
                    
                    if (restaurantsInCollection) {
                        restaurantsInCollection.forEach(restaurantId => {
                            restaurantIdsInCollections.add(restaurantId);
                        });
                    }
                });

                console.log('🎯 Restaurant IDs in selected collections:', Array.from(restaurantIdsInCollections));

                if (restaurantIdsInCollections.size === 0) {
                    console.warn('⚠️ No restaurants found in selected collections');
                    return [];
                }

                const filtered = restaurants.filter(restaurant => {
                    const isInCollection = restaurantIdsInCollections.has(restaurant.id);
                    if (isInCollection) {
                        console.log(`✅ Restaurant ${restaurant.name} (ID: ${restaurant.id}) is in selected collections`);
                    }
                    return isInCollection;
                });

                console.log(`🎉 Filtered restaurants: ${filtered.length} out of ${restaurants.length}`);
                return filtered;
            } catch (error) {
                console.error('❌ Error in filterRestaurantsByCollections:', error);
                return restaurants; // Return original list on error
            }
        }

        // Get collection name by ID
        function getCollectionNameById(collectionId) {
            // Handle both string and numeric IDs
            const numericId = parseInt(collectionId, 10);
            const stringId = String(collectionId);
            
            const collection = userCollections.find(c => 
                c.id === collectionId || c.id === numericId || c.id === stringId
            );
            return collection ? collection.name : null;
        }

        // Update collection filter button appearance (matching cuisine filter style)
        function updateCollectionFilterButtonAppearance() {
            const count = document.getElementById('collection-selected-count');
            const subtitle = document.getElementById('collection-filter-subtitle');
            
            // Check if elements exist before accessing them
            if (!count || !subtitle) return;
            
            const hasActiveFilters = selectedCollections.size > 0;
            
            if (hasActiveFilters) {
                // Show count
                count.textContent = selectedCollections.size;
                count.classList.remove('hidden');

                // Update subtitle
                const selectedCollectionsArray = Array.from(selectedCollections);
                if (selectedCollectionsArray.length === 1) {
                    const collectionName = getCollectionNameById(selectedCollectionsArray[0]);
                    subtitle.textContent = collectionName || '1 collection selected';
            } else {
                    subtitle.textContent = `${selectedCollectionsArray.length} collections selected`;
                }
            } else {
                // Hide count and reset subtitle
                count.classList.add('hidden');
                subtitle.textContent = 'All collections';
            }
        }
        
        // Watched videos are now session-only, no need to load from localStorage
        
        // Add video to watched list (session-only, no localStorage)
        function addVideoToWatched(restaurantId) {
            watchedVideos.add(restaurantId);
        }
        
        // Create watched icon element
        function createWatchedIcon() {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'watched-icon';
            iconWrapper.title = 'You have watched this video';
            iconWrapper.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                </svg>
            `;
            return iconWrapper;
        }
        
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
        
        // Immediately hide auth modal to prevent flash during page load
        if (authModal) {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
            authModal.style.display = 'none';
        }
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
            authModal.style.display = 'flex';
        }

        function closeAuthModal() {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
            authModal.style.display = 'none';
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
            const collectionsBtn = document.getElementById('collections-btn');
            const collectionFilterBtn = document.getElementById('collection-filter-btn');
            const mobileCollectionsBtn = document.getElementById('mobile-collections-btn');
            const signupBtn = document.getElementById('signup-btn');
            const mobileSignupBtn = document.getElementById('mobile-signup-btn');
            const mobileAuthBtn = document.getElementById('mobile-auth-btn');
            
            if (user) {
                // User is logged in - show logout button instead of login button, hide signup
                if (authBtn) authBtn.classList.add('hidden');
                if (signupBtn) {
                    signupBtn.style.display = 'none';
                }
                if (mobileSignupBtn) mobileSignupBtn.classList.add('hidden');
                if (mobileAuthBtn) mobileAuthBtn.classList.add('hidden');
                if (collectionsBtn) collectionsBtn.classList.remove('hidden');
                if (mobileCollectionsBtn) mobileCollectionsBtn.classList.remove('hidden');
                if (collectionFilterBtn) collectionFilterBtn.classList.remove('hidden');
                
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
                
                // Create or update mobile logout button
                let mobileLogoutBtn = document.getElementById('mobile-logout-btn');
                if (!mobileLogoutBtn && mobileAuthBtn && mobileAuthBtn.parentNode) {
                    mobileLogoutBtn = document.createElement('button');
                    mobileLogoutBtn.id = 'mobile-logout-btn';
                    mobileLogoutBtn.className = 'w-full bg-red-600 hover:bg-red-700 text-white rounded px-4 py-3 transition-colors text-left';
                    mobileLogoutBtn.innerHTML = 'Log-out';
                    
                    // Insert after mobile auth button
                    mobileAuthBtn.parentNode.insertBefore(mobileLogoutBtn, mobileAuthBtn.nextSibling);
                    
                    // Add click event
                    mobileLogoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const mobileMenuModal = document.getElementById('mobile-menu-modal');
                        if (mobileMenuModal) {
                            mobileMenuModal.classList.add('hidden');
                            mobileMenuModal.style.display = 'none';
                        }
                        handleLogout();
                    });
                }
                
                if (mobileLogoutBtn) {
                    mobileLogoutBtn.classList.remove('hidden');
                }

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

                // Load collected restaurants and collections
                await loadCollectedRestaurants();
                await loadCollectionsForModal();

                // Re-display restaurants to show correct favorite status (only if restaurants are loaded)
                if (currentRestaurants && currentRestaurants.length > 0) {
                    await applyAllFiltersAndDisplay();
                }
                
            } else {
                // User is logged out - show login and signup buttons
                if (authBtn) authBtn.classList.remove('hidden');
                if (signupBtn) {
                    signupBtn.style.display = '';
                }
                if (mobileSignupBtn) mobileSignupBtn.classList.remove('hidden');
                if (mobileAuthBtn) mobileAuthBtn.classList.remove('hidden');
                if (collectionsBtn) collectionsBtn.classList.add('hidden');
                if (mobileCollectionsBtn) mobileCollectionsBtn.classList.add('hidden');
                // Keep collection filter button visible for all users
                // collectionFilterBtn.classList.add('hidden');
                
                // Hide logout button if it exists
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.classList.add('hidden');
                }
                
                // Hide mobile logout button if it exists
                const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
                if (mobileLogoutBtn) {
                    mobileLogoutBtn.classList.add('hidden');
                }
                
                favoritedRestaurants.clear(); // Clear favorites on logout
                selectedCollections.clear(); // Clear collection filter on logout
                updateCollectionFilterButtonAppearance();
                
                // Re-display to remove favorite icons (only if restaurants are loaded)
                if (currentRestaurants && currentRestaurants.length > 0) {
                    displayRestaurants(currentRestaurants);
                }
            }
        }

        // --- Handle Email Confirmation Redirect ---
        function handleEmailConfirmation() {
            // Check both hash fragment and query parameters
            const hash = window.location.hash.substring(1); // Remove the # character
            const search = window.location.search.substring(1); // Remove the ? character
            
            let accessToken, refreshToken, type, expiresAt, expiresIn, tokenType;
            
            // Try to parse from hash fragment first (most common)
            if (hash) {
                const hashParams = new URLSearchParams(hash);
                accessToken = hashParams.get('access_token');
                refreshToken = hashParams.get('refresh_token');
                type = hashParams.get('type');
                expiresAt = hashParams.get('expires_at');
                expiresIn = hashParams.get('expires_in');
                tokenType = hashParams.get('token_type');
            }
            
            // Fallback to query parameters if not found in hash
            if (!accessToken && search) {
                const urlParams = new URLSearchParams(search);
                accessToken = urlParams.get('access_token');
                refreshToken = urlParams.get('refresh_token');
                type = urlParams.get('type');
                expiresAt = urlParams.get('expires_at');
                expiresIn = urlParams.get('expires_in');
                tokenType = urlParams.get('token_type');
            }
            
            if (type === 'signup' && accessToken) {
                console.log('Email confirmation detected in URL, processing...');
                console.log('Token type:', tokenType, 'Expires at:', expiresAt);
                
                // Set the session with the tokens
                supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                }).then(({ data, error }) => {
                    if (error) {
                        console.error('Error setting session:', error);
                        showAuthFeedback('Email confirmation failed. Please try signing up again.');
                    } else {
                        console.log('Email confirmation successful');
                        showAuthFeedback('Email confirmed successfully! You are now logged in.', false);
                        
                        // Clean up the URL by removing the tokens
                        const cleanUrl = window.location.origin + window.location.pathname;
                        window.history.replaceState({}, document.title, cleanUrl);
                        
                        // Close any open auth modals
                        const authModal = document.getElementById('auth-modal');
                        if (authModal) {
                            authModal.style.display = 'none';
                        }
                        
                        // Reload the page to refresh the UI state
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    }
                });
            }
        }

        // --- Supabase Auth Logic ---
        async function handleSignUp(email, password) {
            try {
                // Get current domain dynamically
                const currentOrigin = window.location.origin;
                const redirectUrl = currentOrigin + '/';
                
                console.log('Signing up with redirect URL:', redirectUrl);
                
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        emailRedirectTo: redirectUrl
                    }
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
        
        // Add signup button event listener
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.addEventListener('click', openAuthModal);
        }

        // Mobile menu functionality
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileMenuModal = document.getElementById('mobile-menu-modal');
        const closeMobileMenu = document.getElementById('close-mobile-menu');
        const mobileAuthBtn = document.getElementById('mobile-auth-btn');
        const mobileSignupBtn = document.getElementById('mobile-signup-btn');
        const mobileCollectionsBtn = document.getElementById('mobile-collections-btn');

        if (mobileMenuBtn && mobileMenuModal) {
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenuModal.classList.remove('hidden');
                mobileMenuModal.style.display = 'block';
            });
        }

        if (closeMobileMenu && mobileMenuModal) {
            closeMobileMenu.addEventListener('click', () => {
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
            });
        }

        if (mobileMenuModal) {
            mobileMenuModal.addEventListener('click', (e) => {
                if (e.target === mobileMenuModal) {
                    mobileMenuModal.classList.add('hidden');
                    mobileMenuModal.style.display = 'none';
                }
            });
        }

        if (mobileAuthBtn) {
            mobileAuthBtn.addEventListener('click', () => {
                openAuthModal();
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
            });
        }

        if (mobileSignupBtn) {
            mobileSignupBtn.addEventListener('click', () => {
                openAuthModal();
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
            });
        }

        // Update collections button visibility for mobile
        function updateMobileCollectionsButton() {
            if (mobileCollectionsBtn) {
                if (authContainer && authContainer.querySelector('.hidden')) {
                    mobileCollectionsBtn.classList.remove('hidden');
                } else {
                    mobileCollectionsBtn.classList.add('hidden');
                }
            }
        }

        if (mobileCollectionsBtn) {
            mobileCollectionsBtn.addEventListener('click', async () => {
                // Check if user is authenticated
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    console.log('User not authenticated, opening auth modal');
                    mobileMenuModal.classList.add('hidden');
                    mobileMenuModal.style.display = 'none';
                    openAuthModal();
                    return;
                }
                
                // Close menu first
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
                
                // Open collections modal
                collectionsModal.classList.remove('hidden');
                collectionsModal.classList.add('flex');
                loadCollectionsForModal();
            });
        }

        
        // Mobile-specific location function that doesn't reset the map view
        function findUserLocationMobile() {
            if (!navigator.geolocation) {
                console.log('Geolocation is not supported by this browser');
                return;
            }

            console.log('Requesting user location for mobile...');
            
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                async function(position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    console.log('User location found for mobile:', userLat, userLon);
                    
                    // Store user location globally for distance calculations
                    window.userLocation = { lat: userLat, lon: userLon };
                    
                    // Pan map to center on user location and keep it there
                    map.setView([userLat, userLon], 14, {
                        animate: true,
                        duration: 1.0
                    });
                    console.log('Map centered on user location and staying there');
                    
                    // Add user location marker with distinct styling
                    const userIcon = L.divIcon({
                        className: 'user-location-icon',
                        html: '<div class="user-icon">📍</div>',
                        iconSize: [35, 35],
                        iconAnchor: [17, 17]
                    });
                    
                    // Remove existing user location marker if it exists
                    if (window.userLocationMarker) {
                        map.removeLayer(window.userLocationMarker);
                    }
                    
                    // Add new user location marker
                    window.userLocationMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(map);
                    
                    // Don't call applyAllFiltersAndDisplay() - keep the map focused on user location
                },
                function(error) {
                    console.error('Error getting user location:', error);
                    let message = 'Unable to get your location';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Location access denied by user';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information is unavailable';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out';
                            break;
                    }
                    console.log(message);
                },
                options
            );
        }
        
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
        // Initial auth check on page load
        async function checkInitialAuthState() {
            try {
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (error) {
                    console.error('Error checking initial auth state:', error);
                    return;
                }
                const user = session ? session.user : null;
                updateUserUI(user);
            } catch (error) {
                console.error('Error in initial auth check:', error);
            }
        }
        
        // Run initial auth check
        checkInitialAuthState();
        
        // Listen for auth state changes
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            const user = session ? session.user : null;
            updateUserUI(user);
        });
        
        // Ensure auth modal starts closed - multiple approaches for reliability
        if (authModal) {
            authModal.classList.add('hidden');
            authModal.classList.remove('flex');
            authModal.style.display = 'none';
        }

        // Handle OAuth redirect on page load
        handleOAuthRedirect();

        // --- First-Time User Tutorial ---

        const tutorialModal = document.getElementById('tutorial-modal');
        const closeTutorialBtn = document.getElementById('close-tutorial-btn');
        const TUTORIAL_COMPLETED_KEY = 'reelEats_tutorialCompleted';

        function showTutorial() {
            // Check if tutorial elements exist
            if (!tutorialModal) return;
            
            // Check if the user has seen the tutorial before
            if (localStorage.getItem(TUTORIAL_COMPLETED_KEY)) {
                return; // Don't show if already completed
            }

            // Show the modal
            tutorialModal.classList.remove('hidden');
            tutorialModal.classList.add('flex');

            // Add a pulsing animation to the first restaurant card and marker
            setTimeout(() => {
                const firstCard = document.querySelector('#restaurant-list > div');
                if (firstCard && restaurantMarkers.length > 0) {
                    firstCard.classList.add('pulse-me');
                    if (restaurantMarkers[0]._icon) {
                        restaurantMarkers[0]._icon.classList.add('pulse-me');
                    }
                }
            }, 500); // Small delay to ensure elements are rendered
        }

        function completeTutorial() {
            // Check if tutorial elements exist
            if (!tutorialModal) return;
            
            // Hide the modal
            tutorialModal.classList.add('hidden');
            tutorialModal.classList.remove('flex');
            
            // Set the flag in localStorage so it doesn't show again
            localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');

            // Also remove the tutorial on the first user interaction
            document.body.removeEventListener('click', completeTutorial);
        }

        function stopPulsingAnimation() {
            // Remove pulsing animations when user selects a restaurant
            document.querySelectorAll('.pulse-me').forEach(el => el.classList.remove('pulse-me'));
        }

        // Event listener for the close button
        if (closeTutorialBtn) {
        closeTutorialBtn.addEventListener('click', completeTutorial);
        }

        // Also close the tutorial on any first click on the page
        document.body.addEventListener('click', completeTutorial, { once: true });

        // Request geolocation on page load to show distances immediately
        function requestGeolocationOnLoad() {
            if (!navigator.geolocation) {
                console.log('Geolocation is not supported by this browser');
                return;
            }

            console.log('Requesting geolocation on page load...');
            
            const options = {
                enableHighAccuracy: true,
                timeout: 8000, // Shorter timeout for page load
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                async function(position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    console.log('User location found on page load:', userLat, userLon);
                    
                    // Store user location globally for distance calculations
                    window.userLocation = { lat: userLat, lon: userLon };
                    
                    // Re-order restaurants by distance now that we have user location
                    if (currentRestaurants && currentRestaurants.length > 0) {
                        currentRestaurants.sort((a, b) => {
                            const distanceA = calculateDistance(userLat, userLon, a.lat, a.lon);
                            const distanceB = calculateDistance(userLat, userLon, b.lat, b.lon);
                            return distanceA - distanceB;
                        });
                        await applyAllFiltersAndDisplay();
                        console.log('Restaurants re-ordered by distance from user location on page load');
                    }
                    
                    // Update restaurant cards with distances
                    updateRestaurantCardsWithDistance();
                    
                    console.log('Distance information added to restaurant cards on page load');
                },
                function(error) {
                    console.log('Geolocation error on page load:', error.message);
                    // Don't show any error to user - just silently fail
                    // The location button is still available for manual request
                },
                options
            );
        }

        // --- Initialization ---
        initializeMap();
        await loadCitiesAndInitialRestaurants();
        setupCuisineFilter();
        setupAdminLogin();
        
        // Setup cuisine filter modal event listeners directly with a small delay
        setTimeout(() => {
            console.log('🔧 Setting up cuisine filter modals...');
            setupCuisineFilterModals();
        }, 500); // Increased delay to ensure everything is loaded
        
        // Load saved filter states (but don't apply yet - restaurants not loaded)
        loadFilterStates();
        syncCuisineCheckboxes();
        syncCollectionCheckboxes();
        updateFilterButtonAppearance();
        updateCollectionFilterButtonAppearance();
        
        // Request geolocation on page load to show distances immediately
        requestGeolocationOnLoad();
        
        // Pre-load collection-restaurant mappings if collections are selected
        if (selectedCollections.size > 0) {
            console.log('🔄 Pre-loading collection mappings for selected collections:', Array.from(selectedCollections));
            await loadRestaurantsForCollections(Array.from(selectedCollections));
        }
        
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
                    // Refresh markers to update gold border (only if restaurants are loaded)
                    if (currentRestaurants && currentRestaurants.length > 0) {
                        await applyAllFiltersAndDisplay();
                    }
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
                    await applyAllFiltersAndDisplay();
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

                // Initialize the marker cluster group with intelligent clustering
                window.markerClusterGroup = L.markerClusterGroup({
                    maxClusterRadius: function(zoom) {
                        // Dynamic clustering based on zoom level
                        // At lower zoom levels, cluster more aggressively
                        // At higher zoom levels, allow more individual markers
                        if (zoom <= 12) return 80;  // Very aggressive clustering at city level
                        if (zoom <= 14) return 60;  // Moderate clustering at district level  
                        if (zoom <= 16) return 40;  // Light clustering at neighborhood level
                        if (zoom <= 18) return 25;  // Minimal clustering at street level
                        return 15; // Very minimal clustering at building level
                    },
                    disableClusteringAtZoom: 20, // Disable clustering only at maximum zoom level
                    spiderfyOnMaxZoom: true, // Show individual markers when zoomed in
                    showCoverageOnHover: false, // Don't show coverage area on hover
                    zoomToBoundsOnClick: true, // Zoom to show all markers in cluster when clicked
                    chunkedLoading: true, // Load markers in chunks for better performance
                    // Custom cluster icon with restaurant SVG and count badge - uniform 46px circle (20% larger again)
                    iconCreateFunction: function(cluster) {
                        const childCount = cluster.getChildCount();
                        
                        // If fewer than 4 locations, show individual icons bunched together
                        if (childCount < 4) {
                            const children = cluster.getAllChildMarkers();
                            const iconSize = 26; // Same as individual markers (20% smaller)
                            const containerSize = 40; // Container to hold bunched icons
                            const offset = 8; // How much icons overlap
                            
                            // Create bunched individual icons
                            let bunchedIconsHtml = '';
                            children.forEach((marker, index) => {
                                const x = (index * offset) - (childCount - 1) * offset / 2;
                                const y = (index * offset) - (childCount - 1) * offset / 2;
                                
                                // Get the marker's restaurant data to determine content
                                const restaurant = marker.options.restaurant;
                                const firstCuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines[0] : null;
                                const displayContent = firstCuisine ? firstCuisine.icon : (index + 1);
                                
                                bunchedIconsHtml += `
                                    <div style="
                                        position: absolute;
                                        left: ${containerSize/2 + x}px;
                                        top: ${containerSize/2 + y}px;
                                        transform: translate(-50%, -50%);
                                        width: ${iconSize}px;
                                        height: ${iconSize}px;
                                        background: white;
                                        border: 2px solid #e5e7eb;
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                        font-size: 13px;
                                        font-weight: bold;
                                        z-index: ${10 + index};
                                    ">${displayContent}</div>
                                `;
                            });
                            
                            return L.divIcon({
                                html: `<div style="
                                    width: ${containerSize}px; 
                                    height: ${containerSize}px; 
                                    position: relative;
                                ">${bunchedIconsHtml}</div>`,
                                className: 'custom-bunched-marker',
                                iconSize: L.point(containerSize, containerSize),
                                iconAnchor: L.point(containerSize/2, containerSize/2)
                            });
                        }
                        
                        // For 4+ locations, show the traditional cluster icon
                        const size = 46; // 20% larger than 38px (38 * 1.2 = 45.6, rounded to 46)
                        const badgeSize = 26; // 20% larger than 22px (22 * 1.2 = 26.4, rounded to 26)
                        const badgeOffset = 6; // Increased offset for larger badge
                        
                        return L.divIcon({
                            html: `<div class="custom-cluster-icon" style="
                                width: ${size}px; 
                                height: ${size}px; 
                                position: relative;
                                background: white;
                                border: 2px solid #e5e7eb;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                            ">
                                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512.546 512.546" style="enable-background:new 0 0 512.546 512.546;" xml:space="preserve" width="34px" height="34px">
                                    <g>
                                        <g>
                                            <circle style="fill:#FFFFFF;" cx="255.863" cy="256.108" r="217.467"/>
                                            <circle style="fill:#C5D9EC;" cx="255.863" cy="256.108" r="142.5"/>
                                            <path style="fill:#A8C6E2;" d="M271.994,382.477c-78.701,0-142.5-63.799-142.5-142.5c0-35.244,12.802-67.494,34-92.37&#10;&#9;&#9;&#9;c-30.672,26.138-50.13,65.044-50.13,108.5c0,78.701,63.799,142.5,142.5,142.5c43.456,0,82.362-19.458,108.5-50.13&#10;&#9;&#9;&#9;C339.487,369.676,307.238,382.477,271.994,382.477z"/>
                                            <path style="fill:#E3EDF6;" d="M270.863,458.575c-65.918,0-124.981-29.333-164.861-75.653V181.161h-15v-26.188&#10;&#9;&#9;&#9;c23.688-15.639,32.043-41.633,30-69.467c-3.878,3.07-7.645,6.273-11.302,9.595c0.025-0.028,0.049-0.056,0.074-0.083&#10;&#9;&#9;&#9;c-25.911,23.527-46.049,53.245-58.105,86.143h-0.011C21.758,260.249,44.6,355.964,106,413.69c0,0,0.001,0,0.001,0.001l0,0&#10;&#9;&#9;&#9;c80.584,83.276,237.06,77.202,310.951-11.494C378.348,437.228,327.099,458.575,270.863,458.575z"/>
                                            <path style="fill:#C5D9EC;" d="M8.502,83.853v15c0,19.592,12.524,36.251,30,42.43v62.379h30v-62.379&#10;&#9;&#9;&#9;c17.476-6.179,30-22.838,30-42.43v-15H8.502z"/>
                                            <path style="fill:#A8C6E2;" d="M60.842,198.172v-62.379c-17.476-6.179-30-22.838-30-42.43v-9.511H8.502v15&#10;&#9;&#9;&#9;c0,19.592,12.524,36.251,30,42.43v62.379h30v-5.489H60.842z"/>
                                            <path style="fill:#EB975D;" d="M53.502,505.046L53.502,505.046c-16.569,0-30-13.431-30-30V203.661h60v271.384&#10;&#9;&#9;&#9;C83.502,491.614,70.07,505.046,53.502,505.046z"/>
                                            <path style="fill:#B25E1E;" d="M45.21,468.146V203.661H23.502v271.384c0,16.569,13.431,30,30,30h0&#10;&#9;&#9;&#9;c7.335,0,14.052-2.636,19.264-7.008C57.342,496.793,45.21,483.89,45.21,468.146z"/>
                                            <path style="fill:#EB975D;" d="M474.044,505.046L474.044,505.046c-16.569,0-30-13.431-30-30v-181.32h60v181.32&#10;&#9;&#9;&#9;C504.044,491.614,490.613,505.046,474.044,505.046z"/>
                                            <path style="fill:#B25E1E;" d="M465.753,468.146v-174.42h-21.709v181.32c0,16.569,13.431,30,30,30h0&#10;&#9;&#9;&#9;c7.335,0,14.052-2.636,19.264-7.008C477.884,496.793,465.753,483.89,465.753,468.146z"/>
                                            <path style="fill:#C5D9EC;" d="M499.491,7.5L499.491,7.5L499.491,7.5c-35.39,33.415-55.447,79.937-55.447,128.609v90l30,22.647&#10;&#9;&#9;&#9;v44.968h30V7.5H499.491z"/>
                                            <path style="fill:#A8C6E2;" d="M504.044,243.145l-37.532-28.333v-90c0-39.733,13.37-78.028,37.532-108.935V7.5h-4.553h0h0&#10;&#9;&#9;&#9;c-35.39,33.415-55.447,79.937-55.447,128.609v90l30,22.647v44.968h30V243.145z"/>
                                            <g>
                                                <path style="fill:none;stroke:#FFFFFF;stroke-width:15;stroke-miterlimit:10;" d="M189.044,165.566&#10;&#9;&#9;&#9;&#9;c-12.105,8.924-22.608,20.435-30.608,34.292"/>
                                                <path style="fill:none;stroke:#FFFFFF;stroke-width:15;stroke-miterlimit:10;" d="M217.366,150.397&#10;&#9;&#9;&#9;&#9;c-4.767,1.733-9.423,3.789-13.932,6.158"/>
                                            </g>
                                        </g>
                                        <g>
                                            <line style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" x1="8.502" y1="83.853" x2="8.502" y2="0.108"/>
                                            <line style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" x1="38.502" y1="83.853" x2="38.502" y2="0.108"/>
                                            <line style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" x1="68.502" y1="83.853" x2="68.502" y2="0.108"/>
                                            <line style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" x1="98.502" y1="83.853" x2="98.502" y2="0.108"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M8.502,83.853v15&#10;&#9;&#9;&#9;c0,19.592,12.524,36.251,30,42.43v62.379h30v-62.379c17.476-6.179,30-22.838,30-42.43v-15H8.502z"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M53.502,505.046L53.502,505.046&#10;&#9;&#9;&#9;c-16.569,0-30-13.431-30-30V203.661h60v271.384C83.502,491.614,70.07,505.046,53.502,505.046z"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M499.491,7.5L499.491,7.5L499.491,7.5&#10;&#9;&#9;&#9;c-35.39,33.415-55.447,79.937-55.447,128.609v90l30,22.647v44.968h30V7.5H499.491z"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M504.044,391.109v83.936&#10;&#9;&#9;&#9;c0,16.569-13.431,30-30,30h0c-16.569,0-30-13.431-30-30v-181.32h60v82.384"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M444.047,146.981&#10;&#9;&#9;&#9;C406.387,82.178,336.213,38.608,255.863,38.608c-62.26,0-118.41,26.16-158.059,68.088"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M84.205,389.689&#10;&#9;&#9;&#9;c39.8,51.072,101.893,83.919,171.658,83.919c80.35,0,150.524-43.57,188.184-108.374"/>
                                            <path style="fill:none;stroke:#000000;stroke-width:15;stroke-miterlimit:10;" d="M120.614,211.109&#10;&#9;&#9;&#9;c-4.704,14.145-7.251,29.274-7.251,44.999c0,78.701,63.799,142.5,142.5,142.5s142.5-63.799,142.5-142.5s-63.799-142.5-142.5-142.5&#10;&#9;&#9;&#9;c-57.266,0-106.641,33.779-129.29,82.499"/>
                                        </g>
                                    </g>
                                </svg>
                                <div style="
                                    position: absolute;
                                    top: -${badgeOffset}px;
                                    right: -${badgeOffset}px;
                                    width: ${badgeSize}px;
                                    height: ${badgeSize}px;
                                    background: #dc2626;
                                    color: white;
                                    border: 2px solid white;
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 15px;
                                    font-weight: bold;
                                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                    z-index: 1000;
                                ">${childCount}</div>
                            </div>`,
                            className: 'custom-cluster-marker',
                            iconSize: L.point(size, size),
                            iconAnchor: L.point(size/2, size/2)
                        });
                    }
                });
                map.addLayer(window.markerClusterGroup);
                markerClusterGroup = window.markerClusterGroup;
                
                // Geolocation will be triggered manually when user clicks location button
                
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
                async function(position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    console.log('User location found:', userLat, userLon);
                    
                    // Store user location globally for distance calculations
                    window.userLocation = { lat: userLat, lon: userLon };
                    
                    // Re-order restaurants by distance now that we have user location
                    if (currentRestaurants && currentRestaurants.length > 0) {
                        currentRestaurants.sort((a, b) => {
                            const distanceA = calculateDistance(userLat, userLon, a.lat, a.lon);
                            const distanceB = calculateDistance(userLat, userLon, b.lat, b.lon);
                            return distanceA - distanceB;
                        });
                        await applyAllFiltersAndDisplay();
                        console.log('Restaurants re-ordered by distance from user location');
                    }
                    
                    // Pan map to center on user location
                    map.setView([userLat, userLon], 14, {
                        animate: true,
                        duration: 1.0
                    });
                    console.log('Map centered on user location');
                    
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

            // Initialize the app with URL-based routing
            await initializeApp();
            const t2 = performance.now();
            console.log(`Total initial load time: ${t2 - t0} ms`);
            
            // Check for #auth hash to open authentication modal (only when hash is present)
            if (window.location.hash && window.location.hash === '#auth') {
                console.log('Opening auth modal due to #auth hash');
                setTimeout(() => {
                    openAuthModal();
                }, 500); // Small delay to ensure everything is loaded
            }
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
                    // populateCitySelect removed - cities are now handled in initializeApp
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
            // populateCitySelect removed - cities are now handled in initializeApp
        }

        // populateCitySelect function removed - now using populateCitySwitcher
        
        async function loadRestaurantsForCity(city = null) {
            // --- Load restaurants with optional city filtering ---
            console.log('loadRestaurantsForCity called with city:', city);

            let query = supabaseClient
                .from('restaurants')
                .select('*');

            // If a city is provided, filter by city name (try multiple approaches)
            if (city) {
                // Try exact match first
                query = query.ilike('city', city);
            }

            // 1. Fetch all restaurants (optionally filtered by city).
            const { data: restaurants, error: restaurantsError } = await query;

            if (restaurantsError) {
                console.error("Error fetching restaurants:", restaurantsError);
                throw restaurantsError;
            }

            // If city filtering returned very few results, try a broader search
            if (city && restaurants && restaurants.length < 5) {
                const { data: broaderRestaurants, error: broaderError } = await supabaseClient
                    .from('restaurants')
                    .select('*')
                    .ilike('city', `%${city}%`); // Contains search

                if (!broaderError && broaderRestaurants && broaderRestaurants.length > restaurants.length) {
                    restaurants.length = 0; // Clear array
                    restaurants.push(...broaderRestaurants); // Add broader results
                }
            }

            if (!restaurants || restaurants.length === 0) {
                currentRestaurants = [];
                displayRestaurants([], false, false); // Not loading, show "no restaurants" message
                return;
            }

            // 2. Fetch TikToks for those specific restaurants (including thumbnails).
            const restaurantIds = restaurants.map(r => r.id);
            console.log('🔍 Fetching TikToks for restaurant IDs:', restaurantIds);
            const { data: tiktoks, error: tiktoksError } = await supabaseClient
                .from('tiktoks')
                .select('restaurant_id, embed_html, thumbnail_url, is_featured')
                .in('restaurant_id', restaurantIds)
                .eq('is_featured', true);

            if (tiktoksError) {
                // Log the error but don't stop execution, so restaurants still display.
                console.error("Error fetching tiktoks:", tiktoksError);
                tiktoks = [];
            } else {
                console.log('✅ Fetched TikToks:', tiktoks);
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
                console.log('📝 Processing TikToks:', tiktoks);
                tiktoks.forEach(t => {
                    console.log('📝 Adding TikTok for restaurant:', t.restaurant_id, 'embed_html:', t.embed_html, 'thumbnail:', t.thumbnail_url);
                    // Store the entire TikTok object, not just embed_html
                    tiktokMap.set(t.restaurant_id, {
                        embed_html: t.embed_html,
                        thumbnail_url: t.thumbnail_url,
                        is_featured: t.is_featured
                    });
                });
            }
            console.log('🗺️ TikTok Map size:', tiktokMap.size);
            console.log('🗺️ TikTok Map contents:', Array.from(tiktokMap.entries()));

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

            window.currentRestaurants = restaurants.map(r => {
                const tiktokData = tiktokMap.get(r.id) || null;
                console.log('🏗️ Creating restaurant object:', r.id, 'tiktok_data:', tiktokData ? 'EXISTS' : 'NULL');
                return {
                    ...r,
                    tiktok_embed_html: tiktokData?.embed_html || null,
                    tiktok_thumbnail_url: tiktokData?.thumbnail_url || null,
                    tiktok_is_featured: tiktokData?.is_featured || false,
                    cuisines: cuisineMap.get(r.id) || []
                };
            });
            currentRestaurants = window.currentRestaurants;
            console.log('📊 Total restaurants with TikTok data:', currentRestaurants.filter(r => r.tiktok_embed_html).length);
            console.log('📊 Total restaurants with thumbnails:', currentRestaurants.filter(r => r.tiktok_thumbnail_url).length);
            
            // Order restaurants based on geolocation availability
            if (window.userLocation) {
                // If user has geolocation, order by distance (closest first)
                currentRestaurants.sort((a, b) => {
                    const distanceA = calculateDistance(window.userLocation.lat, window.userLocation.lon, a.lat, a.lon);
                    const distanceB = calculateDistance(window.userLocation.lat, window.userLocation.lon, b.lat, b.lon);
                    return distanceA - distanceB;
                });
                console.log('Restaurants ordered by distance from user location');
            } else {
                // If no geolocation, randomize the order
                currentRestaurants.sort(() => Math.random() - 0.5);
                console.log('Restaurants ordered randomly (no geolocation)');
            }
            
            // Small delay to ensure skeleton loaders are visible before showing real data
            setTimeout(async () => {
            await applyAllFiltersAndDisplay();
            }, 100);
        }

        // Load restaurants that have TikToks by a specific creator handle (case-insensitive)
        async function loadRestaurantsForCreator(handleLower) {
            try {
                // 1) Validate that the handle exists for a creator
                const handleWithAt = '@' + handleLower;
                let { data: roleRow, error: roleErr } = await supabaseClient
                    .from('user_roles')
                    .select('tiktok_handle, role')
                    .ilike('tiktok_handle', handleWithAt)
                    .single();

                if ((roleErr && roleErr.code === 'PGRST116') || !roleRow) {
                    // Try without leading '@'
                    const fallback = await supabaseClient
                        .from('user_roles')
                        .select('tiktok_handle, role')
                        .ilike('tiktok_handle', handleLower)
                        .single();
                    roleRow = fallback.data;
                    roleErr = fallback.error;
                }

                if (roleErr || !roleRow || (roleRow.role && roleRow.role !== 'creator')) {
                    console.warn('Creator not found for handle:', handleLower, roleErr);
                    displayRestaurants([], false, false);
                    const list = document.getElementById('restaurant-list');
                    if (list) {
                        list.innerHTML = '<p class="text-gray-500 text-center">Creator not found.</p>';
                    }
                    return;
                }

                // 2) Find all TikToks authored by this handle (including thumbnails)
                let { data: tiktoks, error: tErr } = await supabaseClient
                    .from('tiktoks')
                    .select('restaurant_id, embed_html, author_handle, thumbnail_url, is_featured')
                    .ilike('author_handle', handleWithAt)
                    .eq('is_featured', true);

                if (!tErr && tiktoks && tiktoks.length === 0) {
                    const fallbackTik = await supabaseClient
                        .from('tiktoks')
                        .select('restaurant_id, embed_html, author_handle, thumbnail_url, is_featured')
                        .ilike('author_handle', handleLower)
                        .eq('is_featured', true);
                    tiktoks = fallbackTik.data;
                    tErr = fallbackTik.error;
                }

                if (tErr) {
                    console.error('Error fetching creator tiktoks:', tErr);
                    displayRestaurants([], false, false);
                    return;
                }

                if (!tiktoks || tiktoks.length === 0) {
                    displayRestaurants([], false, false);
                    const list = document.getElementById('restaurant-list');
                    if (list) {
                        list.innerHTML = '<p class="text-gray-500 text-center">No content yet for this creator.</p>';
                    }
                    return;
                }

                // 3) Fetch the restaurants for those TikToks
                const restaurantIds = [...new Set(tiktoks.map(t => t.restaurant_id))];
                const { data: restaurants, error: rErr } = await supabaseClient
                    .from('restaurants')
                    .select('*')
                    .in('id', restaurantIds);

                if (rErr) {
                    console.error('Error fetching restaurants:', rErr);
                    displayRestaurants([], false, false);
                    return;
                }

                // 4) Fetch cuisines for those restaurants
                const { data: restaurantCuisines } = await supabaseClient
                    .from('restaurant_cuisines')
                    .select('\n                    restaurant_id,\n                    cuisines (name, icon, color_background, color_text)\n                ')
                    .in('restaurant_id', restaurantIds);

                const tiktokMap = new Map();
                tiktoks.forEach(t => {
                    // map only one embed per restaurant (any by this creator)
                    if (!tiktokMap.has(t.restaurant_id)) {
                        tiktokMap.set(t.restaurant_id, {
                            embed_html: t.embed_html,
                            thumbnail_url: t.thumbnail_url,
                            is_featured: t.is_featured
                        });
                    }
                });

                const cuisineMap = new Map();
                if (restaurantCuisines) {
                    restaurantCuisines.forEach(rc => {
                        if (!cuisineMap.has(rc.restaurant_id)) cuisineMap.set(rc.restaurant_id, []);
                        if (rc.cuisines) cuisineMap.get(rc.restaurant_id).push(rc.cuisines);
                    });
                }

                window.currentRestaurants = (restaurants || []).map(r => {
                    const tiktokData = tiktokMap.get(r.id) || null;
                    return {
                    ...r,
                        tiktok_embed_html: tiktokData?.embed_html || null,
                        tiktok_thumbnail_url: tiktokData?.thumbnail_url || null,
                        tiktok_is_featured: tiktokData?.is_featured || false,
                    cuisines: cuisineMap.get(r.id) || []
                    };
                });
                currentRestaurants = window.currentRestaurants;

                // Order like explore behavior
                if (window.userLocation) {
                    currentRestaurants.sort((a, b) => {
                        const distanceA = calculateDistance(window.userLocation.lat, window.userLocation.lon, a.lat, a.lon);
                        const distanceB = calculateDistance(window.userLocation.lat, window.userLocation.lon, b.lat, b.lon);
                        return distanceA - distanceB;
                    });
                } else {
                    currentRestaurants.sort(() => Math.random() - 0.5);
                }

                setTimeout(async () => { await applyAllFiltersAndDisplay(); }, 100);
            } catch (e) {
                console.error('Error loading creator restaurants:', e);
                displayRestaurants([], false, false);
            }
        }

        // Setup cuisine filter functionality
        function setupCuisineFilter() {
            // Populate cuisine filter checkboxes for both desktop and mobile
            populateCuisineFilter();
            
            // Setup filter toggle button
            setupFilterToggle();
        }
        
        // Setup cuisine filter modal event listeners directly
        function setupCuisineFilterModals() {
            console.log('🔧 Setting up cuisine filter modal event listeners...');
            
            // Desktop modal setup
            const desktopCloseBtn = document.getElementById('close-desktop-filter-modal');
            const desktopCancelBtn = document.getElementById('cancel-cuisine-filter-desktop');
            const desktopApplyBtn = document.getElementById('apply-cuisine-filter-desktop');
            const desktopModal = document.getElementById('desktop-filter-modal');
            
            console.log('Desktop modal elements:', {
                close: !!desktopCloseBtn,
                cancel: !!desktopCancelBtn,
                apply: !!desktopApplyBtn,
                modal: !!desktopModal
            });
            
            if (desktopCloseBtn) {
                desktopCloseBtn.addEventListener('click', () => {
                    console.log('Desktop close button clicked');
                    closeDesktopFilterModal();
                });
            }
            
            if (desktopCancelBtn) {
                desktopCancelBtn.addEventListener('click', () => {
                    console.log('Desktop cancel button clicked');
                    closeDesktopFilterModal();
                });
            }
            
            if (desktopApplyBtn) {
                desktopApplyBtn.addEventListener('click', () => {
                    console.log('Desktop apply button clicked');
                    applyDesktopFilter();
                });
            }
            
            if (desktopModal) {
                desktopModal.addEventListener('click', (e) => {
                    if (e.target === desktopModal) {
                        console.log('Desktop modal clicked outside');
                        closeDesktopFilterModal();
                    }
                });
            }
            
            // Mobile modal setup
            const mobileCloseBtn = document.getElementById('close-filter-modal');
            const mobileCancelBtn = document.getElementById('cancel-cuisine-filter-mobile');
            const mobileApplyBtn = document.getElementById('apply-cuisine-filter-mobile');
            const mobileModal = document.getElementById('filter-modal');
            
            console.log('Mobile modal elements:', {
                close: !!mobileCloseBtn,
                cancel: !!mobileCancelBtn,
                apply: !!mobileApplyBtn,
                modal: !!mobileModal
            });
            
            if (mobileCloseBtn) {
                mobileCloseBtn.addEventListener('click', () => {
                    console.log('Mobile close button clicked');
                    closeMobileFilterModal();
                });
            }
            
            if (mobileCancelBtn) {
                mobileCancelBtn.addEventListener('click', () => {
                    console.log('Mobile cancel button clicked');
                    closeMobileFilterModal();
                });
            }
            
            if (mobileApplyBtn) {
                mobileApplyBtn.addEventListener('click', () => {
                    console.log('Mobile apply button clicked');
                    applyMobileFilter();
                });
            }
            
            if (mobileModal) {
                mobileModal.addEventListener('click', (e) => {
                    if (e.target === mobileModal) {
                        console.log('Mobile modal clicked outside');
                        closeMobileFilterModal();
                    }
                });
            }
            
            console.log('✅ Cuisine filter modal event listeners set up');
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
                        
                        // Update persistent state
                        if (this.checked) {
                            selectedCuisines.add(cuisine.name);
                        } else {
                            selectedCuisines.delete(cuisine.name);
                        }
                        saveFilterStates();
                        
                        updateCuisineCardStyle(cuisineCard, this.checked);
                        updateSelectedCount();
                        applyAllFiltersAndDisplay();
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
                    
                    // Add event listener for mobile cuisine checkbox
                    checkbox.addEventListener('change', function() {
                        console.log('Mobile cuisine checkbox changed:', cuisine.name, 'checked:', this.checked);
                        
                        // Update persistent state
                        if (this.checked) {
                            selectedCuisines.add(cuisine.name);
                        } else {
                            selectedCuisines.delete(cuisine.name);
                        }
                        
                        // Save filter states
                        saveFilterStates();
                        updateSelectedCount();
                    });
                    
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
                        // Update persistent state
                        if (this.checked) {
                            selectedCuisines.add(cuisine.name);
                        } else {
                            selectedCuisines.delete(cuisine.name);
                        }
                        saveFilterStates();
                        
                        updateSelectedCount();
                        applyAllFiltersAndDisplay();
                    });
                }
            });
        }
        
        // Filter restaurants by selected cuisines (multiple selection)
        // Apply combined filters (cuisine + collection)
        async function applyAllFiltersAndDisplay() {
            console.log('🎯 Applying all filters and updating display');
            
            // Update filter button appearances
            updateFilterButtonAppearance();
            updateCollectionFilterButtonAppearance();
            
            // Show skeleton loaders briefly for better UX
            displayRestaurants([], true);
            
            // Use setTimeout to show skeleton loading briefly
            setTimeout(async () => {
                try {
                    const filteredRestaurants = await applyAllFilters(currentRestaurants);
                    window.filteredRestaurants = filteredRestaurants; // Make it globally accessible
                    
                    if (filteredRestaurants.length === 0) {
                        // Show empty state message
                        const restaurantList = document.getElementById('restaurant-list');
                        if (restaurantList) {
                            restaurantList.innerHTML = `
                                <div class="text-center py-8 text-gray-500">
                                    <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                                    </svg>
                                    <h3 class="text-lg font-medium mb-2">No restaurants found</h3>
                                    <p class="text-sm">No restaurants match your current filters. Try adjusting your cuisine or collection selections.</p>
                                </div>
                            `;
                        }
                    } else {
                    displayRestaurants(filteredRestaurants);
                    }
                    
                    // Fit map to show filtered restaurants
                    if (map && mapInitialized) {
                    fitMapToRestaurants(filteredRestaurants);
                }
                } catch (error) {
                    console.error('❌ Error applying filters:', error);
                    // On error, show all restaurants
                    displayRestaurants(currentRestaurants);
                }
            }, 300);
        }

        function filterRestaurantsByCuisines() {
            // Use the new combined filter function
            applyAllFiltersAndDisplay();
        }
        
        // Get selected cuisines from persistent state
        function getSelectedCuisines() {
            return Array.from(selectedCuisines);
        }
        
        // Get selected cuisines from DOM (for UI updates)
        function getSelectedCuisinesFromDOM() {
            // Get checkboxes from both desktop and mobile filters
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox:checked');
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox:checked');
            
            // Combine both sets of checkboxes
            const allCheckboxes = [...desktopCheckboxes, ...mobileCheckboxes];
            return Array.from(allCheckboxes).map(checkbox => checkbox.value);
        }
        
        // Update filter button appearance based on active filters
        function updateFilterButtonAppearance() {
            const selectedCuisines = getSelectedCuisines();
            const hasActiveFilters = selectedCuisines.length > 0;
            
            // Update count element
            const countElement = document.getElementById('selected-count');
            const subtitleElement = document.getElementById('filter-subtitle');
            
            if (!countElement || !subtitleElement) return;
            
            if (hasActiveFilters) {
                // Show count
                countElement.textContent = selectedCuisines.length;
                countElement.classList.remove('hidden');
                
                // Update subtitle
                if (selectedCuisines.length === 1) {
                    subtitleElement.textContent = selectedCuisines[0];
                } else {
                    subtitleElement.textContent = `${selectedCuisines.length} cuisines selected`;
                }
            } else {
                // Hide count and reset subtitle
                countElement.classList.add('hidden');
                subtitleElement.textContent = 'All cuisines';
            }
        }

        // Clear all cuisine filters
        function clearAllCuisineFilters() {
            // Clear persistent state
            selectedCuisines.clear();
            saveFilterStates();
            
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
            applyAllFiltersAndDisplay();
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
            const applyBtn = document.getElementById('apply-cuisine-filter-desktop');
            const cancelBtn = document.getElementById('cancel-cuisine-filter-desktop');
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
            const applyBtn = document.getElementById('apply-cuisine-filter-mobile');
            const cancelBtn = document.getElementById('cancel-cuisine-filter-mobile');
            const clearBtn = document.getElementById('clear-cuisine-filter-mobile');
            
            // Check if elements exist before adding listeners
            if (!filterModal || !closeBtn || !applyBtn || !cancelBtn || !clearBtn) return;
            
            // Close modal
            closeBtn.addEventListener('click', closeMobileFilterModal);
            cancelBtn.addEventListener('click', closeMobileFilterModal);
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
            filterModal.classList.add('flex');
            
            // Ensure event listeners are set up for this modal
            setupDesktopModalListeners();
            
            // Check if the container has content
            const container = document.getElementById('cuisine-filter-container-desktop');
            if (container) {
                console.log('Desktop filter container children:', container.children.length);
            }
            
            // Sync desktop checkboxes with current state
            syncDesktopFilterWithCurrent();
        }
        
        // Setup desktop modal event listeners
        function setupDesktopModalListeners() {
            const closeBtn = document.getElementById('close-desktop-filter-modal');
            const cancelBtn = document.getElementById('cancel-cuisine-filter-desktop');
            const applyBtn = document.getElementById('apply-cuisine-filter-desktop');
            const clearBtn = document.getElementById('clear-cuisine-filter-desktop');
            
            console.log('Setting up desktop modal listeners:', {
                close: !!closeBtn,
                cancel: !!cancelBtn,
                apply: !!applyBtn,
                clear: !!clearBtn
            });
            
            // Add event listeners if they don't already exist
            if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
                closeBtn.addEventListener('click', () => {
                    console.log('Desktop close button clicked');
                    closeDesktopFilterModal();
                });
                closeBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (cancelBtn && !cancelBtn.hasAttribute('data-listener-added')) {
                cancelBtn.addEventListener('click', () => {
                    console.log('Desktop cancel button clicked');
                    closeDesktopFilterModal();
                });
                cancelBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (applyBtn && !applyBtn.hasAttribute('data-listener-added')) {
                applyBtn.addEventListener('click', () => {
                    console.log('Desktop apply button clicked');
                    applyDesktopFilter();
                });
                applyBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (clearBtn && !clearBtn.hasAttribute('data-listener-added')) {
                clearBtn.addEventListener('click', () => {
                    console.log('Desktop clear button clicked');
                    clearDesktopFilter();
                });
                clearBtn.setAttribute('data-listener-added', 'true');
            }
        }
        
        // Close desktop filter modal
        function closeDesktopFilterModal() {
            console.log('Closing desktop filter modal...');
            const filterModal = document.getElementById('desktop-filter-modal');
            if (filterModal) {
                filterModal.classList.add('hidden');
                filterModal.classList.remove('flex');
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
            // Clear persistent state
            selectedCuisines.clear();
            saveFilterStates();
            
            const desktopCheckboxes = document.querySelectorAll('#cuisine-filter-container-desktop .cuisine-checkbox');
            desktopCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
                const card = checkbox.closest('.cuisine-card');
                if (card) {
                    updateCuisineCardStyle(card, false);
                }
            });
            updateSelectedCount();
            updateFilterButtonAppearance();
            
            // Apply the cleared filter
            applyAllFiltersAndDisplay();
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
            
            // Ensure event listeners are set up for this modal
            setupMobileModalListeners();
            
            // Sync mobile checkboxes with desktop state
            syncMobileFilterWithDesktop();
        }
        
        // Setup mobile modal event listeners
        function setupMobileModalListeners() {
            const closeBtn = document.getElementById('close-filter-modal');
            const cancelBtn = document.getElementById('cancel-cuisine-filter-mobile');
            const applyBtn = document.getElementById('apply-cuisine-filter-mobile');
            const clearBtn = document.getElementById('clear-cuisine-filter-mobile');
            
            console.log('Setting up mobile modal listeners:', {
                close: !!closeBtn,
                cancel: !!cancelBtn,
                apply: !!applyBtn,
                clear: !!clearBtn
            });
            
            // Add event listeners if they don't already exist
            if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
                closeBtn.addEventListener('click', () => {
                    console.log('Mobile close button clicked');
                    closeMobileFilterModal();
                });
                closeBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (cancelBtn && !cancelBtn.hasAttribute('data-listener-added')) {
                cancelBtn.addEventListener('click', () => {
                    console.log('Mobile cancel button clicked');
                    closeMobileFilterModal();
                });
                cancelBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (applyBtn && !applyBtn.hasAttribute('data-listener-added')) {
                applyBtn.addEventListener('click', () => {
                    console.log('Mobile apply button clicked');
                    applyMobileFilter();
                });
                applyBtn.setAttribute('data-listener-added', 'true');
            }
            
            if (clearBtn && !clearBtn.hasAttribute('data-listener-added')) {
                clearBtn.addEventListener('click', () => {
                    console.log('Mobile clear button clicked');
                    clearMobileFilter();
                });
                clearBtn.setAttribute('data-listener-added', 'true');
            }
        }
        
        // Close mobile filter modal
        function closeMobileFilterModal() {
            console.log('Closing mobile filter modal...');
            const filterModal = document.getElementById('filter-modal');
            if (filterModal) {
                filterModal.classList.add('hidden');
                filterModal.classList.remove('flex');
            }
        }
        
        // Apply mobile filter
        async function applyMobileFilter() {
            // Sync desktop checkboxes with mobile state
            syncDesktopFilterWithMobile();
            
            // Apply the filter using the new combined system
            await applyAllFiltersAndDisplay();
            
            // Close modal
            closeMobileFilterModal();
        }
        
        // Clear mobile filter
        async function clearMobileFilter() {
            // Clear persistent state
            selectedCuisines.clear();
            saveFilterStates();
            
            const mobileCheckboxes = document.querySelectorAll('#cuisine-filter-container-mobile .cuisine-checkbox');
            mobileCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // Apply the cleared filter
            await applyAllFiltersAndDisplay();
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
            
            // Skip setup if admin link doesn't exist (removed from HTML)
            if (!adminLink) return;
            
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

        // --- Collections Logic ---
        const collectionsBtn = document.getElementById('collections-btn');
        const collectionsModal = document.getElementById('collections-modal');
        const closeCollectionsModalBtn = document.getElementById('close-collections-modal');
        const collectionsList = document.getElementById('collections-list');
        const addCollectionForm = document.getElementById('add-collection-form');

        // Toast notification function
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast-notification');
            const toastMessage = document.getElementById('toast-message');
            
            // Set message and type
            toastMessage.textContent = message;
            toast.className = `fixed top-4 right-4 text-white px-6 py-3 rounded-lg shadow-lg z-[10001] transform translate-x-full transition-transform duration-300 ease-in-out ${type}`;
            
            // Show toast (remove hidden class)
            toast.classList.remove('hidden');
            
            // Slide in
            setTimeout(() => {
                toast.classList.add('show');
            }, 100);
            
            // Hide toast after 3 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                // Hide completely after animation
                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 300);
            }, 3000);
        }

        // Open/Close Modal
        collectionsBtn.addEventListener('click', async () => {
            // Check if user is authenticated
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                console.log('User not authenticated, opening auth modal');
                openAuthModal();
                return;
            }
            
            collectionsModal.classList.remove('hidden');
            collectionsModal.classList.add('flex');
            loadCollectionsForModal();
        });
        closeCollectionsModalBtn.addEventListener('click', () => collectionsModal.classList.add('hidden'));

        // Handle new collection creation
        addCollectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const collectionNameInput = document.getElementById('new-collection-name');
            const collectionName = collectionNameInput.value.trim();
            const { data: { user } } = await supabaseClient.auth.getUser();

            if (collectionName && user) {
                const { error } = await supabaseClient.from('user_collections').insert({ name: collectionName, user_id: user.id });
                if (error) {
                    console.error('Error creating collection:', error);
                } else {
                    collectionNameInput.value = '';
                    loadCollectionsForModal(); // Refresh list
                }
            }
        });

        // Function to load and display a user's collections for the collections modal
        async function loadCollectionsForModal() {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) return;

            const collectionsListEl = document.getElementById('collections-list');
            if (!collectionsListEl) return;

            const { data, error } = await supabaseClient
                .from('user_collections')
                .select(`*, collection_restaurants(count)`)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                collectionsListEl.innerHTML = `<p class="text-red-500">Error loading collections.</p>`;
                return;
            }

            if (data.length === 0) {
                collectionsListEl.innerHTML = `<p class="text-gray-500 text-center">You haven't created any collections yet.</p>`;
            } else {
                collectionsListEl.innerHTML = data.map(collection => `
                    <div class="flex justify-between items-center p-2 rounded-md hover:bg-gray-100">
                        <div class="flex-1 cursor-pointer collection-item" data-collection-id="${collection.id}" data-collection-name="${collection.name}">
                            <p class="font-semibold">${collection.name}</p>
                            <p class="text-sm text-gray-500">${collection.collection_restaurants[0].count} items</p>
                        </div>
                        <button class="delete-collection-btn text-red-500 hover:text-red-700 ml-2" data-collection-id="${collection.id}">Delete</button>
                    </div>
                `).join('');
            }
        }

        // Handle deleting a collection
        let collectionToDelete = null;
        const collectionsListEl = document.getElementById('collections-list');
        if (collectionsListEl) {
            collectionsListEl.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-collection-btn')) {
                const collectionId = e.target.dataset.collectionId;
                const collectionName = e.target.closest('.flex').querySelector('.font-semibold').textContent;
                
                // Store the collection to delete
                collectionToDelete = collectionId;
                
                // Show custom confirmation modal
                document.getElementById('collection-name-to-delete').textContent = collectionName;
                document.getElementById('delete-collection-modal').classList.remove('hidden');
                document.getElementById('delete-collection-modal').classList.add('flex');
            } else if (e.target.closest('.collection-item')) {
                // Handle collection item click for filtering
                const collectionItem = e.target.closest('.collection-item');
                const collectionId = collectionItem.dataset.collectionId;
                const collectionName = collectionItem.dataset.collectionName;
                
                console.log('Collection clicked for filtering:', collectionName, 'ID:', collectionId);
                
                // Clear any existing collection filters
                selectedCollections.clear();
                
                // Add this collection to selected collections
                selectedCollections.add(collectionId);
                saveFilterStates();
                
                // Update collection filter button appearance
                updateCollectionFilterButtonAppearance();
                
                // Apply the filter
                await applyAllFiltersAndDisplay();
                
                // Close the collections modal
                document.getElementById('collections-modal').classList.add('hidden');
                document.getElementById('collections-modal').classList.remove('flex');
                
                // Show success message
                showToast(`Filtering by collection: ${collectionName}`);
            }
        });
        }

        // Handle delete confirmation modal
        document.getElementById('cancel-delete-collection').addEventListener('click', () => {
            document.getElementById('delete-collection-modal').classList.add('hidden');
            document.getElementById('delete-collection-modal').classList.remove('flex');
            collectionToDelete = null;
        });

        document.getElementById('confirm-delete-collection').addEventListener('click', async () => {
            if (collectionToDelete) {
                try {
                    // First delete items in collection, then the collection itself
                    await supabaseClient.from('collection_restaurants').delete().eq('collection_id', collectionToDelete);
                    await supabaseClient.from('user_collections').delete().eq('id', collectionToDelete);
                    loadCollectionsForModal(); // Refresh list
                } catch (error) {
                    console.error('Error deleting collection:', error);
                }
                
                // Close modal
                document.getElementById('delete-collection-modal').classList.add('hidden');
                document.getElementById('delete-collection-modal').classList.remove('flex');
                collectionToDelete = null;
            }
        });

        // Close delete modal when clicking outside
        document.getElementById('delete-collection-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('delete-collection-modal')) {
                document.getElementById('delete-collection-modal').classList.add('hidden');
                document.getElementById('delete-collection-modal').classList.remove('flex');
                collectionToDelete = null;
            }
        });

        // Handle quick create collection modal
        document.getElementById('close-quick-create-modal').addEventListener('click', () => {
            document.getElementById('quick-create-collection-modal').classList.add('hidden');
            document.getElementById('quick-create-collection-modal').classList.remove('flex');
            document.getElementById('quick-create-collection-form').reset();
            window.quickCreateRestaurantId = null;
        });

        document.getElementById('cancel-quick-create').addEventListener('click', () => {
            document.getElementById('quick-create-collection-modal').classList.add('hidden');
            document.getElementById('quick-create-collection-modal').classList.remove('flex');
            document.getElementById('quick-create-collection-form').reset();
            window.quickCreateRestaurantId = null;
        });

        document.getElementById('quick-create-collection-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const collectionName = document.getElementById('quick-collection-name').value.trim();
            const restaurantId = window.quickCreateRestaurantId;

            if (collectionName && restaurantId) {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user) {
                    try {
                        // Create the collection
                        const { data: newCollection, error: createError } = await supabaseClient
                            .from('user_collections')
                            .insert({ name: collectionName, user_id: user.id })
                            .select()
                            .single();

                        if (createError) {
                            console.error('Error creating collection:', createError);
                            showToast('Error creating collection. Please try again.', 'error');
                        } else {
                            // Add restaurant to the new collection
                            const { error: addError } = await supabaseClient.from('collection_restaurants').insert({
                                collection_id: newCollection.id,
                                restaurant_id: restaurantId
                            });

                            if (addError) {
                                console.error('Error adding restaurant to collection:', addError);
                                showToast('Collection created but failed to add restaurant. Please try again.', 'error');
                            } else {
                                showToast(`Collection "${collectionName}" created and restaurant added!`);
                                
                                // Update collection state (store both string and numeric versions)
                                collectedRestaurants.add(restaurantId);
                                collectedRestaurants.add(parseInt(restaurantId, 10));
                                console.log('Updated collectedRestaurants (quick create):', collectedRestaurants);
                                
                                // Close modal and reset
                                document.getElementById('quick-create-collection-modal').classList.add('hidden');
                                document.getElementById('quick-create-collection-modal').classList.remove('flex');
                                document.getElementById('quick-create-collection-form').reset();
                                window.quickCreateRestaurantId = null;
                                
                                // Re-display restaurants to show updated collection status
                                if (currentRestaurants && currentRestaurants.length > 0) {
                                    console.log('Re-displaying restaurants after quick create collection');
                                    displayRestaurants(currentRestaurants);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        showToast('Something went wrong. Please try again.', 'error');
                    }
                }
            }
        });

        // Close quick create modal when clicking outside
        document.getElementById('quick-create-collection-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('quick-create-collection-modal')) {
                document.getElementById('quick-create-collection-modal').classList.add('hidden');
                document.getElementById('quick-create-collection-modal').classList.remove('flex');
                document.getElementById('quick-create-collection-form').reset();
                window.quickCreateRestaurantId = null;
            }
        });

        // Handle showing the 'Add to Collection' popup
        document.getElementById('restaurant-list').addEventListener('click', async (e) => {
            if (e.target.closest('.add-to-collection-btn')) {
                const button = e.target.closest('.add-to-collection-btn');
                const restaurantId = button.dataset.restaurantId;
                const { data: { user } } = await supabaseClient.auth.getUser();

                if (!user) {
                    openAuthModal();
                    return;
                }

                // Show comprehensive collection management modal
                showCollectionManagementModal(restaurantId);
            }
        });

        // Handle adding a restaurant to a collection
        document.body.addEventListener('click', async (e) => {
            // Check if clicked on a collection option in the modal
            const collectionOption = e.target.closest('.collection-option');
            if (collectionOption) {
                const collectionId = collectionOption.dataset.collectionId;
                const restaurantId = collectionOption.dataset.restaurantId;

                // Add to existing collection
                const { error } = await supabaseClient
                    .from('collection_restaurants')
                    .insert({ collection_id: collectionId, restaurant_id: restaurantId });

                if (error && error.code === '23505') { // 23505 is the code for unique constraint violation
                    showToast('This restaurant is already in that collection.', 'warning');
                } else if (error) {
                    console.error(error);
                    showToast('Error adding to collection. Please try again.', 'error');
                } else {
                    showToast('Added to collection!');
                    // Update collection state immediately (store both string and numeric versions)
                    collectedRestaurants.add(restaurantId);
                    collectedRestaurants.add(parseInt(restaurantId, 10));
                    console.log('Updated collectedRestaurants:', collectedRestaurants);
                    
                    // Update the specific restaurant card immediately
                    const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                    if (restaurantCard) {
                        const bookmarkBtn = restaurantCard.querySelector('.add-to-collection-btn');
                        if (bookmarkBtn) {
                            bookmarkBtn.classList.add('collected');
                        }
                    }
                    
                    // Also update the video header collection button if it's visible
                    const videoCollectionBtn = document.getElementById('video-collection-btn');
                    if (videoCollectionBtn && videoCollectionBtn.dataset.restaurantId == restaurantId) {
                        videoCollectionBtn.classList.add('collected');
                        videoCollectionBtn.title = 'Remove from Collections';
                    }
                    
                    // Re-display restaurants to show updated collection status
                    if (currentRestaurants && currentRestaurants.length > 0) {
                        console.log('Re-displaying restaurants after adding to collection');
                        await applyAllFiltersAndDisplay();
                    }
                }
                
                // Close the modal
                document.getElementById('collection-selection-modal').remove();
            }
            
            // Check if clicked on create collection option
            const createOption = e.target.closest('.create-collection-option');
            if (createOption) {
                const restaurantId = createOption.dataset.restaurantId;
                
                // Store the restaurant ID for later use
                window.quickCreateRestaurantId = restaurantId;
                
                // Close any existing collection modals
                const existingModal = document.getElementById('collection-management-modal') || document.getElementById('collection-selection-modal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // Show create collection modal
                document.getElementById('quick-create-collection-modal').classList.remove('hidden');
                document.getElementById('quick-create-collection-modal').classList.add('flex');
                
                // Focus on the input field
                setTimeout(() => {
                    document.getElementById('quick-collection-name').focus();
                }, 100);
            }
            
            // Check if clicked on any part of a popup list item (legacy desktop popup)
            const listItem = e.target.closest('.add-to-collection-popup li');
            if (listItem) {
                const collectionId = listItem.dataset.collectionId;
                const restaurantId = listItem.dataset.restaurantId;

                // Check if it's the create collection option
                if (listItem.classList.contains('create-collection-option')) {
                    // Store the restaurant ID for later use
                    window.quickCreateRestaurantId = restaurantId;
                    
                    // Show create collection modal
                    document.getElementById('quick-create-collection-modal').classList.remove('hidden');
                    document.getElementById('quick-create-collection-modal').classList.add('flex');
                    
                    // Focus on the input field
                    setTimeout(() => {
                        document.getElementById('quick-collection-name').focus();
                    }, 100);
                } else if (collectionId) {
                    // Add to existing collection
                    const { error } = await supabaseClient.from('collection_restaurants').insert({
                        collection_id: collectionId,
                        restaurant_id: restaurantId
                    });

                    if (error && error.code === '23505') { // 23505 is the code for unique constraint violation
                        showToast('This restaurant is already in that collection.', 'warning');
                    } else if (error) {
                        console.error(error);
                        showToast('Error adding to collection. Please try again.', 'error');
                    } else {
                        showToast('Added to collection!');
                        // Update collection state (store both string and numeric versions)
                        collectedRestaurants.add(restaurantId);
                        collectedRestaurants.add(parseInt(restaurantId, 10));
                        console.log('Updated collectedRestaurants:', collectedRestaurants);
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
                            console.log('Re-displaying restaurants after adding to collection');
                            await applyAllFiltersAndDisplay();
                        }
                    }
                }
                
                listItem.closest('.add-to-collection-popup').remove();
            }
            
            // Check if clicked on a collection management option
            const managementOption = e.target.closest('.collection-management-option');
            if (managementOption) {
                const collectionId = managementOption.dataset.collectionId;
                const restaurantId = managementOption.dataset.restaurantId;
                const action = managementOption.dataset.action;
                const collectionName = managementOption.querySelector('.text-lg').textContent;

                if (action === 'add') {
                    // Add to collection
                    const { error } = await supabaseClient
                        .from('collection_restaurants')
                        .insert({ collection_id: collectionId, restaurant_id: restaurantId });

                    if (error && error.code === '23505') { // 23505 is the code for unique constraint violation
                        showToast('This restaurant is already in that collection.', 'warning');
                    } else if (error) {
                        console.error('Error adding to collection:', error);
                        showToast('Error adding to collection. Please try again.', 'error');
                    } else {
                        showToast(`Added to ${collectionName}`);
                        
                        // Update collection state immediately (store both string and numeric versions)
                        collectedRestaurants.add(restaurantId);
                        collectedRestaurants.add(parseInt(restaurantId, 10));
                        console.log('Updated collectedRestaurants:', collectedRestaurants);
                        
                        // Update the specific restaurant card immediately
                        const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                        if (restaurantCard) {
                            const bookmarkBtn = restaurantCard.querySelector('.add-to-collection-btn');
                            if (bookmarkBtn) {
                                bookmarkBtn.classList.add('collected');
                            }
                        }
                        
                        // Also update the video header collection button if it's visible
                        const videoCollectionBtn = document.getElementById('video-collection-btn');
                        if (videoCollectionBtn && videoCollectionBtn.dataset.restaurantId == restaurantId) {
                            videoCollectionBtn.classList.add('collected');
                            videoCollectionBtn.title = 'Remove from Collections';
                        }
                        
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
                            console.log('Re-displaying restaurants after adding to collection');
                            await applyAllFiltersAndDisplay();
                        }
                    }
                } else if (action === 'remove') {
                    // Remove from collection
                    const { error } = await supabaseClient
                        .from('collection_restaurants')
                        .delete()
                        .eq('collection_id', collectionId)
                        .eq('restaurant_id', restaurantId);

                    if (error) {
                        console.error('Error removing from collection:', error);
                        showToast('Error removing from collection. Please try again.', 'error');
                    } else {
                        showToast(`Removed from ${collectionName}`);
                        
                        // Check if restaurant is still in any collections
                        const { data: remainingCollections } = await supabaseClient
                            .from('collection_restaurants')
                            .select('collection_id')
                            .eq('restaurant_id', restaurantId);
                        
                        if (!remainingCollections || remainingCollections.length === 0) {
                            // Remove from collected restaurants if not in any collections (remove both string and numeric versions)
                            collectedRestaurants.delete(restaurantId);
                            collectedRestaurants.delete(parseInt(restaurantId, 10));
                            
                            // Update the specific restaurant card
                            const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                            if (restaurantCard) {
                                const bookmarkBtn = restaurantCard.querySelector('.add-to-collection-btn');
                                if (bookmarkBtn) {
                                    bookmarkBtn.classList.remove('collected');
                                }
                            }
                            
                            // Also update the video header collection button if it's visible
                            const videoCollectionBtn = document.getElementById('video-collection-btn');
                            if (videoCollectionBtn && videoCollectionBtn.dataset.restaurantId == restaurantId) {
                                videoCollectionBtn.classList.remove('collected');
                                videoCollectionBtn.title = 'Add to Collection';
                            }
                        }
                        
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
                            console.log('Re-displaying restaurants after removing from collection');
                            await applyAllFiltersAndDisplay();
                        }
                    }
                }
                
                // Close the management modal
                document.getElementById('collection-management-modal').remove();
            } else if (!e.target.closest('.add-to-collection-btn')) {
                // Hide popups when clicking elsewhere
                document.querySelectorAll('.add-to-collection-popup').forEach(p => p.remove());
            }
        });

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

        function displayRestaurants(restaurants, showSkeletons = false, isLoading = false) {
            if (showSkeletons) {
                showSkeletonLoaders(restaurants.length || 6);
                return;
            }
            
            restaurantList.innerHTML = '';
            
            // Clear markers only if markerClusterGroup exists
            if (markerClusterGroup) {
            markerClusterGroup.clearLayers(); // Clear the cluster group instead of individual markers
            }
            window.restaurantMarkers = []; // Also clear the local array
            restaurantMarkers = window.restaurantMarkers;

            if (restaurants.length === 0 && !isLoading) {
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
                
                // Set up intersection observer for the last item to trigger smart preloading
                if (index === restaurants.length - 1) {
                    setupIntersectionObserver(listItem);
                }
            });
            
            // Update restaurant cards with distance information if user location is available
            updateRestaurantCardsWithDistance();
            
            // Preload videos for the first 5 restaurants
            const initialBatch = restaurants.slice(0, 5);
            preloadVideoBatch(initialBatch);
            
            // Show tutorial for first-time users
            showTutorial();
        }
        
        function createListItem(restaurant, index) {
            const listItem = document.createElement('div');
            // Add position: relative to the list item for the button
            listItem.className = 'bg-white rounded-lg cursor-pointer hover:bg-gray-100 transition border border-gray-200 relative touch-manipulation';
            listItem.dataset.restaurantId = restaurant.id;
            
            const isFavorited = favoritedRestaurants.has(restaurant.id);
            const isCollected = collectedRestaurants.has(restaurant.id);
            const favoriteClass = isFavorited ? 'favorited' : '';
            const collectionClass = isCollected ? 'collected' : '';
            const number = index + 1;
            
            // Debug logging
            console.log(`Creating list item for ${restaurant.name} (ID: ${restaurant.id}): isCollected=${isCollected}, collectionClass="${collectionClass}"`);
            console.log(`Current collectedRestaurants Set:`, Array.from(collectedRestaurants));
            if (isCollected) {
                console.log(`Restaurant ${restaurant.name} is collected, applying class: ${collectionClass}`);
            }

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
            
            // Distance will be added by updateRestaurantCardsWithDistance() when user location is available
            let distanceHtml = '';
            
            // Create thumbnail HTML
            let thumbnailHtml = '';
            if (restaurant.tiktok_thumbnail_url) {
                thumbnailHtml = `
                    <img src="${restaurant.tiktok_thumbnail_url}"
                         alt="${restaurant.name} TikTok thumbnail"
                         class="restaurant-thumbnail w-20 h-20 rounded-lg object-cover border border-gray-200"
                         loading="lazy"
                         onerror="this.style.display='none'">`;
            }
            
            listItem.innerHTML = `
                <div class="w-full p-3 md:p-4">
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-3 flex flex-col items-center">
                            <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mb-2">
                        ${number}
                    </div>
                            ${thumbnailHtml}
                </div>
                    <div class="flex-1 min-w-0 pr-16">
                        <h3 class="text-gray-900 text-base md:text-lg font-semibold leading-tight">${restaurant.name}</h3>
                        <p class="text-gray-600 text-sm md:text-sm mt-1.5 line-clamp-2 leading-relaxed">${restaurant.description || ''}</p>
                        <div class="mt-2.5 flex flex-wrap gap-1">${cuisineTags}</div>
                    ${distanceHtml}
                        </div>
                    </div>
                </div>
                <div class="absolute top-2 right-2 flex items-center space-x-1">
                    <button class="add-to-collection-btn ${collectionClass}" data-restaurant-id="${restaurant.id}" title="Add to collection">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                    </button>
                    <button class="favorite-btn ${favoriteClass}" data-restaurant-id="${restaurant.id}" title="Add to favorites">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    </button>
                </div>
            `;

            // Main click event to open video
            listItem.addEventListener('click', (e) => {
                // Prevent opening video if the favorite button or collection button was clicked
                if (e.target.closest('.favorite-btn') || e.target.closest('.add-to-collection-btn')) return;

                // Stop pulsing animation when user selects a restaurant
                stopPulsingAnimation();

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

            // Check if video has been watched and add icon if necessary
            if (watchedVideos.has(restaurant.id)) {
                const watchedIcon = createWatchedIcon();
                listItem.appendChild(watchedIcon);
            }

            return listItem;
        }

        function createNumberedMarker(restaurant, index) {
            const isFavorited = favoritedRestaurants.has(restaurant.id);
            const favoritedClass = isFavorited ? 'favorited' : '';

            // Check if thumbnail markers feature is enabled
            const useThumbnails = CONFIG.FEATURE_FLAGS.THUMBNAIL_MARKERS;

            // Check if restaurant has a TikTok thumbnail
            let markerHtml = '';
            let iconSize = [32, 32];
            let iconAnchor = [16, 16];

            if (useThumbnails && restaurant.tiktok_thumbnail_url) {
                // Use thumbnail as marker
                markerHtml = `<div class="thumbnail-marker-container ${favoritedClass}" style="
                    width: 32px;
                    height: 32px;
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 50%;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <img src="${restaurant.tiktok_thumbnail_url}"
                         alt="${restaurant.name}"
                         style="
                             width: 28px;
                             height: 28px;
                             border-radius: 50%;
                             object-fit: cover;
                         "
                         loading="lazy"
                         onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\"width: 20px; height: 20px; background: #f3f4f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;\">🍽️</div>'">
                </div>`;
            } else {
                // Fallback to cuisine icon or number
                const firstCuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines[0] : null;
                const displayContent = firstCuisine ? firstCuisine.icon : (index + 1);
                markerHtml = `<div class="svg-marker-container ${favoritedClass}" style="
                    width: 32px; 
                    height: 32px; 
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    font-size: 13px;
                    font-weight: bold;
                ">${displayContent}</div>`;
            }

            const icon = L.divIcon({
                className: 'restaurant-marker',
                html: markerHtml,
                iconSize: iconSize,
                iconAnchor: iconAnchor
            });
            
            const marker = L.marker([restaurant.lat, restaurant.lon], { 
                icon: icon,
                title: restaurant.name,
                restaurant: restaurant // Add restaurant data for clustering
            });
            
            marker.on('click', () => {
                // Stop pulsing animation when user selects a restaurant
                stopPulsingAnimation();

                // Remove active class from all cards
                document.querySelectorAll('#restaurant-list .bg-white').forEach(card => {
                    card.classList.remove('active-list-item');
                });
                // Add active class to corresponding card
                const correspondingCard = document.querySelector(`[data-restaurant-id="${restaurant.id}"]`);
                if (correspondingCard) {
                    correspondingCard.classList.add('active-list-item');
                    
                    // Scroll the restaurant list to make the clicked restaurant visible
                    correspondingCard.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
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

        // Preload video for a single restaurant (extracted from showVideoFor)
        async function preloadVideo(restaurant) {
            if (!restaurant.tiktok_embed_html) {
                console.log('❌ No TikTok embed HTML found for restaurant:', restaurant.name);
                return;
            }

            // Create a temporary, hidden container off-screen for TikTok processing
            const preloadContainer = document.createElement('div');
            preloadContainer.style.position = 'absolute';
            preloadContainer.style.top = '-9999px';
            preloadContainer.style.left = '-9999px';
            preloadContainer.style.width = '330px';
            preloadContainer.style.height = '585px';
            preloadContainer.style.background = 'black';
            preloadContainer.dataset.restaurantId = restaurant.id; // Store restaurant ID for cleanup
            document.body.appendChild(preloadContainer);

            console.log('🎬 Preloading video for:', restaurant.name);

            // Inject the raw TikTok blockquote HTML into the hidden container
            preloadContainer.innerHTML = restaurant.tiktok_embed_html;

            // Make sure the blockquote is visible for TikTok processing
            const hiddenBlockquotes = preloadContainer.querySelectorAll('blockquote.tiktok-embed');
            hiddenBlockquotes.forEach(bq => {
                bq.style.visibility = 'visible';
                bq.style.display = 'block';
                bq.removeAttribute('hidden');
                bq.classList.remove('hidden');
            });

            // Try to trigger TikTok embed processing
            if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                window.tiktokEmbed.load();
            }

            // Set up observer to detect when iframe is ready
            const observer = new MutationObserver((mutations, obs) => {
                const iframe = preloadContainer.querySelector('iframe');
                if (iframe) {
                    console.log('✅ Video preloaded for:', restaurant.name);
                    // Store the preloaded iframe for later use
                    restaurant._preloadedIframe = iframe.outerHTML;
                    obs.disconnect();
                    // Clean up the preload container
                    if (document.body.contains(preloadContainer)) {
                        document.body.removeChild(preloadContainer);
                    }
                }
            });

            observer.observe(preloadContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });

            // Cleanup timeout
            setTimeout(() => {
                if (document.body.contains(preloadContainer)) {
                    observer.disconnect();
                    document.body.removeChild(preloadContainer);
                }
            }, 5000); // Shorter timeout for preloading
        }

        // Preload videos in batches
        function preloadVideoBatch(restaurants) {
            console.log('🚀 Preloading video batch for', restaurants.length, 'restaurants');
            restaurants.forEach(restaurant => {
                preloadVideo(restaurant);
            });
        }

        // Set up intersection observer for smart preloading
        function setupIntersectionObserver(targetElement) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        console.log('👀 Last restaurant item is visible, loading next batch...');
                        
                        // Get current number of items in the list
                        const restaurantList = document.getElementById('restaurant-list');
                        const currentItemCount = restaurantList.children.length;
                        
                        // Calculate next batch of 5 restaurants
                        const nextBatchStart = currentItemCount;
                        const nextBatchEnd = Math.min(nextBatchStart + 5, window.filteredRestaurants.length);
                        
                        if (nextBatchStart < window.filteredRestaurants.length) {
                            const nextBatch = window.filteredRestaurants.slice(nextBatchStart, nextBatchEnd);
                            preloadVideoBatch(nextBatch);
                        }
                        
                        // Stop observing this element to prevent multiple triggers
                        observer.unobserve(targetElement);
                    }
                });
            }, {
                threshold: 0.1, // Trigger when 10% of the element is visible
                rootMargin: '100px' // Start loading 100px before the element comes into view
            });
            
            // Start observing the target element
            observer.observe(targetElement);
        }

        // Populate video header with restaurant information
        function populateVideoHeader(restaurant) {
            const restaurantNameEl = document.getElementById('video-restaurant-name');
            const favoriteBtn = document.getElementById('video-favorite-btn');
            const collectionBtn = document.getElementById('video-collection-btn');
            
            if (restaurantNameEl) {
                restaurantNameEl.textContent = restaurant.name;
            }
            
            // Update favorite button state
            if (favoriteBtn) {
                const isFavorited = favoritedRestaurants.has(restaurant.id);
                favoriteBtn.classList.toggle('favorited', isFavorited);
                favoriteBtn.title = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
            }
            
            // Update collection button state
            if (collectionBtn) {
                const isCollected = collectedRestaurants.has(restaurant.id);
                collectionBtn.classList.toggle('collected', isCollected);
                collectionBtn.title = isCollected ? 'Remove from Collections' : 'Add to Collection';
            }
            
            // Store current restaurant ID for button actions
            if (favoriteBtn) favoriteBtn.dataset.restaurantId = restaurant.id;
            if (collectionBtn) collectionBtn.dataset.restaurantId = restaurant.id;
        }

        // Toggle favorite from video header
        async function toggleFavoriteFromVideoHeader(restaurantId) {
            const restaurant = currentRestaurants.find(r => r.id == restaurantId);
            if (!restaurant) return;
            
            // Check if user is authenticated
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                // Close video modal and show auth modal
                closeVideo();
                setTimeout(() => {
                    openAuthModal();
                }, 100);
                return;
            }
            
            const favoriteBtn = document.getElementById('video-favorite-btn');
            const isCurrentlyFavorited = favoritedRestaurants.has(restaurantId);
            const userId = session.user.id;
            
            try {
                if (isCurrentlyFavorited) {
                    // Remove from favorites
                    const { error } = await supabaseClient
                        .from('user_favorites')
                        .delete()
                        .eq('user_id', userId)
                        .eq('restaurant_id', restaurantId);

                    if (error) {
                        console.error('Error removing favorite:', error);
                        showToast('Error removing from favorites', 'error');
                    } else {
                        favoritedRestaurants.delete(restaurantId);
                        if (favoriteBtn) {
                            favoriteBtn.classList.remove('favorited');
                            favoriteBtn.title = 'Add to Favorites';
                        }
                        showToast('Removed from favorites');
                    }
                } else {
                    // Add to favorites
                    const { error } = await supabaseClient
                        .from('user_favorites')
                        .insert({ user_id: userId, restaurant_id: restaurantId });

                    if (error) {
                        console.error('Error adding favorite:', error);
                        showToast('Error adding to favorites', 'error');
                    } else {
                        favoritedRestaurants.add(restaurantId);
                        if (favoriteBtn) {
                            favoriteBtn.classList.add('favorited');
                            favoriteBtn.title = 'Remove from Favorites';
                        }
                        showToast('Added to favorites');
                    }
                }
                
                // Also update the restaurant card in the list
                const listItem = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                if (listItem) {
                    const cardFavoriteBtn = listItem.querySelector('.favorite-btn');
                    if (cardFavoriteBtn) {
                        cardFavoriteBtn.classList.toggle('favorited', !isCurrentlyFavorited);
                    }
                }
                
                // Update markers to show gold border for favorited restaurants
                if (window.restaurantMarkers && window.restaurantMarkers.length > 0) {
                    window.restaurantMarkers.forEach(marker => {
                        const markerLat = marker.getLatLng().lat;
                        const markerLon = marker.getLatLng().lng;
                        const restaurant = currentRestaurants.find(r => 
                            Math.abs(r.lat - markerLat) < 0.0001 && Math.abs(r.lon - markerLon) < 0.0001
                        );
                        if (restaurant && restaurant.id == restaurantId) {
                            // Update the marker's favorited state
                            const isFavorited = favoritedRestaurants.has(restaurantId);
                            const markerElement = marker.getElement();
                            if (markerElement) {
                                const markerContent = markerElement.querySelector('.svg-marker-container');
                                if (markerContent) {
                                    markerContent.classList.toggle('favorited', isFavorited);
                                }
                            }
                        }
                    });
                }
                
            } catch (error) {
                console.error('Error toggling favorite:', error);
                showToast('Error updating favorites', 'error');
            }
        }

        // Show collection management modal from video header (same as restaurant card)
        async function showCollectionManagementFromVideoHeader(restaurantId) {
            const restaurant = currentRestaurants.find(r => r.id == restaurantId);
            if (!restaurant) return;
            
            // Check if user is authenticated
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                // Close video modal first so user can see the sign-up modal
                closeVideo();
                // Small delay to ensure video modal closes before opening auth modal
                setTimeout(() => {
                    openAuthModal();
                }, 100);
                return;
            }
            
            // Use the same comprehensive collection management modal as restaurant cards
            showCollectionManagementModal(restaurantId);
        }

        // Show video for restaurant
async function showVideoFor(restaurant) {
            console.log('🎬 showVideoFor called with restaurant:', restaurant);
            console.log('🎬 restaurant.tiktok_embed_html:', restaurant.tiktok_embed_html);
            console.log('🎬 restaurant.tiktok_embed_html type:', typeof restaurant.tiktok_embed_html);
            console.log('🎬 restaurant.tiktok_embed_html length:', restaurant.tiktok_embed_html ? restaurant.tiktok_embed_html.length : 'N/A');

    if (!restaurant.tiktok_embed_html) {
        console.log('❌ No TikTok embed HTML found for restaurant:', restaurant.name);
        showNoVideoMessage(videoContainer, restaurant.name);
        videoModal.classList.add('show');
        return;
    }

    // Mark as watched and update UI
    addVideoToWatched(restaurant.id);
    const listItem = document.querySelector(`[data-restaurant-id="${restaurant.id}"]`);
    if (listItem && !listItem.querySelector('.watched-icon')) {
        const watchedIcon = createWatchedIcon();
        listItem.appendChild(watchedIcon);
    }

    // Populate video header with restaurant info
    populateVideoHeader(restaurant);

    // Show the modal with a loading indicator
    videoModal.classList.add('show');
    scrollToRestaurant(restaurant.id);
    videoContainer.innerHTML = `
        <div class="w-full h-full flex items-center justify-center text-white">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
    `;

    // Create a temporary, hidden container off-screen for TikTok processing
    const preloadContainer = document.createElement('div');
    preloadContainer.style.position = 'absolute';
    preloadContainer.style.top = '-9999px';
    preloadContainer.style.left = '-9999px';
    preloadContainer.style.width = '330px';
    preloadContainer.style.height = '585px';
    preloadContainer.style.background = 'black';
    document.body.appendChild(preloadContainer);

    console.log('🎬 Preload container created, injecting TikTok HTML...');
    console.log('🎬 TikTok HTML length:', restaurant.tiktok_embed_html.length);

    // Inject the raw TikTok blockquote HTML into the hidden container
    preloadContainer.innerHTML = restaurant.tiktok_embed_html;
    console.log('🎬 TikTok HTML injected into preload container');

    // Make sure the blockquote is visible for TikTok processing
    const hiddenBlockquotes = preloadContainer.querySelectorAll('blockquote.tiktok-embed');
    hiddenBlockquotes.forEach(bq => {
        bq.style.visibility = 'visible';
        bq.style.display = 'block';
        bq.removeAttribute('hidden');
        bq.classList.remove('hidden');
    });

    console.log('🎬 Hidden blockquotes prepared:', hiddenBlockquotes.length);

            // Try multiple approaches to trigger TikTok embed processing
            console.log('🎬 Attempting to trigger TikTok embed processing...');

            // Method 1: Use TikTok's official API if available
            if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                console.log('✅ TikTok script available, calling load()...');
                window.tiktokEmbed.load();
            } else {
                console.log('⏳ TikTok script not ready, trying alternative methods...');

                // Method 2: Try to find and trigger existing TikTok embeds
                const existingEmbeds = document.querySelectorAll('blockquote.tiktok-embed');
                if (existingEmbeds.length > 0) {
                    console.log('🔍 Found existing TikTok embeds:', existingEmbeds.length);
                    // TikTok script might already be processing existing embeds
                }

                // Method 3: Try to manually create the iframe
                console.log('🔄 Attempting manual iframe creation...');
                const videoId = restaurant.tiktok_embed_html.match(/data-video-id="([^"]+)"/)?.[1];
                if (videoId) {
                    console.log('🎬 Found video ID:', videoId);
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://www.tiktok.com/embed/v2/${videoId}`;
                    iframe.width = '330';
                    iframe.height = '585';
                    iframe.frameBorder = '0';
                    iframe.allowFullscreen = true;
                    iframe.allow = 'encrypted-media';
                    iframe.style.border = 'none';
                    iframe.style.background = 'black';

                    console.log('✅ Created iframe manually, adding to modal...');
                    videoContainer.innerHTML = '';
                    videoContainer.appendChild(iframe);

                    // Clean up the preload container since we're not using it
                    document.body.removeChild(preloadContainer);
                    observer.disconnect();
                    return;
                } else {
                    console.log('❌ Could not extract video ID from embed HTML');
                }

                // Method 4: Force reload TikTok script
                console.log('🔄 Attempting to reload TikTok script...');
                const existingScript = document.querySelector('script[src*="tiktok.com/embed.js"]');
                if (existingScript) {
                    existingScript.remove();
                }

                const newScript = document.createElement('script');
                newScript.src = 'https://www.tiktok.com/embed.js';
                newScript.async = true;
                newScript.onload = () => {
                    console.log('✅ TikTok script reloaded');
                    setTimeout(() => {
                        if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                            console.log('✅ TikTok script ready after reload, calling load()...');
                            window.tiktokEmbed.load();
                        } else {
                            console.log('❌ TikTok script still not working after reload');
                        }
                    }, 1000);
                };
                document.head.appendChild(newScript);
            }

    // Use MutationObserver to wait for iframe creation
    const observer = new MutationObserver((mutations, obs) => {
        console.log('🔍 MutationObserver triggered, checking for iframe...');
        const iframe = preloadContainer.querySelector('iframe');

        if (iframe) {
            console.log('✅ TikTok iframe detected! Moving to modal...');
            console.log('🎬 Iframe src:', iframe.src);
            console.log('🎬 Iframe readyState:', iframe.readyState);

            // Clear loading spinner and add iframe
            videoContainer.innerHTML = '';
            videoContainer.appendChild(iframe);

            // Clean up
            document.body.removeChild(preloadContainer);
            obs.disconnect();
            console.log('✅ Video loading complete');
        } else {
            console.log('⏳ No iframe found yet, mutations:', mutations.length);
            mutations.forEach(m => console.log('  - Mutation:', m.type, m.addedNodes.length, 'nodes'));
        }
    });

    console.log('🎬 Starting MutationObserver...');
    observer.observe(preloadContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style']
    });

    // Increased timeout with better error handling
    setTimeout(() => {
        if (document.body.contains(preloadContainer)) {
            console.error('❌ TikTok embed timed out after 8 seconds');
            console.log('🔍 Final preload container contents:', preloadContainer.innerHTML);

            document.body.removeChild(preloadContainer);
            observer.disconnect();
            showNoVideoMessage(videoContainer, restaurant.name, 'Video loading failed');
        }
    }, 8000);
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
            let startTranslateY = 0;
            let currentTranslateY = 0;
            let lastTap = 0;
            let rafId = null;

            if (!drawerHandle || !aside) {
                console.log('Drawer handle or aside not found');
                return;
            }

            console.log('Setting up mobile drawer functionality');

            // Calculate translateY from height value
            function heightToTranslateY(height) {
                const maxHeight = window.innerHeight - 60; // 60px for header
                return maxHeight - height;
            }

            // Calculate height from translateY value
            function translateYToHeight(translateY) {
                const maxHeight = window.innerHeight - 60;
                return maxHeight - translateY;
            }

            // Set initial position on mobile - check localStorage first
            if (window.innerWidth <= 768) {
                const savedHeight = localStorage.getItem('drawer-height');
                let initialHeight;
                
                if (savedHeight && !isNaN(parseInt(savedHeight))) {
                    initialHeight = parseInt(savedHeight);
                    console.log('Restoring drawer height from localStorage:', savedHeight, 'px');
                } else {
                    // Use default height (33vh)
                    initialHeight = Math.floor(window.innerHeight * 0.33);
                    console.log('Using default drawer height: 33vh =', initialHeight, 'px');
                }
                
                // Ensure height is within valid bounds
                const maxHeight = window.innerHeight - 60;
                const minDrawerHeight = 50; // Just the handle visible
                const maxDrawerHeight = maxHeight - 80; // Leave small sliver of map
                initialHeight = Math.max(minDrawerHeight, Math.min(maxDrawerHeight, initialHeight));
                
                currentTranslateY = heightToTranslateY(initialHeight);
                const heightPx = `${initialHeight}px`;
                
                console.log('Window height:', window.innerHeight);
                console.log('Max drawer height:', maxHeight);
                console.log('Initial drawer height:', initialHeight);
                console.log('Calculated translateY:', currentTranslateY);
                
                // Disable transition for initial positioning
                aside.style.transition = 'none';
                
                // Set the CSS variable and transform
                document.documentElement.style.setProperty('--drawer-height', heightPx);
                aside.style.transform = `translateY(${currentTranslateY}px)`;
                
                // Force a reflow to ensure the transform is applied
                void aside.offsetHeight;
                
                // Re-enable transitions after a brief moment
                setTimeout(() => {
                    aside.style.transition = '';
                }, 50);
                
                console.log('Drawer transform applied:', aside.style.transform);
                console.log('Drawer computed height:', getComputedStyle(aside).height);
            }

            // Update drawer position with RAF for smooth 60fps
            function updateDrawerPosition(translateY) {
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                }
                
                rafId = requestAnimationFrame(() => {
                    aside.style.transform = `translateY(${translateY}px)`;
                    rafId = null;
                });
            }

            // Start dragging
            function startDrag(e) {
                isDragging = true;
                aside.classList.add('dragging');
                
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startY = clientY;
                startTranslateY = currentTranslateY;
                
                e.preventDefault();
                
                // Visual feedback
                drawerHandle.style.backgroundColor = '#e5e7eb';
            }

            // Handle drag movement
            function drag(e) {
                if (!isDragging) return;
                
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const deltaY = clientY - startY;
                
                // Calculate new translateY (positive deltaY = dragging down = more translateY)
                let newTranslateY = startTranslateY + deltaY;
                
                // Clamp values: allow drawer from just handle visible to nearly full screen
                const maxHeight = window.innerHeight - 60;
                const minDrawerHeight = 50; // Just the handle visible
                const maxDrawerHeight = maxHeight - 80; // Leave small sliver of map
                const minTranslateY = heightToTranslateY(maxDrawerHeight); // Max drawer height
                const maxTranslateY = heightToTranslateY(minDrawerHeight); // Min drawer height
                
                newTranslateY = Math.max(minTranslateY, Math.min(maxTranslateY, newTranslateY));
                currentTranslateY = newTranslateY;
                
                // Schedule RAF update
                updateDrawerPosition(newTranslateY);
            }

            // End dragging
            function endDrag(e) {
                if (!isDragging) return;
                
                isDragging = false;
                aside.classList.remove('dragging');
                
                // Cancel any pending RAF
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                
                // Visual feedback
                drawerHandle.style.backgroundColor = '#f8fafc';
                
                // Save final position
                const finalHeight = translateYToHeight(currentTranslateY);
                document.documentElement.style.setProperty('--drawer-height', `${finalHeight}px`);
                localStorage.setItem('drawer-height', finalHeight.toString());
                
                // Double tap detection
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 500 && tapLength > 0) {
                    const currentHeight = translateYToHeight(currentTranslateY);
                    const maxHeight = window.innerHeight - 60;
                    const collapsedHeight = 50; // Just handle visible
                    const expandedHeight = maxHeight - 80; // Nearly full screen
                    
                    let targetHeight;
                    if (currentHeight < expandedHeight / 2) {
                        targetHeight = expandedHeight;
                    } else {
                        targetHeight = collapsedHeight;
                    }
                    
                    currentTranslateY = heightToTranslateY(targetHeight);
                    aside.style.transform = `translateY(${currentTranslateY}px)`;
                    document.documentElement.style.setProperty('--drawer-height', `${targetHeight}px`);
                    localStorage.setItem('drawer-height', targetHeight.toString());
                }
                lastTap = currentTime;
            }

            // Handle document-level touch move (passive where possible)
            function handleDocumentTouchMove(e) {
                if (isDragging) {
                    e.preventDefault();
                    drag(e);
                }
            }

            // Add event listeners
            drawerHandle.addEventListener('touchstart', startDrag, { passive: false });
            drawerHandle.addEventListener('mousedown', startDrag);
            
            // Use non-passive only when actually dragging
            document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
            document.addEventListener('mousemove', drag);
            
            document.addEventListener('touchend', endDrag);
            document.addEventListener('mouseup', endDrag);

            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth <= 768) {
                    const savedHeight = localStorage.getItem('drawer-height');
                    if (savedHeight) {
                        const height = parseInt(savedHeight);
                        currentTranslateY = heightToTranslateY(height);
                        aside.style.transform = `translateY(${currentTranslateY}px)`;
                        document.documentElement.style.setProperty('--drawer-height', `${height}px`);
                    }
                }
            });
        }

        // --- Event Listeners ---
        
        // City Switcher Event Listeners
        const citySwitcherDesktop = document.getElementById('city-switcher-desktop');
        const citySwitcherMobile = document.getElementById('city-switcher-mobile');
        const cityModal = document.getElementById('city-modal');
        const closeModalButton = document.getElementById('close-modal-button');
        const cityList = document.getElementById('modal-city-list');
        const citySearchInput = document.getElementById('city-search-input');

        const openModal = () => {
            if (cityModal) {
                cityModal.classList.add('show');
                // Focus on search input when modal opens
                if (citySearchInput) {
                    setTimeout(() => citySearchInput.focus(), 100);
                }
            }
        };
        
        const closeModal = () => {
            if (cityModal) {
                cityModal.classList.remove('show');
                // Clear search input when modal closes
                if (citySearchInput) {
                    citySearchInput.value = '';
                    // Reset the city list to show all cities
                    const items = cityList?.getElementsByTagName('li');
                    if (items) {
                        for (let i = 0; i < items.length; i++) {
                            items[i].style.display = "";
                        }
                    }
                }
            }
        };

        if (citySwitcherDesktop) {
            citySwitcherDesktop.addEventListener('click', openModal);
        }
        if (citySwitcherMobile) {
            citySwitcherMobile.addEventListener('click', openModal);
        }
        if (closeModalButton) {
            closeModalButton.addEventListener('click', closeModal);
        }
        if (cityModal) {
            cityModal.addEventListener('click', (e) => {
                // Close when clicking overlay
                if (e.target === cityModal) {
                    closeModal();
                }
            });
        }

        // City selection logic - navigate to new URL
        if (cityList) {
            cityList.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const selectedCity = e.target.dataset.city;
                    console.log('🏙️ Navigating to city:', selectedCity);
                    
                    // Navigate to the new city URL
                    if (selectedCity === '') {
                        window.location.href = '/explore';
                    } else {
                        window.location.href = `/explore?city=${encodeURIComponent(selectedCity)}`;
                    }
                }
            });
        }

        // Live search/filter for cities in the modal
        if (citySearchInput) {
            citySearchInput.addEventListener('keyup', () => {
                const filter = citySearchInput.value.toLowerCase();
                const items = cityList?.getElementsByTagName('li');
                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        const txtValue = items[i].textContent || items[i].innerText;
                        if (txtValue.toLowerCase().indexOf(filter) > -1) {
                            items[i].style.display = "";
                        } else {
                            items[i].style.display = "none";
                        }
                    }
                }
            });
        }
        
        // Video modal event listeners
        if (closeVideoBtn) {
        closeVideoBtn.addEventListener('click', closeVideo);
        }
        if (videoModal) {
        videoModal.addEventListener('click', (e) => e.target === videoModal && closeVideo());
        }
        
        // Video header button event listeners
        const videoFavoriteBtn = document.getElementById('video-favorite-btn');
        const videoCollectionBtn = document.getElementById('video-collection-btn');
        
        if (videoFavoriteBtn) {
            videoFavoriteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const restaurantId = videoFavoriteBtn.dataset.restaurantId;
                if (restaurantId) {
                    await toggleFavoriteFromVideoHeader(restaurantId);
                }
            });
        }
        
        if (videoCollectionBtn) {
            videoCollectionBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const restaurantId = videoCollectionBtn.dataset.restaurantId;
                if (restaurantId) {
                    await showCollectionManagementFromVideoHeader(restaurantId);
                }
            });
        }
        
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
        
        // Location button event listener - handles both desktop and mobile
        const locationBtn = document.getElementById('location-btn');
        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                console.log('Location button clicked');
                // Use mobile-specific function for mobile, desktop function for desktop
                if (window.innerWidth <= 768) {
                    findUserLocationMobile();
                } else {
                    addUserLocationMarker();
                }
            });
        }
        
        // Setup mobile drawer after DOM is ready
        setupMobileDrawer();

        // Collection Filter Event Listeners
        const collectionFilterBtn = document.getElementById('collection-filter-btn');
        if (collectionFilterBtn) {
            collectionFilterBtn.addEventListener('click', async () => {
                try {
                    // Check if user is authenticated
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (!session || !session.user) {
                        openAuthModal();
                    } else {
                        showCollectionFilterModal();
                    }
                } catch (error) {
                    console.error('Error checking authentication:', error);
                    openAuthModal(); // Default to showing auth modal on error
                }
            });
        } else {
            console.error('Collection filter button not found');
        }
        
        const closeCollectionFilterModal = document.getElementById('close-collection-filter-modal');
        if (closeCollectionFilterModal) {
            closeCollectionFilterModal.addEventListener('click', () => {
                document.getElementById('collection-filter-modal').classList.add('hidden');
                document.getElementById('collection-filter-modal').classList.remove('flex');
            });
        }
        
        const cancelCollectionFilter = document.getElementById('cancel-collection-filter');
        if (cancelCollectionFilter) {
            cancelCollectionFilter.addEventListener('click', () => {
                document.getElementById('collection-filter-modal').classList.add('hidden');
                document.getElementById('collection-filter-modal').classList.remove('flex');
            });
        }
        
        const clearCollectionFilters = document.getElementById('clear-collection-filters-desktop');
        if (clearCollectionFilters) {
            clearCollectionFilters.addEventListener('click', () => {
                console.log('Clear collection filters (desktop) clicked');
                console.log('Before clear - selectedCollections:', Array.from(selectedCollections));
                selectedCollections.clear();
                console.log('After clear - selectedCollections:', Array.from(selectedCollections));
                saveFilterStates();
                updateCollectionFilterButtonAppearance();
                
                // Sync checkboxes to reflect cleared state
                syncCollectionCheckboxes();
                
                // Apply the cleared filter immediately to update the display
                if (currentRestaurants && currentRestaurants.length > 0) {
                    applyAllFiltersAndDisplay();
                }
                
                // Refresh the modal after clearing to show unselected state
                showDesktopCollectionFilterModal();
            });
        }
        
        const applyCollectionFilterDesktop = document.getElementById('apply-collection-filter-desktop');
        if (applyCollectionFilterDesktop) {
            applyCollectionFilterDesktop.addEventListener('click', () => {
                console.log('Apply collection filter (desktop) clicked');
                console.log('Selected collections:', Array.from(selectedCollections));
                
                // Apply combined filters
                if (currentRestaurants && currentRestaurants.length > 0) {
                    console.log('🚀 Starting combined filter application...');
                    applyAllFiltersAndDisplay();
            }
            
            // Close modal
            document.getElementById('collection-filter-modal').classList.add('hidden');
            document.getElementById('collection-filter-modal').classList.remove('flex');
            
            // Update button appearance
            updateCollectionFilterButtonAppearance();
            });
        }
        
        // Handle collection filter card clicks (desktop)
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.collection-filter-card');
            if (card) {
                const collectionId = card.dataset.collectionId;
                console.log('Collection card clicked:', collectionId);

                // Toggle selection
                if (selectedCollections.has(collectionId)) {
                    selectedCollections.delete(collectionId);
                    console.log('Deselected collection:', collectionId);
                } else {
                    selectedCollections.add(collectionId);
                    console.log('Selected collection:', collectionId);
                }
                saveFilterStates();

                // Update visual state immediately
                if (selectedCollections.has(collectionId)) {
                    card.classList.add('border-purple-500', 'bg-purple-100');
                    card.querySelector('.w-5').classList.add('bg-purple-500', 'border-purple-500');
                } else {
                    card.classList.remove('border-purple-500', 'bg-purple-100');
                    card.querySelector('.w-5').classList.remove('bg-purple-500', 'border-purple-500');
                }

                // Update button appearance
                updateCollectionFilterButtonAppearance();
                console.log('Selected collections:', Array.from(selectedCollections));
            }
        });

        // Handle collection checkbox clicks (mobile)
        document.addEventListener('click', (e) => {
            const label = e.target.closest('.collection-checkbox');
            if (label) {
                const collectionId = label.dataset.collectionId;
                const checkbox = label.querySelector('input[type="checkbox"]');

                console.log('Collection checkbox clicked:', collectionId);

                // Toggle checkbox state
                checkbox.checked = !checkbox.checked;

                if (checkbox.checked) {
                    selectedCollections.add(collectionId);
                    console.log('Selected collection:', collectionId);
                } else {
                    selectedCollections.delete(collectionId);
                    console.log('Deselected collection:', collectionId);
                }
                saveFilterStates();

                // Update visual state
                if (checkbox.checked) {
                    label.classList.add('border-purple-500', 'bg-purple-100');
                    label.querySelector('.w-4').classList.add('bg-purple-500', 'border-purple-500');
                } else {
                    label.classList.remove('border-purple-500', 'bg-purple-100');
                    label.querySelector('.w-4').classList.remove('bg-purple-500', 'border-purple-500');
                }

                // Update button appearance
                updateCollectionFilterButtonAppearance();
                console.log('Selected collections:', Array.from(selectedCollections));
            }
        });

        // Mobile Collection Filter Event Listeners
        const closeMobileCollectionFilterModal = document.getElementById('close-collection-filter-modal-mobile');
        if (closeMobileCollectionFilterModal) {
            closeMobileCollectionFilterModal.addEventListener('click', () => {
                document.getElementById('collection-filter-modal-mobile').classList.add('hidden');
                document.getElementById('collection-filter-modal-mobile').classList.remove('flex');
            });
        }

        const clearMobileCollectionFilters = document.getElementById('clear-collection-filters-mobile');
        if (clearMobileCollectionFilters) {
            clearMobileCollectionFilters.addEventListener('click', () => {
                console.log('Clear collection filters (mobile) clicked');
                console.log('Before clear - selectedCollections:', Array.from(selectedCollections));
                selectedCollections.clear();
                console.log('After clear - selectedCollections:', Array.from(selectedCollections));
                saveFilterStates();
                updateCollectionFilterButtonAppearance();
                
                // Sync checkboxes to reflect cleared state
                syncCollectionCheckboxes();
                
                // Apply the cleared filter immediately to update the display
                if (currentRestaurants && currentRestaurants.length > 0) {
                    applyAllFiltersAndDisplay();
                }
                
                // Refresh the modal after clearing to show unselected state
                showMobileCollectionFilterModal();
            });
        }

        const applyMobileCollectionFilter = document.getElementById('apply-collection-filter-mobile');
        if (applyMobileCollectionFilter) {
            applyMobileCollectionFilter.addEventListener('click', () => {
                console.log('Apply collection filter (mobile) clicked');
                console.log('Selected collections:', Array.from(selectedCollections));
                
                // Apply combined filters
                if (currentRestaurants && currentRestaurants.length > 0) {
                    console.log('🚀 Starting combined filter application (mobile)...');
                    applyAllFiltersAndDisplay();
                }

                // Close modal
                document.getElementById('collection-filter-modal-mobile').classList.add('hidden');
                document.getElementById('collection-filter-modal-mobile').classList.remove('flex');

                // Update button appearance
                updateCollectionFilterButtonAppearance();
            });
        }

        // Add event listeners for "Create First Collection" buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'create-first-collection-btn' || e.target.id === 'create-first-collection-btn-mobile') {
                // Close the collection filter modal
                const collectionModal = document.getElementById('collection-filter-modal');
                const mobileCollectionModal = document.getElementById('collection-filter-modal-mobile');

                if (collectionModal) {
                    collectionModal.classList.add('hidden');
                    collectionModal.classList.remove('flex');
                }
                if (mobileCollectionModal) {
                    mobileCollectionModal.classList.add('hidden');
                    mobileCollectionModal.classList.remove('flex');
                }

                // Open the collections modal
                const collectionsModal = document.getElementById('collections-modal');
                if (collectionsModal) {
                    collectionsModal.classList.remove('hidden');
                    collectionsModal.classList.add('flex');
                    // Focus on the input field
                    setTimeout(() => {
                        const input = document.getElementById('new-collection-name');
                        if (input) input.focus();
                    }, 100);
                }
            }
        });
    
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

// City collage functions
async function loadCityCollages() {
    // Only run on homepage and if feature is enabled
    if (!CONFIG.FEATURE_FLAGS.CITY_COLLAGES) {
        console.log('City collages feature disabled');
        return;
    }

    if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
        console.log('Not on homepage, skipping city collages');
        return;
    }

    const cityGrid = document.getElementById('city-grid');
    if (!cityGrid) {
        console.log('City grid element not found');
        return;
    }

        console.log('Starting city collages load...');

    try {
        // Fetch all cities
        const { data: cities, error: citiesError } = await supabaseClient
            .from('cities')
            .select('name')
            .order('name', { ascending: true });

        if (citiesError) {
            console.error('Error fetching cities for collages:', citiesError);
            return;
        }

        if (!cities || cities.length === 0) {
            console.log('No cities found for collages');
            return;
        }

        // For each city, fetch up to 12 random featured TikToks
        for (const cityObj of cities) {
            const cityName = cityObj.name;
            console.log(`Processing city: ${cityName}`);

            // Fetch restaurants for this city (try exact match first, then case-insensitive)
            let { data: restaurants, error: restaurantsError } = await supabaseClient
                .from('restaurants')
                .select('id')
                .ilike('city', cityName);

            // If no exact match, try case-insensitive search
            if (!restaurantsError && (!restaurants || restaurants.length === 0)) {
                const { data: fallbackRestaurants, error: fallbackError } = await supabaseClient
                    .from('restaurants')
                    .select('id')
                    .ilike('city', cityName.toLowerCase());

                restaurants = fallbackRestaurants;
                restaurantsError = fallbackError;
            }

            if (restaurantsError || !restaurants || restaurants.length === 0) {
                console.log(`No restaurants found for ${cityName}, skipping collage`);
                continue;
            }

            const restaurantIds = restaurants.map(r => r.id);

            // Fetch up to 12 random featured TikToks for this city
            const { data: tiktoks, error: tiktoksError } = await supabaseClient
                .from('tiktoks')
                .select('restaurant_id, embed_html, thumbnail_url, is_featured')
                .in('restaurant_id', restaurantIds)
                .eq('is_featured', true)
                .limit(12);

            if (tiktoksError || !tiktoks || tiktoks.length === 0) {
                console.log(`No TikToks found for ${cityName}, skipping collage`);
                continue;
            }

            // Shuffle and take up to 12 thumbnails
            const shuffledTiktoks = tiktoks.sort(() => Math.random() - 0.5);
            const selectedTiktoks = shuffledTiktoks.slice(0, 12);

            // Create collage HTML
            const collageHtml = createCityCollage(cityName, selectedTiktoks);
            cityGrid.appendChild(collageHtml);
        }

        console.log('✅ City collages loaded successfully');

    } catch (error) {
        console.error('Error loading city collages:', error);
    }
}

function createCityCollage(cityName, tiktoks) {
    const collageCard = document.createElement('a');
    collageCard.href = `/explore?city=${encodeURIComponent(cityName.toLowerCase())}`;
    collageCard.className = 'city-collage-card';

    const thumbnailsHtml = tiktoks.map(tiktok => {
        const videoId = tiktok.embed_html.match(/data-video-id="([^"]+)"/)?.[1] || '';
        const thumbnailUrl = tiktok.thumbnail_url || 'https://via.placeholder.com/200x200/6366F1/FFFFFF?text=🎬';

        return `
            <div class="city-collage-thumbnail">
                <img src="${thumbnailUrl}"
                     alt="${cityName} TikTok"
                     loading="lazy"
                     onerror="this.src='https://via.placeholder.com/200x200/6366F1/FFFFFF?text=🎬'">
            </div>
        `;
    }).join('');

    collageCard.innerHTML = `
        <div class="city-collage-container">
            <div class="city-collage-grid">
                ${thumbnailsHtml}
            </div>
            <div class="city-collage-overlay">
                <h3 class="city-collage-title">${cityName}</h3>
            </div>
        </div>
    `;

    return collageCard;
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
async function testSupabaseConnectionTest() {
    try {
        const result = await testSupabaseConnection();
        if (result.testError) throw result.testError;
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

// testCitySelector function removed - city selector replaced with city switcher modal

// Main test runner
async function runAllTests() {
    console.log('🧪 Starting ReelEats Test Suite...\n');
    testResults = { passed: 0, failed: 0, total: 0 };
    
    // Core functionality tests
    await testSupabaseConnectionTest();
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
    // testCitySelector removed - replaced with city switcher modal
    
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

