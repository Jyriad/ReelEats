// Dashboard JavaScript - Creator Dashboard
// This script handles authentication, role checking, and content management

// Import Supabase configuration and client
import { CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

// Initialize Supabase client
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
        addRestaurantBtn.addEventListener('click', () => {
            // TODO: Implement add restaurant functionality
            alert('Add restaurant functionality coming soon!');
        });
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
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
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
