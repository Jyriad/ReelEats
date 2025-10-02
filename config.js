// --- Shared Configuration ---
// This file contains all shared configuration constants for the ReelEats application

export const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://jsuxrpnfofkigdfpnuua.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdXhycG5mb2ZraWdkZnBudXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU3NTMsImV4cCI6MjA2OTk1MTc1M30.EgMu5bfHNPcVGpQIL8pL_mEFTouQG1nXOnP0mee0WJ8',
    
    // Application Configuration
    APP_NAME: 'ReelEats',
    APP_VERSION: '1.152',
    
    // Local Storage Keys
    STORAGE_KEYS: {
        WATCHED_VIDEOS: 'reelEats_watchedVideos',
        CITY_DATA: 'reelEats_cityData'
    },
    
    // Map Configuration
    MAP_CONFIG: {
        DEFAULT_ZOOM: 12,
        CLUSTER_ZOOM: 15,
        MAX_ZOOM: 16
    },
    
    // Video Configuration
    VIDEO_CONFIG: {
        IFRAME_TIMEOUT: 3000,
        FALLBACK_DELAY: 100
    },
    
    // Google Maps API Configuration
    GOOGLE_MAPS_KEYS: {
        WEBSITE_KEY: 'AIzaSyBH3tTjAVW8wPk2ojqzmtoKSFzlqeM42ek', // For loading the script in HTML
        ADMIN_KEY: 'AIzaSyA23UG6AynwlN6KszWs7SDdACYEVyhVZLY'      // For direct API calls in JS
    }
};
