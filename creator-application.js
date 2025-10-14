// Creator Application System - Fixed and Reliable
const { createClient } = supabase;

// Initialize Supabase client
const supabaseClient = createClient(
    'https://jsuxrpnfofkigdfpnuua.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8'
);

// Global variables
let applicationForm, loginRequired, successMessage, errorMessage, loadingState;
let loginBtn, signupBtn, retryBtn;
let authModal, closeAuthModalBtn, loginForm, signupForm, switchAuthModeBtn, googleSigninBtn;

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
    
    // Hide auth modal on page load
    if (authModal) {
        authModal.classList.add('hidden');
        authModal.style.display = 'none';
        console.log('Auth modal hidden on page load');
        console.log('Modal classes after hiding:', authModal.className);
        console.log('Modal display style after hiding:', authModal.style.display);
    }
    
        // Check authentication status with a small delay to ensure session is loaded
        setTimeout(async () => {
            console.log('Running delayed authentication check...');
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                console.log('User already authenticated:', session.user.email, 'ID:', session.user.id);
                updateUserUI(session.user);
                try {
                    console.log('Calling checkApplicationStatus...');
                    
                    // Add a safety timeout - if checkApplicationStatus takes too long, show form
                    const checkPromise = checkApplicationStatus();
                    const safetyTimeout = new Promise((resolve) => {
                        setTimeout(() => {
                            console.log('Safety timeout: checkApplicationStatus taking too long, showing application form');
                            resolve(null);
                        }, 1500);
                    });
                    
                    const existingApplication = await Promise.race([checkPromise, safetyTimeout]);
                    console.log('checkApplicationStatus returned:', existingApplication);
                    
                    if (existingApplication) {
                        console.log('Found existing application, status:', existingApplication.status);
                        if (existingApplication.status === 'approved') {
                            console.log('Showing approved message');
                            showApprovedMessage(existingApplication);
                        } else {
                            console.log('Showing existing application (magic word)');
                            showExistingApplication(existingApplication);
                        }
                    } else {
                        console.log('No existing application found or timeout occurred, showing application form');
                        showApplicationForm();
                    }
                    updateMobileCollectionsVisibility(true);
                } catch (error) {
                    console.error('Error in delayed auth check:', error);
                    console.log('Error occurred, showing application form as fallback for logged-in user');
                    showApplicationForm();
                    updateMobileCollectionsVisibility(true);
                }
            } else {
                console.log('No session found, showing login required');
                updateUserUI(null);
                showNotAuthenticatedState();
                updateMobileCollectionsVisibility(false);
            }
        }, 50);
    
    // Setup event listeners
    setupEventListeners();
    
    // Update page title with version
    document.title = `Join the ReelGrub Creator Program - v1.500`;
});

// Check Application Status
async function checkApplicationStatus() {
    try {
        console.log('checkApplicationStatus: Starting...');
        
        // Define the elements we'll be showing/hiding
        const applicationForm = document.getElementById('application-form');
        
        // Get the current user session
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
            console.log('User is logged in:', user.email);
            // --- USER IS LOGGED IN ---
            
            // User is logged in - no need to hide login prompt since we'll show appropriate content
            
            // Query for an existing application with timeout
            console.log('Creating database query promise...');
            const queryPromise = supabaseClient
                .from('creator_applications')
                .select('id, user_id, tiktok_handle, requested_username, magic_word, status, created_at')
                .eq('user_id', user.id)
                .single();
            
            console.log('Creating timeout promise...');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                    console.log('Database query timeout triggered after 1 second');
                    reject(new Error('Database query timeout'));
                }, 1000)
            );
            
            console.log('Starting Promise.race with database query and timeout...');
            const { data: application, error } = await Promise.race([queryPromise, timeoutPromise]);
            
            console.log('Database query completed. Application:', application, 'Error:', error);
            
            if (application && !error) {
                // --- Logged-in user HAS an application ---
                console.log('User has existing application, status:', application.status);
                if (application.status === 'approved') {
                    console.log('Showing approved message');
                    showApprovedMessage(application);
                } else {
                    console.log('Showing existing application (magic word)');
                    showExistingApplication(application);
                }
                return application;
            } else {
                // --- Logged-in user does NOT have an application ---
                console.log('User has no existing application, showing form');
                showApplicationForm();
                return null;
            }
            
        } else {
            console.log('User is not logged in');
            // --- USER IS NOT LOGGED IN ---
            showNotAuthenticatedState();
            return null;
        }
        
    } catch (error) {
        console.error('Error in checkApplicationStatus:', error);
        console.log('Error details:', error.message, error.code);
        // Fallback: show application form for logged-in users
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            console.log('Error occurred, showing application form as fallback for user:', user.email);
            showApplicationForm();
        } else {
            showNotAuthenticatedState();
        }
        return null;
    }
}

// Magic Word Generator
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
        
        // Create QR code for the magic word
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        
        // Create QR code element
        const qrDiv = document.createElement('div');
        qrDiv.style.cssText = `
            width: 200px;
            height: 200px;
            margin: 0 auto;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 2px solid #333;
        `;
        
        // Generate QR code HTML
        qrDiv.innerHTML = qr.createImgTag(4, 8);
        
        qrContainer.appendChild(qrDiv);
        
        // Add label below QR code
        const label = document.createElement('p');
        label.textContent = `Magic Word: ${text}`;
        label.style.cssText = `
            text-align: center;
            margin-top: 8px;
            font-size: 12px;
            color: #666;
            font-weight: bold;
        `;
        qrContainer.appendChild(label);
    }
}

// Generate QR code for TikTok account
function generateTikTokQRCode() {
    const tiktokQRContainer = document.getElementById('tiktok-qr-code');
    if (tiktokQRContainer) {
        tiktokQRContainer.innerHTML = '';
        
        // Create QR code for TikTok account
        const tiktokUrl = 'https://www.tiktok.com/@reelgrub';
        
        // Use the QR code generator library
        const qr = qrcode(0, 'M');
        qr.addData(tiktokUrl);
        qr.make();
        
        // Create QR code element
        const qrDiv = document.createElement('div');
        qrDiv.style.cssText = `
            width: 150px;
            height: 150px;
            margin: 0 auto;
            background: white;
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // Generate QR code HTML
        qrDiv.innerHTML = qr.createImgTag(4, 8);
        
        // Add click handler to open TikTok
        qrDiv.addEventListener('click', () => {
            window.open(tiktokUrl, '_blank');
        });
        
        qrDiv.style.cursor = 'pointer';
        qrDiv.title = 'Click to open @reelgrub on TikTok';
        
        tiktokQRContainer.appendChild(qrDiv);
        
        // Add label below QR code
        const label = document.createElement('p');
        label.textContent = 'Follow @reelgrub on TikTok';
        label.style.cssText = `
            text-align: center;
            margin-top: 8px;
            font-size: 12px;
            color: #666;
        `;
        tiktokQRContainer.appendChild(label);
    }
}

// Show application form
function showApplicationForm() {
    console.log('showApplicationForm called');
    console.log('applicationForm element:', applicationForm);
    
    // Hide all messages first
    hideAllMessages();
    
    // Show the application form
    if (applicationForm) {
        applicationForm.classList.remove('hidden');
        console.log('Application form should now be visible');
    } else {
        console.error('Application form element not found!');
    }
    
    // Also show the benefits section for logged-in users
    showBenefitsSection();
}

// Show benefits section for all users
function showBenefitsSection() {
    const mainContent = document.querySelector('main');
    if (mainContent && !document.getElementById('benefits-section')) {
        // Create benefits section
        const benefitsSection = document.createElement('div');
        benefitsSection.id = 'benefits-section';
        benefitsSection.className = 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8';
        benefitsSection.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-6 text-center">Why Join as a Creator?</h2>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
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
        `;
        
        // Insert benefits section before the application form
        if (applicationForm) {
            applicationForm.parentNode.insertBefore(benefitsSection, applicationForm);
        }
    }
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
        errorText.textContent = message;
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
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
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

                <!-- Sign In Button -->
                <div class="text-center">
                    <button id="signin-apply-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
                        Sign In to Apply
                    </button>
                </div>
            </div>
        `;
        
        // Re-attach event listener to the new login button
        const newLoginBtn = document.getElementById('signin-apply-btn');
        if (newLoginBtn) {
            newLoginBtn.addEventListener('click', (e) => {
                console.log('Sign In to Apply button clicked');
                e.preventDefault();
                openAuthModal('login');
            });
        } else {
            console.error('Sign In to Apply button not found after creation');
        }
    }
}

// Show existing application (magic word instructions)
function showExistingApplication(application) {
    hideAllMessages();
    
    // Show success message with application details
    successMessage.classList.remove('hidden');
    
    // Show benefits section for logged-in users
    showBenefitsSection();
    
    // Populate the success message with application data
    const displayTiktokHandle = document.getElementById('display-tiktok-handle');
    const displayUsername = document.getElementById('display-username');
    const displayStatus = document.getElementById('display-status');
    const submittedDate = document.getElementById('submitted-date');
    const magicWord = document.getElementById('magic-word');
    const magicWordInstruction = document.getElementById('magic-word-instruction');
    
    if (displayTiktokHandle) displayTiktokHandle.textContent = '@' + application.tiktok_handle;
    if (displayUsername) displayUsername.textContent = application.requested_username;
    if (displayStatus) displayStatus.textContent = application.status.charAt(0).toUpperCase() + application.status.slice(1);
    if (submittedDate) submittedDate.textContent = new Date(application.created_at).toLocaleDateString();
    if (magicWord) magicWord.textContent = application.magic_word;
    if (magicWordInstruction) magicWordInstruction.textContent = application.magic_word;
    
    // Generate TikTok QR code
    generateTikTokQRCode();
}

// Show approved message
function showApprovedMessage(application) {
    hideAllMessages();
    
    // Show success message with approval details
    successMessage.classList.remove('hidden');
    
    // Show benefits section for approved creators
    showBenefitsSection();
    
    // Clear the success message content and show approval message
    const successMessageContent = document.querySelector('#success-message .bg-white');
    if (successMessageContent) {
        successMessageContent.innerHTML = `
            <div class="text-center mb-8">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
                <h2 class="text-3xl font-bold text-green-800 mb-4">🎉 Congratulations!</h2>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Your application to be a creator has been approved!</h3>
                <p class="text-gray-600 mb-6">Welcome to the ReelGrub Creator Program. You can now start adding your favorite restaurants and creating amazing food content.</p>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 class="font-medium text-gray-800 mb-2">Your Creator Details:</h4>
                    <div class="text-sm text-gray-600 space-y-1">
                        <p><strong>TikTok Handle:</strong> @${application.tiktok_handle}</p>
                        <p><strong>Creator Username:</strong> ${application.requested_username}</p>
                        <p><strong>Approved:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                
                <a href="/dashboard" class="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
                    Go to Creator Dashboard
                </a>
            </div>
        `;
    }
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
        let userHasEditedUsername = false;
        
        // Track if user has manually edited the username field
        desiredUsernameInput.addEventListener('input', function() {
            userHasEditedUsername = true;
        });
        
        tiktokHandleInput.addEventListener('keyup', function() {
            const tiktokHandle = this.value.trim().replace(/^@/, '');
            if (tiktokHandle && !userHasEditedUsername) {
                // Only auto-fill if the user hasn't manually edited the username field
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
    
    // Login button
    if (loginBtn) {
        console.log('Setting up login button event listener');
        loginBtn.addEventListener('click', (e) => {
            console.log('Login button clicked');
            e.preventDefault();
            openAuthModal('login');
        });
    } else {
        console.log('Login button not found during setup');
    }
    
    // Signup button
    if (signupBtn) {
        console.log('Setting up signup button event listener');
        signupBtn.addEventListener('click', (e) => {
            console.log('Signup button clicked');
            e.preventDefault();
            openAuthModal('signup');
        });
    } else {
        console.log('Signup button not found during setup');
    }
    
    // Retry button
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
    
    // Auth modal
    if (closeAuthModalBtn) {
        closeAuthModalBtn.addEventListener('click', closeAuthModal);
    }
    
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                closeAuthModal();
            }
        });
    }
    
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Signup form
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Switch auth mode
    if (switchAuthModeBtn) {
        switchAuthModeBtn.addEventListener('click', switchAuthMode);
    }
    
    // Google signin
    if (googleSigninBtn) {
        googleSigninBtn.addEventListener('click', handleGoogleSignin);
    }
    
    // Mobile menu functionality
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuModal = document.getElementById('mobile-menu-modal');
    const closeMobileMenu = document.getElementById('close-mobile-menu');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenuModal) {
                mobileMenuModal.classList.remove('hidden');
                mobileMenuModal.style.display = 'flex';
            }
        });
    }
    
    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', () => {
            if (mobileMenuModal) {
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
            }
        });
    }
    
    if (mobileMenuModal) {
        mobileMenuModal.addEventListener('click', (e) => {
            if (e.target === mobileMenuModal) {
                mobileMenuModal.classList.add('hidden');
                mobileMenuModal.style.display = 'none';
            }
        });
    }
    
    // Mobile auth buttons
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const mobileSignupBtn = document.getElementById('mobile-signup-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    
    if (mobileAuthBtn) {
        mobileAuthBtn.addEventListener('click', () => {
            closeMobileMenuModal();
            openAuthModal('login');
        });
    }
    
    if (mobileSignupBtn) {
        mobileSignupBtn.addEventListener('click', () => {
            closeMobileMenuModal();
            openAuthModal('signup');
        });
    }
    
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            closeMobileMenuModal();
            handleLogout();
        });
    }
    
    // Desktop logout button
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
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

// Show magic word message
function showMagicWordMessage(tiktokHandle, magicWord) {
    console.log('showMagicWordMessage called');
    hideAllMessages();
    
    // Hide the application form
    if (applicationForm) {
        applicationForm.classList.add('hidden');
        console.log('Application form hidden');
    }
    
    // Show the success message
    successMessage.classList.remove('hidden');
    console.log('Success message shown');
    
    // Populate the success message
    const displayTiktokHandle = document.getElementById('display-tiktok-handle');
    const displayUsername = document.getElementById('display-username');
    const displayStatus = document.getElementById('display-status');
    const submittedDate = document.getElementById('submitted-date');
    const magicWordElement = document.getElementById('magic-word');
    const magicWordInstruction = document.getElementById('magic-word-instruction');
    
    if (displayTiktokHandle) displayTiktokHandle.textContent = '@' + tiktokHandle;
    if (displayUsername) displayUsername.textContent = document.getElementById('desired-username').value.trim();
    if (displayStatus) displayStatus.textContent = 'Pending';
    if (submittedDate) submittedDate.textContent = new Date().toLocaleDateString();
    if (magicWordElement) magicWordElement.textContent = magicWord;
    if (magicWordInstruction) magicWordInstruction.textContent = magicWord;
    
    // Generate TikTok QR code
    generateTikTokQRCode();
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
            showErrorMessage('Login failed: ' + error.message);
            return;
        }
        
        console.log('Login successful:', data.user.email);
        // Don't close modal or check status here - let onAuthStateChange handle it
        // This prevents race conditions and duplicate processing
        
    } catch (error) {
        console.error('Login error:', error);
        showErrorMessage('Login failed. Please try again.');
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
            showErrorMessage('Signup failed: ' + error.message);
            return;
        }
        
        console.log('Signup successful:', data.user.email);
        closeAuthModal();
        
        // Check application status after signup
        setTimeout(async () => {
            await checkApplicationStatus();
        }, 100);
        
    } catch (error) {
        console.error('Signup error:', error);
        showErrorMessage('Signup failed. Please try again.');
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
            showErrorMessage('Google signin failed: ' + error.message);
        }
    } catch (error) {
        console.error('Google signin error:', error);
        showErrorMessage('Google signin failed. Please try again.');
    }
}

// Open auth modal
function openAuthModal(mode = 'login') {
    console.log('openAuthModal called with mode:', mode);
    console.log('authModal variable:', authModal);
    
    // Try to get the modal again if it's not found
    if (!authModal) {
        console.log('Auth modal not found in variable, trying to get it again...');
        authModal = document.getElementById('auth-modal');
        console.log('Retrieved auth modal:', authModal);
    }
    
    if (!authModal) {
        console.error('Auth modal still not found after retry');
        return;
    }
    
    console.log('Auth modal found, showing modal');
    authModal.classList.remove('hidden');
    authModal.classList.add('flex');
    authModal.style.display = 'flex';
    authModal.style.zIndex = '9999';
    authModal.style.position = 'fixed';
    authModal.style.top = '0';
    authModal.style.left = '0';
    authModal.style.width = '100%';
    authModal.style.height = '100%';
    
    // Set the appropriate form and title based on mode
    const titleElement = document.getElementById('auth-modal-title');
    const loginFormElement = document.getElementById('login-form');
    const signupFormElement = document.getElementById('signup-form');
    const switchBtn = document.getElementById('switch-auth-mode');
    
    if (mode === 'login') {
        if (titleElement) titleElement.textContent = 'Login';
        if (loginFormElement) loginFormElement.classList.remove('hidden');
        if (signupFormElement) signupFormElement.classList.add('hidden');
        if (switchBtn) switchBtn.textContent = "Don't have an account? Sign Up";
    } else {
        if (titleElement) titleElement.textContent = 'Sign Up';
        if (loginFormElement) loginFormElement.classList.add('hidden');
        if (signupFormElement) signupFormElement.classList.remove('hidden');
        if (switchBtn) switchBtn.textContent = 'Already have an account? Log in';
    }
    
    console.log('Auth modal should now be visible');
    console.log('Modal classes after showing:', authModal.className);
    console.log('Modal style after showing:', authModal.style.display);
    console.log('Modal computed style:', window.getComputedStyle(authModal).display);
}

// Close auth modal
function closeAuthModal() {
    console.log('closeAuthModal called');
    
    if (!authModal) {
        console.error('Auth modal not found');
        return;
    }
    
    authModal.classList.add('hidden');
    authModal.classList.remove('flex');
    authModal.style.display = 'none';
    console.log('Auth modal hidden');
}

// Switch auth mode
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

// Close mobile menu modal
function closeMobileMenuModal() {
    const mobileMenuModal = document.getElementById('mobile-menu-modal');
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
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Update user UI based on authentication state
function updateUserUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-button');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const mobileSignupBtn = document.getElementById('mobile-signup-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    
    if (user) {
        // User is logged in - hide login/signup, show logout
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        if (signupBtn) {
            signupBtn.style.display = 'none';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
        }
        if (mobileAuthBtn) {
            mobileAuthBtn.style.display = 'none';
        }
        if (mobileSignupBtn) {
            mobileSignupBtn.style.display = 'none';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'block';
        }
    } else {
        // User is logged out - show login/signup, hide logout
        if (loginBtn) {
            loginBtn.style.display = 'block';
        }
        if (signupBtn) {
            signupBtn.style.display = 'block';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        if (mobileAuthBtn) {
            mobileAuthBtn.style.display = 'block';
        }
        if (mobileSignupBtn) {
            mobileSignupBtn.style.display = 'block';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'none';
        }
    }
}

// Update mobile collections visibility
function updateMobileCollectionsVisibility(isVisible) {
    // This function can be used to show/hide mobile collections button
    // For now, it's a placeholder
}

// Listen for authentication state changes
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth state changed:', event, session?.user?.email);
    console.log('Auth state change - session:', session);
    
        if (event === 'SIGNED_IN' && session?.user) {
            console.log('User signed in, closing auth modal and checking application status...');
            updateUserUI(session.user);
            closeAuthModal();
            
            // Check if user has an existing application
            try {
                console.log('Checking for existing application from auth state change...');
                
                // Add a safety timeout - if checkApplicationStatus takes too long, show form
                const checkPromise = checkApplicationStatus();
                const safetyTimeout = new Promise((resolve) => {
                    setTimeout(() => {
                        console.log('Safety timeout: checkApplicationStatus taking too long, showing application form');
                        resolve(null);
                    }, 1500);
                });
                
                const existingApplication = await Promise.race([checkPromise, safetyTimeout]);
                console.log('Existing application found from auth state change:', existingApplication);
                
                if (existingApplication) {
                    if (existingApplication.status === 'approved') {
                        console.log('User has approved application, showing approved message');
                        showApprovedMessage(existingApplication);
                    } else {
                        console.log('User has pending application, showing magic word instructions');
                        showExistingApplication(existingApplication);
                    }
                } else {
                    console.log('No existing application or timeout occurred, showing application form');
                    showApplicationForm();
                }
                
                updateMobileCollectionsVisibility(true);
            } catch (appCheckError) {
                console.error('Error in auth state change application check:', appCheckError);
                console.log('Error details:', appCheckError.message, appCheckError.code);
                console.log('Error occurred, showing application form as fallback for logged-in user');
                showApplicationForm();
                updateMobileCollectionsVisibility(true);
            }
            // Stay on creators page - don't redirect
        } else if (event === 'SIGNED_OUT') {
            console.log('User signed out, showing login required');
            updateUserUI(null);
            showNotAuthenticatedState();
            updateMobileCollectionsVisibility(false);
        }
});