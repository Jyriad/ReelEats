// --- Video Helper Functions ---
// This file contains helper functions for video loading and management

import { CONFIG } from './config.js';

/**
 * Extracts video ID from TikTok embed HTML
 * @param {string} embedHtml - The TikTok embed HTML
 * @returns {string|null} - The video ID or null if not found
 */
export function extractVideoId(embedHtml) {
    const videoIdMatch = embedHtml.match(/data-video-id="(\d+)"/);
    return videoIdMatch ? videoIdMatch[1] : null;
}

/**
 * Creates an iframe element for TikTok video
 * @param {string} videoId - The TikTok video ID
 * @returns {string} - HTML string for the iframe
 */
export function createVideoIframe(videoId) {
    return `
        <iframe 
            src="https://www.tiktok.com/embed/v2/${videoId}?lang=en-US" 
            width="330" 
            height="585" 
            frameborder="0" 
            allowfullscreen
            allow="encrypted-media"
            style="border: none; background: white;">
        </iframe>
    `;
}

/**
 * Handles iframe loading with fallback to blockquote
 * @param {HTMLElement} videoContainer - The container element
 * @param {string} embedHtml - The original embed HTML
 * @param {Function} fallbackFunction - Function to call if iframe fails
 */
export function handleIframeLoading(videoContainer, embedHtml, fallbackFunction) {
    setTimeout(() => {
        const iframe = videoContainer.querySelector('iframe');
        if (iframe) {
            iframe.onload = () => {
                console.log('✅ Direct iframe loaded');
            };
            iframe.onerror = () => {
                console.log('❌ Direct iframe failed, trying blockquote...');
                fallbackFunction();
            };
            
            // Check if iframe content is loading after timeout
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (!iframeDoc || iframeDoc.body.children.length === 0) {
                        console.log('⚠️ Iframe appears empty, trying blockquote...');
                        fallbackFunction();
                    }
                } catch (e) {
                    // Cross-origin error is expected and means iframe is working
                    console.log('✅ Iframe cross-origin (likely working)');
                }
            }, CONFIG.VIDEO_CONFIG.IFRAME_TIMEOUT);
        }
    }, CONFIG.VIDEO_CONFIG.FALLBACK_DELAY);
}

/**
 * Loads video using blockquote approach
 * @param {HTMLElement} videoContainer - The container element
 * @param {string} embedHtml - The TikTok embed HTML
 */
export function loadVideoWithBlockquote(videoContainer, embedHtml) {
    console.log('🔄 Loading video with blockquote approach...');
    videoContainer.innerHTML = embedHtml;
    
    // Make blockquote visible
    const blockquotes = videoContainer.querySelectorAll('blockquote.tiktok-embed');
    blockquotes.forEach(bq => {
        bq.style.visibility = 'visible';
        bq.style.display = 'block';
    });
    
    // Trigger TikTok script
    setTimeout(() => {
        if (window.tiktokEmbed && typeof window.tiktokEmbed.load === 'function') {
            window.tiktokEmbed.load();
        }
    }, CONFIG.VIDEO_CONFIG.FALLBACK_DELAY);
}

/**
 * Shows "no video available" message
 * @param {HTMLElement} videoContainer - The container element
 * @param {string} restaurantName - The name of the restaurant
 */
export function showNoVideoMessage(videoContainer, restaurantName) {
    videoContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white p-4">No video available for ${restaurantName}</div>`;
}
