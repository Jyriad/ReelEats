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

// DOM elements
let loadingState = null;
let addRestaurantBtn = null;
let myRestaurantsList = null;
let logoutBtn = null;
let mobileLogoutBtn = null;
let mobileMenuBtn = null;
let mobileMenuModal = null;
let closeMobileMenu = null;

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

// Make functions globally accessible
window.editRestaurant = editRestaurant;
window.deleteRestaurant = deleteRestaurant;
