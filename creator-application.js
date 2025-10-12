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

// Check Application Status
async function checkApplicationStatus() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session || !session.user) {
            console.log('User not authenticated, cannot check application status');
            return null;
        }
        
        console.log('Checking application status for user:', session.user.id);
        
        // Query the creator_applications table for existing application
        const { data, error } = await supabaseClient
            .from('creator_applications')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned - no existing application
                console.log('No existing application found');
                return null;
            } else {
                console.error('Error checking application status:', error);
                return null;
            }
        }
        
        console.log('Existing application found:', data);
        return data;
        
    } catch (error) {
        console.error('Error in checkApplicationStatus:', error);
        return null;
    }
}

// Magic Word Generator
function generateMagicWord() {
    const adjectives = [
        'Blue', 'Red', 'Green', 'Purple', 'Golden', 'Silver', 'Bright', 'Dark', 'Happy', 'Cool',
        'Fast', 'Slow', 'Big', 'Small', 'Hot', 'Cold', 'Sweet', 'Sour', 'Fresh', 'Clean'
    ];
    
    const nouns = [
        'Ocean', 'Mountain', 'River', 'Forest', 'Desert', 'Island', 'Bridge', 'Castle', 'Garden', 'Valley',
        'Star', 'Moon', 'Sun', 'Cloud', 'Wind', 'Fire', 'Water', 'Earth', 'Sky', 'Dream'
    ];
    
    const numbers = [
        '47', '23', '89', '12', '56', '78', '34', '91', '65', '42',
        '18', '73', '29', '84', '37', '52', '96', '14', '67', '81'
    ];
    
    // Randomly select one word from each array
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = numbers[Math.floor(Math.random() * numbers.length)];
    
    // Combine into a memorable phrase
    const magicWord = `${adjective}-${noun}-${number}`;
    
    console.log('Generated magic word:', magicWord);
    return magicWord;
}

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
            
            // Check if user has an existing application
            const existingApplication = await checkApplicationStatus();
            
            if (existingApplication) {
                showExistingApplication(existingApplication);
            } else {
                showApplicationForm();
            }
            
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

// Show magic word message
function showMagicWordMessage(tiktokHandle, magicWord) {
    hideAllMessages();
    
    // Update success message content
    const successTitle = successMessage.querySelector('h3');
    const successText = successMessage.querySelector('p');
    const continueLink = successMessage.querySelector('a');
    
    if (successTitle) successTitle.textContent = 'Application Submitted!';
    if (successText) {
        successText.innerHTML = `
            <strong>Your Magic Word:</strong><br>
            <span class="text-2xl font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-lg inline-block mt-2 mb-4">${magicWord}</span><br><br>
            <strong>Verification Instructions:</strong><br>
            To verify your account, please send a Direct Message from your TikTok account <strong>@${tiktokHandle}</strong> with your magic word: <strong>${magicWord}</strong><br><br>
            We'll review your application and get back to you soon!
        `;
    }
    if (continueLink) continueLink.textContent = 'Continue Exploring';
    
    successMessage.classList.remove('hidden');
}

// Show existing application
function showExistingApplication(application) {
    hideAllMessages();
    
    // Update success message content for existing application
    const successTitle = successMessage.querySelector('h3');
    const successText = successMessage.querySelector('p');
    const continueLink = successMessage.querySelector('a');
    
    if (successTitle) successTitle.textContent = 'Application Status';
    if (successText) {
        const statusColor = application.status === 'approved' ? 'text-green-600' : 
                           application.status === 'rejected' ? 'text-red-600' : 'text-yellow-600';
        
        // Only show magic word and verification instructions if status is not 'approved'
        const showMagicWord = application.status !== 'approved';
        
        let magicWordSection = '';
        let verificationSection = '';
        let statusMessage = '';
        
        if (showMagicWord) {
            magicWordSection = `
                <strong>Your Magic Word:</strong><br>
                <span class="text-2xl font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-lg inline-block mt-2 mb-4">${application.magic_word}</span><br><br>
            `;
            
            verificationSection = `
                <strong>Verification Instructions:</strong><br>
                To verify your account, please send a Direct Message from your TikTok account <strong>@${application.tiktok_handle}</strong> with your magic word: <strong>${application.magic_word}</strong><br><br>
            `;
        }
        
        // Status-specific messages
        if (application.status === 'pending') {
            statusMessage = 'We\'re currently reviewing your application and will get back to you soon!';
        } else if (application.status === 'approved') {
            statusMessage = 'Congratulations! Your application has been approved! You are now a verified creator.';
        } else if (application.status === 'rejected') {
            statusMessage = 'Your application was not approved at this time. You can reapply if you wish.';
        }
        
        successText.innerHTML = `
            <strong>Status:</strong> <span class="${statusColor} font-semibold capitalize">${application.status}</span><br><br>
            <strong>TikTok Handle:</strong> @${application.tiktok_handle}<br><br>
            ${magicWordSection}
            ${verificationSection}
            ${statusMessage}
        `;
    }
    if (continueLink) continueLink.textContent = 'Continue Exploring';
    
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
        
        // Generate magic word
        const magicWord = generateMagicWord();
        
        // Insert application into database
        const { data, error } = await supabaseClient
            .from('creator_applications')
            .insert([
                {
                    user_id: user.id,
                    tiktok_handle: cleanTikTokHandle,
                    magic_word: magicWord,
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
        showMagicWordMessage(cleanTikTokHandle, magicWord);
        
    } catch (error) {
        console.error('Unexpected error:', error);
        showErrorMessage('An unexpected error occurred. Please try again.');
    }
}

// Listen for authentication state changes
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
    
    if (event === 'SIGNED_IN' && session?.user) {
        closeAuthModal();
        
        // Check if user has an existing application
        const existingApplication = await checkApplicationStatus();
        
        if (existingApplication) {
            showExistingApplication(existingApplication);
        } else {
            showApplicationForm();
        }
        
        updateMobileCollectionsVisibility(true);
        // Stay on creators page - don't redirect
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
