document.addEventListener('DOMContentLoaded', function() {
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeDisplay = document.getElementById('volumeDisplay');
  const muteButton = document.getElementById('mute');
  const resetButton = document.getElementById('reset');

  let isMuted = false;
  let previousVolume = 100;
  let currentTabId = null;

  const storage = {
    async get(key) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        const result = await browser.storage.local.get(key);
        return result[key];
      }
      return undefined;
    },

    async set(key, value) {
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        await browser.storage.local.set({[key]: value});
      }
    }
  };

  async function getStorageKey() {
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    const url = new URL(tabs[0].url);
    return `volume_${url.hostname}`;
  }

  async function initializePopup() {
    try {
      const tabs = await browser.tabs.query({active: true, currentWindow: true});
      currentTabId = tabs[0].id;

      const storageKey = await getStorageKey();
      const storedVolume = await storage.get(storageKey);

      let volumeToSet;
      if (storedVolume !== undefined && storedVolume !== null) {
        volumeToSet = parseInt(storedVolume);
      } else {
        volumeToSet = 100;
        await storage.set(storageKey, 100);
      }

      volumeSlider.value = volumeToSet;
      updateDisplay(volumeToSet);
      setTabVolume(currentTabId, volumeToSet);

    } catch (error) {
      volumeSlider.value = 100;
      updateDisplay(100);
    }
  }

  initializePopup();

  function updateDisplay(volume) {
    volumeSlider.value = volume;
    volumeDisplay.textContent = volume + '%';
    if (volume == 0) {
      muteButton.textContent = 'Unmute';
      isMuted = true;
    } else {
      muteButton.textContent = 'Mute';
      isMuted = false;
    }
  }

  async function setTabVolume(tabId, volume) {
    browser.tabs.sendMessage(tabId, {
      action: 'setVolume',
      volume: volume / 100
    }).catch(() => {});

    const storageKey = await getStorageKey();
    await storage.set(storageKey, volume);
  }

  volumeSlider.addEventListener('input', async function() {
    const volume = parseInt(this.value);
    updateDisplay(volume);

    if (currentTabId) {
      await setTabVolume(currentTabId, volume);
    }
  });

  muteButton.addEventListener('click', function() {
    if (currentTabId) {
      if (isMuted) {
        volumeSlider.value = previousVolume;
        updateDisplay(previousVolume);
        setTabVolume(currentTabId, previousVolume);
      } else {
        previousVolume = parseInt(volumeSlider.value);
        volumeSlider.value = 0;
        updateDisplay(0);
        setTabVolume(currentTabId, 0);
      }
    }
  });

  resetButton.addEventListener('click', function() {
    volumeSlider.value = 100;
    updateDisplay(100);

    if (currentTabId) {
      setTabVolume(currentTabId, 100);
    }
  });
});