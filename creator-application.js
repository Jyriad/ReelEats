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
    
    // Ensure auth modal is hidden on page load
    if (authModal) {
        authModal.classList.add('hidden');
        authModal.style.display = 'none';
        console.log('Auth modal hidden on page load');
        console.log('Modal classes after hiding:', authModal.className);
        console.log('Modal display style after hiding:', authModal.style.display);
    } else {
        console.error('Auth modal element not found');
    }
    
    // Get mobile menu elements
    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    mobileMenuModal = document.getElementById('mobile-menu-modal');
    closeMobileMenu = document.getElementById('close-mobile-menu');
    mobileCollectionsBtn = document.getElementById('mobile-collections-btn');
    
    // Check authentication status with a small delay to ensure session is loaded
    setTimeout(async () => {
        console.log('Running delayed authentication check...');
        await checkAuthenticationStatus();
    }, 100);
    
    // Setup event listeners
    setupEventListeners();
    
    // Update page title with version
    document.title = `Join the ReelGrub Creator Program - v${versionNumber}`;
});

// Check if user is authenticated
async function checkAuthenticationStatus() {
    try {
        console.log('checkAuthenticationStatus called');
        
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Error checking authentication:', error);
            showNotAuthenticatedState();
            return;
        }
        
        if (session && session.user) {
            console.log('User is authenticated:', session.user.email);
            
            // Check if user has an existing application
            const existingApplication = await checkApplicationStatus();
            
            if (existingApplication) {
                if (existingApplication.status === 'approved') {
                    showApprovedMessage(existingApplication);
                } else {
                    showExistingApplication(existingApplication);
                }
            } else {
                showApplicationForm();
            }
            
            updateMobileCollectionsVisibility(true);
        } else {
            console.log('User is not authenticated');
            showNotAuthenticatedState();
            updateMobileCollectionsVisibility(false);
        }
    } catch (error) {
        console.error('Error checking authentication status:', error);
        showNotAuthenticatedState();
    }
}

// Show public application form for non-authenticated users
function showNotAuthenticatedState() {
    console.log('User not authenticated - showing public application form');
    hideAllMessages();
    
    // Show a simple application form
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="text-center mb-12">
                    <h1 class="text-4xl font-bold text-gray-900 mb-4">Join the ReelGrub Creator Program</h1>
                    <p class="text-xl text-gray-600">Share your favorite food spots with the world and help others discover amazing restaurants through TikTok videos.</p>
                </div>

                <!-- Why Join Section -->
                <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Why Join as a Creator?</h2>
                    <div class="grid md:grid-cols-3 gap-8">
                        <div class="text-center">
                            <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Grow Your Audience</h3>
                            <p class="text-gray-600">Reach food lovers who are actively looking for restaurant recommendations.</p>
                        </div>
                        <div class="text-center">
                            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Engage Your Followers</h3>
                            <p class="text-gray-600">Share your favorite places with your followers and help them discover amazing restaurants through your recommendations.</p>
                        </div>
                        <div class="text-center">
                            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                            </div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Show Your Reach</h3>
                            <p class="text-gray-600">Map all the fun locations you have eaten at and showcase your culinary adventures to build your food influencer presence.</p>
                        </div>
                    </div>
                </div>

                <!-- Authentication Required -->
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Ready to Apply?</h2>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-900 mb-2">Sign In Required</h3>
                        <p class="text-gray-600 mb-6">Please sign in or create an account to submit your creator application.</p>
                        <div class="space-x-4">
                            <button id="show-login-btn" class="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                                Sign In
                            </button>
                            <button id="show-signup-btn" class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors">
                                Sign Up
                            </button>
                        </div>
                        <p class="text-sm text-gray-500 mt-4">
                            Don't worry, signing up is quick and free!
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for the auth buttons
        setTimeout(() => {
            const showLoginBtn = document.getElementById('show-login-btn');
            const showSignupBtn = document.getElementById('show-signup-btn');
            
            console.log('Looking for auth buttons...');
            console.log('showLoginBtn:', showLoginBtn);
            console.log('showSignupBtn:', showSignupBtn);
            
            if (showLoginBtn) {
                console.log('Adding click listener to login button');
                showLoginBtn.addEventListener('click', () => {
                    console.log('Login button clicked');
                    openAuthModal('login');
                });
            } else {
                console.error('Login button not found');
            }
            
            if (showSignupBtn) {
                console.log('Adding click listener to signup button');
                showSignupBtn.addEventListener('click', () => {
                    console.log('Signup button clicked');
                    openAuthModal('signup');
                });
            } else {
                console.error('Signup button not found');
            }
        }, 100);
    }
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
    
    // Update success message content with QR code
    const successTitle = successMessage.querySelector('h3');
    const successText = successMessage.querySelector('p');
    const continueLink = successMessage.querySelector('a');
    
    if (successTitle) successTitle.textContent = 'Application Submitted!';
    if (successText) {
        successText.innerHTML = `
            <div class="mb-6">
                <p class="text-gray-600 mb-4">To verify your account, please complete one of the following steps:</p>
                
                <!-- Option 1: QR Code -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 class="text-lg font-semibold text-blue-900 mb-2">Option 1: Scan QR Code (Easiest)</h4>
                    <div id="qrcode-container" class="flex justify-center my-3"></div>
                    <p class="text-sm text-blue-800">1. Scan the code to open our TikTok profile @reelgrub</p>
                    <p class="text-sm text-blue-800">2. Tap 'Message' and send us your magic word</p>
                </div>
                
                <!-- Option 2: Manual -->
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <h4 class="text-lg font-semibold text-purple-900 mb-2">Option 2: Manual</h4>
                    <p class="text-sm text-purple-800">Open TikTok, search for <strong>@reelgrub</strong>, and send us a DM with your magic word</p>
                </div>
                
                <!-- Magic Word Display -->
                <div class="bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-300 rounded-lg p-4 text-center">
                    <p class="text-purple-800 mb-2"><strong>Your Magic Word:</strong></p>
                    <p class="text-3xl font-bold text-purple-600">${magicWord}</p>
                </div>
                
                <p class="text-gray-600 mt-4 text-sm">We'll review your application and get back to you soon!</p>
            </div>
        `;
    }
    if (continueLink) continueLink.textContent = 'Continue Exploring';
    
    // Generate QR Code
    const qrContainer = document.getElementById('qrcode-container');
    if (qrContainer) {
        qrContainer.innerHTML = ''; // Clear any previous QR code
        const tiktokProfileUrl = 'https://www.tiktok.com/@reelgrub';
        
        try {
            const qr = qrcode(0, 'M'); // type 0, error correction 'M'
            qr.addData(tiktokProfileUrl);
            qr.make();
            qrContainer.innerHTML = qr.createImgTag(4, 8); // (size, margin)
            console.log('QR code generated successfully');
        } catch (e) {
            console.error("Error generating QR code:", e);
            qrContainer.innerHTML = '<p class="text-sm text-gray-500">QR code unavailable</p>';
        }
    }
    
    successMessage.classList.remove('hidden');
}

// Show existing application
function showExistingApplication(application) {
    hideAllMessages();
    
    // Get elements
    const successIcon = successMessage.querySelector('.w-16.h-16');
    const successIconSvg = successMessage.querySelector('.w-8.h-8');
    const successTitle = successMessage.querySelector('h3');
    const successText = successMessage.querySelector('p');
    const continueLink = successMessage.querySelector('a');
    
    // Update icon and colors based on status
    if (application.status === 'approved') {
        // Approved: Green checkmark
        if (successIcon) {
            successIcon.className = 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4';
        }
        if (successIconSvg) {
            successIconSvg.setAttribute('class', 'w-8 h-8 text-green-600');
            successIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
        }
    } else if (application.status === 'rejected') {
        // Rejected: Red X
        if (successIcon) {
            successIcon.className = 'w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4';
        }
        if (successIconSvg) {
            successIconSvg.setAttribute('class', 'w-8 h-8 text-red-600');
            successIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
        }
    } else {
        // Pending: Yellow clock
        if (successIcon) {
            successIcon.className = 'w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4';
        }
        if (successIconSvg) {
            successIconSvg.setAttribute('class', 'w-8 h-8 text-yellow-600');
            successIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
        }
    }
    
    // Update title
    if (successTitle) {
        if (application.status === 'approved') {
            successTitle.textContent = 'Application Approved!';
        } else if (application.status === 'rejected') {
            successTitle.textContent = 'Application Status';
        } else {
            successTitle.textContent = 'Application Under Review';
        }
    }
    
    // Update content
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
                <div class="mb-4">
                    <!-- Option 1: QR Code -->
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 class="text-lg font-semibold text-blue-900 mb-2">Option 1: Scan QR Code (Easiest)</h4>
                        <div id="existing-qrcode-container" class="flex justify-center my-3"></div>
                        <p class="text-sm text-blue-800">1. Scan the code to open our TikTok profile @reelgrub</p>
                        <p class="text-sm text-blue-800">2. Tap 'Message' and send us your magic word</p>
                    </div>
                    
                    <!-- Option 2: Manual -->
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                        <h4 class="text-lg font-semibold text-purple-900 mb-2">Option 2: Manual</h4>
                        <p class="text-sm text-purple-800">Open TikTok, search for <strong>@reelgrub</strong>, and send us a DM with your magic word</p>
                    </div>
                    
                    <!-- Magic Word Display -->
                    <div class="bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-300 rounded-lg p-4 text-center mb-4">
                        <p class="text-purple-800 mb-2"><strong>Your Magic Word:</strong></p>
                        <p class="text-3xl font-bold text-purple-600">${application.magic_word}</p>
                    </div>
                </div>
            `;
        }
        
        // Status-specific messages
        if (application.status === 'pending') {
            statusMessage = `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-blue-800 mb-2"><strong>Status:</strong> <span class="${statusColor} font-semibold capitalize">${application.status}</span></p>
                    <p class="text-blue-800 mb-2"><strong>TikTok Handle:</strong> @${application.tiktok_handle}</p>
                    <p class="text-blue-700">We're currently reviewing your application and will get back to you soon!</p>
                </div>
            `;
        } else if (application.status === 'approved') {
            statusMessage = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                    <p class="text-green-800 mb-3"><strong>Status:</strong> <span class="${statusColor} font-semibold capitalize">${application.status}</span></p>
                    <p class="text-green-800 mb-3"><strong>TikTok Handle:</strong> @${application.tiktok_handle}</p>
                    <p class="text-green-700 text-lg mb-4">🎉 Congratulations! Your application has been approved!</p>
                    <p class="text-green-600">You are now a verified creator and can start sharing your restaurant recommendations with the ReelGrub community.</p>
                </div>
            `;
        } else if (application.status === 'rejected') {
            statusMessage = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 mb-2"><strong>Status:</strong> <span class="${statusColor} font-semibold capitalize">${application.status}</span></p>
                    <p class="text-red-800 mb-2"><strong>TikTok Handle:</strong> @${application.tiktok_handle}</p>
                    <p class="text-red-700">Your application was not approved at this time. You can reapply if you wish.</p>
                </div>
            `;
        }
        
        successText.innerHTML = `
            ${magicWordSection}
            ${statusMessage}
        `;
    }
    
    // Update continue button
    if (continueLink) {
        if (application.status === 'approved') {
            continueLink.textContent = 'Start Creating';
            continueLink.href = '/explore';
            continueLink.className = 'inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors';
        } else {
            continueLink.textContent = 'Continue Exploring';
            continueLink.href = '/explore';
            continueLink.className = 'inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors';
        }
    }
    
    // Generate QR Code for existing applications (if status is not approved)
    if (application.status !== 'approved') {
        const existingQrContainer = document.getElementById('existing-qrcode-container');
        if (existingQrContainer) {
            existingQrContainer.innerHTML = ''; // Clear any previous QR code
            const tiktokProfileUrl = 'https://www.tiktok.com/@reelgrub';
            
            try {
                const qr = qrcode(0, 'M'); // type 0, error correction 'M'
                qr.addData(tiktokProfileUrl);
                qr.make();
                existingQrContainer.innerHTML = qr.createImgTag(4, 8); // (size, margin)
                console.log('QR code for existing application generated successfully');
            } catch (e) {
                console.error("Error generating QR code for existing application:", e);
                existingQrContainer.innerHTML = '<p class="text-sm text-gray-500">QR code unavailable</p>';
            }
        }
    }
    
    successMessage.classList.remove('hidden');
}

// Show simple approved message for approved creators
function showApprovedMessage(application) {
    hideAllMessages();
    
    // Get elements
    const successIcon = successMessage.querySelector('.w-16.h-16');
    const successIconSvg = successMessage.querySelector('.w-8.h-8');
    const successTitle = successMessage.querySelector('h3');
    const successText = successMessage.querySelector('p');
    const continueLink = successMessage.querySelector('a');
    
    // Set approved styling
    if (successIcon) {
        successIcon.className = 'w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4';
    }
    if (successIconSvg) {
        successIconSvg.setAttribute('class', 'w-8 h-8 text-green-600');
        successIconSvg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
    }
    
    if (successTitle) {
        successTitle.textContent = 'Creator Status: Approved';
    }
    
    if (successText) {
        successText.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                <p class="text-green-800 mb-3"><strong>Congratulations!</strong></p>
                <p class="text-green-700 text-lg mb-4">🎉 Your request to join as a creator has been approved!</p>
                <p class="text-green-600">You are now a verified creator and can start sharing your restaurant recommendations with the ReelGrub community.</p>
            </div>
        `;
    }
    
    if (continueLink) {
        continueLink.textContent = 'Start Creating';
        continueLink.href = '/explore';
        continueLink.className = 'inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors';
    }
    
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

// Function to convert text to URL-friendly format
function makeUrlFriendly(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
}

// Setup event listeners
function setupEventListeners() {
    // Application form submission
    if (applicationForm) {
        applicationForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Auto-fill desired username from TikTok handle and live preview
    const tiktokHandleInput = document.getElementById('tiktok-handle');
    const desiredUsernameInput = document.getElementById('desired-username');
    const usernamePreview = document.getElementById('username-preview');
    
    // Auto-fill desired username when TikTok handle changes
    if (tiktokHandleInput && desiredUsernameInput) {
        tiktokHandleInput.addEventListener('keyup', function() {
            const tiktokHandle = this.value.trim().replace(/^@/, '');
            if (tiktokHandle && !desiredUsernameInput.value.trim()) {
                // Only auto-fill if the desired username field is empty
                const urlFriendlyUsername = makeUrlFriendly(tiktokHandle);
                desiredUsernameInput.value = urlFriendlyUsername;
                updateUsernamePreview(urlFriendlyUsername);
            }
        });
    }
    
    // Live preview for desired username
    if (desiredUsernameInput && usernamePreview) {
        desiredUsernameInput.addEventListener('keyup', function() {
            const username = this.value.trim();
            const urlFriendlyUsername = makeUrlFriendly(username);
            updateUsernamePreview(urlFriendlyUsername);
        });
    }
    
    // Helper function to update the preview
    function updateUsernamePreview(username) {
        if (usernamePreview) {
            usernamePreview.textContent = username || 'your-username';
        }
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
        closeAuthModalBtn.addEventListener('click', () => {
            console.log('Close auth modal button clicked');
            closeAuthModal();
        });
    } else {
        console.error('Close auth modal button not found');
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
    const desiredUsernameInput = document.getElementById('desired-username');
    
    if (!tiktokHandleInput) {
        console.error('TikTok handle input not found');
        return;
    }
    
    if (!desiredUsernameInput) {
        console.error('Desired username input not found');
        return;
    }
    
    const tiktokHandle = tiktokHandleInput.value.trim();
    const desiredUsername = desiredUsernameInput.value.trim();
    
    // Validate TikTok handle
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
    
    // Validate desired username
    if (!desiredUsername) {
        showErrorMessage('Please enter your desired username.');
        return;
    }
    
    // Validate username format (no spaces, special characters)
    const urlFriendlyUsername = makeUrlFriendly(desiredUsername);
    
    if (urlFriendlyUsername !== desiredUsername.toLowerCase() || urlFriendlyUsername.includes(' ')) {
        showErrorMessage('Username can only contain letters, numbers, and hyphens. No spaces or special characters allowed.');
        return;
    }
    
    if (urlFriendlyUsername.length < 3) {
        showErrorMessage('Username must be at least 3 characters long.');
        return;
    }
    
    console.log('Submitting application for TikTok handle:', cleanTikTokHandle, 'and username:', urlFriendlyUsername);
    
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
                    requested_username: urlFriendlyUsername,
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
    console.log('Auth state change - session:', session);
    
    if (event === 'SIGNED_IN' && session?.user) {
        console.log('User signed in, closing auth modal and checking application status...');
        closeAuthModal();
        
        // Check if user has an existing application
        const existingApplication = await checkApplicationStatus();
        console.log('Existing application found:', existingApplication);
        
        if (existingApplication) {
            if (existingApplication.status === 'approved') {
                console.log('User has approved application, showing approved message');
                showApprovedMessage(existingApplication);
            } else {
                console.log('User has non-approved application, showing existing application');
                showExistingApplication(existingApplication);
            }
        } else {
            console.log('No existing application, showing application form');
            showApplicationForm();
        }
        
        updateMobileCollectionsVisibility(true);
        // Stay on creators page - don't redirect
    } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, showing login required');
        showLoginRequired();
        updateMobileCollectionsVisibility(false);
    }
});

// Authentication modal functions
function openAuthModal(mode = 'login') {
    console.log('openAuthModal called with mode:', mode);
    console.log('authModal variable:', authModal);
    
    // Get modal element if not already set
    const modalElement = authModal || document.getElementById('auth-modal');
    console.log('modalElement:', modalElement);
    
    if (!modalElement) {
        console.error('Auth modal element not found!');
        return;
    }
    
    // Hide feedback
    const feedbackElement = authFeedback || document.getElementById('auth-feedback');
    if (feedbackElement) {
        feedbackElement.classList.add('hidden');
    }
    
    // Set initial mode
    if (mode === 'signup') {
        switchToSignup();
    } else {
        switchToLogin();
    }
    
    // Ensure close button has event listener
    const closeBtn = document.getElementById('close-auth-modal');
    if (closeBtn) {
        console.log('Setting up close button listener');
        // Remove any existing listener and add a new one
        closeBtn.onclick = () => {
            console.log('Close button clicked');
            closeAuthModal();
        };
    } else {
        console.error('Close button not found');
    }
    
    // Show modal
    modalElement.classList.remove('hidden');
    modalElement.classList.add('flex');
    modalElement.style.display = 'flex';
    console.log('Modal should now be visible');
}

function closeAuthModal() {
    console.log('closeAuthModal called');
    
    // Get modal element if not already set
    const modalElement = authModal || document.getElementById('auth-modal');
    
    if (!modalElement) {
        console.error('Auth modal not found in closeAuthModal');
        return;
    }
    
    modalElement.classList.add('hidden');
    modalElement.classList.remove('flex');
    modalElement.style.display = 'none';
    console.log('Auth modal hidden');
    
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
        console.log('Starting Google signin process...');
        
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
        
        console.log('Google signin initiated successfully, redirecting...');
        
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
