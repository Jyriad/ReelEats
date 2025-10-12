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

// Auth modal elements
let authModal;
let closeAuthModalBtn;
let loginForm;
let signupForm;
let switchAuthModeBtn;
let googleSigninBtn;
let authTitle;
let authFeedback;

// Mobile menu elements
let mobileMenuBtn;
let mobileMenuModal;
let closeMobileMenu;
let mobileCollectionsBtn;

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
    
    // Get auth modal elements
    authModal = document.getElementById('auth-modal');
    closeAuthModalBtn = document.getElementById('close-auth-modal');
    loginForm = document.getElementById('login-form');
    signupForm = document.getElementById('signup-form');
    switchAuthModeBtn = document.getElementById('switch-auth-mode');
    googleSigninBtn = document.getElementById('google-signin-btn');
    authTitle = document.getElementById('auth-title');
    authFeedback = document.getElementById('auth-feedback');
    
    // Get mobile menu elements
    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    mobileMenuModal = document.getElementById('mobile-menu-modal');
    closeMobileMenu = document.getElementById('close-mobile-menu');
    mobileCollectionsBtn = document.getElementById('mobile-collections-btn');
    
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
            updateMobileCollectionsVisibility(true);
        } else {
            console.log('User is not authenticated');
            showLoginRequired();
            updateMobileCollectionsVisibility(false);
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
            openAuthModal('login');
        });
    }
    
    // Signup button
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            openAuthModal('signup');
        });
    }
    
    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            showApplicationForm();
        });
    }
    
    // Auth modal event listeners
    if (closeAuthModalBtn) {
        closeAuthModalBtn.addEventListener('click', closeAuthModal);
    }
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) closeAuthModal();
        });
    }
    
    if (switchAuthModeBtn) {
        switchAuthModeBtn.addEventListener('click', switchAuthMode);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', handleGoogleSignin);
    }
    
    // Mobile menu event listeners
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
    
    if (mobileCollectionsBtn) {
        mobileCollectionsBtn.addEventListener('click', () => {
            window.location.href = '/explore';
            mobileMenuModal.classList.add('hidden');
            mobileMenuModal.style.display = 'none';
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
        closeAuthModal();
        showApplicationForm();
        updateMobileCollectionsVisibility(true);
    } else if (event === 'SIGNED_OUT') {
        showLoginRequired();
        updateMobileCollectionsVisibility(false);
    }
});

// Authentication modal functions
function openAuthModal(mode = 'login') {
    if (!authModal) return;
    
    // Hide feedback
    if (authFeedback) {
        authFeedback.classList.add('hidden');
    }
    
    // Set initial mode
    if (mode === 'signup') {
        switchToSignup();
    } else {
        switchToLogin();
    }
    
    // Show modal
    authModal.classList.remove('hidden');
    authModal.style.display = 'flex';
}

function closeAuthModal() {
    if (!authModal) return;
    
    authModal.classList.add('hidden');
    authModal.style.display = 'none';
    
    // Hide feedback
    if (authFeedback) {
        authFeedback.classList.add('hidden');
    }
}

function switchAuthMode() {
    if (!loginForm || !signupForm || !switchAuthModeBtn || !authTitle) return;
    
    if (loginForm.classList.contains('hidden')) {
        switchToLogin();
    } else {
        switchToSignup();
    }
}

function switchToLogin() {
    if (!loginForm || !signupForm || !switchAuthModeBtn || !authTitle) return;
    
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    authTitle.textContent = 'Sign In';
    switchAuthModeBtn.textContent = 'Need an account? Sign Up';
}

function switchToSignup() {
    if (!loginForm || !signupForm || !switchAuthModeBtn || !authTitle) return;
    
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    authTitle.textContent = 'Sign Up';
    switchAuthModeBtn.textContent = 'Already have an account? Sign In';
}

function showAuthFeedback(message, isError = true) {
    if (!authFeedback) return;
    
    authFeedback.textContent = message;
    authFeedback.className = isError ? 'text-sm text-red-500 mt-4' : 'text-sm text-green-500 mt-4';
    authFeedback.classList.remove('hidden');
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            console.error('Login error:', error);
            showAuthFeedback(error.message);
            return;
        }
        
        console.log('Login successful:', data.user.email);
        // Auth state change will handle the rest
        
    } catch (error) {
        console.error('Login error:', error);
        showAuthFeedback('An unexpected error occurred. Please try again.');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });
        
        if (error) {
            console.error('Signup error:', error);
            showAuthFeedback(error.message);
            return;
        }
        
        console.log('Signup successful:', data.user.email);
        showAuthFeedback('Check your email for a confirmation link!', false);
        
    } catch (error) {
        console.error('Signup error:', error);
        showAuthFeedback('An unexpected error occurred. Please try again.');
    }
}

async function handleGoogleSignin() {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/creators'
            }
        });
        
        if (error) {
            console.error('Google signin error:', error);
            showAuthFeedback(error.message);
            return;
        }
        
        console.log('Google signin initiated');
        
    } catch (error) {
        console.error('Google signin error:', error);
        showAuthFeedback('An unexpected error occurred. Please try again.');
    }
}

// Update mobile collections button visibility
function updateMobileCollectionsVisibility(isAuthenticated) {
    if (!mobileCollectionsBtn) return;
    
    if (isAuthenticated) {
        mobileCollectionsBtn.classList.remove('hidden');
    } else {
        mobileCollectionsBtn.classList.add('hidden');
    }
}
