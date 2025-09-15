// Admin Panel JavaScript
const SUPABASE_URL = 'https://jsuxrpnfofkigdfpnuua.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize admin panel
document.addEventListener('DOMContentLoaded', async function() {
    await loadDashboardData();
    await loadCitiesForSelect();
    await loadRecentRestaurants();
    await loadRecentTikToks();
    
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
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select(`
                id,
                name,
                description,
                created_at,
                cities (name)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
        
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
                    <p class="text-sm text-gray-600">${restaurant.cities?.name || 'Unknown City'}</p>
                    <p class="text-xs text-gray-500 mt-1">${new Date(restaurant.created_at).toLocaleDateString()}</p>
                </div>
                <button onclick="deleteRestaurant(${restaurant.id})" 
                        class="text-red-600 hover:text-red-800 text-sm ml-2">
                    Delete
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent restaurants:', error);
        showStatus('Error loading restaurants', 'error');
    }
}

// Load recent TikTok videos
async function loadRecentTikToks() {
    try {
        const { data: tiktoks, error } = await supabaseClient
            .from('tiktoks')
            .select(`
                id,
                video_url,
                title,
                is_featured,
                created_at,
                restaurants (name, id)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const container = document.getElementById('recent-tiktoks');
        
        if (tiktoks.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No TikTok videos found</div>';
            return;
        }
        
        container.innerHTML = tiktoks.map(tiktok => `
            <div class="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <h5 class="font-medium text-gray-900">${tiktok.restaurants?.name || 'Unknown Restaurant'}</h5>
                    <p class="text-sm text-gray-600">${tiktok.title || 'No title'}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-xs text-gray-500">${new Date(tiktok.created_at).toLocaleDateString()}</span>
                        ${tiktok.is_featured ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Featured</span>' : ''}
                    </div>
                </div>
                <button onclick="deleteTikTok(${tiktok.id})" 
                        class="text-red-600 hover:text-red-800 text-sm ml-2">
                    Delete
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent TikToks:', error);
        showStatus('Error loading TikTok videos', 'error');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Add restaurant form
    document.getElementById('add-restaurant-form').addEventListener('submit', handleAddRestaurant);
    
    // Add TikTok form
    document.getElementById('add-tiktok-form').addEventListener('submit', handleAddTikTok);
    
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
        await loadRecentTikToks();
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
    
    const formData = {
        name: document.getElementById('restaurant-name').value,
        description: document.getElementById('restaurant-description').value,
        lat: parseFloat(document.getElementById('restaurant-lat').value),
        lon: parseFloat(document.getElementById('restaurant-lon').value),
        city_id: parseInt(document.getElementById('restaurant-city').value)
    };
    
    try {
        // Add restaurant (no TikTok video here anymore)
        const { data: restaurant, error: restaurantError } = await supabaseClient
            .from('restaurants')
            .insert([formData])
            .select()
            .single();
        
        if (restaurantError) throw restaurantError;
        
        // Reset form
        document.getElementById('add-restaurant-form').reset();
        
        // Refresh data
        await loadDashboardData();
        await loadRecentRestaurants();
        
        showStatus('Restaurant added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding restaurant:', error);
        showStatus('Error adding restaurant: ' + error.message, 'error');
    }
}

// Handle add TikTok form submission
async function handleAddTikTok(e) {
    e.preventDefault();
    
    const restaurantId = document.getElementById('selected-restaurant-id').value;
    const tiktokUrl = document.getElementById('tiktok-url').value;
    const title = document.getElementById('tiktok-title').value;
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
        
        const { error } = await supabaseClient
            .from('tiktoks')
            .insert([{
                restaurant_id: parseInt(restaurantId),
                video_url: tiktokUrl,
                embed_html: embedHtml,
                title: title || null,
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
        await loadRecentTikToks();
        
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
        const { data, error } = await supabaseClient
            .from('restaurants')
            .select('id')
            .limit(1);
        
        const statusEl = document.getElementById('db-status');
        
        if (error) {
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
