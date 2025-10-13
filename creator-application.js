// Creator Application System - Simplified and Reliable
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';
import { versionNumber } from './config.js';

// Initialize Supabase client
const supabaseClient = createClient(
    'https://jsuxrpnfofkigdfpnuua.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8'
);

// Global state
let currentUser = null;
let currentApplication = null;

// DOM elements
let loginModal, applicationForm, magicWordDisplay, approvedDisplay;

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Creator application page loaded - v' + versionNumber);
    
    // Get DOM elements
    loginModal = document.getElementById('login-modal');
    applicationForm = document.getElementById('application-form');
    magicWordDisplay = document.getElementById('magic-word-display');
    approvedDisplay = document.getElementById('approved-display');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check initial auth state
    await checkAuthState();
    
    // Update page title
    document.title = `Join the ReelGrub Creator Program - v${versionNumber}`;
});

// Setup all event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Application form
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleApplicationSubmit);
    }
    
    // Close modal buttons
    const closeModalBtns = document.querySelectorAll('.close-modal');
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', closeLoginModal);
    });
    
    // Switch between login/signup
    const switchAuthBtn = document.getElementById('switch-auth-mode');
    if (switchAuthBtn) {
        switchAuthBtn.addEventListener('click', switchAuthMode);
    }
    
    // Google signin
    const googleSigninBtn = document.getElementById('google-signin-btn');
    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', handleGoogleSignin);
    }
    
    // Login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', openLoginModal);
    }
    
    // Auto-fill username from TikTok handle
    const tiktokHandleInput = document.getElementById('tiktok-handle');
    const desiredUsernameInput = document.getElementById('desired-username');
    const usernamePreview = document.getElementById('username-preview');
    
    if (tiktokHandleInput && desiredUsernameInput && usernamePreview) {
        let userHasEditedUsername = false;
        
        // Track if user has manually edited the username field
        desiredUsernameInput.addEventListener('input', function() {
            userHasEditedUsername = true;
        });
        
        tiktokHandleInput.addEventListener('keyup', function() {
            const tiktokHandle = this.value.trim().replace(/^@/, '');
            if (tiktokHandle && !userHasEditedUsername) {
                const urlFriendlyUsername = makeUrlFriendly(tiktokHandle);
                desiredUsernameInput.value = urlFriendlyUsername;
                updateUsernamePreview(urlFriendlyUsername);
            }
        });
        
        desiredUsernameInput.addEventListener('keyup', function() {
            const username = this.value.trim();
            const urlFriendlyUsername = makeUrlFriendly(username);
            updateUsernamePreview(urlFriendlyUsername);
        });
    }
}

// Check authentication state
async function checkAuthState() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Error checking auth state:', error);
            showLoginPrompt();
            return;
        }
        
        if (session && session.user) {
            currentUser = session.user;
            console.log('User authenticated:', currentUser.email);
            await checkApplicationStatus();
        } else {
            console.log('User not authenticated');
            showLoginPrompt();
        }
    } catch (error) {
        console.error('Error in checkAuthState:', error);
        showLoginPrompt();
    }
}

// Check if user has an existing application
async function checkApplicationStatus() {
    try {
        console.log('Checking application status for user:', currentUser.id);
        
        const { data: application, error } = await supabaseClient
            .from('creator_applications')
            .select('id, user_id, tiktok_handle, requested_username, magic_word, status, created_at')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // No application found
                console.log('No existing application found');
                currentApplication = null;
                showApplicationForm();
            } else {
                console.error('Error checking application:', error);
                showApplicationForm(); // Show form as fallback
            }
        } else {
            console.log('Found existing application:', application);
            currentApplication = application;
            
            if (application.status === 'approved') {
                showApprovedMessage(application);
            } else {
                showMagicWordInstructions(application);
            }
        }
    } catch (error) {
        console.error('Error in checkApplicationStatus:', error);
        showApplicationForm(); // Show form as fallback
    }
}

// Show login prompt for non-authenticated users
function showLoginPrompt() {
    hideAllSections();
    const loginPrompt = document.getElementById('login-prompt');
    if (loginPrompt) {
        loginPrompt.style.display = 'block';
    }
}

// Show application form
function showApplicationForm() {
    hideAllSections();
    if (applicationForm) {
        applicationForm.style.display = 'block';
    }
}

// Show magic word instructions
function showMagicWordInstructions(application) {
    hideAllSections();
    if (magicWordDisplay) {
        magicWordDisplay.style.display = 'block';
        
        // Populate the magic word display
        const magicWordElement = document.getElementById('magic-word');
        const tiktokHandleElement = document.getElementById('display-tiktok-handle');
        const usernameElement = document.getElementById('display-username');
        const statusElement = document.getElementById('display-status');
        const submittedDateElement = document.getElementById('submitted-date');
        
        if (magicWordElement) magicWordElement.textContent = application.magic_word;
        if (tiktokHandleElement) tiktokHandleElement.textContent = '@' + application.tiktok_handle;
        if (usernameElement) usernameElement.textContent = application.requested_username;
        if (statusElement) statusElement.textContent = application.status.charAt(0).toUpperCase() + application.status.slice(1);
        if (submittedDateElement) submittedDateElement.textContent = new Date(application.created_at).toLocaleDateString();
        
        // Generate QR code
        generateQRCode(application.magic_word);
    }
}

// Show approved message
function showApprovedMessage(application) {
    hideAllSections();
    if (approvedDisplay) {
        approvedDisplay.style.display = 'block';
        
        // Populate approved display
        const approvedTiktokHandle = document.getElementById('approved-tiktok-handle');
        const approvedUsername = document.getElementById('approved-username');
        
        if (approvedTiktokHandle) approvedTiktokHandle.textContent = '@' + application.tiktok_handle;
        if (approvedUsername) approvedUsername.textContent = application.requested_username;
    }
}

// Hide all sections
function hideAllSections() {
    const sections = [loginModal, applicationForm, magicWordDisplay, approvedDisplay];
    sections.forEach(section => {
        if (section) {
            section.style.display = 'none';
        }
    });
    
    const loginPrompt = document.getElementById('login-prompt');
    if (loginPrompt) {
        loginPrompt.style.display = 'none';
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showError('Login failed: ' + error.message);
            return;
        }
        
        console.log('Login successful:', data.user.email);
        currentUser = data.user;
        closeLoginModal();
        await checkApplicationStatus();
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed. Please try again.');
    }
}

// Handle signup
async function handleSignup(event) {
    event.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) {
            showError('Signup failed: ' + error.message);
            return;
        }
        
        console.log('Signup successful:', data.user.email);
        currentUser = data.user;
        closeLoginModal();
        await checkApplicationStatus();
        
    } catch (error) {
        console.error('Signup error:', error);
        showError('Signup failed. Please try again.');
    }
}

// Handle application submission
async function handleApplicationSubmit(event) {
    event.preventDefault();
    
    const tiktokHandle = document.getElementById('tiktok-handle').value.trim();
    const desiredUsername = document.getElementById('desired-username').value.trim();
    
    // Validate inputs
    if (!tiktokHandle) {
        showError('Please enter your TikTok handle.');
        return;
    }
    
    if (!desiredUsername) {
        showError('Please enter your desired username.');
        return;
    }
    
    // Validate username format
    const urlFriendlyUsername = makeUrlFriendly(desiredUsername);
    if (urlFriendlyUsername !== desiredUsername.toLowerCase() || urlFriendlyUsername.includes(' ')) {
        showError('Username can only contain letters, numbers, and hyphens. No spaces or special characters allowed.');
        return;
    }
    
    if (urlFriendlyUsername.length < 3) {
        showError('Username must be at least 3 characters long.');
        return;
    }
    
    // Clean TikTok handle
    const cleanTikTokHandle = tiktokHandle.replace(/^@/, '');
    
    try {
        // Generate magic word
        const magicWord = generateMagicWord();
        
        // Submit application
        const { data, error } = await supabaseClient
            .from('creator_applications')
            .insert([
                {
                    user_id: currentUser.id,
                    tiktok_handle: cleanTikTokHandle,
                    requested_username: urlFriendlyUsername,
                    magic_word: magicWord,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                showError('You have already submitted an application. We\'ll review it and get back to you soon!');
            } else {
                showError('Failed to submit application. Please try again.');
            }
            return;
        }
        
        console.log('Application submitted successfully:', data);
        currentApplication = data;
        showMagicWordInstructions(data);
        
    } catch (error) {
        console.error('Application submission error:', error);
        showError('An unexpected error occurred. Please try again.');
    }
}

// Handle Google signin
async function handleGoogleSignin() {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href
            }
        });
        
        if (error) {
            showError('Google signin failed: ' + error.message);
        }
    } catch (error) {
        console.error('Google signin error:', error);
        showError('Google signin failed. Please try again.');
    }
}

// Open login modal
function openLoginModal() {
    if (loginModal) {
        loginModal.style.display = 'flex';
    }
}

// Close login modal
function closeLoginModal() {
    if (loginModal) {
        loginModal.style.display = 'none';
    }
}

// Switch between login and signup
function switchAuthMode() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const switchBtn = document.getElementById('switch-auth-mode');
    
    if (loginForm && signupForm && switchBtn) {
        if (loginForm.style.display === 'none') {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            switchBtn.textContent = 'Need an account? Sign up';
        } else {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            switchBtn.textContent = 'Already have an account? Log in';
        }
    }
}

// Generate magic word
function generateMagicWord() {
    const adjectives = [
        'Blue', 'Red', 'Green', 'Purple', 'Golden', 'Silver', 'Bright', 'Dark', 'Happy', 'Cool',
        'Swift', 'Bold', 'Calm', 'Wild', 'Sweet', 'Sharp', 'Warm', 'Cold', 'Loud', 'Quiet'
    ];
    
    const nouns = [
        'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Shark', 'Falcon',
        'Phoenix', 'Dragon', 'Unicorn', 'Griffin', 'Pegasus', 'Kraken', 'Yeti', 'Sphinx', 'Minotaur', 'Centaur'
    ];
    
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    
    return `${adjective}${noun}${number}`;
}

// Make text URL-friendly
function makeUrlFriendly(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// Update username preview
function updateUsernamePreview(username) {
    const usernamePreview = document.getElementById('username-preview');
    if (usernamePreview) {
        usernamePreview.textContent = username || 'your-username';
    }
}

// Generate QR code
function generateQRCode(text) {
    const qrContainer = document.getElementById('qr-code');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        
        // Simple QR code generation (you can replace this with a proper QR library)
        const qrDiv = document.createElement('div');
        qrDiv.style.cssText = `
            width: 200px;
            height: 200px;
            border: 2px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            margin: 0 auto;
            font-family: monospace;
            font-size: 12px;
            text-align: center;
            word-break: break-all;
            padding: 10px;
        `;
        qrDiv.textContent = `QR Code for: ${text}`;
        qrContainer.appendChild(qrDiv);
    }
}

// Show error message
function showError(message) {
    // Remove existing error messages
    const existingErrors = document.querySelectorAll('.error-message');
    existingErrors.forEach(error => error.remove());
    
    // Create new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #fee;
        color: #c33;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
        border: 1px solid #fcc;
    `;
    errorDiv.textContent = message;
    
    // Insert at top of current section
    const currentSection = document.querySelector('[style*="display: block"]');
    if (currentSection) {
        currentSection.insertBefore(errorDiv, currentSection.firstChild);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event);
    
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        await checkApplicationStatus();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentApplication = null;
        showLoginPrompt();
    }
});