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

                <!-- Public Application Form -->
                <div class="bg-white rounded-lg shadow-lg p-8">
                    <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Apply Now</h2>
                    <form id="public-creator-application-form" class="space-y-6">
                        <div>
                            <label for="public-tiktok-handle" class="block text-sm font-medium text-gray-700 mb-2">TikTok Handle</label>
                            <div class="flex">
                                <span class="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">@</span>
                                <input type="text" id="public-tiktok-handle" name="tiktok_handle" required 
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                       placeholder="your_tiktok_handle">
                            </div>
                        </div>
                        <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            Submit Application
                        </button>
                    </form>
                    
                    <!-- Success/Error Messages -->
                    <div id="public-success-message" class="hidden mt-6 text-center">
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h3>
                        <p class="text-gray-600 mb-6">Thanks for applying! We'll review your application and get back to you soon.</p>
                        <a href="/explore" class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors">
                            Continue Exploring
                        </a>
                    </div>
                    
                    <div id="public-error-message" class="hidden mt-6 text-center">
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-900 mb-2">Error</h3>
                        <p id="public-error-text" class="text-gray-600 mb-6"></p>
                        <button onclick="location.reload()" class="inline-block bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for the public form
        const publicForm = document.getElementById('public-creator-application-form');
        if (publicForm) {
            publicForm.addEventListener('submit', handlePublicFormSubmission);
        }
    }
}

// Handle public form submission (for non-authenticated users)
async function handlePublicFormSubmission(e) {
    e.preventDefault();
    
    const form = e.target;
    const tiktokHandle = form.querySelector('#public-tiktok-handle').value.trim();
    
    if (!tiktokHandle) {
        showPublicErrorMessage('Please enter your TikTok handle');
        return;
    }
    
    try {
        // Generate magic word
        const magicWord = generateMagicWord();
        
        // Submit to database (without user_id since user is not authenticated)
        const { data, error } = await supabaseClient
            .from('creator_applications')
            .insert([
                {
                    tiktok_handle: tiktokHandle,
                    magic_word: magicWord,
                    status: 'pending',
                    user_id: null // No user ID for non-authenticated users
                }
            ]);
        
        if (error) {
            console.error('Error submitting public application:', error);
            showPublicErrorMessage('Failed to submit application. Please try again.');
            return;
        }
        
        // Show success message with magic word
        showPublicSuccessMessage(tiktokHandle, magicWord);
        
    } catch (error) {
        console.error('Error submitting public application:', error);
        showPublicErrorMessage('An unexpected error occurred. Please try again.');
    }
}

// Show public success message with magic word
function showPublicSuccessMessage(tiktokHandle, magicWord) {
    const form = document.getElementById('public-creator-application-form');
    const successMessage = document.getElementById('public-success-message');
    const errorMessage = document.getElementById('public-error-message');
    
    if (form) form.style.display = 'none';
    if (errorMessage) errorMessage.classList.add('hidden');
    
    if (successMessage) {
        successMessage.innerHTML = `
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Application Submitted!</h3>
            <p class="text-gray-600 mb-4">Thanks for applying! We'll review your application and get back to you soon.</p>
            
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <p class="text-purple-800 mb-2"><strong>Your Magic Word:</strong></p>
                <p class="text-2xl font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-lg inline-block mb-3">${magicWord}</p>
                <p class="text-sm text-purple-700">
                    <strong>Verification Instructions:</strong><br>
                    To verify your account, please send a Direct Message from your TikTok account <strong>@${tiktokHandle}</strong> with your magic word: <strong>${magicWord}</strong>
                </p>
            </div>
            
            <a href="/explore" class="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors">
                Continue Exploring
            </a>
        `;
        successMessage.classList.remove('hidden');
    }
}

// Show public error message
function showPublicErrorMessage(message) {
    const form = document.getElementById('public-creator-application-form');
    const successMessage = document.getElementById('public-success-message');
    const errorMessage = document.getElementById('public-error-message');
    const errorText = document.getElementById('public-error-text');
    
    if (form) form.style.display = 'block';
    if (successMessage) successMessage.classList.add('hidden');
    
    if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
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
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <strong class="text-purple-800">Your Magic Word:</strong><br>
                    <span class="text-2xl font-bold text-purple-600 bg-purple-100 px-4 py-2 rounded-lg inline-block mt-2 mb-3">${application.magic_word}</span><br>
                    <div class="text-sm text-purple-700 mt-3">
                        <strong>Verification Instructions:</strong><br>
                        To verify your account, please send a Direct Message from your TikTok account <strong>@${application.tiktok_handle}</strong> with your magic word: <strong>${application.magic_word}</strong>
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
    console.log('closeAuthModal called');
    if (!authModal) {
        console.error('Auth modal not found in closeAuthModal');
        return;
    }
    
    authModal.classList.add('hidden');
    authModal.style.display = 'none';
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
