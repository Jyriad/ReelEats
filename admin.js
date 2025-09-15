// Admin Panel JavaScript
const SUPABASE_URL = 'https://jsuxrpnfofkigdfpnuua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if user is authenticated
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// Simple admin login
async function adminLogin() {
    const email = prompt('Enter admin email:');
    const password = prompt('Enter admin password:');
    
    if (!email || !password) return false;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        showStatus('Successfully logged in!', 'success');
        return true;
    } catch (error) {
        console.error('Login error:', error);
        showStatus('Login failed: ' + error.message, 'error');
        return false;
    }
}

// Admin logout
async function adminLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        showStatus('Logged out successfully', 'success');
        setTimeout(() => {
            location.reload();
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        showStatus('Logout failed: ' + error.message, 'error');
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is authenticated
    const session = await checkAuth();
    if (!session) {
        const loginSuccess = await adminLogin();
        if (!loginSuccess) {
            document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h1>Access Denied</h1><p>Authentication required for admin panel.</p></div>';
            return;
        }
    }
    
    await loadDashboardData();
    await loadCitiesForSelect();
    await loadRecentRestaurants();
    await loadRestaurantsWithoutVideos();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check database status
    checkDatabaseStatus();
});

// Load dashboard statistics
async function loadDashboardData() {
    try {
        // Count restaurants
        const { count: restaurantCount } = await supabaseClient
            .from('restaurants')
            .select('*', { count: 'exact', head: true });
        
        // Count cities
        const { count: cityCount } = await supabaseClient
            .from('cities')
            .select('*', { count: 'exact', head: true });
        
        // Count featured videos
        const { count: videoCount } = await supabaseClient
            .from('tiktoks')
            .select('*', { count: 'exact', head: true })
            .eq('is_featured', true);
        
        // Update dashboard
        document.getElementById('total-restaurants').textContent = restaurantCount || 0;
        document.getElementById('total-cities').textContent = cityCount || 0;
        document.getElementById('total-videos').textContent = videoCount || 0;
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showStatus('Error loading dashboard data', 'error');
    }
}

// Load cities for dropdown
async function loadCitiesForSelect() {
    try {
        const { data: cities, error } = await supabaseClient
            .from('cities')
            .select('id, name')
            .order('name');
        
        if (error) throw error;
        
        const citySelect = document.getElementById('restaurant-city');
        citySelect.innerHTML = '<option value="">Select City</option>';
        
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.id;
            option.textContent = city.name;
            citySelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading cities:', error);
        showStatus('Error loading cities', 'error');
    }
}

// Load recent restaurants
async function loadRecentRestaurants() {
    try {
        console.log('🏪 Loading recent restaurants...');
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select('id, name, description, created_at, city_id')
            .order('created_at', { ascending: false })
            .limit(10);
            
        console.log('🏪 Restaurants query result:', { restaurants, error });
        
        if (error) throw error;
        
        const container = document.getElementById('recent-restaurants');
        
        if (restaurants.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No restaurants found</div>';
            return;
        }
        
        container.innerHTML = restaurants.map(restaurant => `
            <div class="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <h5 class="font-medium text-gray-900">${restaurant.name}</h5>
                    <p class="text-sm text-gray-600">City ID: ${restaurant.city_id || 'Unknown'}</p>
                    <p class="text-xs text-gray-500 mt-1">${new Date(restaurant.created_at).toLocaleDateString()}</p>
                </div>
                <button onclick="deleteRestaurant(${restaurant.id})" 
                        class="text-red-600 hover:text-red-800 text-sm ml-2">
                    Delete
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('🚨 Error loading recent restaurants:', error);
        console.error('🚨 Full error object:', JSON.stringify(error, null, 2));
        console.error('🚨 Error message:', error.message);
        console.error('🚨 Error code:', error.code);
        console.error('🚨 Error details:', error.details);
        console.error('🚨 Error hint:', error.hint);
        
        // Update the container to show error instead of loading
        const container = document.getElementById('recent-restaurants');
        container.innerHTML = `<div class="text-sm text-red-500">Error: ${error.message || 'Unknown error'}</div>`;
        
        showStatus(`Error loading restaurants: ${error.message}`, 'error');
    }
}

// Toggle recent restaurants section
function toggleRecentRestaurants() {
    const content = document.getElementById('recent-restaurants-content');
    const arrow = document.getElementById('recent-restaurants-arrow');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
    }
}

// Select restaurant from "Restaurants Without Videos" to pre-fill TikTok form
function selectRestaurantForTikTok(restaurantId, restaurantName) {
    console.log('🎯 Selecting restaurant for TikTok:', { restaurantId, restaurantName });
    
    // Pre-fill the TikTok form
    document.getElementById('selected-restaurant-id').value = restaurantId;
    document.getElementById('selected-restaurant-name').textContent = restaurantName;
    
    // Show the selected restaurant section
    document.getElementById('selected-restaurant').classList.remove('hidden');
    
    // Enable the submit button
    document.querySelector('#add-tiktok-form button[type="submit"]').disabled = false;
    
    // Scroll to the TikTok form section
    document.getElementById('add-tiktok-form').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
    
    // Focus on the TikTok URL input
    setTimeout(() => {
        document.getElementById('tiktok-url').focus();
    }, 500);
    
    // Show success message
    showStatus(`Selected "${restaurantName}" - ready to add TikTok video!`, 'success');
}

// Load restaurants without TikTok videos
async function loadRestaurantsWithoutVideos() {
    try {
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select('id, name, description, created_at, city_id')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        // Get all restaurant IDs that have TikTok videos
        const { data: tiktoks, error: tiktokError } = await supabaseClient
            .from('tiktoks')
            .select('restaurant_id');
            
        if (tiktokError) throw tiktokError;
        
        // Create set of restaurant IDs that have videos
        const restaurantIdsWithVideos = new Set(tiktoks.map(t => t.restaurant_id));
        
        // Filter restaurants that don't have videos
        const restaurantsWithoutVideos = restaurants.filter(restaurant => 
            !restaurantIdsWithVideos.has(restaurant.id)
        );
        
        const container = document.getElementById('restaurants-without-videos');
        
        if (restaurantsWithoutVideos.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">All restaurants have TikTok videos!</div>';
            return;
        }
        
        console.log('🎯 Restaurants without videos:', restaurantsWithoutVideos);
        
        container.innerHTML = restaurantsWithoutVideos.map(restaurant => `
            <div class="flex justify-between items-start p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 cursor-pointer transition-colors duration-200" 
                 onclick="selectRestaurantForTikTok(${restaurant.id}, '${restaurant.name.replace(/'/g, "\\'")}')">
                <div class="flex-1">
                    <h5 class="font-medium text-gray-900">${restaurant.name}</h5>
                    <p class="text-sm text-gray-600">City ID: ${restaurant.city_id || 'Unknown'}</p>
                    <p class="text-xs text-gray-500 mt-1">Added: ${new Date(restaurant.created_at).toLocaleDateString()}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        🎬 Click to Add Video
                    </span>
                </div>
            </div>
        `).join('');
        
        console.log('✅ Updated restaurants without videos display');
        
        // Update dashboard count
        document.getElementById('restaurants-without-videos-count').textContent = restaurantsWithoutVideos.length;
        
    } catch (error) {
        console.error('🚨 Error loading restaurants without videos:', error);
        console.error('🚨 Full error object:', JSON.stringify(error, null, 2));
        console.error('🚨 Error message:', error.message);
        console.error('🚨 Error code:', error.code);
        console.error('🚨 Error details:', error.details);
        console.error('🚨 Error hint:', error.hint);
        
        // Update the container to show error instead of loading
        const container = document.getElementById('restaurants-without-videos');
        container.innerHTML = `<div class="text-sm text-red-500">Error: ${error.message || 'Unknown error'}</div>`;
        
        showStatus(`Error loading restaurants without videos: ${error.message}`, 'error');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Add restaurant form
    document.getElementById('add-restaurant-form').addEventListener('submit', handleAddRestaurant);
    
    // Add TikTok form
    document.getElementById('add-tiktok-form').addEventListener('submit', handleAddTikTok);
    
    // Location finding buttons
    document.getElementById('find-on-map-btn').addEventListener('click', handleFindOnMap);
    document.getElementById('extract-from-url-btn').addEventListener('click', handleExtractFromUrl);
    
    // Restaurant search functionality
    const searchInput = document.getElementById('restaurant-search');
    searchInput.addEventListener('input', handleRestaurantSearch);
    searchInput.addEventListener('focus', handleRestaurantSearch);
    
    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#restaurant-search') && !e.target.closest('#search-results')) {
            document.getElementById('search-results').classList.add('hidden');
        }
    });
    
    // Refresh data button
    document.getElementById('refresh-data').addEventListener('click', async () => {
        showStatus('Refreshing data...', 'info');
        await loadDashboardData();
        await loadRecentRestaurants();
        await loadRestaurantsWithoutVideos();
        showStatus('Data refreshed successfully!', 'success');
    });
    
    // Clear cache button
    document.getElementById('clear-cache').addEventListener('click', () => {
        localStorage.clear();
        showStatus('Cache cleared successfully!', 'success');
    });
}

// Handle add restaurant form submission
async function handleAddRestaurant(e) {
    e.preventDefault();
    
    // Debug: Check current authentication status
    const { data: { session } } = await supabaseClient.auth.getSession();
    console.log('🔐 Current session:', session);
    console.log('🔐 User ID:', session?.user?.id);
    console.log('🔐 User email:', session?.user?.email);
    
    if (!session) {
        showStatus('Not authenticated! Please refresh and log in again.', 'error');
        return;
    }
    
    const lat = document.getElementById('restaurant-lat').value;
    const lon = document.getElementById('restaurant-lon').value;
    
    if (!lat || !lon) {
        showStatus('Please find the restaurant location on the map first', 'error');
        return;
    }
    
    const formData = {
        name: document.getElementById('restaurant-name').value,
        description: document.getElementById('restaurant-description').value,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        city_id: parseInt(document.getElementById('restaurant-city').value),
        google_place_id: document.getElementById('google-place-id').value || null,
        google_maps_url: document.getElementById('google-maps-url').value || null
    };
    
    console.log('📝 Form data to insert:', formData);
    
    try {
        // Add restaurant
        const { data: restaurant, error: restaurantError } = await supabaseClient
            .from('restaurants')
            .insert([formData])
            .select()
            .single();
        
        if (restaurantError) {
            console.error('🚨 Restaurant insert error details:', restaurantError);
            console.error('🚨 Error code:', restaurantError.code);
            console.error('🚨 Error message:', restaurantError.message);
            console.error('🚨 Error details:', restaurantError.details);
            throw restaurantError;
        }
        
        console.log('✅ Restaurant added successfully:', restaurant);
        
        // Reset form
        resetRestaurantForm();
        
        // Refresh data
        await loadDashboardData();
        await loadRecentRestaurants();
        await loadRestaurantsWithoutVideos();
        
        showStatus('Restaurant added successfully!', 'success');
        
    } catch (error) {
        console.error('🚨 Complete error object:', error);
        console.error('🚨 Error adding restaurant:', error);
        showStatus('Error adding restaurant: ' + error.message, 'error');
    }
}

// Reset restaurant form to initial state
function resetRestaurantForm() {
    document.getElementById('add-restaurant-form').reset();
    document.getElementById('location-results').classList.add('hidden');
    document.getElementById('selected-location').classList.add('hidden');
    document.getElementById('location-status').textContent = 'Location not found yet';
    document.getElementById('location-status').className = 'px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-300 rounded-md';
    document.getElementById('submit-restaurant-btn').disabled = true;
}

// Handle Find on Map button click
async function handleFindOnMap() {
    const restaurantName = document.getElementById('restaurant-name').value.trim();
    
    if (!restaurantName) {
        showStatus('Please enter a restaurant name first', 'error');
        return;
    }
    
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
        showStatus('Google Maps API not loaded. Please check your API key.', 'error');
        return;
    }
    
    const statusEl = document.getElementById('location-status');
    statusEl.textContent = 'Searching...';
    statusEl.className = 'px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-300 rounded-md';
    
    const useNewAPI = false; // Set to false temporarily to use legacy API while fixing issues
    
    console.log('🔍 useNewAPI flag:', useNewAPI);
    
    try {        
        if (useNewAPI) {
            console.log('🆕 Using NEW Places API...');
            // Use new Places API (New) - REST API
            await searchWithNewAPI(restaurantName, statusEl);
        } else {
            console.log('🔄 Using LEGACY Places API...');
            // Fallback to legacy Places API
            await searchWithLegacyAPI(restaurantName, statusEl);
        }
        
    } catch (error) {
        console.error('Error searching for location:', error);
        statusEl.textContent = 'Search failed';
        statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
        showStatus('Error searching for location: ' + error.message, 'error');
        
        // If new API fails, try legacy as fallback
        if (useNewAPI) {
            console.log('New API failed, trying legacy API...');
            try {
                await searchWithLegacyAPI(restaurantName, statusEl);
            } catch (legacyError) {
                console.error('Legacy API also failed:', legacyError);
            }
        }
    }
}

// Search using new Places API (New) - REST API
async function searchWithNewAPI(restaurantName, statusEl) {
    const API_KEY = 'AIzaSyCtSwtAs5AldNeESZrgsGLQ7MOJzsIugFU';
    
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types'
        },
        body: JSON.stringify({
            textQuery: restaurantName + ' restaurant',
            maxResultCount: 10
        })
    });
    
    if (!response.ok) {
        throw new Error(`New Places API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('🆕 New Places API response:', data);
    
    if (data.places && data.places.length > 0) {
        // Convert new API format to legacy format for compatibility
        const convertedResults = data.places.map(place => ({
            place_id: place.id,
            name: place.displayName?.text || place.displayName,
            formatted_address: place.formattedAddress,
            geometry: {
                location: {
                    lat: place.location?.latitude,
                    lng: place.location?.longitude
                }
            },
            types: place.types || []
        }));
        
        displayLocationOptions(convertedResults);
        statusEl.textContent = `Found ${convertedResults.length} location(s) (New API)`;
        statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
    } else {
        statusEl.textContent = 'No locations found (New API)';
        statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
        showStatus('No locations found for "' + restaurantName + '"', 'error');
    }
}

// Search using legacy Places API (fallback)
async function searchWithLegacyAPI(restaurantName, statusEl) {
    return new Promise(async (resolve, reject) => {
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        
        // First search with broader parameters
        const request = {
            query: restaurantName + ' restaurant',
            fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types']
        };
        
        console.log('🔍 Searching for:', request.query);
        
        // Perform multiple searches for better coverage
        let allResults = [];
        let searchesCompleted = 0;
        const totalSearches = 3;
        
        // Search 1: Standard search
        service.textSearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                console.log('🔄 Standard search results:', results.length);
                allResults = allResults.concat(results);
            }
            searchesCompleted++;
            checkAndDisplayResults();
        });
        
        // Search 2: Search with UK bias
        const ukRequest = {
            ...request,
            region: 'uk',
            location: new google.maps.LatLng(54.7023545, -3.2765753), // Center of UK
            radius: 500000 // 500km radius
        };
        
        setTimeout(() => {
            service.textSearch(ukRequest, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    console.log('🇬🇧 UK-biased search results:', results.length);
                    allResults = allResults.concat(results);
                }
                searchesCompleted++;
                checkAndDisplayResults();
            });
        }, 100);
        
        // Search 3: Search without "restaurant" term for chains
        const chainRequest = {
            query: restaurantName,
            fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types'],
            type: 'restaurant'
        };
        
        setTimeout(() => {
            service.textSearch(chainRequest, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    console.log('🏪 Chain search results:', results.length);
                    allResults = allResults.concat(results);
                }
                searchesCompleted++;
                checkAndDisplayResults();
            });
        }, 200);
        
        function checkAndDisplayResults() {
            if (searchesCompleted === totalSearches) {
                // Remove duplicates based on place_id
                const uniqueResults = [];
                const seenPlaceIds = new Set();
                
                allResults.forEach(result => {
                    if (!seenPlaceIds.has(result.place_id)) {
                        seenPlaceIds.add(result.place_id);
                        uniqueResults.push(result);
                    }
                });
                
                console.log('🎯 Total unique results found:', uniqueResults.length);
                
                if (uniqueResults.length > 0) {
                    // Sort by name similarity and distance
                    const sortedResults = uniqueResults.sort((a, b) => {
                        const aNameMatch = a.name.toLowerCase().includes(restaurantName.toLowerCase());
                        const bNameMatch = b.name.toLowerCase().includes(restaurantName.toLowerCase());
                        
                        if (aNameMatch && !bNameMatch) return -1;
                        if (!aNameMatch && bNameMatch) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    
                    displayLocationOptions(sortedResults.slice(0, 15)); // Show top 15 results
                    statusEl.textContent = `Found ${sortedResults.length} location(s) (Enhanced Search)`;
                    statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
                    resolve(sortedResults);
                } else {
                    statusEl.textContent = 'No locations found';
                    statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
                    const error = new Error('No locations found for "' + restaurantName + '"');
                    showStatus(error.message, 'error');
                    reject(error);
                }
            }
        }
    });
}

// Handle Extract from URL button click
async function handleExtractFromUrl() {
    const url = document.getElementById('google-maps-url').value.trim();
    
    if (!url) {
        showStatus('Please enter a Google Maps URL first', 'error');
        return;
    }
    
    const statusEl = document.getElementById('location-status');
    statusEl.textContent = 'Extracting from URL...';
    statusEl.className = 'px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-300 rounded-md';
    
    try {
        // Check if Google Maps API is loaded
        if (typeof google === 'undefined' || !google.maps) {
            throw new Error('Google Maps API not loaded. Please check your API key.');
        }
        
        await extractLocationFromUrl(url, statusEl);
        
    } catch (error) {
        console.error('Error extracting from URL:', error);
        statusEl.textContent = 'URL extraction failed';
        statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
        showStatus('Error extracting from URL: ' + error.message, 'error');
    }
}

// Extract location from various Google Maps URL formats
async function extractLocationFromUrl(url, statusEl) {
    // Handle Google Share links (like share.google/...)
    if (url.includes('share.google') || url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
        console.log('Detected Google Share link, following redirect...');
        await handleShareLink(url, statusEl);
        return;
    }
    
    // Try to extract coordinates from direct Google Maps URLs
    let lat, lng, placeId;
    
    // Pattern 1: @lat,lng,zoom (most common)
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
        console.log('Extracted coordinates from @ pattern:', lat, lng);
    }
    
    // Pattern 2: ll=lat,lng
    const llMatch = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!lat && llMatch) {
        lat = parseFloat(llMatch[1]);
        lng = parseFloat(llMatch[2]);
        console.log('Extracted coordinates from ll pattern:', lat, lng);
    }
    
    // Pattern 3: q=lat,lng
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!lat && qMatch) {
        lat = parseFloat(qMatch[1]);
        lng = parseFloat(qMatch[2]);
        console.log('Extracted coordinates from q pattern:', lat, lng);
    }
    
    // Pattern 4: Place ID in URL
    const placeIdMatch = url.match(/place_id=([A-Za-z0-9_-]+)/);
    if (placeIdMatch) {
        placeId = placeIdMatch[1];
        console.log('Extracted place ID:', placeId);
    }
    
    // Pattern 5: data parameter with coordinates
    const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (!lat && dataMatch) {
        lat = parseFloat(dataMatch[1]);
        lng = parseFloat(dataMatch[2]);
        console.log('Extracted coordinates from data pattern:', lat, lng);
    }
    
    if (placeId) {
        // Use Place ID to get location details
        await getPlaceFromId(placeId, statusEl);
    } else if (lat && lng) {
        // Use coordinates for reverse geocoding
        await reverseGeocode(lat, lng, statusEl);
    } else {
        throw new Error('Could not extract coordinates or place ID from URL. Please try using the "Find on Map" button instead.');
    }
}

// Handle Google Share links by following redirects
async function handleShareLink(shareUrl, statusEl) {
    try {
        // Try to follow the redirect to get the actual Google Maps URL
        const response = await fetch(shareUrl, { 
            method: 'HEAD',
            redirect: 'follow'
        });
        
        const finalUrl = response.url;
        console.log('Share link redirected to:', finalUrl);
        
        if (finalUrl && finalUrl !== shareUrl) {
            // Extract from the final URL
            await extractLocationFromUrl(finalUrl, statusEl);
        } else {
            // If redirect doesn't work, try alternative approach
            throw new Error('Could not follow share link redirect');
        }
    } catch (error) {
        console.log('Share link redirect failed, trying alternative method...');
        
        // Alternative: Try to extract any place name from the URL and search for it
        const urlParts = shareUrl.split('/');
        const shareId = urlParts[urlParts.length - 1];
        
        if (shareId && shareId.length > 5) {
            // If we can't extract directly, ask user to use "Find on Map" instead
            throw new Error(`Cannot extract from share link directly. Please copy the restaurant name and use the "Find on Map" button instead.`);
        } else {
            throw new Error('Invalid share link format');
        }
    }
}

// Get place details from Place ID
async function getPlaceFromId(placeId, statusEl) {
    try {
        // Try new Places API first
        const API_KEY = 'AIzaSyCtSwtAs5AldNeESZrgsGLQ7MOJzsIugFU';
        
        const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location'
            }
        });
        
        if (response.ok) {
            const place = await response.json();
            console.log('🆕 New Places API place details:', place);
            
            // Convert to legacy format
            const convertedPlace = {
                place_id: place.id,
                name: place.displayName?.text || place.displayName,
                formatted_address: place.formattedAddress,
                geometry: {
                    location: {
                        lat: place.location?.latitude,
                        lng: place.location?.longitude
                    }
                }
            };
            
            selectLocation(convertedPlace);
            statusEl.textContent = 'Location extracted successfully (New API)';
            statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
            return;
        }
        
        // Fallback to legacy API
        throw new Error('New API failed, trying legacy...');
        
    } catch (error) {
        console.log('🔄 Falling back to legacy Places API for place details...');
        
        // Fallback to legacy API
        return new Promise((resolve, reject) => {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            
            service.getDetails({
                placeId: placeId,
                fields: ['place_id', 'name', 'formatted_address', 'geometry']
            }, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                    console.log('🔄 Legacy API place details:', place);
                    selectLocation(place);
                    statusEl.textContent = 'Location extracted successfully (Legacy API)';
                    statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
                    resolve();
                } else {
                    reject(new Error('Could not get place details for Place ID: ' + placeId));
                }
            });
        });
    }
}

// Reverse geocode coordinates to get place information
async function reverseGeocode(lat, lng, statusEl) {
    return new Promise((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results[0]) {
                selectLocation({
                    place_id: results[0].place_id,
                    name: results[0].formatted_address,
                    formatted_address: results[0].formatted_address,
                    geometry: {
                        location: { lat: () => lat, lng: () => lng }
                    }
                });
                statusEl.textContent = 'Location extracted successfully';
                statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
                resolve();
            } else {
                reject(new Error('Could not reverse geocode the coordinates'));
            }
        });
    });
}

// Display location options for user to choose from
function displayLocationOptions(places) {
    const resultsDiv = document.getElementById('location-results');
    const optionsDiv = document.getElementById('location-options');
    
    optionsDiv.innerHTML = places.map((place, index) => {
        // Handle both new API format (direct values) and legacy API format (functions)
        const lat = typeof place.geometry.location.lat === 'function' 
            ? place.geometry.location.lat() 
            : place.geometry.location.lat;
        const lng = typeof place.geometry.location.lng === 'function' 
            ? place.geometry.location.lng() 
            : place.geometry.location.lng;
            
        return `
            <div class="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors" 
                 onclick="selectLocation(${JSON.stringify(place).replace(/"/g, '&quot;')})">
                <div class="font-medium text-gray-900">${place.name}</div>
                <div class="text-sm text-gray-600">${place.formatted_address}</div>
                <div class="text-xs text-gray-500 mt-1">
                    Lat: ${lat.toFixed(6)}, 
                    Lng: ${lng.toFixed(6)}
                </div>
            </div>
        `;
    }).join('');
    
    resultsDiv.classList.remove('hidden');
}

// Select a location from the options
function selectLocation(place) {
    const lat = typeof place.geometry.location.lat === 'function' 
        ? place.geometry.location.lat() 
        : place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng === 'function' 
        ? place.geometry.location.lng() 
        : place.geometry.location.lng;
    
    // Fill hidden form fields
    document.getElementById('restaurant-lat').value = lat;
    document.getElementById('restaurant-lon').value = lng;
    document.getElementById('google-place-id').value = place.place_id || '';
    
    // Fill Google Maps URL field
    if (place.place_id) {
        // Use Google Maps Place URL format
        const googleMapsUrl = `https://maps.google.com/?cid=${place.place_id}`;
        document.getElementById('google-maps-url').value = googleMapsUrl;
    } else {
        // Fallback to coordinates-based URL
        const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        document.getElementById('google-maps-url').value = googleMapsUrl;
    }
    
    // Update selected location display
    document.getElementById('selected-name').textContent = place.name;
    document.getElementById('selected-address').textContent = place.formatted_address;
    document.getElementById('selected-coordinates').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Show selected location info
    document.getElementById('selected-location').classList.remove('hidden');
    document.getElementById('location-results').classList.add('hidden');
    
    // Enable submit button
    document.getElementById('submit-restaurant-btn').disabled = false;
    
    // Update status
    const statusEl = document.getElementById('location-status');
    statusEl.textContent = 'Location selected ✓';
    statusEl.className = 'px-3 py-2 text-sm text-green-600 bg-green-50 border border-green-300 rounded-md';
}

// Handle add TikTok form submission
async function handleAddTikTok(e) {
    e.preventDefault();
    
    const restaurantId = document.getElementById('selected-restaurant-id').value;
    const tiktokUrl = document.getElementById('tiktok-url').value;
    const isFeatured = document.getElementById('is-featured').checked;
    
    if (!restaurantId) {
        showStatus('Please select a restaurant first', 'error');
        return;
    }
    
    try {
        const videoId = extractTikTokVideoId(tiktokUrl);
        if (!videoId) {
            showStatus('Invalid TikTok URL - could not extract video ID', 'error');
            return;
        }
        
        const embedHtml = `<blockquote class="tiktok-embed" cite="${tiktokUrl}" data-video-id="${videoId}" style="width: 330px; height: 585px; margin: 0; visibility: hidden;"><section></section></blockquote>`;
        
        console.log('🎬 Attempting to insert TikTok with data:', {
            restaurant_id: parseInt(restaurantId),
            embed_html: embedHtml,
            is_featured: isFeatured
        });

        const { error } = await supabaseClient
            .from('tiktoks')
            .insert([{
                restaurant_id: parseInt(restaurantId),
                embed_html: embedHtml,
                is_featured: isFeatured
            }]);
        
        if (error) throw error;
        
        // Reset form
        document.getElementById('add-tiktok-form').reset();
        document.getElementById('selected-restaurant').classList.add('hidden');
        document.getElementById('selected-restaurant-id').value = '';
        document.querySelector('#add-tiktok-form button[type="submit"]').disabled = true;
        
        // Refresh data
        await loadDashboardData();
        await loadRestaurantsWithoutVideos();
        
        showStatus('TikTok video added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding TikTok video:', error);
        showStatus('Error adding TikTok video: ' + error.message, 'error');
    }
}

// Handle restaurant search
async function handleRestaurantSearch(e) {
    const searchTerm = e.target.value.trim();
    const resultsContainer = document.getElementById('search-results');
    
    if (searchTerm.length < 2) {
        resultsContainer.classList.add('hidden');
        return;
    }
    
    try {
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select(`
                id,
                name,
                description,
                cities (name)
            `)
            .ilike('name', `%${searchTerm}%`)
            .limit(10);
        
        if (error) throw error;
        
        if (restaurants.length === 0) {
            resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500">No restaurants found</div>';
        } else {
            resultsContainer.innerHTML = restaurants.map(restaurant => `
                <div class="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0" 
                     onclick="selectRestaurant(${restaurant.id}, '${restaurant.name.replace(/'/g, "\\'")}')">
                    <div class="font-medium text-gray-900">${restaurant.name}</div>
                    <div class="text-sm text-gray-600">${restaurant.cities?.name || 'Unknown City'}</div>
                </div>
            `).join('');
        }
        
        resultsContainer.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error searching restaurants:', error);
        resultsContainer.innerHTML = '<div class="p-3 text-sm text-red-500">Error searching restaurants</div>';
        resultsContainer.classList.remove('hidden');
    }
}

// Select restaurant from search results
function selectRestaurant(id, name) {
    document.getElementById('selected-restaurant-id').value = id;
    document.getElementById('selected-restaurant-name').textContent = name;
    document.getElementById('selected-restaurant').classList.remove('hidden');
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('restaurant-search').value = '';
    
    // Enable the submit button
    document.querySelector('#add-tiktok-form button[type="submit"]').disabled = false;
}

// Extract TikTok video ID from URL
function extractTikTokVideoId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
}

// Delete restaurant
async function deleteRestaurant(restaurantId) {
    if (!confirm('Are you sure you want to delete this restaurant?')) {
        return;
    }
    
    try {
        // Delete associated TikToks first
        await supabaseClient
            .from('tiktoks')
            .delete()
            .eq('restaurant_id', restaurantId);
        
        // Delete restaurant
        const { error } = await supabaseClient
            .from('restaurants')
            .delete()
            .eq('id', restaurantId);
        
        if (error) throw error;
        
        // Refresh data
        await loadDashboardData();
        await loadRecentRestaurants();
        
        showStatus('Restaurant deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        showStatus('Error deleting restaurant: ' + error.message, 'error');
    }
}

// Delete TikTok video
async function deleteTikTok(tiktokId) {
    if (!confirm('Are you sure you want to delete this TikTok video?')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('tiktoks')
            .delete()
            .eq('id', tiktokId);
        
        if (error) throw error;
        
        // Refresh data
        await loadDashboardData();
        await loadRecentTikToks();
        
        showStatus('TikTok video deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Error deleting TikTok video:', error);
        showStatus('Error deleting TikTok video: ' + error.message, 'error');
    }
}

// Check database connection status
async function checkDatabaseStatus() {
    try {
        console.log('🔍 Testing database connection and table structure...');
        
        // Test restaurants table structure
        console.log('🏪 Testing restaurants table...');
        const { data: restaurantTest, error: restaurantError } = await supabaseClient
            .from('restaurants')
            .select('*')
            .limit(1);
            
        if (restaurantError) {
            console.error('❌ Restaurants table error:', restaurantError);
        } else {
            console.log('✅ Restaurants table accessible');
            if (restaurantTest.length > 0) {
                console.log('📊 Restaurant columns available:', Object.keys(restaurantTest[0]));
            }
        }
        
        // Test tiktoks table structure
        console.log('🎬 Testing tiktoks table...');
        const { data: tiktokTest, error: tiktokError } = await supabaseClient
            .from('tiktoks')
            .select('*')
            .limit(1);
            
        if (tiktokError) {
            console.error('❌ TikToks table error:', tiktokError);
        } else {
            console.log('✅ TikToks table accessible');
            if (tiktokTest.length > 0) {
                console.log('📊 TikTok columns available:', Object.keys(tiktokTest[0]));
            }
        }
        
        const statusEl = document.getElementById('db-status');
        
        if (restaurantError || tiktokError) {
            statusEl.innerHTML = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>';
        } else {
            statusEl.innerHTML = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Connected</span>';
        }
        
        // Update last updated time
        document.getElementById('last-updated').textContent = new Date().toLocaleString();
        
    } catch (error) {
        console.error('Database status check failed:', error);
        document.getElementById('db-status').innerHTML = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>';
    }
}

// Show status message
function showStatus(message, type = 'success') {
    const statusDiv = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    
    statusText.textContent = message;
    
    // Update colors based on type
    const messageDiv = statusDiv.querySelector('div');
    messageDiv.className = `px-4 py-2 rounded-md shadow-lg ${
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'info' ? 'bg-blue-500 text-white' :
        'bg-green-500 text-white'
    }`;
    
    // Show message
    statusDiv.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 3000);
}
