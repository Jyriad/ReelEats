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
            };
            iframe.onerror = () => {
                fallbackFunction();
            };
            
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (!iframeDoc || iframeDoc.body.children.length === 0) {
                        fallbackFunction();
                    }
                } catch (e) {
                }
            }, CONFIG.VIDEO_CONFIG.IFRAME_TIMEOUT);
        }
    }, CONFIG.VIDEO_CONFIG.FALLBACK_DELAY);
}

function showNoVideoMessage(videoContainer, restaurantName, additionalInfo = '') {
    const message = additionalInfo ? `No video available for ${restaurantName}. ${additionalInfo}` : `No video available for ${restaurantName}`;
    videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">${message}</div>`;
}

function loadVideoWithBlockquote(videoContainer, embedHtml) {
    // Create a temporary, hidden container off-screen for TikTok processing
    const preloadContainer = document.createElement('div');
    preloadContainer.style.position = 'absolute';
    preloadContainer.style.top = '-9999px';
    preloadContainer.style.left = '-9999px';
    preloadContainer.style.width = '330px';
    preloadContainer.style.height = '585px';
    preloadContainer.style.background = 'black';
    document.body.appendChild(preloadContainer);

    // Inject the raw TikTok blockquote HTML into the hidden container
    preloadContainer.innerHTML = embedHtml;

    // Make sure the blockquote is visible for TikTok processing
    const hiddenBlockquotes = preloadContainer.querySelectorAll('blockquote.tiktok-embed');
    hiddenBlockquotes.forEach(bq => {
        bq.style.visibility = 'visible';
        bq.style.display = 'block';
        bq.removeAttribute('hidden');
        bq.classList.remove('hidden');
    });

    // Use MutationObserver to wait for iframe creation
    const observer = new MutationObserver((mutations, obs) => {
        const iframe = preloadContainer.querySelector('iframe');

        if (iframe) {
            // Clear loading spinner and add iframe
            videoContainer.innerHTML = '';
            videoContainer.appendChild(iframe);

            // Clean up
            document.body.removeChild(preloadContainer);
            obs.disconnect();
        }
    });

    observer.observe(preloadContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'style']
    });

    // Timeout fallback
    setTimeout(() => {
        if (document.body.contains(preloadContainer)) {
            document.body.removeChild(preloadContainer);
            observer.disconnect();
            showNoVideoMessage(videoContainer, 'Restaurant', 'Video loading failed');
        }
    }, 8000);
}

async function ensureTikTokScriptIsReady() {
    return new Promise((resolve) => {
        if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
            resolve();
            return;
        }

        // Try to find and trigger existing TikTok embeds
        const existingEmbeds = document.querySelectorAll('blockquote.tiktok-embed');
        if (existingEmbeds.length > 0) {
            // TikTok script might already be processing existing embeds
            setTimeout(resolve, 1000);
            return;
        }

        // Force reload TikTok script
        const existingScript = document.querySelector('script[src*="tiktok.com/embed.js"]');
        if (existingScript) {
            existingScript.remove();
        }

        const newScript = document.createElement('script');
        newScript.src = 'https://www.tiktok.com/embed.js';
        newScript.async = true;
        newScript.onload = () => {
            setTimeout(() => {
                if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
                    window.tiktokEmbed.load();
                }
                resolve();
            }, 1000);
        };
        document.head.appendChild(newScript);
    });
}

// --- Skeleton Loader Functions ---
function createSkeletonCard() {
    const skeletonCard = document.createElement('div');
    skeletonCard.className = 'skeleton-card';
    skeletonCard.innerHTML = `
        <div class="skeleton-avatar"></div>
        <div class="skeleton-content">
            <div class="skeleton-title"></div>
            <div class="skeleton-description"></div>
            <div class="skeleton-description"></div>
            <div class="skeleton-tags">
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
            </div>
        </div>
        <div class="skeleton-favorite"></div>
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
        // --- UI Element References ---
        const mapElement = document.getElementById('map');
        const restaurantList = document.getElementById('restaurant-list');
        const videoModal = document.getElementById('video-modal');
        const videoContainer = videoModal ? videoModal.querySelector('.video-container') : null;
        const videoTitleEl = document.getElementById('video-title');
        const closeVideoBtn = videoModal ? videoModal.querySelector('.close-video-btn') : null;
        const citySelect = document.getElementById('city-select');
        
        // Check if essential elements exist
        if (!mapElement) {
            throw new Error('Map element not found');
        }
        if (!restaurantList) {
            throw new Error('Restaurant list element not found');
        }
        if (!videoModal) {
            throw new Error('Video modal element not found');
        }
        
        // --- State Management ---
        // State management - Global scope for tests
        window.currentRestaurants = [];
        window.restaurantMarkers = [];
        window.map = null; // Define map in a broader scope
        window.mapInitialized = false; // Prevent double initialization
        window.allCuisines = []; // Store all available cuisines for filtering
        window.favoritedRestaurants = new Set();
        window.markerClusterGroup = null; // Marker cluster group for map clustering
        
        // Watched videos state management
        let watchedVideos = new Set();
        
        // Collected restaurants state management
        let collectedRestaurants = new Set();
        let selectedCollections = new Set();
        let userCollections = [];
        
        // Filter state persistence
        let selectedCuisines = new Set();
        
        // Load watched videos from localStorage
        function loadWatchedVideos() {
            const watched = localStorage.getItem(CONFIG.STORAGE_KEYS.WATCHED_VIDEOS);
            if (watched) {
                watchedVideos = new Set(JSON.parse(watched));
            }
        }
        
        // Load filter states from localStorage
        function loadFilterStates() {
            // Load selected cuisines
            const savedCuisines = localStorage.getItem('selectedCuisines');
            if (savedCuisines) {
                selectedCuisines = new Set(JSON.parse(savedCuisines));
            }
            
            // Load selected collections
            const savedCollections = localStorage.getItem('selectedCollections');
            if (savedCollections) {
                selectedCollections = new Set(JSON.parse(savedCollections));
            }
        }
        
        // Save filter states to localStorage
        function saveFilterStates() {
            localStorage.setItem('selectedCuisines', JSON.stringify(Array.from(selectedCuisines)));
            localStorage.setItem('selectedCollections', JSON.stringify(Array.from(selectedCollections)));
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
                } else {
                    userCollections = data || [];
                }
            } catch (error) {
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
                } else {
                    // Store both string and numeric versions for compatibility
                    collectedRestaurants = new Set();
                    data.forEach(item => {
                        collectedRestaurants.add(item.restaurant_id); // numeric version
                        collectedRestaurants.add(String(item.restaurant_id)); // string version
                    });
                }
            } catch (error) {
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
            if (collectionIds.length === 0) return;

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                return;
            }

            try {
                // Convert collection IDs to numbers in case they're strings
                const numericCollectionIds = collectionIds.map(id => parseInt(id, 10));

                const { data, error } = await supabaseClient
                    .from('collection_restaurants')
                    .select('restaurant_id, collection_id')
                    .in('collection_id', numericCollectionIds);

                if (error) {
                    // Try without conversion as fallback
                    const { data: fallbackData, error: fallbackError } = await supabaseClient
                        .from('collection_restaurants')
                        .select('restaurant_id, collection_id')
                        .in('collection_id', collectionIds);
                    
                    if (fallbackError) {
                    } else {
                        data = fallbackData;
                    }
                } else {
                }

                if (data && data.length > 0) {
                    // Store mappings for each collection with both string and numeric keys
                    data.forEach(item => {
                        
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
                        
                    });
                } else {
                    
                    // Let's also check if the collections actually exist
                    const { data: collectionCheck, error: collectionError } = await supabaseClient
                        .from('user_collections')
                        .select('id, name')
                        .in('id', numericCollectionIds);
                    
                    if (collectionError) {
                    } else {
                    }
                }
            } catch (error) {
            }
        }

        // Combined filter function that applies both cuisine and collection filters
        async function applyAllFilters(restaurants) {
            
            let filteredRestaurants = [...restaurants]; // Start with all restaurants
            
            // Apply cuisine filter first
            const selectedCuisines = getSelectedCuisines();
            
            if (selectedCuisines.length > 0) {
                filteredRestaurants = filteredRestaurants.filter(restaurant => {
                    return restaurant.cuisines && restaurant.cuisines.some(cuisine => 
                        selectedCuisines.includes(cuisine.name)
                    );
                });
            }
            
            // Apply collection filter second
            
            if (selectedCollections.size > 0) {
                filteredRestaurants = await filterRestaurantsByCollections(filteredRestaurants);
            } else {
            }
            
            return filteredRestaurants;
        }

        // Filter restaurants by selected collections
        async function filterRestaurantsByCollections(restaurants) {

            if (selectedCollections.size === 0) {
                return restaurants;
            }
            
            try {
                // Load restaurant mappings for selected collections
                await loadRestaurantsForCollections(Array.from(selectedCollections));

                // Get all restaurant IDs that are in any of the selected collections
                const restaurantIdsInCollections = new Set();
                selectedCollections.forEach(collectionId => {
                    // Try both string and numeric versions of the collection ID
                    const numericId = parseInt(collectionId, 10);
                    const stringId = String(collectionId);
                    
                    
                    let restaurantsInCollection = collectionRestaurantMappings.get(collectionId);
                    if (!restaurantsInCollection) {
                        restaurantsInCollection = collectionRestaurantMappings.get(numericId);
                    }
                    if (!restaurantsInCollection) {
                        restaurantsInCollection = collectionRestaurantMappings.get(stringId);
                    }
                    
                    
                    if (restaurantsInCollection) {
                        restaurantsInCollection.forEach(restaurantId => {
                            restaurantIdsInCollections.add(restaurantId);
                        });
                    }
                });


                if (restaurantIdsInCollections.size === 0) {
                    return [];
                }

                const filtered = restaurants.filter(restaurant => {
                    const isInCollection = restaurantIdsInCollections.has(restaurant.id);
                    if (isInCollection) {
                    }
                    return isInCollection;
                });

                return filtered;
            } catch (error) {
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
        
        // Load watched videos now that the variable is declared
        loadWatchedVideos();
        
        // Add video to watched list and save to localStorage
        function addVideoToWatched(restaurantId) {
            watchedVideos.add(restaurantId);
            localStorage.setItem(CONFIG.STORAGE_KEYS.WATCHED_VIDEOS, JSON.stringify([...watchedVideos]));
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
            const collectionsBtn = document.getElementById('collections-btn');
            const collectionFilterBtn = document.getElementById('collection-filter-btn');
            
            if (user) {
                // User is logged in - show logout button instead of login button
                authBtn.classList.add('hidden');
                collectionsBtn.classList.remove('hidden');
                collectionFilterBtn.classList.remove('hidden');
                
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
                // User is logged out - show login button
                authBtn.classList.remove('hidden');
                collectionsBtn.classList.add('hidden');
                // Keep collection filter button visible for all users
                // collectionFilterBtn.classList.add('hidden');
                
                // Hide logout button if it exists
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.classList.add('hidden');
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
                
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: provider,
                    options: {
                        redirectTo: window.location.href
                    }
                });
                
                if (error) {
                    throw error;
                }
                
                
            } catch (error) {
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
                showAuthFeedback('OAuth authentication failed: ' + error);
                // Clear the hash
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
            }
            
            if (accessToken && refreshToken) {
                
                try {
                    // Set the session manually
                    const { data, error } = await supabaseClient.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });
                    
                    if (error) {
                        showAuthFeedback('Failed to complete authentication: ' + error.message);
                    } else {
                        // Close the auth modal if it's open
                        closeAuthModal();
                    }
                } catch (error) {
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

        // --- First-Time User Tutorial ---

        const tutorialModal = document.getElementById('tutorial-modal');
        const closeTutorialBtn = document.getElementById('close-tutorial-btn');
        const TUTORIAL_COMPLETED_KEY = 'reelEats_tutorialCompleted';

        function showTutorial() {
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

        function hideTutorialModal() {
            // Hide the modal but keep pulsing
            tutorialModal.classList.add('hidden');
            tutorialModal.classList.remove('flex');
        }

        function completeTutorial() {
            // Remove pulsing animations
            document.querySelectorAll('.pulse-me').forEach(el => el.classList.remove('pulse-me'));
            
            // Set the flag in localStorage so it doesn't show again
            localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');

            // Remove restaurant click listeners
            document.removeEventListener('restaurant-clicked', completeTutorial);
        }

        // Event listener for the close button - only hide modal, don't complete tutorial
        closeTutorialBtn.addEventListener('click', hideTutorialModal);

        // Listen for restaurant clicks to complete tutorial (stop pulsing)
        document.addEventListener('restaurant-clicked', completeTutorial);

        // --- Initialization ---
        initializeMap();
        await loadCitiesAndInitialRestaurants();
        setupCuisineFilter();
        setupAdminLogin();
        
        // Load saved filter states (but don't apply yet - restaurants not loaded)
        loadFilterStates();
        syncCuisineCheckboxes();
        syncCollectionCheckboxes();
        updateFilterButtonAppearance();
        updateCollectionFilterButtonAppearance();
        
        // Pre-load collection-restaurant mappings if collections are selected
        if (selectedCollections.size > 0) {
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
                } else {
                    favoritedRestaurants.add(restaurantId);
                    favoriteBtn?.classList.add('favorited');
                    // Refresh markers to update gold border
                    await applyAllFiltersAndDisplay();
                }
            }
        }

        // --- Map Loading Helper Functions ---
        function hideMapLoadingOverlay() {
            const loadingOverlay = document.getElementById('map-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }

        function showMapLoadingOverlay() {
            const loadingOverlay = document.getElementById('map-loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.remove('hidden');
            }
        }

        function initializeMap() {
            if (mapInitialized) {
                return;
            }
            
            try {
                
                // Show loading overlay
                showMapLoadingOverlay();
                // Check if map is already initialized
                if (map) {
                    map.remove();
                    map = null;
                }
                
                // Clear any existing content
                mapElement.innerHTML = '';
                mapElement._leaflet_id = null;
                
                map = L.map(mapElement, { 
                    preferCanvas: true,
                    fadeAnimation: true,
                    zoomAnimation: true,
                    zoomAnimationThreshold: 4
                }).setView([51.5074, -0.1278], 13);
                
                // Create tile layer with loading events
                const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap &copy; CARTO',
                    subdomains: 'abcd',
                    maxZoom: 20,
                    crossOrigin: true,
                    loading: 'lazy'
                });
                
                // Add loading event listeners
                let tilesLoaded = 0;
                let totalTiles = 0;
                let loadingTimeout;
                
                tileLayer.on('loading', function() {
                    // Show loading overlay if not already visible
                    const loadingOverlay = document.getElementById('map-loading-overlay');
                    if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
                        // Already showing, just update text
                        const loadingText = loadingOverlay.querySelector('.map-loading-text');
                        if (loadingText) {
                            loadingText.textContent = 'Loading map tiles...';
                        }
                    }
                });
                
                tileLayer.on('tileload', function() {
                    tilesLoaded++;
                    if (tilesLoaded >= 4) { // Wait for at least 4 tiles to load
                        clearTimeout(loadingTimeout);
                        loadingTimeout = setTimeout(() => {
                            hideMapLoadingOverlay();
                        }, 500); // Small delay to ensure smooth transition
                    }
                });
                
                tileLayer.on('tileerror', function() {
                });
                
                // Add the tile layer to the map
                tileLayer.addTo(map);
                
                // Fallback timeout in case tiles don't load
                setTimeout(() => {
                    hideMapLoadingOverlay();
                }, 3000);

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
                
                // Geolocation will be triggered manually when user clicks location button
                
                window.mapInitialized = true;
                mapInitialized = window.mapInitialized;
            } catch (error) {
                mapInitialized = false;
            }
        }

        function addUserLocationMarker() {
            if (!navigator.geolocation) {
                return;
            }

            
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            };

            navigator.geolocation.getCurrentPosition(
                async function(position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    
                    
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
                    }
                    
                    // Pan map to center on user location
                    map.setView([userLat, userLon], 14, {
                        animate: true,
                        duration: 1.0
                    });
                    
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
                    
                },
                function(error) {
                    // Fallback to default London location
                },
                options
            );
        }

        async function loadCitiesAndInitialRestaurants() {
            const t0 = performance.now();
            await loadCities();
            const t1 = performance.now();

            if (citySelect.options.length > 0) {
                const initialCityId = citySelect.value;
                // Show skeleton loaders while loading
                displayRestaurants([], true);
                await loadRestaurantsForCity(initialCityId);
                
                // Apply saved filters after restaurants are loaded
                await applyAllFiltersAndDisplay();
                
                const selectedOption = citySelect.options[citySelect.selectedIndex];
                map.flyTo([selectedOption.dataset.lat, selectedOption.dataset.lon], 12);
            }
            const t2 = performance.now();
        }

        async function loadCities() {
            const CACHE_KEY = 'reelEats_citiesCache';
            const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

            // Try to load from cache first
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                const { cities, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    populateCitySelect(cities);
                    // Fetch in background to check for updates, but don't block
                    fetchAndCacheCities(); 
                    return;
                }
            }
            
            // If no valid cache, fetch from network
            await fetchAndCacheCities();
        }

        async function fetchAndCacheCities() {
             const { data: cities, error } = await supabaseClient.from('cities').select('id, name, lat, lon');
             if (error) {
                return;
             }
             localStorage.setItem('reelEats_citiesCache', JSON.stringify({ cities, timestamp: Date.now() }));
             populateCitySelect(cities);
        }

        function populateCitySelect(cities) {
            citySelect.innerHTML = '';
            let londonCity = null;
            
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = city.name;
                option.dataset.lat = city.lat;
                option.dataset.lon = city.lon;
                citySelect.appendChild(option);
                
                // Find London city for default selection
                if (city.name.toLowerCase().includes('london')) {
                    londonCity = city;
                }
            });
            
            // Set London as default if found, otherwise use first city
            if (londonCity) {
                citySelect.value = londonCity.id;
            } else if (cities.length > 0) {
                citySelect.value = cities[0].id;
            }
        }
        
        async function loadRestaurantsForCity(cityId) {
            // --- FIX: Use a more robust two-query approach ---

            // 1. Fetch all restaurants for the selected city.
            const { data: restaurants, error: restaurantsError } = await supabaseClient
                .from('restaurants')
                .select('*')
                .eq('city_id', cityId);

            if (restaurantsError) {
                throw restaurantsError;
            }

            if (!restaurants || restaurants.length === 0) {
                currentRestaurants = [];
                displayRestaurants([], false, false); // Not loading, show "no restaurants" message
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
            } else {
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

            window.currentRestaurants = restaurants.map(r => {
                const tiktokHtml = tiktokMap.get(r.id) || null;
                return {
                    ...r,
                    tiktok_embed_html: tiktokHtml,
                    cuisines: cuisineMap.get(r.id) || []
                };
            });
            currentRestaurants = window.currentRestaurants;
            
            // Order restaurants based on geolocation availability
            if (window.userLocation) {
                // If user has geolocation, order by distance (closest first)
                currentRestaurants.sort((a, b) => {
                    const distanceA = calculateDistance(window.userLocation.lat, window.userLocation.lon, a.lat, a.lon);
                    const distanceB = calculateDistance(window.userLocation.lat, window.userLocation.lon, b.lat, b.lon);
                    return distanceA - distanceB;
                });
            } else {
                // If no geolocation, randomize the order
                currentRestaurants.sort(() => Math.random() - 0.5);
            }
            
            // Small delay to ensure skeleton loaders are visible before showing real data
            setTimeout(async () => {
            await applyAllFiltersAndDisplay();
            }, 100);
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
                
            } catch (error) {
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
                return;
            }
            
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
                return;
            }
            
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
            
            // Update filter button appearances
            updateFilterButtonAppearance();
            updateCollectionFilterButtonAppearance();
            
            // Show skeleton loaders briefly for better UX
            displayRestaurants([], true);
            
            // Use setTimeout to show skeleton loading briefly
            setTimeout(async () => {
                try {
                    const filteredRestaurants = await applyAllFilters(currentRestaurants);
                    
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
                // On mobile, open the mobile modal
                if (window.innerWidth < 768) {
                    openMobileFilterModal();
                } else {
                    // On desktop, open the desktop modal
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
            
                filterModal: !!filterModal,
                closeBtn: !!closeBtn,
                applyBtn: !!applyBtn,
                cancelBtn: !!cancelBtn,
                clearBtn: !!clearBtn
            });
            
            // Close modal
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    closeDesktopFilterModal();
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function() {
                    closeDesktopFilterModal();
                });
            }
            
            if (applyBtn) {
                applyBtn.addEventListener('click', function() {
                    applyDesktopFilter();
                });
            }
            
            if (clearBtn) {
                clearBtn.addEventListener('click', function() {
                    clearDesktopFilter();
                });
            }
            
            // Close modal when clicking outside
            if (filterModal) {
                filterModal.addEventListener('click', function(e) {
                    if (e.target === filterModal) {
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
            const filterModal = document.getElementById('desktop-filter-modal');
            if (!filterModal) {
                return;
            }
            
            filterModal.classList.remove('hidden');
            filterModal.classList.add('md:flex');
            
            // Check if the container has content
            const container = document.getElementById('cuisine-filter-container-desktop');
            if (container) {
            }
            
            // Sync desktop checkboxes with current state
            syncDesktopFilterWithCurrent();
        }
        
        // Close desktop filter modal
        function closeDesktopFilterModal() {
            const filterModal = document.getElementById('desktop-filter-modal');
            if (filterModal) {
                filterModal.classList.add('hidden');
                filterModal.classList.remove('md:flex');
            } else {
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
            
            // Open login modal when admin link is clicked
            adminLink.addEventListener('click', async function(e) {
                e.preventDefault();
                
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
                            window.location.href = 'admin.html';
                            return;
                        }
                    } catch (error) {
                    }
                }
                
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
                    
                    // Test Supabase connection first
                    const { data: testData, error: testError } = await supabaseClient.auth.getSession();
                    
                    // Sign in with Supabase
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });
                    
                    if (error) {
                        throw error;
                    }
                    
                    
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
                    
                    
                    // Close modal and redirect
                    closeLoginModal();
                    window.location.href = 'admin.html';
                    
                } catch (error) {
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
        collectionsBtn.addEventListener('click', () => {
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

            const { data, error } = await supabaseClient
                .from('user_collections')
                .select(`*, collection_restaurants(count)`)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                collectionsList.innerHTML = `<p class="text-red-500">Error loading collections.</p>`;
                return;
            }

            if (data.length === 0) {
                collectionsList.innerHTML = `<p class="text-gray-500 text-center">You haven't created any collections yet.</p>`;
            } else {
                collectionsList.innerHTML = data.map(collection => `
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
        collectionsList.addEventListener('click', async (e) => {
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
                            showToast('Error creating collection. Please try again.', 'error');
                        } else {
                            // Add restaurant to the new collection
                            const { error: addError } = await supabaseClient.from('collection_restaurants').insert({
                                collection_id: newCollection.id,
                                restaurant_id: restaurantId
                            });

                            if (addError) {
                                showToast('Collection created but failed to add restaurant. Please try again.', 'error');
                            } else {
                                showToast(`Collection "${collectionName}" created and restaurant added!`);
                                
                                // Update collection state (store both string and numeric versions)
                                collectedRestaurants.add(restaurantId);
                                collectedRestaurants.add(parseInt(restaurantId, 10));
                                
                                // Close modal and reset
                                document.getElementById('quick-create-collection-modal').classList.add('hidden');
                                document.getElementById('quick-create-collection-modal').classList.remove('flex');
                                document.getElementById('quick-create-collection-form').reset();
                                window.quickCreateRestaurantId = null;
                                
                                // Re-display restaurants to show updated collection status
                                if (currentRestaurants && currentRestaurants.length > 0) {
                                    displayRestaurants(currentRestaurants);
                                }
                            }
                        }
                    } catch (error) {
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
                    showToast('Error adding to collection. Please try again.', 'error');
                } else {
                    showToast('Added to collection!');
                    // Update collection state immediately (store both string and numeric versions)
                    collectedRestaurants.add(restaurantId);
                    collectedRestaurants.add(parseInt(restaurantId, 10));
                    
                    // Update the specific restaurant card immediately
                    const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                    if (restaurantCard) {
                        const bookmarkBtn = restaurantCard.querySelector('.add-to-collection-btn');
                        if (bookmarkBtn) {
                            bookmarkBtn.classList.add('collected');
                        }
                    }
                    
                    // Re-display restaurants to show updated collection status
                    if (currentRestaurants && currentRestaurants.length > 0) {
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
                        showToast('Error adding to collection. Please try again.', 'error');
                    } else {
                        showToast('Added to collection!');
                        // Update collection state (store both string and numeric versions)
                        collectedRestaurants.add(restaurantId);
                        collectedRestaurants.add(parseInt(restaurantId, 10));
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
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
                        showToast('Error adding to collection. Please try again.', 'error');
                    } else {
                        showToast(`Added to ${collectionName}`);
                        
                        // Update collection state immediately (store both string and numeric versions)
                        collectedRestaurants.add(restaurantId);
                        collectedRestaurants.add(parseInt(restaurantId, 10));
                        
                        // Update the specific restaurant card immediately
                        const restaurantCard = document.querySelector(`[data-restaurant-id="${restaurantId}"]`);
                        if (restaurantCard) {
                            const bookmarkBtn = restaurantCard.querySelector('.add-to-collection-btn');
                            if (bookmarkBtn) {
                                bookmarkBtn.classList.add('collected');
                            }
                        }
                        
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
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
                        }
                        
                        // Re-display restaurants to show updated collection status
                        if (currentRestaurants && currentRestaurants.length > 0) {
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
            markerClusterGroup.clearLayers(); // Clear the cluster group instead of individual markers
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
            });
            
            // Update restaurant cards with distance information if user location is available
            updateRestaurantCardsWithDistance();
            
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
            if (isCollected) {
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
            
            listItem.innerHTML = `
                <div class="w-full p-3 md:p-4 flex items-start">
                <div class="flex-shrink-0 mr-3">
                    <div class="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        ${number}
                    </div>
                </div>
                    <div class="flex-1 min-w-0 pr-16">
                        <h3 class="text-gray-900 text-base md:text-lg font-semibold leading-tight">${restaurant.name}</h3>
                        <p class="text-gray-600 text-sm md:text-sm mt-1.5 line-clamp-2 leading-relaxed">${restaurant.description || ''}</p>
                        <div class="mt-2.5 flex flex-wrap gap-1">${cuisineTags}</div>
                    ${distanceHtml}
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

        // Show video for restaurant
async function showVideoFor(restaurant) {
    // Complete tutorial when user watches their first video
    if (document.querySelector('.pulse-me')) {
        document.dispatchEvent(new CustomEvent('restaurant-clicked', { 
            detail: { restaurant: restaurant, source: 'video-watch' } 
        }));
    }

    if (!restaurant.tiktok_embed_html) {
        showNoVideoMessage(videoContainer, restaurant.name);
        videoModal.classList.add('show');
        return;
    }

    // Mark as watched and update UI
    addVideoToWatched(restaurant.id);
    const listItem = document.querySelector(`[data-restaurant-id="${restaurant.id}"]`);
    if (listItem && !listItem.querySelector('.watched-icon')) {
        listItem.appendChild(createWatchedIcon());
    }

    // Show modal and loading state
    videoModal.classList.add('show');
    scrollToRestaurant(restaurant.id);
    videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>`;

    const videoId = extractVideoId(restaurant.tiktok_embed_html);

                if (videoId) {
        // Primary, fast method: Direct iframe
        videoContainer.innerHTML = createVideoIframe(videoId);
                } else {
        // Fallback, slower method: Use the blockquote and ensure the script is ready
        await ensureTikTokScriptIsReady();
        loadVideoWithBlockquote(videoContainer, restaurant.tiktok_embed_html);
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

        // --- Mobile Drawer Functionality - Simplified ---
        function setupMobileDrawer() {
            const drawerHandle = document.getElementById('drawer-handle');
            const aside = document.querySelector('aside');
            let isDragging = false;
            let startY = 0;
            let startHeight = 0;

            if (!drawerHandle || !aside) {
                return;
            }


            // Set initial height on mobile
            if (window.innerWidth <= 768) {
                aside.style.height = '33vh';
            }

            // Simple drag start - only on the visible handle
            function startDrag(e) {
                isDragging = true;
                
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
                
                // Update both the style and the CSS variable
                aside.style.height = `${newHeight}px`;
                document.documentElement.style.setProperty('--drawer-height', `${newHeight}px`);
                e.preventDefault();
                e.stopPropagation();
            }

            function endDrag(e) {
                if (!isDragging) return;
                
                isDragging = false;
                
                // Visual feedback
                drawerHandle.style.backgroundColor = '#f8fafc';
                
                // Persist the final height
                const finalHeight = parseInt(getComputedStyle(aside).height);
                document.documentElement.style.setProperty('--drawer-height', `${finalHeight}px`);
            }

            // Simple click to toggle drawer height
            function toggleDrawer() {
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

            // Add event listeners only to the drawer handle
            drawerHandle.addEventListener('touchstart', startDrag, { passive: false });
            drawerHandle.addEventListener('mousedown', startDrag);
            
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('mousemove', drag);
            
            document.addEventListener('touchend', endDrag);
            document.addEventListener('mouseup', endDrag);

            // Add click to toggle
            drawerHandle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleDrawer();
            });

            // Prevent default touch behavior on handle
            drawerHandle.addEventListener('touchstart', (e) => {
                e.preventDefault();
            }, { passive: false });
        }

        // --- Event Listeners ---
        citySelect.addEventListener('change', async function() {
            const selectedOption = citySelect.options[citySelect.selectedIndex];
            // Show skeleton loaders while loading
            displayRestaurants([], true);
            await loadRestaurantsForCity(selectedOption.value);
            
            // Pre-load collection mappings if collections are selected
            if (selectedCollections.size > 0) {
                await loadRestaurantsForCollections(Array.from(selectedCollections));
            }
            
            // Apply saved filters after loading new city's restaurants
            await applyAllFiltersAndDisplay();
            
            // Smooth transition to new city
            if (map) {
                map.flyTo([selectedOption.dataset.lat, selectedOption.dataset.lon], 12, {
                    animate: true,
                    duration: 1.5,
                    easeLinearity: 0.1
                });
            }
        });
        closeVideoBtn.addEventListener('click', closeVideo);
        videoModal.addEventListener('click', (e) => e.target === videoModal && closeVideo());
        
        // Check location availability and hide button only if user denies permission
        function checkLocationAvailability() {
            const locationBtn = document.getElementById('location-btn');
            if (!locationBtn) return;
            
            // Check if geolocation is supported
            if (!navigator.geolocation) {
                locationBtn.style.display = 'none';
                return;
            }
            
            // Test geolocation permission
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    // Permission granted, keep button visible
                    locationBtn.style.display = 'block';
                },
                function(error) {
                    // Only hide button if user explicitly denied permission
                    if (error.code === error.PERMISSION_DENIED) {
                        locationBtn.style.display = 'none';
                    } else {
                        // Other errors (timeout, unavailable, etc.) - keep button visible
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
                addUserLocationMarker();
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
                    openAuthModal(); // Default to showing auth modal on error
                }
            });
        } else {
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
        
        const clearCollectionFilters = document.getElementById('clear-collection-filters');
        if (clearCollectionFilters) {
            clearCollectionFilters.addEventListener('click', () => {
                selectedCollections.clear();
                saveFilterStates();
                updateCollectionFilterButtonAppearance();
                
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
                
                // Apply combined filters
                if (currentRestaurants && currentRestaurants.length > 0) {
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

                // Toggle selection
                if (selectedCollections.has(collectionId)) {
                    selectedCollections.delete(collectionId);
                } else {
                    selectedCollections.add(collectionId);
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
            }
        });

        // Handle collection checkbox clicks (mobile)
        document.addEventListener('click', (e) => {
            const label = e.target.closest('.collection-checkbox');
            if (label) {
                const collectionId = label.dataset.collectionId;
                const checkbox = label.querySelector('input[type="checkbox"]');


                // Toggle checkbox state
                checkbox.checked = !checkbox.checked;

                if (checkbox.checked) {
                    selectedCollections.add(collectionId);
                } else {
                    selectedCollections.delete(collectionId);
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
                selectedCollections.clear();
                saveFilterStates();
                updateCollectionFilterButtonAppearance();
                
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
                
                // Apply combined filters
                if (currentRestaurants && currentRestaurants.length > 0) {
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
}

function testFail(testName, error = '') {
    testResults.failed++;
    testResults.total++;
}

function testSummary() {
    
    if (testResults.failed === 0) {
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
    testCitySelector();
    
    // Show summary
    testSummary();
}

// Auto-run tests after page loads
async function autoRunTests() {
    // Wait a bit for everything to initialize
    setTimeout(async () => {
        await runAllTests();
    }, 2000); // 2 second delay to ensure everything is loaded
}

// Make test runner available globally
window.runAllTests = runAllTests;

// Auto-run tests on page load
autoRunTests();

