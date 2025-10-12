// Creator Application JavaScript
import { CONFIG, versionNumber } from './config.js';

// Initialize Supabase client
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// DOM elements
let applicationForm;
let loginRequired;
let successMessage;
let errorMessage;
let loadingState;
let loginBtn;
let signupBtn;
let retryBtn;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Creator application page loaded');
    
    // Get DOM elements
    applicationForm = document.getElementById('application-form');
    loginRequired = document.getElementById('login-required');
    successMessage = document.getElementById('success-message');
    errorMessage = document.getElementById('error-message');
    loadingState = document.getElementById('loading-state');
    loginBtn = document.getElementById('login-btn');
    signupBtn = document.getElementById('signup-btn');
    retryBtn = document.getElementById('retry-btn');
    
    // Check authentication status
    await checkAuthenticationStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Update page title with version
    document.title = `Join the ReelGrub Creator Program - v${versionNumber}`;
});

// Check if user is authenticated
async function checkAuthenticationStatus() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Error checking authentication:', error);
            showLoginRequired();
            return;
        }
        
        if (session && session.user) {
            console.log('User is authenticated:', session.user.email);
            showApplicationForm();
        } else {
            console.log('User is not authenticated');
            showLoginRequired();
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        showLoginRequired();
    }
}

// Show login required message
function showLoginRequired() {
    hideAllMessages();
    loginRequired.classList.remove('hidden');
}

// Show application form
function showApplicationForm() {
    hideAllMessages();
    applicationForm.classList.remove('hidden');
}

// Show success message
function showSuccessMessage() {
    hideAllMessages();
    successMessage.classList.remove('hidden');
}

// Show error message
function showErrorMessage(message) {
    hideAllMessages();
    errorMessage.classList.remove('hidden');
    const errorText = document.getElementById('error-text');
    if (errorText) {
        errorText.textContent = message || 'There was an error submitting your application. Please try again.';
    }
}

// Show loading state
function showLoadingState() {
    hideAllMessages();
    loadingState.classList.remove('hidden');
}

// Hide all messages
function hideAllMessages() {
    const elements = [loginRequired, applicationForm, successMessage, errorMessage, loadingState];
    elements.forEach(element => {
        if (element) {
            element.classList.add('hidden');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Application form submission
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Login button
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = '/explore#auth';
        });
    }
    
    // Signup button
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            window.location.href = '/explore#auth';
        });
    }
    
    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            showApplicationForm();
        });
    }
}

// Handle form submission
async function handleFormSubmission(event) {
    event.preventDefault();
    
    const tiktokHandleInput = document.getElementById('tiktok-handle');
    if (!tiktokHandleInput) {
        console.error('TikTok handle input not found');
        return;
    }
    
    const tiktokHandle = tiktokHandleInput.value.trim();
    
    // Validate input
    if (!tiktokHandle) {
        showErrorMessage('Please enter your TikTok handle.');
        return;
    }
    
    // Clean the TikTok handle (remove @ if present)
    const cleanTikTokHandle = tiktokHandle.replace(/^@/, '');
    
    if (!cleanTikTokHandle) {
        showErrorMessage('Please enter a valid TikTok handle.');
        return;
    }
    
    console.log('Submitting application for TikTok handle:', cleanTikTokHandle);
    
    // Show loading state
    showLoadingState();
    
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError) {
            console.error('Error getting user:', userError);
            showErrorMessage('Authentication error. Please log in again.');
            return;
        }
        
        if (!user) {
            console.error('No user found');
            showErrorMessage('Please log in to submit your application.');
            return;
        }
        
        console.log('User ID:', user.id);
        
        // Insert application into database
        const { data, error } = await supabaseClient
            .from('creator_applications')
            .insert([
                {
                    user_id: user.id,
                    tiktok_handle: cleanTikTokHandle,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ])
            .select();
        
        if (error) {
            console.error('Error submitting application:', error);
            
            // Check if it's a duplicate application
            if (error.code === '23505') { // Unique constraint violation
                showErrorMessage('You have already submitted an application. We\'ll review it and get back to you soon!');
            } else {
                showErrorMessage('Failed to submit application. Please try again.');
            }
            return;
        }
        
        console.log('Application submitted successfully:', data);
        showSuccessMessage();
        
    } catch (error) {
        console.error('Unexpected error:', error);
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
}

// Listen for authentication state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
    
    if (event === 'SIGNED_IN' && session?.user) {
        showApplicationForm();
    } else if (event === 'SIGNED_OUT') {
        showLoginRequired();
    }
});
