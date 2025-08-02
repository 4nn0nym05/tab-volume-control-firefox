// Content script to control audio elements
let globalVolumeMultiplier = 1.0;
let originalVolumes = new WeakMap();
let storedVolume = 100; // Fallback storage
let volumeApplied = false;
let retryCount = 0;
const MAX_RETRIES = 10;

// Get storage key based on current URL
function getStorageKey() {
  return `volume_${window.location.hostname}`;
}

// Load saved volume from storage
async function loadSavedVolume() {
  const storageKey = getStorageKey();

  try {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      const result = await browser.storage.local.get(storageKey);
      const savedVolume = result[storageKey];
      if (savedVolume !== undefined && savedVolume !== 100) {
        storedVolume = savedVolume;
        console.log(`Found saved volume: ${savedVolume}% for ${window.location.hostname}`);
        return savedVolume;
      }
    }
  } catch (error) {
    console.log('Storage not available, using default volume');
  }

  console.log(`No custom volume found for ${window.location.hostname}, using 100%`);
  return 100;
}

// Function to set volume for all audio/video elements
function setAllMediaVolume(multiplier) {
  globalVolumeMultiplier = multiplier;

  // Set volume for existing media elements
  const mediaElements = document.querySelectorAll('audio, video');
  let elementsFound = 0;

  mediaElements.forEach(element => {
    // Store original volume if not already stored
    if (!originalVolumes.has(element)) {
      originalVolumes.set(element, element.volume);
    }

    // Apply the multiplier to the original volume
    const originalVol = originalVolumes.get(element);
    element.volume = originalVol * multiplier;
    elementsFound++;
  });

  if (elementsFound > 0) {
    console.log(`Applied ${Math.round(multiplier * 100)}% volume to ${elementsFound} media elements`);
    volumeApplied = true;
  }

  return elementsFound;
}

// Auto-apply volume to new media elements
function applyVolumeToNewMedia(element) {
  // Store original volume and apply current multiplier
  if (!originalVolumes.has(element)) {
    originalVolumes.set(element, element.volume);
  }
  element.volume = originalVolumes.get(element) * globalVolumeMultiplier;
  console.log(`Applied ${Math.round(globalVolumeMultiplier * 100)}% volume to new media element`);
}

// Retry mechanism to apply volume
async function retryApplyVolume() {
  if (volumeApplied || retryCount >= MAX_RETRIES) {
    return;
  }

  retryCount++;
  console.log(`Retry attempt ${retryCount}/${MAX_RETRIES} to apply volume`);

  const savedVolume = await loadSavedVolume();
  const elementsFound = setAllMediaVolume(savedVolume / 100);

  if (elementsFound === 0 && retryCount < MAX_RETRIES) {
    // No media elements found yet, try again in a bit
    setTimeout(retryApplyVolume, 500);
  }
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setVolume') {
    setAllMediaVolume(message.volume);
    storedVolume = Math.round(message.volume * 100); // Store as percentage
    sendResponse({success: true});
  } else if (message.action === 'getVolume') {
    sendResponse({volume: storedVolume});
  } else if (message.action === 'storeVolume') {
    storedVolume = message.volume;
    sendResponse({success: true});
  }
});

// Monitor for new media elements
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const mediaElements = node.matches && node.matches('audio, video') ?
          [node] : node.querySelectorAll && node.querySelectorAll('audio, video');

        if (mediaElements && mediaElements.length > 0) {
          mediaElements.forEach(applyVolumeToNewMedia);
        }
      }
    });
  });
});

// Start observing when DOM is ready
if (document.body) {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  });
}

// Initialize: load saved volume and apply to existing elements
async function initialize() {
  console.log(`Content script initializing for ${window.location.hostname}`);

  const savedVolume = await loadSavedVolume();
  const elementsFound = setAllMediaVolume(savedVolume / 100);

  if (elementsFound === 0) {
    console.log('No media elements found initially, will retry...');
    // Start retry mechanism
    setTimeout(retryApplyVolume, 100);
  }
}

// Multiple initialization triggers
console.log(`Volume control content script loaded for ${window.location.hostname}`);

// Immediate initialization
initialize();

// DOM ready initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
}

// Window load initialization
window.addEventListener('load', initialize);

// Also try after a short delay in case media loads asynchronously
setTimeout(initialize, 1000);
setTimeout(initialize, 3000);