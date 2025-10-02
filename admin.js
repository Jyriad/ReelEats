// Admin Panel JavaScript
// Note: SUPABASE_URL, SUPABASE_ANON_KEY, and supabaseClient are declared in admin.html

import { CONFIG } from './config.js';

// admin.js

// Check if user is authenticated AND has the 'admin' role
async function checkAuth() {
    // First, check if there is a logged-in user session
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        console.log('No active session found.');
        return false; // Not authenticated
    }

    // If there is a session, check if that user has the 'admin' role
    const user = session.user;
    console.log('Checking roles for user:', user.id);

    try {
        const { data: userRole, error: roleError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single(); // Use .single() to get one record or null

        if (roleError && roleError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is not an actual error for us here.
            // Throw any other errors.
            throw roleError;
        }

        if (userRole) {
            console.log('Admin role confirmed for user.');
            return session; // User is an admin, return the session object
        } else {
            console.log('User does not have admin role.');
            return false; // User is logged in, but not an admin
        }

    } catch (error) {
        console.error('Error checking user role:', error);
        return false;
    }
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
async function initializeAdminPanel() {
    console.log('Admin panel initializing...');
    
    // Check if user is authenticated
    const session = await checkAuth();
    console.log('Auth check result:', session);
    
    if (!session) {
        console.log('No session, checking for existing user session...');
        
        // Check if there's an existing session from the main app
        const { data: { session: existingSession }, error: sessionError } = await supabaseClient.auth.getSession();
        
        if (existingSession && existingSession.user) {
            console.log('Found existing session, checking admin role...');
            
            // Check if this user has admin role
            try {
                const { data: userRole, error: roleError } = await supabaseClient
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', existingSession.user.id)
                    .eq('role', 'admin')
                    .single();
                
                if (userRole) {
                    console.log('Existing user has admin role, proceeding...');
                    // User is already authenticated and has admin role, proceed
                } else {
                    console.log('Existing user does not have admin role');
                    document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h1>Access Denied</h1><p>Admin privileges required.</p><a href="index.html">Return to Map</a></div>';
                    return;
                }
            } catch (error) {
                console.error('Error checking admin role:', error);
                document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h1>Access Denied</h1><p>Error verifying admin privileges.</p><a href="index.html">Return to Map</a></div>';
                return;
            }
        } else {
            console.log('No existing session, redirecting to main app for login...');
            // No existing session, redirect to main app
            window.location.href = 'index.html';
            return;
        }
    }
    
    try {
        console.log('Loading dashboard data...');
        await loadDashboardData();
        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
    
    try {
        console.log('Loading cities...');
        await loadCitiesForSelect();
        console.log('Cities loaded successfully');
    } catch (error) {
        console.error('Failed to load cities:', error);
    }
    
    try {
        console.log('Loading recent restaurants...');
        await loadRecentRestaurants();
        console.log('Recent restaurants loaded successfully');
    } catch (error) {
        console.error('Failed to load recent restaurants:', error);
    }
    
    try {
        console.log('Loading restaurants without videos...');
        await loadRestaurantsWithoutVideos();
        console.log('Restaurants without videos loaded successfully');
    } catch (error) {
        console.error('Failed to load restaurants without videos:', error);
    }
    
    // Load videos for management with error handling
    try {
        await loadVideosForManagement();
    } catch (error) {
        console.error('Failed to load videos for management:', error);
        // Ensure the section shows something even if loading fails
        const container = document.getElementById('videos-list');
        if (container) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No videos available</p>';
        }
    }
    
    // Load cuisines for the add restaurant form
    try {
        console.log('Loading cuisines...');
        await loadAndDisplayCuisines('cuisine-selection');
        console.log('Cuisines loaded successfully');
    } catch (error) {
        console.error('Failed to load cuisines:', error);
    }
    
    // Set up event listeners
    setupEventListeners();
}

// Run when DOM is ready or immediately if already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPanel);
} else {
    initializeAdminPanel();
}

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
            container.innerHTML = '<div class="text-sm text-gray-500">No restaurants found for your selected filters. Try clearing your selection.</div>';
            return;
        }
        
        container.innerHTML = restaurants.map(restaurant => `
            <div class="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <h5 class="font-medium text-gray-900">${restaurant.name}</h5>
                    <p class="text-sm text-gray-600">City ID: ${restaurant.city_id || 'Unknown'}</p>
                    <p class="text-xs text-gray-500 mt-1">${new Date(restaurant.created_at).toLocaleDateString()}</p>
                </div>
                <button onclick="deleteRestaurant(${restaurant.id}, '${restaurant.name}')" 
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

// Load and display cuisines dynamically from database
async function loadAndDisplayCuisines(containerId, preselectedCuisines = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // Fetch all categories and their cuisines in one go
        let { data: categories, error } = await supabaseClient
            .from('cuisine_categories')
            .select(`
                id,
                name,
                icon,
                cuisines ( id, name, icon, color_background, color_text )
            `)
            .order('name');

        if (error) throw error;

        container.innerHTML = ''; // Clear existing content

        categories.forEach(category => {
            const categorySection = document.createElement('div');
            let buttonsHtml = category.cuisines.map(cuisine => {
                const isSelected = preselectedCuisines.includes(cuisine.name);
                const bgColor = cuisine.color_background || '#E5E7EB';
                const textColor = cuisine.color_text || '#1F2937';
                const selectedClass = isSelected ? 'selected' : '';
                return `
                    <button type="button" class="cuisine-btn px-3 py-2 text-xs border rounded-full transition-colors ${selectedClass}" 
                            data-cuisine="${cuisine.name}"
                            data-bg-color="${bgColor}"
                            data-text-color="${textColor}"
                            style="background-color: ${isSelected ? '#3B82F6' : bgColor}; color: ${isSelected ? 'white' : textColor};">
                        <span class="inline-block w-3 h-3 mr-1 flex items-center justify-center" style="font-size: 12px; line-height: 1; overflow: hidden;">${cuisine.icon || '🍽️'}</span> ${cuisine.name}
                    </button>
                `;
            }).join('');

            categorySection.innerHTML = `
                <h4 class="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                    <span class="inline-block w-5 h-5 mr-2" style="font-size: 20px; line-height: 1;">${category.icon || '📁'}</span> ${category.name}
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    ${buttonsHtml}
                </div>
            `;
            container.appendChild(categorySection);
        });

        // Re-attach event listeners to the new buttons
        setupCuisineSelection(containerId);

    } catch (error) {
        console.error('Error loading cuisines:', error);
        container.innerHTML = '<p class="text-red-500">Error: Could not load cuisines from the database.</p>';
    }
}

// Set up cuisine selection functionality
function setupCuisineSelection(containerId = null) {
    console.log('🍽️ Setting up cuisine selection...');
    const selector = containerId ? `#${containerId} .cuisine-btn` : '.cuisine-btn';
    const cuisineButtons = document.querySelectorAll(selector);
    console.log('🍽️ Found cuisine buttons:', cuisineButtons.length);
    
    cuisineButtons.forEach((button, index) => {
        // Remove any existing event listeners
        button.replaceWith(button.cloneNode(true));
    });
    
    // Re-query after cloning to get fresh elements
    const freshButtons = document.querySelectorAll('.cuisine-btn');
    console.log('🍽️ Fresh cuisine buttons:', freshButtons.length);
    
    freshButtons.forEach((button, index) => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🍽️ Cuisine button clicked:', button.dataset.cuisine);
            
            // Toggle selection
            if (button.classList.contains('selected')) {
                // Deselect
                button.classList.remove('selected');
                // Restore original styling from data attributes
                const bgColor = button.dataset.bgColor || '#E5E7EB';
                const textColor = button.dataset.textColor || '#1F2937';
                button.style.backgroundColor = bgColor;
                button.style.color = textColor;
                console.log('🍽️ Deselected:', button.dataset.cuisine);
            } else {
                // Select
                button.classList.add('selected');
                button.style.backgroundColor = '#3B82F6';
                button.style.color = 'white';
                console.log('🍽️ Selected:', button.dataset.cuisine);
            }
            
            // Debug: Show current selection
            const selectedCuisines = getSelectedCuisines();
            console.log('🍽️ Currently selected cuisines:', selectedCuisines);
        });
    });
}

// Get selected cuisines
function getSelectedCuisines() {
    const selectedButtons = document.querySelectorAll('.cuisine-btn.selected');
    return Array.from(selectedButtons).map(btn => btn.dataset.cuisine);
}

// Get cuisine color for create form
// Note: getCuisineColor function removed - now using database colors via data attributes

// Reset cuisine selection
function resetCuisineSelection() {
    const cuisineButtons = document.querySelectorAll('.cuisine-btn');
    cuisineButtons.forEach(button => {
        button.classList.remove('selected');
        // Restore original styling from data attributes
        const bgColor = button.dataset.bgColor || '#E5E7EB';
        const textColor = button.dataset.textColor || '#1F2937';
        button.style.backgroundColor = bgColor;
        button.style.color = textColor;
    });
}

// Add cuisine relationships to restaurant_cuisines table
async function addRestaurantCuisines(restaurantId, selectedCuisineNames) {
    try {
        console.log('🍽️ Adding cuisines for restaurant:', restaurantId, 'Selected cuisines:', selectedCuisineNames);
        
        if (!selectedCuisineNames || selectedCuisineNames.length === 0) {
            console.log('🍽️ No cuisines selected, skipping cuisine relationships');
            return;
        }
        
        // First, get cuisine IDs from cuisine names
        const { data: cuisines, error: cuisineError } = await supabaseClient
            .from('cuisines')
            .select('id, name')
            .in('name', selectedCuisineNames);
            
        if (cuisineError) {
            console.error('Error fetching cuisines:', cuisineError);
            showStatus('Restaurant added, but failed to add cuisines. Please add them manually.', 'warning');
            return;
        }
        
        console.log('🍽️ Found cuisine IDs:', cuisines);
        
        // Check if any cuisines are missing and create them
        const foundCuisineNames = cuisines.map(c => c.name);
        const missingCuisines = selectedCuisineNames.filter(name => !foundCuisineNames.includes(name));
        
        if (missingCuisines.length > 0) {
            console.log('🍽️ Creating missing cuisines:', missingCuisines);
            const newCuisines = missingCuisines.map(name => ({ name }));
            
            const { data: createdCuisines, error: createError } = await supabaseClient
                .from('cuisines')
                .insert(newCuisines)
                .select('id, name');
                
            if (createError) {
                console.error('Error creating missing cuisines:', createError);
                showStatus('Restaurant added, but failed to create missing cuisines.', 'warning');
                return;
            }
            
            console.log('🍽️ Created missing cuisines:', createdCuisines);
            cuisines.push(...createdCuisines);
        }
        
        if (!cuisines || cuisines.length === 0) {
            console.log('🍽️ No cuisines found or created for selected names:', selectedCuisineNames);
            showStatus('Restaurant added, but no cuisines could be processed.', 'warning');
            return;
        }
        
        // Create restaurant_cuisine relationships
        const relationshipData = cuisines.map(cuisine => ({
            restaurant_id: restaurantId,
            cuisine_id: cuisine.id
        }));
        
        console.log('🍽️ Creating relationships:', relationshipData);
        
        const { error: relationshipError } = await supabaseClient
            .from('restaurant_cuisines')
            .insert(relationshipData);
            
        if (relationshipError) {
            console.error('Error adding restaurant cuisines:', relationshipError);
            showStatus('Restaurant added, but failed to link cuisines. Please add them manually.', 'warning');
        } else {
            console.log('✅ Successfully added', relationshipData.length, 'cuisine relationships');
        }
        
    } catch (error) {
        console.error('Error in addRestaurantCuisines:', error);
        showStatus('Restaurant added, but failed to process cuisines. Please add them manually.', 'warning');
    }
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
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 gap-1">
                        <span style="font-size: 12px; line-height: 1;">🎬</span> Click to Add Video
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
    
    
    // Video management search and filter
    const searchVideoInput = document.getElementById('video-search-manage');
    const videoCityFilterSelect = document.getElementById('video-city-filter-manage');
    const refreshVideosBtn = document.getElementById('refresh-videos');
    
    if (searchVideoInput) {
        searchVideoInput.addEventListener('input', filterVideos);
    }
    
    if (videoCityFilterSelect) {
        videoCityFilterSelect.addEventListener('change', filterVideos);
    }
    
    if (refreshVideosBtn) {
        refreshVideosBtn.addEventListener('click', async () => {
            showStatus('Refreshing videos...', 'info');
            await loadVideosForManagement();
            showStatus('Videos refreshed successfully!', 'success');
        });
    }
    
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
        google_maps_url: document.getElementById('google-maps-url').value || null,
        created_at: new Date().toISOString()
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
        
        // Check if TikTok URL was provided
        const tiktokUrl = document.getElementById('restaurant-tiktok-url').value.trim();
        if (tiktokUrl) {
            console.log('🎬 TikTok URL provided, adding video for restaurant:', restaurant.id);
            
            try {
                // Extract video ID and creator handle from TikTok URL
                const videoId = extractTikTokVideoId(tiktokUrl);
                const authorHandle = extractTikTokCreatorHandle(tiktokUrl);
                
                if (!videoId) {
                    console.warn('⚠️ Could not extract video ID from TikTok URL, skipping video creation');
                    showStatus('Restaurant added, but TikTok URL was invalid. You can add the video manually.', 'warning');
                } else {
                    // Create embed HTML
                    const embedHtml = `<blockquote class="tiktok-embed" cite="${tiktokUrl}" data-video-id="${videoId}" style="width: 330px; height: 585px; margin: 0; visibility: hidden; position: absolute; top: -9999px; left: -9999px;"><section></section></blockquote>`;
                    
                    // Insert TikTok video
                    const { error: tiktokError } = await supabaseClient
                        .from('tiktoks')
                        .insert([{
                            restaurant_id: restaurant.id,
                            embed_html: embedHtml,
                            is_featured: true, // Always featured when added via restaurant form
                            author_handle: authorHandle
                        }]);
                    
                    if (tiktokError) {
                        console.error('🚨 Error adding TikTok video:', tiktokError);
                        showStatus('Restaurant added successfully, but failed to add TikTok video. You can add it manually.', 'warning');
                    } else {
                        console.log('✅ TikTok video added successfully as featured');
                        showStatus('Restaurant and featured TikTok video added successfully!', 'success');
                    }
                }
            } catch (tiktokError) {
                console.error('🚨 Error processing TikTok video:', tiktokError);
                showStatus('Restaurant added successfully, but failed to add TikTok video. You can add it manually.', 'warning');
            }
        } else {
            showStatus('Restaurant added successfully!', 'success');
        }
        
        // Add cuisine relationships
        const selectedCuisines = getSelectedCuisines();
        console.log('🍽️ Selected cuisines from form:', selectedCuisines);
        if (selectedCuisines.length > 0) {
            console.log('🍽️ Adding cuisine relationships:', selectedCuisines);
            await addRestaurantCuisines(restaurant.id, selectedCuisines);
        } else {
            console.log('🍽️ No cuisines selected for this restaurant');
        }
        
        // Reset form
        resetRestaurantForm();
        
        // Refresh data
        await loadDashboardData();
        await loadRecentRestaurants();
        await loadRestaurantsWithoutVideos();
        
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
    
    // Reset cuisine selection
    resetCuisineSelection();
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
    const API_KEY = CONFIG.GOOGLE_MAPS_KEYS.ADMIN_KEY;
    
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
async function searchWithLegacyAPI(restaurantName, statusEl, formType = 'create') {
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
                    
                    displayLocationOptions(sortedResults.slice(0, 15), formType); // Show top 15 results
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
async function extractLocationFromUrl(url, statusEl, formType = 'create') {
    // Handle Google Share links (like share.google/...)
    if (url.includes('share.google') || url.includes('goo.gl') || url.includes('maps.app.goo.gl')) {
        console.log('Detected Google Share link, following redirect...');
        await handleShareLink(url, statusEl, formType);
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
        await getPlaceFromId(placeId, statusEl, formType);
    } else if (lat && lng) {
        // Use coordinates for reverse geocoding
        await reverseGeocode(lat, lng, statusEl, formType);
    } else {
        throw new Error('Could not extract coordinates or place ID from URL. Please try using the "Find on Map" button instead.');
    }
}

// Handle Google Share links by following redirects
async function handleShareLink(shareUrl, statusEl, formType = 'create') {
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
            await extractLocationFromUrl(finalUrl, statusEl, formType);
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
async function getPlaceFromId(placeId, statusEl, formType = 'create') {
    try {
        // Try new Places API first
        const API_KEY = CONFIG.GOOGLE_MAPS_KEYS.ADMIN_KEY;
        
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
            
            selectLocation(convertedPlace, formType);
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
                    selectLocation(place, formType);
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
async function reverseGeocode(lat, lng, statusEl, formType = 'create') {
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
                }, formType);
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
function displayLocationOptions(places, formType = 'create') {
    const resultsDiv = document.getElementById(formType === 'edit' ? 'edit-location-results' : 'location-results');
    const optionsDiv = document.getElementById(formType === 'edit' ? 'edit-location-options' : 'location-options');
    
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
                 onclick="selectLocation(${JSON.stringify(place).replace(/"/g, '&quot;')}, '${formType}')">
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
function selectLocation(place, formType = 'create') {
    const lat = typeof place.geometry.location.lat === 'function' 
        ? place.geometry.location.lat() 
        : place.geometry.location.lat;
    const lng = typeof place.geometry.location.lng === 'function' 
        ? place.geometry.location.lng() 
        : place.geometry.location.lng;
    
    // Fill hidden form fields
    const latField = formType === 'edit' ? 'edit-restaurant-lat' : 'restaurant-lat';
    const lonField = formType === 'edit' ? 'edit-restaurant-lon' : 'restaurant-lon';
    const placeIdField = formType === 'edit' ? 'edit-google-place-id' : 'google-place-id';
    const mapsUrlField = formType === 'edit' ? 'edit-google-maps-url' : 'google-maps-url';
    
    document.getElementById(latField).value = lat;
    document.getElementById(lonField).value = lng;
    document.getElementById(placeIdField).value = place.place_id || '';
    
    // Fill Google Maps URL field
    if (place.place_id) {
        // Use Google Maps Place URL format
        const googleMapsUrl = `https://maps.google.com/?cid=${place.place_id}`;
        document.getElementById(mapsUrlField).value = googleMapsUrl;
    } else {
        // Fallback to coordinates-based URL
        const googleMapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        document.getElementById(mapsUrlField).value = googleMapsUrl;
    }
    
    // Update selected location display
    const nameField = formType === 'edit' ? 'edit-selected-name' : 'selected-name';
    const addressField = formType === 'edit' ? 'edit-selected-address' : 'selected-address';
    const coordsField = formType === 'edit' ? 'edit-selected-coordinates' : 'selected-coordinates';
    
    document.getElementById(nameField).textContent = place.name;
    document.getElementById(addressField).textContent = place.formatted_address;
    document.getElementById(coordsField).textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Show selected location info
    const selectedLocationDiv = formType === 'edit' ? 'edit-selected-location' : 'selected-location';
    const resultsDiv = formType === 'edit' ? 'edit-location-results' : 'location-results';
    
    document.getElementById(selectedLocationDiv).classList.remove('hidden');
    document.getElementById(resultsDiv).classList.add('hidden');
    
    // Enable submit button (only for create form)
    if (formType === 'create') {
        document.getElementById('submit-restaurant-btn').disabled = false;
    }
    
    // Update status
    const statusEl = document.getElementById(formType === 'edit' ? 'edit-location-status' : 'location-status');
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
        const authorHandle = extractTikTokCreatorHandle(tiktokUrl);
        
        if (!videoId) {
            showStatus('Invalid TikTok URL - could not extract video ID', 'error');
            return;
        }
        
        const embedHtml = `<blockquote class="tiktok-embed" cite="${tiktokUrl}" data-video-id="${videoId}" style="width: 330px; height: 585px; margin: 0; visibility: hidden; position: absolute; top: -9999px; left: -9999px;"><section></section></blockquote>`;
        
        console.log('🎬 Attempting to insert TikTok with data:', {
            restaurant_id: parseInt(restaurantId),
            embed_html: embedHtml,
            is_featured: isFeatured,
            author_handle: authorHandle
        });

        const { error } = await supabaseClient
            .from('tiktoks')
            .insert([{
                restaurant_id: parseInt(restaurantId),
                embed_html: embedHtml,
                is_featured: isFeatured,
                author_handle: authorHandle
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
            resultsContainer.innerHTML = '<div class="p-3 text-sm text-gray-500">No restaurants found for your selected filters. Try clearing your selection.</div>';
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

function extractTikTokCreatorHandle(url) {
    // Extract the creator handle from TikTok URL
    // Example: https://www.tiktok.com/@cajapanesepancakes/video/7294745895676022048
    // Should return: @cajapanesepancakes
    const match = url.match(/tiktok\.com\/(@[^\/]+)/);
    return match ? match[1] : null;
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
        type === 'warning' ? 'bg-yellow-500 text-white' :
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


// Video Management Functions

// Load restaurants with their videos for management
async function loadVideosForManagement() {
    try {
        console.log('Loading restaurants with videos for management...');
        
        // First, get all restaurants
        const { data: restaurants, error: restaurantsError } = await supabaseClient
            .from('restaurants')
            .select(`
                *,
                cities (name),
                restaurant_cuisines (
                    cuisines (name)
                )
            `)
            .order('created_at', { ascending: false });

        if (restaurantsError) throw restaurantsError;

        console.log('Restaurants loaded:', restaurants);

        // Then, get all videos
        const { data: videos, error: videosError } = await supabaseClient
            .from('tiktoks')
            .select('*')
            .order('created_at', { ascending: false });

        if (videosError) throw videosError;

        console.log('Videos loaded:', videos);

        // Group videos by restaurant ID
        const videosByRestaurant = {};
        videos.forEach(video => {
            if (!videosByRestaurant[video.restaurant_id]) {
                videosByRestaurant[video.restaurant_id] = [];
            }
            videosByRestaurant[video.restaurant_id].push(video);
        });

        // Create restaurant groups with their videos
        const restaurantGroups = restaurants.map(restaurant => ({
            restaurant: restaurant,
            videos: videosByRestaurant[restaurant.id] || []
        }));

        console.log('Restaurant groups:', restaurantGroups);

        // Populate city filter
        const cityFilter = document.getElementById('video-city-filter-manage');
        if (cityFilter) {
            const cities = [...new Set(restaurants.map(r => r.cities.name))];
            cityFilter.innerHTML = '<option value="">All Cities</option>' + 
                cities.map(city => `<option value="${city}">${city}</option>`).join('');
        }

        displayRestaurantVideoGroups(restaurantGroups);
    } catch (error) {
        console.error('Error loading restaurants and videos:', error);
        showStatus('Failed to load restaurants and videos: ' + error.message, 'error');
        
        // Show error message in the videos list container
        const container = document.getElementById('videos-list');
        if (container) {
            container.innerHTML = `<p class="text-red-500 text-center py-8">Error loading data: ${error.message}</p>`;
        }
    }
    
    // Ensure the section is visible by adding a loading message if empty
    const container = document.getElementById('videos-list');
    if (container && container.innerHTML.trim() === '') {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Loading restaurants...</p>';
    }
}

// Display restaurant groups with their videos
function displayRestaurantVideoGroups(restaurantGroups) {
    console.log('Displaying restaurant video groups:', restaurantGroups);
    
    const container = document.getElementById('videos-list');
    if (!container) {
        console.error('Videos list container not found!');
        return;
    }

    console.log('Restaurant groups array:', restaurantGroups);
    
    if (restaurantGroups.length === 0) {
        console.log('No restaurants found, showing empty message');
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No restaurants found</p>';
        return;
    }

    // Clear the container first
    container.innerHTML = '';
    
    // Create each restaurant group as a separate element
    restaurantGroups.forEach(group => {
        const restaurant = group.restaurant;
        const videos = group.videos;
        
        const restaurantDiv = document.createElement('div');
        restaurantDiv.className = 'border border-gray-300 rounded-lg p-4 mb-6 bg-gray-50';
        restaurantDiv.setAttribute('data-restaurant-group', restaurant.id);
        
        // Show video count and status
        const videoCountText = videos.length === 0 ? 'No videos' : `${videos.length} video${videos.length !== 1 ? 's' : ''}`;
        const videoStatusClass = videos.length === 0 ? 'text-red-500' : 'text-gray-500';
        
        restaurantDiv.innerHTML = `
            <!-- Restaurant Header -->
            <div class="flex justify-between items-start mb-4">
                <div class="flex-1">
                    <h3 class="text-xl font-bold text-gray-900 mb-1">${restaurant.name}</h3>
                    <p class="text-sm text-gray-600">${restaurant.cities.name}</p>
                    <p class="text-xs ${videoStatusClass} mt-1">${videoCountText}</p>
                </div>
                <div class="flex space-x-2">
                    <button onclick="editRestaurant(${restaurant.id})" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1">
                        <span style="font-size: 12px; line-height: 1;">✏️</span> Edit Restaurant
                    </button>
                    <button onclick="deleteRestaurant(${restaurant.id}, '${restaurant.name}')" 
                            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1">
                        <span style="font-size: 12px; line-height: 1;">🗑️</span> Delete Restaurant
                    </button>
                </div>
            </div>
            
            <!-- Videos for this restaurant -->
            <div class="space-y-3" id="videos-for-restaurant-${restaurant.id}">
            </div>
        `;
        
        // Add the restaurant div to the container
        container.appendChild(restaurantDiv);
        
        // Now add videos to this restaurant
        const videosContainer = restaurantDiv.querySelector(`#videos-for-restaurant-${restaurant.id}`);
        
        if (videos.length === 0) {
            // Show message for restaurants without videos
            const noVideosDiv = document.createElement('div');
            noVideosDiv.className = 'border border-dashed border-gray-300 rounded-lg p-4 bg-white text-center';
            noVideosDiv.innerHTML = `
                <div class="text-gray-500 mb-2">
                    <span class="text-2xl" style="font-size: 24px; line-height: 1;">📹</span>
                </div>
                <p class="text-sm text-gray-600 mb-3">No videos added yet</p>
                <button onclick="addVideoToRestaurant(${restaurant.id}, '${restaurant.name}')" 
                        class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 mx-auto">
                    <span style="font-size: 12px; line-height: 1;">➕</span> Add Video
                </button>
            `;
            videosContainer.appendChild(noVideosDiv);
        } else {
            // Add videos
            videos.forEach(video => {
                const createdDate = new Date(video.created_at).toLocaleDateString();
                const isFeatured = video.is_featured ? '⭐ Featured' : '📹 Regular';
                
                const videoDiv = document.createElement('div');
                videoDiv.className = 'border border-gray-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow';
                videoDiv.setAttribute('data-video-id', video.id);
                
                // Create the video card content using DOM methods to avoid HTML injection issues
                const mainDiv = document.createElement('div');
                mainDiv.className = 'flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3';
                
                // Content section
                const contentDiv = document.createElement('div');
                contentDiv.className = 'flex-1 min-w-0';
                
                // Video info section
                const infoDiv = document.createElement('div');
                infoDiv.className = 'flex flex-col sm:flex-row sm:items-center gap-2 mb-2';
                
                const statusSpan = document.createElement('span');
                statusSpan.className = `text-xs px-2 py-1 rounded-full ${video.is_featured ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'} w-fit flex items-center gap-1`;
                statusSpan.innerHTML = `<span class="text-xs" style="font-size: 12px; line-height: 1;">${video.is_featured ? '⭐' : '📹'}</span> <span>${video.is_featured ? 'Featured' : 'Regular'}</span>`;
                
                const videoIdSpan = document.createElement('span');
                videoIdSpan.className = 'text-xs text-gray-500';
                // Extract video ID from embed HTML if available
                let videoId = 'N/A';
                if (video.embed_html) {
                    const idMatch = video.embed_html.match(/data-video-id="(\d+)"/);
                    if (idMatch) {
                        videoId = idMatch[1];
                    }
                }
                videoIdSpan.textContent = `Video ID: ${videoId}`;
                
                const dateSpan = document.createElement('span');
                dateSpan.className = 'text-xs text-gray-500';
                dateSpan.textContent = `Added: ${createdDate}`;
                
                infoDiv.appendChild(statusSpan);
                infoDiv.appendChild(videoIdSpan);
                infoDiv.appendChild(dateSpan);
                
                // Preview section
                const previewDiv = document.createElement('div');
                previewDiv.className = 'mt-2 p-2 bg-gray-50 rounded text-xs';
                
                const previewLabel = document.createElement('div');
                previewLabel.className = 'text-gray-600 mb-1';
                previewLabel.textContent = 'Video Preview:';
                
                const previewContent = document.createElement('div');
                previewContent.className = 'text-gray-500 font-mono break-all max-h-16 overflow-y-auto text-xs';
                previewContent.textContent = video.embed_html ? video.embed_html.substring(0, 150) + '...' : 'No embed HTML';
                
                previewDiv.appendChild(previewLabel);
                previewDiv.appendChild(previewContent);
                
                contentDiv.appendChild(infoDiv);
                contentDiv.appendChild(previewDiv);
                
                // Buttons section
                const buttonsDiv = document.createElement('div');
                buttonsDiv.className = 'flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-1 flex-shrink-0';
                
                // Edit button
                const editBtn = document.createElement('button');
                editBtn.className = 'bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap';
                editBtn.innerHTML = '<span style="font-size: 12px; line-height: 1;">✏️</span> Edit';
                editBtn.onclick = () => editVideo(video.id);
                
                // Feature button
                const featureBtn = document.createElement('button');
                featureBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap';
                featureBtn.textContent = video.is_featured ? '⭐ Unfeature' : '⭐ Feature';
                featureBtn.onclick = () => toggleVideoFeatured(video.id, video.is_featured);
                
                // Delete button
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap';
                deleteBtn.innerHTML = '<span style="font-size: 12px; line-height: 1;">🗑️</span> Delete';
                deleteBtn.onclick = () => deleteVideo(video.id, restaurant.name);
                
                buttonsDiv.appendChild(editBtn);
                buttonsDiv.appendChild(featureBtn);
                buttonsDiv.appendChild(deleteBtn);
                
                mainDiv.appendChild(contentDiv);
                mainDiv.appendChild(buttonsDiv);
                
                videoDiv.appendChild(mainDiv);
                
                videosContainer.appendChild(videoDiv);
            });
        }
    });
}

// Edit video function
async function editVideo(videoId) {
    try {
        // Fetch video details
        const { data: video, error } = await supabaseClient
            .from('tiktoks')
            .select(`
                *,
                restaurants (
                    name,
                    cities (name)
                )
            `)
            .eq('id', videoId)
            .single();

        if (error) throw error;

        // Create edit modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Edit TikTok Video</h3>
                    
                    <form id="edit-video-form" class="space-y-4">
                        <input type="hidden" id="edit-video-id" value="${video.id}">
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Restaurant</label>
                            <input type="text" value="${video.restaurants.name} (${video.restaurants.cities.name})" disabled
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">TikTok Video URL</label>
                            <input type="url" id="edit-video-url" placeholder="https://www.tiktok.com/@username/video/1234567890"
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <p class="text-xs text-gray-500 mt-1">Enter the full TikTok video URL. The embed code will be generated automatically.</p>
                        </div>
                        
                        <div class="flex items-center">
                            <input type="checkbox" id="edit-is-featured" ${video.is_featured ? 'checked' : ''}
                                   class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                            <label for="edit-is-featured" class="ml-2 block text-sm text-gray-900">
                                Featured Video
                            </label>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4">
                            <button type="button" onclick="closeEditVideoModal()" 
                                    class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Extract URL from existing embed HTML and populate the form
        const urlInput = document.getElementById('edit-video-url');
        if (video.embed_html) {
            const urlMatch = video.embed_html.match(/cite="([^"]+)"/);
            if (urlMatch) {
                urlInput.value = urlMatch[1];
            }
        }
        
        // Set up form submission
        document.getElementById('edit-video-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveVideoChanges(videoId);
        });
        
    } catch (error) {
        console.error('Error editing video:', error);
        showStatus('Failed to load video details: ' + error.message, 'error');
    }
}

// Save video changes
async function saveVideoChanges(videoId) {
    try {
        const videoUrl = document.getElementById('edit-video-url').value;
        
        if (!videoUrl) {
            showStatus('Please enter a TikTok video URL', 'error');
            return;
        }

        // Generate embed HTML from URL
        const embedHtml = generateTikTokEmbed(videoUrl);
        
        const formData = {
            embed_html: embedHtml,
            is_featured: document.getElementById('edit-is-featured').checked
        };

        const { error } = await supabaseClient
            .from('tiktoks')
            .update(formData)
            .eq('id', videoId);

        if (error) throw error;

        showStatus('Video updated successfully!', 'success');
        closeEditVideoModal();
        await loadVideosForManagement();
        
    } catch (error) {
        console.error('Error updating video:', error);
        showStatus('Failed to update video: ' + error.message, 'error');
    }
}

// Generate TikTok embed HTML from URL
function generateTikTokEmbed(url) {
    // Extract video ID from TikTok URL
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    if (!videoIdMatch) {
        throw new Error('Invalid TikTok URL format');
    }
    
    const videoId = videoIdMatch[1];
    
    // Generate the embed HTML
    return `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${videoId}" style="max-width: 605px; min-width: 325px; position: relative; overflow: hidden;">
        <section>
            <a target="_blank" title="@username" href="${url}">@username</a>
        </section>
    </blockquote>
    <script async src="https://www.tiktok.com/embed.js"></script>`;
}

// Toggle video featured status
async function toggleVideoFeatured(videoId, currentStatus) {
    try {
        const { error } = await supabaseClient
            .from('tiktoks')
            .update({ is_featured: !currentStatus })
            .eq('id', videoId);

        if (error) throw error;

        showStatus(`Video ${!currentStatus ? 'featured' : 'unfeatured'} successfully!`, 'success');
        await loadVideosForManagement();
        
    } catch (error) {
        console.error('Error toggling video featured status:', error);
        showStatus('Failed to update video status: ' + error.message, 'error');
    }
}

// Delete video function
async function deleteVideo(videoId, restaurantName) {
    if (!confirm(`Are you sure you want to delete the video for "${restaurantName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('tiktoks')
            .delete()
            .eq('id', videoId);

        if (error) throw error;

        showStatus('Video deleted successfully!', 'success');
        await loadVideosForManagement();
        
    } catch (error) {
        console.error('Error deleting video:', error);
        showStatus('Failed to delete video: ' + error.message, 'error');
    }
}

// Close edit video modal
function closeEditVideoModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) {
        modal.remove();
    }
}

// Filter videos based on search and city filter
function filterVideos() {
    const searchTerm = document.getElementById('video-search-manage').value.toLowerCase();
    const cityFilter = document.getElementById('video-city-filter-manage').value;
    
    const restaurantGroups = document.querySelectorAll('[data-restaurant-group]');
    
    restaurantGroups.forEach(group => {
        const restaurantName = group.querySelector('h3').textContent.toLowerCase();
        const cityName = group.querySelector('p').textContent.toLowerCase();
        
        const matchesSearch = restaurantName.includes(searchTerm);
        const matchesCity = !cityFilter || cityName.includes(cityFilter.toLowerCase());
        
        if (matchesSearch && matchesCity) {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
        }
    });
}

// Restaurant Management Functions (needed for video management section)

// Edit restaurant function
async function editRestaurant(restaurantId) {
    try {
        // Fetch restaurant details
        const { data: restaurant, error } = await supabaseClient
            .from('restaurants')
            .select(`
                *,
                cities (name),
                restaurant_cuisines (
                    cuisines (name)
                )
            `)
            .eq('id', restaurantId)
            .single();

        if (error) throw error;

        // Get current cuisines for this restaurant
        const currentCuisines = restaurant.restaurant_cuisines ? 
            restaurant.restaurant_cuisines.map(rc => rc.cuisines.name) : [];

        // Create edit modal with similar UI to create form
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-0 mx-auto p-5 border w-full h-full shadow-lg rounded-md bg-white overflow-y-auto">
                <div class="mt-3">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Edit Restaurant</h3>
                        <button type="button" onclick="closeEditModal()" 
                                class="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                            ×
                        </button>
                    </div>
                    
                    <form id="edit-restaurant-form" class="space-y-4">
                        <input type="hidden" id="edit-restaurant-id" value="${restaurant.id}">
                        
                        <!-- Restaurant Name and Find Button -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
                                <input type="text" id="edit-restaurant-name" value="${restaurant.name}" required
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div class="flex flex-col justify-end">
                                <button type="button" id="edit-find-on-map-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                    <span style="font-size: 16px; line-height: 1;">🗺️</span>
                                    Find on Map
                                </button>
                            </div>
                        </div>

                        <!-- Alternative: Google Maps URL -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Google Maps URL (Alternative)</label>
                            <div class="flex gap-2">
                                <input type="url" id="edit-google-maps-url" value="${restaurant.google_maps_url || ''}" placeholder="https://maps.google.com/... or Google Place URL"
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <button type="button" id="edit-extract-from-url-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                                    Extract
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Paste a Google Maps URL to automatically extract location data</p>
                        </div>

                        <!-- City Selection -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <select id="edit-restaurant-city" required
                                        class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">Select City</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <div id="edit-location-status" class="px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-300 rounded-md">
                                    Location: ${restaurant.lat.toFixed(6)}, ${restaurant.lon.toFixed(6)}
                                </div>
                            </div>
                        </div>

                        <!-- Description -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea id="edit-restaurant-description" placeholder="Brief description of the restaurant" rows="2"
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">${restaurant.description || ''}</textarea>
                        </div>

                        <!-- Cuisine Selection -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-3">Cuisines (Select all that apply)</label>
                            <div id="edit-cuisine-selection" class="border border-gray-200 rounded-lg p-4 space-y-4">
                                <!-- Cuisine buttons will be populated here -->
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Click cuisines to select/deselect. Selected cuisines will be highlighted in blue.</p>
                        </div>

                        <!-- Location Results (Initially Hidden) -->
                        <div id="edit-location-results" class="hidden">
                            <h4 class="text-sm font-medium text-gray-700 mb-2">Found Locations (Click to Select):</h4>
                            <div id="edit-location-options" class="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                                <!-- Location options will appear here -->
                            </div>
                        </div>

                        <!-- Selected Location Info (Initially Hidden) -->
                        <div id="edit-selected-location" class="hidden">
                            <div class="p-4 bg-green-50 border border-green-200 rounded-md">
                                <h4 class="text-sm font-medium text-green-800 mb-2">✅ Selected Location:</h4>
                                <div class="text-sm text-green-700">
                                    <div><strong>Name:</strong> <span id="edit-selected-name"></span></div>
                                    <div><strong>Address:</strong> <span id="edit-selected-address"></span></div>
                                    <div><strong>Coordinates:</strong> <span id="edit-selected-coordinates"></span></div>
                                </div>
                            </div>
                        </div>

                        <!-- Hidden fields for form submission -->
                        <input type="hidden" id="edit-restaurant-lat" value="${restaurant.lat}">
                        <input type="hidden" id="edit-restaurant-lon" value="${restaurant.lon}">
                        <input type="hidden" id="edit-google-place-id" value="${restaurant.google_place_id || ''}">
                        
                        <div class="flex justify-end space-x-3 pt-4">
                            <button type="button" onclick="closeEditModal()" 
                                    class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate city dropdown
        await populateCityDropdown('edit-restaurant-city', restaurant.city_id);
        
        // Populate cuisine selection
        await populateEditCuisineSelection(currentCuisines);
        
        // Set up event listeners for edit form
        setupEditFormEventListeners();
        
        // Set up cuisine selection after a short delay to ensure DOM is ready
        setTimeout(() => {
            console.log('🍽️ Setting up edit cuisine selection after delay...');
            setupEditCuisineSelection();
        }, 200);
        
        // Set up form submission
        document.getElementById('edit-restaurant-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🍽️ Edit form submitted, calling saveRestaurantChanges...');
            await saveRestaurantChanges(restaurantId);
        });
        
    } catch (error) {
        console.error('Error editing restaurant:', error);
        showStatus('Failed to load restaurant details: ' + error.message, 'error');
    }
}

// Save restaurant changes
async function saveRestaurantChanges(restaurantId) {
    try {
        const formData = {
            name: document.getElementById('edit-restaurant-name').value,
            description: document.getElementById('edit-restaurant-description').value,
            lat: parseFloat(document.getElementById('edit-restaurant-lat').value),
            lon: parseFloat(document.getElementById('edit-restaurant-lon').value),
            city_id: parseInt(document.getElementById('edit-restaurant-city').value),
            google_place_id: document.getElementById('edit-google-place-id').value || null,
            google_maps_url: document.getElementById('edit-google-maps-url').value || null
        };

        const { error } = await supabaseClient
            .from('restaurants')
            .update(formData)
            .eq('id', restaurantId);

        if (error) throw error;

        // Update cuisine relationships
        const selectedCuisines = getSelectedEditCuisines();
        console.log('🍽️ Edit form selected cuisines:', selectedCuisines);
        
        if (selectedCuisines.length >= 0) { // Always update cuisines, even if none selected
            console.log('🍽️ Deleting existing cuisine relationships for restaurant:', restaurantId);
            // First, delete existing cuisine relationships
            const { error: deleteError } = await supabaseClient
                .from('restaurant_cuisines')
                .delete()
                .eq('restaurant_id', restaurantId);
                
            if (deleteError) {
                console.error('Error deleting existing cuisine relationships:', deleteError);
            } else {
                console.log('✅ Successfully deleted existing cuisine relationships');
            }
            
            // Then add new ones if any selected
            if (selectedCuisines.length > 0) {
                console.log('🍽️ Adding new cuisine relationships:', selectedCuisines);
                await addRestaurantCuisines(restaurantId, selectedCuisines);
            } else {
                console.log('🍽️ No cuisines selected, restaurant will have no cuisine relationships');
            }
        }

        showStatus('Restaurant updated successfully!', 'success');
        closeEditModal();
        await loadVideosForManagement();
        
    } catch (error) {
        console.error('Error updating restaurant:', error);
        showStatus('Failed to update restaurant: ' + error.message, 'error');
    }
}

// Populate cuisine selection for edit form
async function populateEditCuisineSelection(currentCuisines) {
    console.log('🍽️ Populating edit cuisine selection with current cuisines:', currentCuisines);
    // The container ID inside the edit modal is 'edit-cuisine-selection'
    await loadAndDisplayCuisines('edit-cuisine-selection', currentCuisines);
}

// Set up cuisine selection for edit form
function setupEditCuisineSelection() {
    console.log('🍽️ Setting up edit cuisine selection...');
    const cuisineButtons = document.querySelectorAll('.edit-cuisine-btn');
    console.log('🍽️ Found edit cuisine buttons:', cuisineButtons.length);
    
    cuisineButtons.forEach((button, index) => {
        // Remove any existing event listeners
        button.replaceWith(button.cloneNode(true));
    });
    
    // Re-query after cloning to get fresh elements
    const freshButtons = document.querySelectorAll('.edit-cuisine-btn');
    console.log('🍽️ Fresh edit cuisine buttons:', freshButtons.length);
    
    freshButtons.forEach((button, index) => {
        // Add a simple click test first
        button.addEventListener('click', (e) => {
            console.log('🍽️ BUTTON CLICKED!', button.dataset.cuisine, 'Current classes:', button.className);
        });
        
        button.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🍽️ Edit cuisine button clicked:', button.dataset.cuisine);
            
            // Toggle selection
            if (button.classList.contains('selected')) {
                // Deselect
                button.classList.remove('selected');
                // Restore original styling from data attributes
                const bgColor = button.dataset.bgColor || '#E5E7EB';
                const textColor = button.dataset.textColor || '#1F2937';
                button.style.backgroundColor = bgColor;
                button.style.color = textColor;
                console.log('🍽️ Deselected edit cuisine:', button.dataset.cuisine);
            } else {
                // Select
                button.classList.add('selected');
                button.style.backgroundColor = '#3B82F6';
                button.style.color = 'white';
                console.log('🍽️ Selected edit cuisine:', button.dataset.cuisine);
            }
            
            // Debug: Show current selection
            const selectedCuisines = getSelectedEditCuisines();
            console.log('🍽️ Currently selected edit cuisines:', selectedCuisines);
        });
    });
}



// Get selected cuisines from edit form
function getSelectedEditCuisines() {
    const selectedButtons = document.querySelectorAll('#edit-cuisine-selection .cuisine-btn.selected');
    const cuisines = Array.from(selectedButtons).map(btn => btn.dataset.cuisine);
    console.log('🍽️ getSelectedEditCuisines() called, found:', cuisines);
    return cuisines;
}

// Debug function to test edit cuisine selection
function debugEditCuisineSelection() {
    console.log('🍽️ Debug: Edit cuisine selection status');
    console.log('🍽️ Total edit cuisine buttons:', document.querySelectorAll('#edit-cuisine-selection .cuisine-btn').length);
    console.log('🍽️ Selected edit cuisine buttons:', document.querySelectorAll('#edit-cuisine-selection .cuisine-btn.selected').length);
    console.log('🍽️ Selected cuisines:', getSelectedEditCuisines());
    
    // Test clicking a button
    const firstButton = document.querySelector('#edit-cuisine-selection .cuisine-btn');
    if (firstButton) {
        console.log('🍽️ Testing click on first button:', firstButton.dataset.cuisine);
        firstButton.click();
        console.log('🍽️ After click - selected cuisines:', getSelectedEditCuisines());
    }
}

// Set up event listeners for edit form
function setupEditFormEventListeners() {
    // Find on Map button
    document.getElementById('edit-find-on-map-btn').addEventListener('click', handleEditFindOnMap);
    
    // Extract from URL button
    document.getElementById('edit-extract-from-url-btn').addEventListener('click', handleEditExtractFromUrl);
}

// Handle Find on Map for edit form
async function handleEditFindOnMap() {
    const restaurantName = document.getElementById('edit-restaurant-name').value.trim();
    
    if (!restaurantName) {
        showStatus('Please enter a restaurant name first', 'error');
        return;
    }
    
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
        showStatus('Google Maps API not loaded. Please check your API key.', 'error');
        return;
    }
    
    const statusEl = document.getElementById('edit-location-status');
    statusEl.textContent = 'Searching...';
    statusEl.className = 'px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-300 rounded-md';
    
    try {
        // Use legacy Places API for edit form
        await searchWithLegacyAPI(restaurantName, statusEl, 'edit');
    } catch (error) {
        console.error('Error searching for location:', error);
        statusEl.textContent = 'Search failed';
        statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
        showStatus('Error searching for location: ' + error.message, 'error');
    }
}

// Handle Extract from URL for edit form
async function handleEditExtractFromUrl() {
    const url = document.getElementById('edit-google-maps-url').value.trim();
    
    if (!url) {
        showStatus('Please enter a Google Maps URL first', 'error');
        return;
    }
    
    const statusEl = document.getElementById('edit-location-status');
    statusEl.textContent = 'Extracting from URL...';
    statusEl.className = 'px-3 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-300 rounded-md';
    
    try {
        // Check if Google Maps API is loaded
        if (typeof google === 'undefined' || !google.maps) {
            throw new Error('Google Maps API not loaded. Please check your API key.');
        }
        
        await extractLocationFromUrl(url, statusEl, 'edit');
        
    } catch (error) {
        console.error('Error extracting from URL:', error);
        statusEl.textContent = 'URL extraction failed';
        statusEl.className = 'px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-300 rounded-md';
        showStatus('Error extracting from URL: ' + error.message, 'error');
    }
}

// Delete restaurant function
async function deleteRestaurant(restaurantId, restaurantName) {
    if (!confirm(`Are you sure you want to delete "${restaurantName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        // First delete related records
        await supabaseClient
            .from('restaurant_cuisines')
            .delete()
            .eq('restaurant_id', restaurantId);

        await supabaseClient
            .from('tiktoks')
            .delete()
            .eq('restaurant_id', restaurantId);

        // Then delete the restaurant
        const { error } = await supabaseClient
            .from('restaurants')
            .delete()
            .eq('id', restaurantId);

        if (error) throw error;

        showStatus('Restaurant deleted successfully!', 'success');
        await loadVideosForManagement();
        
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        showStatus('Failed to delete restaurant: ' + error.message, 'error');
    }
}

// Close edit modal
function closeEditModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) {
        modal.remove();
    }
}

// Populate city dropdown for edit form
async function populateCityDropdown(selectId, selectedCityId = null) {
    try {
        const { data: cities, error } = await supabaseClient
            .from('cities')
            .select('id, name')
            .order('name');

        if (error) throw error;

        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select City</option>' + 
            cities.map(city => 
                `<option value="${city.id}" ${city.id === selectedCityId ? 'selected' : ''}>${city.name}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

// Add video to restaurant function
function addVideoToRestaurant(restaurantId, restaurantName) {
    // Scroll to the add video section and pre-populate the restaurant search
    const addVideoSection = document.querySelector('#add-tiktok-form');
    if (addVideoSection) {
        addVideoSection.scrollIntoView({ behavior: 'smooth' });
        const restaurantSearch = document.getElementById('restaurant-search');
        if (restaurantSearch) {
            restaurantSearch.value = restaurantName;
            restaurantSearch.dispatchEvent(new Event('input'));
        }
    }
}
