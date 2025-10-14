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

// --- REEL SUBMISSION STATE MANAGEMENT ---
let validatedTiktokUrl = null;
let selectedRestaurantId = null;
let newRestaurantData = null;

// DOM elements
let loadingState = null;
let addRestaurantBtn = null;
let myRestaurantsList = null;
let logoutBtn = null;
let mobileLogoutBtn = null;
let mobileMenuBtn = null;
let mobileMenuModal = null;
let closeMobileMenu = null;

// --- REEL SUBMISSION ELEMENT SELECTORS ---
let validateTiktokBtn = null;
let tiktokUrlInput = null;
let tiktokValidationError = null;
let restaurantSearchInput = null;
let restaurantSearchResults = null;
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
    restaurantSearchInput = document.getElementById('restaurant-search-input');
    restaurantSearchResults = document.getElementById('restaurant-search-results');
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
    if (restaurantSearchInput) {
        restaurantSearchInput.addEventListener('keyup', handleRestaurantSearch);
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
            <p class="text-gray-600">${restaurant.address || 'No address provided'}</p>
            <p class="text-gray-500 text-sm">Cuisine: ${restaurant.cuisine || 'Not specified'}</p>
            <p class="text-gray-500 text-sm">Added: ${new Date(restaurant.created_at).toLocaleDateString()}</p>
            <div class="restaurant-actions">
                <button class="btn-edit" onclick="editRestaurant('${restaurant.id}')">Edit</button>
                <button class="btn-delete" onclick="deleteRestaurant('${restaurant.id}')">Delete</button>
            </div>
        </div>
    `).join('');
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

// Add restaurant markers to map
function addRestaurantMarkers() {
    if (!map || !userRestaurants) return;
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    // Add markers for each restaurant
    userRestaurants.forEach(restaurant => {
        if (restaurant.latitude && restaurant.longitude) {
            const marker = L.marker([restaurant.latitude, restaurant.longitude])
                .addTo(map)
                .bindPopup(`
                    <div>
                        <h3 class="font-semibold">${restaurant.name}</h3>
                        <p class="text-sm text-gray-600">${restaurant.address || 'No address'}</p>
                        <p class="text-sm text-gray-500">${restaurant.cuisine || 'No cuisine specified'}</p>
                    </div>
                `);
        }
    });
    
    // Fit map to show all markers
    if (userRestaurants.length > 0) {
        const group = new L.featureGroup();
        userRestaurants.forEach(restaurant => {
            if (restaurant.latitude && restaurant.longitude) {
                group.addLayer(L.marker([restaurant.latitude, restaurant.longitude]));
            }
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
                    address: address,
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    submitted_by_user_id: currentUser.id,
                    city: 'Unknown', // You might want to add city detection
                    cuisine: 'Unknown' // You might want to add cuisine selection
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
        addRestaurantMarkers();
        
        console.log('Restaurant deleted successfully');
        
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        alert('Error deleting restaurant. Please try again.');
    }
}

// --- REEL SUBMISSION HANDLER FUNCTIONS ---

// 1. Validate TikTok URL
async function handleValidateTiktok() {
    const url = tiktokUrlInput?.value?.trim();
    
    if (!url) {
        showTiktokValidationError('Please enter a TikTok URL');
        return;
    }
    
    if (!validateTiktokBtn) return;
    
    // Show loading state
    validateTiktokBtn.disabled = true;
    validateTiktokBtn.textContent = 'Validating...';
    hideTiktokValidationError();
    
    try {
        // Call the validate-tiktok Supabase Edge Function
        const { data, error } = await supabaseClient.functions.invoke('validate-tiktok', {
            body: { url: url }
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
                // Store the validated URL
                validatedTiktokUrl = url;
                
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

// 2. Search for Restaurants
async function handleRestaurantSearch() {
    const searchTerm = restaurantSearchInput?.value?.trim();
    
    if (!searchTerm || searchTerm.length < 3) {
        if (restaurantSearchResults) {
            restaurantSearchResults.innerHTML = '';
        }
        return;
    }
    
    try {
        // Query the restaurants table
        const { data: restaurants, error } = await supabaseClient
            .from('restaurants')
            .select('id, name, address, city')
            .ilike('name', `%${searchTerm}%`)
            .limit(10);
        
        if (error) {
            console.error('Error searching restaurants:', error);
            return;
        }
        
        // Display results
        displayRestaurantSearchResults(restaurants || []);
        
    } catch (error) {
        console.error('Error searching restaurants:', error);
    }
}

// Display restaurant search results
function displayRestaurantSearchResults(restaurants) {
    if (!restaurantSearchResults) return;
    
    if (restaurants.length === 0) {
        restaurantSearchResults.innerHTML = '<p class="text-gray-500 text-sm">No restaurants found</p>';
        return;
    }
    
    restaurantSearchResults.innerHTML = restaurants.map(restaurant => `
        <div class="restaurant-result p-3 border border-gray-200 rounded-md mb-2 cursor-pointer hover:bg-gray-50 transition-colors" 
             data-restaurant-id="${restaurant.id}" data-restaurant-name="${restaurant.name}">
            <h4 class="font-medium text-gray-900">${restaurant.name}</h4>
            <p class="text-sm text-gray-600">${restaurant.address || 'No address'}</p>
            <p class="text-xs text-gray-500">${restaurant.city || 'No city'}</p>
        </div>
    `).join('');
    
    // Add click listeners to each result
    restaurantSearchResults.querySelectorAll('.restaurant-result').forEach(result => {
        result.addEventListener('click', () => {
            const restaurantId = result.dataset.restaurantId;
            const restaurantName = result.dataset.restaurantName;
            
            // Store selected restaurant
            selectedRestaurantId = restaurantId;
            
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

// 3. Show new restaurant form
function showNewRestaurantForm() {
    showStep(3);
}

// 4. Geocode new restaurant address
async function handleGeocodeNewRestaurant() {
    const name = newRestaurantName?.value?.trim();
    const address = newRestaurantAddress?.value?.trim();
    
    if (!name || !address) {
        showGeocodeStatus('Please fill in both restaurant name and address', 'error');
        return;
    }
    
    if (!geocodeAddressBtn) return;
    
    // Show loading state
    geocodeAddressBtn.disabled = true;
    geocodeAddressBtn.textContent = 'Getting Coordinates...';
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
            // Store the new restaurant data
            newRestaurantData = {
                name: name,
                address: address,
                latitude: data.lat,
                longitude: data.lng,
                city: data.city || 'Unknown',
                cuisine: 'Unknown'
            };
            
            showGeocodeStatus('Address found! Coordinates: ' + data.lat + ', ' + data.lng, 'success');
            
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
            showGeocodeStatus('Could not find coordinates for this address', 'error');
        }
        
    } catch (error) {
        console.error('Geocoding error:', error);
        showGeocodeStatus('Error looking up address: ' + error.message, 'error');
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
                    ...newRestaurantData,
                    submitted_by_user_id: currentUser.id
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
        const { data: newTiktok, error: tiktokError } = await supabaseClient
            .from('tiktoks')
            .insert([{
                url: validatedTiktokUrl,
                restaurant_id: finalRestaurantId,
                submitted_by_user_id: currentUser.id
            }])
            .select()
            .single();
        
        if (tiktokError) {
            console.error('Error creating TikTok link:', tiktokError);
            alert('Error saving reel: ' + tiktokError.message);
            return;
        }
        
        // C. Success!
        alert('Reel saved successfully!');
        
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

function showGeocodeStatus(message, type) {
    const statusElement = document.getElementById('geocode-status');
    if (!statusElement) return;
    
    statusElement.textContent = message;
    statusElement.className = `status-message text-sm mb-3 ${
        type === 'error' ? 'text-red-600' : 
        type === 'success' ? 'text-green-600' : 
        'text-blue-600'
    }`;
    statusElement.classList.remove('hidden');
}

function resetReelForm() {
    // Reset state
    validatedTiktokUrl = null;
    selectedRestaurantId = null;
    newRestaurantData = null;
    
    // Clear form inputs
    if (tiktokUrlInput) tiktokUrlInput.value = '';
    if (restaurantSearchInput) restaurantSearchInput.value = '';
    if (newRestaurantName) newRestaurantName.value = '';
    if (newRestaurantAddress) newRestaurantAddress.value = '';
    
    // Clear results
    if (restaurantSearchResults) restaurantSearchResults.innerHTML = '';
    
    // Hide error messages
    hideTiktokValidationError();
    if (geocodeStatus) geocodeStatus.classList.add('hidden');
    
    // Show step 1
    showStep(1);
}

// Make functions globally accessible
window.editRestaurant = editRestaurant;
window.deleteRestaurant = deleteRestaurant;
