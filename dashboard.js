// Dashboard JavaScript - Creator Dashboard
// This script handles authentication, role checking, and content management

// Import Supabase configuration
import { CONFIG } from './config.js';

// Initialize Supabase client using global supabase object
const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Global variables
let map = null;
let currentUser = null;
let userRestaurants = [];
let userTiktoks = [];

// --- REEL SUBMISSION STATE MANAGEMENT ---
let validatedTiktokUrl = null;
let selectedRestaurantId = null;
let newRestaurantData = null;

// DOM elements
let loadingState = null;
let addRestaurantBtn = null;
let myRestaurantsList = null;
let myTiktoksLoading = null;
let myTiktoksTable = null;
let logoutBtn = null;
let mobileLogoutBtn = null;
let mobileMenuBtn = null;
let mobileMenuModal = null;
let closeMobileMenu = null;

// --- REEL SUBMISSION ELEMENT SELECTORS ---
let validateTiktokBtn = null;
let tiktokUrlInput = null;
let tiktokValidationError = null;
let editableTiktokUrl = null;
let restaurantSearchInput = null;
let searchRestaurantBtn = null;
let restaurantSearchResults = null;
let restaurantSearchOptions = null;
let showNewRestaurantFormBtn = null;
let newRestaurantName = null;
let newRestaurantAddress = null;
let geocodeAddressBtn = null;
let submitReelBtn = null;
let summaryTiktokUrl = null;
let summaryRestaurantName = null;

// Restaurant form elements
let addRestaurantForm = null;
let restaurantForm = null;
let findOnMapBtn = null;
let saveRestaurantBtn = null;
let cancelRestaurantBtn = null;
let addressInput = null;
let latitudeInput = null;
let longitudeInput = null;
let geocodeStatus = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard page loaded');
    
    // Get DOM elements
    loadingState = document.getElementById('loading-state');
    addRestaurantBtn = document.getElementById('add-restaurant-btn');
    myRestaurantsList = document.getElementById('my-restaurants-list');
    myTiktoksLoading = document.getElementById('my-tiktoks-loading');
    myTiktoksTable = document.getElementById('my-tiktoks-table');
    logoutBtn = document.getElementById('logout-button');
    mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    mobileMenuModal = document.getElementById('mobile-menu-modal');
    closeMobileMenu = document.getElementById('close-mobile-menu');
    
    // Restaurant form elements
    addRestaurantForm = document.getElementById('add-restaurant-form');
    restaurantForm = document.getElementById('restaurant-form');
    findOnMapBtn = document.getElementById('find-on-map-btn');
    saveRestaurantBtn = document.getElementById('save-restaurant-btn');
    cancelRestaurantBtn = document.getElementById('cancel-restaurant-btn');
    addressInput = document.getElementById('address-input');
    latitudeInput = document.getElementById('latitude-input');
    longitudeInput = document.getElementById('longitude-input');
    geocodeStatus = document.getElementById('geocode-status');
    
    // --- REEL SUBMISSION ELEMENTS ---
    validateTiktokBtn = document.getElementById('validate-tiktok-btn');
    tiktokUrlInput = document.getElementById('tiktok-url-input');
    tiktokValidationError = document.getElementById('tiktok-validation-error');
    editableTiktokUrl = document.getElementById('editable-tiktok-url');
    restaurantSearchInput = document.getElementById('restaurant-search-input');
    searchRestaurantBtn = document.getElementById('search-restaurant-btn');
    restaurantSearchResults = document.getElementById('restaurant-search-results');
    restaurantSearchOptions = document.getElementById('restaurant-search-options');
    showNewRestaurantFormBtn = document.getElementById('show-new-restaurant-form-btn');
    newRestaurantName = document.getElementById('new-restaurant-name');
    newRestaurantAddress = document.getElementById('new-restaurant-address');
    geocodeAddressBtn = document.getElementById('geocode-address-btn');
    submitReelBtn = document.getElementById('submit-reel-btn');
    summaryTiktokUrl = document.getElementById('summary-tiktok-url');
    summaryRestaurantName = document.getElementById('summary-restaurant-name');
    
    // Setup event listeners
    setupEventListeners();
    
    // Perform security checks
    await performSecurityChecks();
    
    // If we get here, user is authenticated and has creator role
    await loadDashboard();
});

// Setup event listeners
function setupEventListeners() {
    // Logout buttons
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // Mobile menu
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenuModal) {
                mobileMenuModal.classList.remove('hidden');
                mobileMenuModal.style.display = 'flex';
            }
        });
    }
    
    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', closeMobileMenuModal);
    }
    
    if (mobileMenuModal) {
        mobileMenuModal.addEventListener('click', (e) => {
            if (e.target === mobileMenuModal) {
                closeMobileMenuModal();
            }
        });
    }
    
    // Add restaurant button
    if (addRestaurantBtn) {
        addRestaurantBtn.addEventListener('click', showAddRestaurantForm);
    }
    
    // Restaurant form buttons
    if (findOnMapBtn) {
        findOnMapBtn.addEventListener('click', handleFindOnMap);
    }
    
    if (saveRestaurantBtn) {
        saveRestaurantBtn.addEventListener('click', handleSaveRestaurant);
    }
    
    if (cancelRestaurantBtn) {
        cancelRestaurantBtn.addEventListener('click', hideAddRestaurantForm);
    }
    
    // --- REEL SUBMISSION EVENT LISTENERS ---
    
    // 1. Validate TikTok URL
    if (validateTiktokBtn) {
        validateTiktokBtn.addEventListener('click', handleValidateTiktok);
    }
    
    // 2. Search for Restaurants
    if (searchRestaurantBtn) {
        searchRestaurantBtn.addEventListener('click', handleRestaurantSearch);
    }
    
    // Also allow Enter key in search input
    if (restaurantSearchInput) {
        restaurantSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRestaurantSearch();
            }
        });
    }
    
    // 3. Show new restaurant form
    if (showNewRestaurantFormBtn) {
        showNewRestaurantFormBtn.addEventListener('click', showNewRestaurantForm);
    }
    
    // 4. Geocode new restaurant address
    if (geocodeAddressBtn) {
        geocodeAddressBtn.addEventListener('click', handleGeocodeNewRestaurant);
    }
    
    // 5. Final submission
    if (submitReelBtn) {
        submitReelBtn.addEventListener('click', handleSubmitReel);
    }
    
    // 6. Editable TikTok URL change
    if (editableTiktokUrl) {
        editableTiktokUrl.addEventListener('input', handleEditableUrlChange);
    }
}

// Close mobile menu modal
function closeMobileMenuModal() {
    if (mobileMenuModal) {
        mobileMenuModal.classList.add('hidden');
        mobileMenuModal.style.display = 'none';
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Logout error:', error);
        } else {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Security checks - this is the "security guard"
async function performSecurityChecks() {
    console.log('Performing security checks...');
    
    try {
        // Check 1: Is the user logged in?
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError) {
            console.error('Error getting user:', userError);
            redirectToHomepage();
            return;
        }
        
        if (!user) {
            console.log('No user found, redirecting to homepage');
            redirectToHomepage();
            return;
        }
        
        console.log('User is logged in:', user.email);
        currentUser = user;
        
        // Check 2: Does the user have the 'creator' role?
        const { data: userRole, error: roleError } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
        
        if (roleError) {
            console.error('Error checking user role:', roleError);
            redirectToHomepage();
            return;
        }
        
        if (!userRole || userRole.role !== 'creator') {
            console.log('User does not have creator role, redirecting to homepage');
            console.log('User role found:', userRole);
            redirectToHomepage();
            return;
        }
        
        console.log('User has creator role, proceeding with dashboard');
        
    } catch (error) {
        console.error('Error in security checks:', error);
        redirectToHomepage();
    }
}

// Redirect to homepage
function redirectToHomepage() {
    console.log('Redirecting to homepage...');
    window.location.href = '/';
}

// Load dashboard content
async function loadDashboard() {
    console.log('Loading dashboard content...');
    
    try {
        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        // Load user's restaurants
        await loadUserRestaurants();

        // Load user's TikToks
        await loadUserTiktoks();

        // Initialize map
        await initializeMap();
        
        console.log('Dashboard loaded successfully');
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        alert('Error loading dashboard. Please refresh the page.');
    }
}

// Load user's restaurants
async function loadUserRestaurants() {
    console.log('Loading user restaurants...');

    try {
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select('*')
            .eq('submitted_by_user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading restaurants:', error);
            return;
        }

        userRestaurants = restaurants || [];
        console.log('Loaded restaurants:', userRestaurants.length);

        // Display restaurants
        displayRestaurants();

    } catch (error) {
        console.error('Error loading restaurants:', error);
    }
}

// Load user's TikToks
async function loadUserTiktoks() {
    console.log('Loading user TikToks...');

    if (!myTiktoksLoading || !myTiktoksTable) return;

    try {
        // Show loading state
        myTiktoksLoading.classList.remove('hidden');

        // Query TikToks with restaurant information
        const { data: tiktoks, error } = await supabaseClient
            .from('tiktoks')
            .select(`
                id,
                embed_html,
                author_handle,
                created_at,
                is_featured,
                restaurant_id,
                restaurants (
                    id,
                    name,
                    city,
                    lat,
                    lon
                )
            `)
            .eq('submitted_by_user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading TikToks:', error);
            showTiktoksError('Error loading TikToks: ' + error.message);
            return;
        }

        userTiktoks = tiktoks || [];
        console.log('Loaded TikToks:', userTiktoks.length);

        // Display TikToks
        displayTiktoks();

    } catch (error) {
        console.error('Error loading TikToks:', error);
        showTiktoksError('Error loading TikToks: ' + error.message);
    } finally {
        // Hide loading state
        myTiktoksLoading.classList.add('hidden');
    }
}

// Display restaurants in the list
function displayRestaurants() {
    if (!myRestaurantsList) return;

    if (userRestaurants.length === 0) {
        myRestaurantsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p class="text-lg mb-2">No restaurants added yet</p>
                <p class="text-sm">Click "Add New Restaurant" to get started!</p>
            </div>
        `;
        return;
    }

    myRestaurantsList.innerHTML = userRestaurants.map(restaurant => `
        <div class="restaurant-card" data-restaurant-id="${restaurant.id}">
            <h3 class="text-lg font-semibold">${restaurant.name}</h3>
            <p class="text-gray-600">${restaurant.city || 'No city provided'}</p>
            <p class="text-gray-500 text-sm">Added: ${new Date(restaurant.created_at).toLocaleDateString()}</p>
            <div class="restaurant-actions">
                <button class="btn-edit" onclick="editRestaurant('${restaurant.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteRestaurant('${restaurant.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

// Display TikToks in the table
function displayTiktoks() {
    if (!myTiktoksTable) return;

    if (userTiktoks.length === 0) {
        myTiktoksTable.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <p class="text-lg mb-2">No TikToks submitted yet</p>
                <p class="text-sm">Use "Add a New Reel" above to submit your first TikTok!</p>
            </div>
        `;
        return;
    }

    myTiktoksTable.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            TikTok Video
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Restaurant
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Submitted
                        </th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${userTiktoks.map(tiktok => {
                        const restaurant = tiktok.restaurants;
                        const createdDate = new Date(tiktok.created_at).toLocaleDateString();
                        const isFeatured = tiktok.is_featured ? 'Featured' : 'Standard';

                        return `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="tiktok-embed-container" style="width: 200px; height: 120px; overflow: hidden; border-radius: 8px;">
                                        ${tiktok.embed_html}
                                    </div>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="text-sm font-medium text-gray-900">${restaurant?.name || 'Restaurant not found'}</div>
                                    <div class="text-sm text-gray-500">${tiktok.author_handle || 'Unknown creator'}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="text-sm text-gray-900">${restaurant?.city || 'No location'}</div>
                                    ${restaurant?.lat && restaurant?.lon ? `
                                        <div class="text-xs text-gray-500">
                                            ${restaurant.lat.toFixed(4)}, ${restaurant.lon.toFixed(4)}
                                        </div>
                                    ` : ''}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    ${createdDate}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tiktok.is_featured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                        ${isFeatured}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Show the table
    myTiktoksTable.classList.remove('hidden');
}

// Initialize map
async function initializeMap() {
    console.log('Initializing map...');
    
    try {
        // Initialize map centered on a default location (you can adjust this)
        map = L.map('map').setView([51.505, -0.09], 13);
        
        // Add tile layer - using same style as rest of website
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
        
        // Add markers for user's restaurants
        addRestaurantMarkers();
        
        console.log('Map initialized successfully');
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Add restaurant and TikTok markers to map
function addRestaurantMarkers() {
    if (!map) return;

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Add markers for each restaurant (from restaurants table)
    userRestaurants.forEach(restaurant => {
        if (restaurant.lat && restaurant.lon) {
            const marker = L.marker([restaurant.lat, restaurant.lon])
                .addTo(map)
                .bindPopup(`
                    <div>
                        <h3 class="font-semibold">${restaurant.name}</h3>
                        <p class="text-sm text-gray-600">${restaurant.city || 'No city'}</p>
                        <p class="text-sm text-blue-600">Your Restaurant</p>
                    </div>
                `);
        }
    });

    // Add markers for TikTok locations (from tiktoks table with restaurant data)
    userTiktoks.forEach(tiktok => {
        if (tiktok.restaurants && tiktok.restaurants.lat && tiktok.restaurants.lon) {
            const marker = L.marker([tiktok.restaurants.lat, tiktok.restaurants.lon])
                .addTo(map)
                .bindPopup(`
                    <div>
                        <h3 class="font-semibold">${tiktok.restaurants.name}</h3>
                        <p class="text-sm text-gray-600">${tiktok.restaurants.city || 'No city'}</p>
                        <p class="text-sm text-purple-600">TikTok: ${tiktok.author_handle || 'Unknown'}</p>
                    </div>
                `);
        }
    });

    // Fit map to show all markers
    const allLocations = [];

    // Add restaurant locations
    userRestaurants.forEach(restaurant => {
        if (restaurant.lat && restaurant.lon) {
            allLocations.push([restaurant.lat, restaurant.lon]);
        }
    });

    // Add TikTok locations
    userTiktoks.forEach(tiktok => {
        if (tiktok.restaurants && tiktok.restaurants.lat && tiktok.restaurants.lon) {
            allLocations.push([tiktok.restaurants.lat, tiktok.restaurants.lon]);
        }
    });

    if (allLocations.length > 0) {
        const group = new L.featureGroup();
        allLocations.forEach(location => {
            group.addLayer(L.marker(location));
        });

        if (group.getLayers().length > 0) {
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
}

// Show add restaurant form
function showAddRestaurantForm() {
    if (addRestaurantForm) {
        addRestaurantForm.classList.remove('hidden');
        addRestaurantBtn.style.display = 'none';
    }
}

// Hide add restaurant form
function hideAddRestaurantForm() {
    if (addRestaurantForm) {
        addRestaurantForm.classList.add('hidden');
        addRestaurantBtn.style.display = 'block';
        // Reset form
        if (restaurantForm) {
            restaurantForm.reset();
        }
        // Clear status message
        if (geocodeStatus) {
            geocodeStatus.classList.add('hidden');
        }
    }
}

// Handle find on map button click
async function handleFindOnMap() {
    const address = addressInput?.value?.trim();
    
    if (!address) {
        showGeocodeStatus('Please enter an address', 'error');
        return;
    }
    
    if (!findOnMapBtn) return;
    
    // Show loading state
    findOnMapBtn.disabled = true;
    findOnMapBtn.textContent = 'Finding...';
    showGeocodeStatus('Looking up address...', 'info');
    
    try {
        // Call the geocode-address Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('geocode-address', {
            body: { address: address }
        });
        
        if (error) {
            console.error('Geocoding error:', error);
            showGeocodeStatus('Error looking up address: ' + error.message, 'error');
            return;
        }
        
        if (data && data.lat && data.lng) {
            // Populate hidden fields
            if (latitudeInput) latitudeInput.value = data.lat;
            if (longitudeInput) longitudeInput.value = data.lng;
            
            showGeocodeStatus('Address found! Coordinates: ' + data.lat + ', ' + data.lng, 'success');
            
            // Center map on the new coordinates
            if (map) {
                map.setView([data.lat, data.lng], 15);
            }
        } else {
            showGeocodeStatus('Could not find coordinates for this address', 'error');
        }
        
    } catch (error) {
        console.error('Geocoding error:', error);
        showGeocodeStatus('Error looking up address: ' + error.message, 'error');
    } finally {
        // Reset button state
        findOnMapBtn.disabled = false;
        findOnMapBtn.textContent = 'Find on Map';
    }
}

// Handle save restaurant button click
async function handleSaveRestaurant(event) {
    event.preventDefault();
    
    const restaurantName = document.getElementById('restaurant-name')?.value?.trim();
    const address = addressInput?.value?.trim();
    const latitude = latitudeInput?.value;
    const longitude = longitudeInput?.value;
    
    if (!restaurantName || !address) {
        showGeocodeStatus('Please fill in all required fields', 'error');
        return;
    }
    
    if (!latitude || !longitude) {
        showGeocodeStatus('Please find the address on the map first', 'error');
        return;
    }
    
    if (!saveRestaurantBtn) return;
    
    // Show loading state
    saveRestaurantBtn.disabled = true;
    saveRestaurantBtn.textContent = 'Saving...';
    
    try {
        // Insert restaurant into database
        const { data, error } = await supabaseClient
            .from('restaurants')
            .insert([
                {
                    name: restaurantName,
                    lat: parseFloat(latitude),
                    lon: parseFloat(longitude),
                    submitted_by_user_id: currentUser.id,
                    city: 'Unknown', // You might want to add city detection
                    google_maps_url: address
                }
            ])
            .select();
        
        if (error) {
            console.error('Error saving restaurant:', error);
            showGeocodeStatus('Error saving restaurant: ' + error.message, 'error');
            return;
        }
        
        showGeocodeStatus('Restaurant saved successfully!', 'success');
        
        // Hide form and reload restaurants
        setTimeout(() => {
            hideAddRestaurantForm();
            loadUserRestaurants(currentUser.id);
        }, 1500);
        
    } catch (error) {
        console.error('Error saving restaurant:', error);
        showGeocodeStatus('Error saving restaurant: ' + error.message, 'error');
    } finally {
        // Reset button state
        saveRestaurantBtn.disabled = false;
        saveRestaurantBtn.textContent = 'Save Restaurant';
    }
}

// Show geocode status message
function showGeocodeStatus(message, type) {
    if (!geocodeStatus) return;
    
    const statusText = geocodeStatus.querySelector('p');
    if (statusText) {
        statusText.textContent = message;
        statusText.className = `text-sm ${
            type === 'error' ? 'text-red-600' : 
            type === 'success' ? 'text-green-600' : 
            'text-blue-600'
        }`;
    }
    
    geocodeStatus.classList.remove('hidden');
}

// Edit restaurant function
function editRestaurant(restaurantId) {
    // TODO: Implement edit restaurant functionality
    alert(`Edit restaurant ${restaurantId} - functionality coming soon!`);
}

// Delete restaurant function
async function deleteRestaurant(restaurantId) {
    if (!confirm('Are you sure you want to delete this restaurant?')) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('restaurants')
            .delete()
            .eq('id', restaurantId)
            .eq('submitted_by_user_id', currentUser.id); // Security check
        
        if (error) {
            console.error('Error deleting restaurant:', error);
            alert('Error deleting restaurant. Please try again.');
            return;
        }
        
        // Remove from local array
        userRestaurants = userRestaurants.filter(r => r.id !== restaurantId);
        
        // Refresh display
        displayRestaurants();
        // Reload TikToks in case the deleted restaurant had TikToks
        loadUserTiktoks();
        addRestaurantMarkers();
        
        console.log('Restaurant deleted successfully');
        
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        alert('Error deleting restaurant. Please try again.');
    }
}

// --- REEL SUBMISSION HANDLER FUNCTIONS ---

// Helper function to clean TikTok URL
function cleanTiktokUrl(url) {
    // Remove query parameters and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    return cleanUrl;
}

// 1. Validate TikTok URL
async function handleValidateTiktok() {
    const rawUrl = tiktokUrlInput?.value?.trim();
    
    if (!rawUrl) {
        showTiktokValidationError('Please enter a TikTok URL');
        return;
    }
    
    // Clean the URL by removing query parameters
    const cleanUrl = cleanTiktokUrl(rawUrl);
    
    // Update the input field with the cleaned URL
    if (tiktokUrlInput && cleanUrl !== rawUrl) {
        tiktokUrlInput.value = cleanUrl;
    }
    
    if (!validateTiktokBtn) return;
    
    // Show loading state
    validateTiktokBtn.disabled = true;
    validateTiktokBtn.textContent = 'Validating...';
    hideTiktokValidationError();
    
    try {
        // Call the validate-tiktok Supabase Edge Function with cleaned URL
        const { data, error } = await supabaseClient.functions.invoke('validate-tiktok', {
            body: { url: cleanUrl }
        });
        
        if (error) {
            console.error('TikTok validation error:', error);
            showTiktokValidationError('Error validating TikTok URL: ' + error.message);
            return;
        }
        
        if (data && data.valid) {
            // Get the creator's handle from user_roles table
            const { data: userRole, error: roleError } = await supabaseClient
                .from('user_roles')
                .select('tiktok_handle')
                .eq('user_id', currentUser.id)
                .single();
            
            if (roleError) {
                console.error('Error getting user role:', roleError);
                showTiktokValidationError('Error verifying creator identity');
                return;
            }
            
            // Compare handles
            if (data.handle && userRole.tiktok_handle && data.handle.toLowerCase() === userRole.tiktok_handle.toLowerCase()) {
                // Store the validated URL (use the cleaned URL)
                validatedTiktokUrl = cleanUrl;
                
                // Move to step 2
                showStep(2);
            } else {
                showTiktokValidationError('This TikTok video does not belong to your creator account. Please use a video from @' + (userRole.tiktok_handle || 'your handle'));
            }
        } else {
            showTiktokValidationError('Invalid TikTok URL or video not found');
        }
        
    } catch (error) {
        console.error('TikTok validation error:', error);
        showTiktokValidationError('Error validating TikTok URL: ' + error.message);
    } finally {
        // Reset button state
        validateTiktokBtn.disabled = false;
        validateTiktokBtn.textContent = 'Next';
    }
}

// 2. Search for Restaurants (Database + Google Places)
async function handleRestaurantSearch() {
    const searchTerm = restaurantSearchInput?.value?.trim();
    
    if (!searchTerm || searchTerm.length < 3) {
        hideRestaurantSearchResults();
        return;
    }
    
    if (!searchRestaurantBtn) return;
    
    // Show loading state
    searchRestaurantBtn.disabled = true;
    searchRestaurantBtn.textContent = 'Searching...';
    
    try {
        // Step 1: Search database first
        const { data: dbRestaurants, error: dbError } = await supabaseClient
            .from('restaurants')
            .select('id, name, city, lat, lon')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);
        
        if (dbError) {
            console.error('Error searching database:', dbError);
        }
        
        // Step 2: Search Google Places
        let googlePlaces = [];
        try {
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/google-places`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    action: 'searchText',
                    data: {
                        textQuery: searchTerm + ' restaurant',
                        maxResultCount: 8
                    }
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.places && result.data.places.length > 0) {
                    // Convert Google Places format to our format
                    googlePlaces = result.data.places.map(place => ({
                        id: `google_${place.id}`,
                        name: place.displayName?.text || place.displayName,
                        address: place.formattedAddress,
                        city: place.addressComponents?.find(comp => comp.types.includes('locality'))?.longText || 'Unknown',
                        lat: place.location?.latitude,
                        lon: place.location?.longitude,
                        source: 'google'
                    }));
                }
            }
        } catch (googleError) {
            console.error('Error searching Google Places:', googleError);
        }
        
        // Step 3: Display combined results
        displayCombinedSearchResults(dbRestaurants || [], googlePlaces);
        
    } catch (error) {
        console.error('Error in restaurant search:', error);
        showRestaurantSearchError('Search failed. Please try again.');
    } finally {
        // Reset button state
        searchRestaurantBtn.disabled = false;
        searchRestaurantBtn.textContent = 'Search';
    }
}

// Display combined search results (Database + Google Places)
function displayCombinedSearchResults(dbRestaurants, googlePlaces) {
    if (!restaurantSearchOptions) return;
    
    let html = '';
    
    // Show database results first
    if (dbRestaurants.length > 0) {
        html += '<div class="mb-3">';
        html += '<h5 class="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Existing Restaurants</h5>';
        html += dbRestaurants.map(restaurant => `
            <div class="restaurant-option p-3 border border-blue-200 rounded-md mb-2 cursor-pointer hover:bg-blue-50 transition-colors bg-blue-25" 
                 data-restaurant-id="${restaurant.id}" 
                 data-restaurant-name="${restaurant.name}"
                 data-source="database">
                <div class="font-medium text-gray-900">${restaurant.name}</div>
                <div class="text-sm text-gray-600">${restaurant.city || 'No city'}</div>
                <div class="text-xs text-blue-600 mt-1">✓ Already in database</div>
            </div>
        `).join('');
        html += '</div>';
    }
    
    // Show Google Places results
    if (googlePlaces.length > 0) {
        html += '<div>';
        html += '<h5 class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Google Places Results</h5>';
        html += googlePlaces.map(place => `
            <div class="restaurant-option p-3 border border-gray-200 rounded-md mb-2 cursor-pointer hover:bg-gray-50 transition-colors" 
                 data-place-id="${place.id}" 
                 data-restaurant-name="${place.name}"
                 data-address="${place.address}"
                 data-city="${place.city}"
                 data-lat="${place.lat}"
                 data-lon="${place.lon}"
                 data-source="google">
                <div class="font-medium text-gray-900">${place.name}</div>
                <div class="text-sm text-gray-600">${place.address || 'No address'}</div>
                <div class="text-xs text-gray-500">${place.city || 'No city'}</div>
            </div>
        `).join('');
        html += '</div>';
    }
    
    // Show no results message
    if (dbRestaurants.length === 0 && googlePlaces.length === 0) {
        html = '<p class="text-gray-500 text-sm text-center py-4">No restaurants found. Try a different search term or add a new restaurant.</p>';
    }
    
    restaurantSearchOptions.innerHTML = html;
    
    // Show results container
    if (restaurantSearchResults) {
        restaurantSearchResults.classList.remove('hidden');
    }
    
    // Add click listeners to each result
    restaurantSearchOptions.querySelectorAll('.restaurant-option').forEach(option => {
        option.addEventListener('click', () => {
            const source = option.dataset.source;
            const restaurantName = option.dataset.restaurantName;
            
            if (source === 'database') {
                // Existing restaurant from database
                selectedRestaurantId = option.dataset.restaurantId;
                newRestaurantData = null; // Clear any new restaurant data
            } else if (source === 'google') {
                // New restaurant from Google Places
                selectedRestaurantId = null; // Clear database selection
                newRestaurantData = {
                    name: restaurantName,
                    city: option.dataset.city,
                    lat: parseFloat(option.dataset.lat),
                    lon: parseFloat(option.dataset.lon),
                    google_maps_url: option.dataset.address
                };
            }
            
            // Populate summary
            if (summaryRestaurantName) {
                summaryRestaurantName.textContent = restaurantName;
            }
            if (summaryTiktokUrl) {
                summaryTiktokUrl.textContent = validatedTiktokUrl;
            }
            
            // Move to step 4
            showStep(4);
        });
    });
}

// Helper functions for restaurant search
function hideRestaurantSearchResults() {
    if (restaurantSearchResults) {
        restaurantSearchResults.classList.add('hidden');
    }
}

function showRestaurantSearchError(message) {
    if (restaurantSearchOptions) {
        restaurantSearchOptions.innerHTML = `<p class="text-red-500 text-sm text-center py-4">${message}</p>`;
    }
    if (restaurantSearchResults) {
        restaurantSearchResults.classList.remove('hidden');
    }
}

// Helper functions for TikToks
function showTiktoksError(message) {
    if (myTiktoksTable) {
        myTiktoksTable.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <p class="text-lg mb-2">Error loading TikToks</p>
                <p class="text-sm">${message}</p>
            </div>
        `;
        myTiktoksTable.classList.remove('hidden');
    }
}

// 3. Show new restaurant form
function showNewRestaurantForm() {
    showStep(3);
}

// 4. Geocode new restaurant address
async function handleGeocodeNewRestaurant() {
    const name = newRestaurantName?.value?.trim();
    const address = newRestaurantAddress?.value?.trim();
    
    if (!name || !address) {
        showReelGeocodeStatus('Please fill in both restaurant name and address', 'error');
        return;
    }
    
    if (!geocodeAddressBtn) return;
    
    // Show loading state
    geocodeAddressBtn.disabled = true;
    geocodeAddressBtn.textContent = 'Getting Coordinates...';
    showReelGeocodeStatus('Looking up address...', 'info');
    
    try {
        // Call the geocode-address Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('geocode-address', {
            body: { address: address }
        });
        
        if (error) {
            console.error('Geocoding error:', error);
            showReelGeocodeStatus('Error looking up address: ' + error.message, 'error');
            return;
        }
        
        if (data && data.lat && data.lng) {
            // Store the new restaurant data
            newRestaurantData = {
                name: name,
                city: data.city || 'Unknown',
                lat: data.lat,
                lon: data.lng,
                google_maps_url: address
            };
            
            showReelGeocodeStatus('Address found! Coordinates: ' + data.lat + ', ' + data.lng, 'success');
            
            // Populate summary
            if (summaryRestaurantName) {
                summaryRestaurantName.textContent = name;
            }
            if (summaryTiktokUrl) {
                summaryTiktokUrl.textContent = validatedTiktokUrl;
            }
            
            // Move to step 4
            showStep(4);
        } else {
            showReelGeocodeStatus('Could not find coordinates for this address', 'error');
        }
        
    } catch (error) {
        console.error('Geocoding error:', error);
        showReelGeocodeStatus('Error looking up address: ' + error.message, 'error');
    } finally {
        // Reset button state
        geocodeAddressBtn.disabled = false;
        geocodeAddressBtn.textContent = 'Get Coordinates';
    }
}

// 5. Final submission
async function handleSubmitReel() {
    if (!submitReelBtn) return;
    
    // Show loading state
    submitReelBtn.disabled = true;
    submitReelBtn.textContent = 'Saving...';
    
    try {
        let finalRestaurantId = selectedRestaurantId;
        
        // A. If newRestaurantData is not null, create the restaurant first
        if (newRestaurantData) {
            const { data: newRestaurant, error: restaurantError } = await supabaseClient
                .from('restaurants')
                .insert([{
                    name: newRestaurantData.name,
                    city: newRestaurantData.city,
                    lat: newRestaurantData.lat,
                    lon: newRestaurantData.lon,
                    google_maps_url: newRestaurantData.google_maps_url,
                    submitted_by_user_id: currentUser.id,
                    is_publicly_approved: false
                }])
                .select()
                .single();
            
            if (restaurantError) {
                console.error('Error creating restaurant:', restaurantError);
                alert('Error creating restaurant: ' + restaurantError.message);
                return;
            }
            
            finalRestaurantId = newRestaurant.id;
        }
        
        // B. Now create the TikTok link
        const embedHtml = generateTikTokEmbed(validatedTiktokUrl);
        const authorHandle = extractTikTokCreatorHandle(validatedTiktokUrl);
        const { data: newTiktok, error: tiktokError } = await supabaseClient
            .from('tiktoks')
            .insert([{
                embed_html: embedHtml,
                restaurant_id: finalRestaurantId,
                submitted_by_user_id: currentUser.id,
                author_handle: authorHandle,
                is_featured: false,
                is_publicly_approved: false
            }])
            .select()
            .single();
        
        if (tiktokError) {
            console.error('Error creating TikTok link:', tiktokError);
            alert('Error saving reel: ' + tiktokError.message);
            return;
        }
        
        // C. Success!
        showSuccessMessage('Reel saved successfully!');
        
        // Reset form back to step 1
        resetReelForm();
        
        // Refresh the map to show new locations
        await loadUserRestaurants();
        addRestaurantMarkers();
        
    } catch (error) {
        console.error('Error submitting reel:', error);
        alert('Error saving reel: ' + error.message);
    } finally {
        // Reset button state
        submitReelBtn.disabled = false;
        submitReelBtn.textContent = 'Save Reel';
    }
}

// Helper functions for UI management
function showStep(stepNumber) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`step-${i}-${i === 1 ? 'tiktok-url' : i === 2 ? 'link-restaurant' : i === 3 ? 'new-restaurant' : 'summary'}`);
        if (step) {
            step.style.display = 'none';
        }
    }
    
    // Show the requested step
    const stepNames = ['', 'tiktok-url', 'link-restaurant', 'new-restaurant', 'summary'];
    const step = document.getElementById(`step-${stepNumber}-${stepNames[stepNumber]}`);
    if (step) {
        step.style.display = 'block';
    }
    
    // Populate editable URL when showing step 2
    if (stepNumber === 2 && editableTiktokUrl && validatedTiktokUrl) {
        editableTiktokUrl.value = validatedTiktokUrl;
    }
}

function showTiktokValidationError(message) {
    if (tiktokValidationError) {
        tiktokValidationError.textContent = message;
        tiktokValidationError.classList.remove('hidden');
    }
}

function hideTiktokValidationError() {
    if (tiktokValidationError) {
        tiktokValidationError.classList.add('hidden');
    }
}

function showReelGeocodeStatus(message, type) {
    const statusElement = document.getElementById('reel-geocode-status');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `status-message text-sm mb-3 ${
        type === 'error' ? 'text-red-600' : 
        type === 'success' ? 'text-green-600' : 
        'text-blue-600'
    }`;
    statusElement.classList.remove('hidden');
}


// Handle editable URL changes
function handleEditableUrlChange() {
    if (editableTiktokUrl) {
        // Clean the URL and update the validated URL
        const cleanUrl = cleanTiktokUrl(editableTiktokUrl.value);
        validatedTiktokUrl = cleanUrl;
        
        // Update the summary if we're on step 4
        if (summaryTiktokUrl) {
            summaryTiktokUrl.textContent = cleanUrl;
        }
    }
}

function resetReelForm() {
    // Reset state
    validatedTiktokUrl = null;
    selectedRestaurantId = null;
    newRestaurantData = null;
    
    // Clear form inputs
    if (tiktokUrlInput) tiktokUrlInput.value = '';
    if (editableTiktokUrl) editableTiktokUrl.value = '';
    if (restaurantSearchInput) restaurantSearchInput.value = '';
    if (newRestaurantName) newRestaurantName.value = '';
    if (newRestaurantAddress) newRestaurantAddress.value = '';
    
    // Clear search results
    hideRestaurantSearchResults();
    if (restaurantSearchOptions) restaurantSearchOptions.innerHTML = '';
    
    // Hide error messages
    hideTiktokValidationError();
    const reelGeocodeStatus = document.getElementById('reel-geocode-status');
    if (reelGeocodeStatus) reelGeocodeStatus.classList.add('hidden');
    
    // Show step 1
    showStep(1);
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

// Extract TikTok creator handle from URL
function extractTikTokCreatorHandle(url) {
    // Extract the creator handle from TikTok URL
    // Example: https://www.tiktok.com/@cajapanesepancakes/video/7294745895676022048
    // Should return: @cajapanesepancakes
    const match = url.match(/tiktok\.com\/(@[^\/]+)/);
    return match ? match[1] : null;
}

// Show subtle success message
function showSuccessMessage(message) {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ease-in-out';
    successDiv.style.transform = 'translateX(100%)';
    successDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
            </svg>
            <span class="font-medium">${message}</span>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(successDiv);
    
    // Animate in
    setTimeout(() => {
        successDiv.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        successDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 300);
    }, 3000);
}

// Make functions globally accessible
window.editRestaurant = editRestaurant;
window.deleteRestaurant = deleteRestaurant;
