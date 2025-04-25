/**
 * Language Support Module for AIVoiceTranslator
 * Handles language compatibility with various TTS services
 */

// Language support configuration for different TTS services
const languageSupport = {
    browser: {
        // Web Speech API has more limited language support
        supported: [
            // Common languages with good browser support
            "en-US", "en-GB", "es", "fr", "de", "it", "zh", "ja", "ru", "pt", "ko",
            // European languages with moderate support
            "bg", "cs", "da", "nl", "et", "fi", "el", "hu", "is", "ga", "lv", "lt", 
            "no", "pl", "ro", "sk", "sl", "sv", "uk",
            // Other languages with some browser support
            "ar", "hi", "id", "ms", "fa", "th", "tr", "vi"
        ]
    },
    openai: {
        // OpenAI supports all languages in our dropdown
        supported: "all"
    },
    silent: {
        // Silent mode supports all languages (no audio)
        supported: "all"
    }
};

/**
 * Check if a language is supported by a TTS service
 * 
 * @param {string} languageCode - Language code to check
 * @param {string} ttsService - TTS service to check support for
 * @returns {boolean} - Whether the language is supported
 */
function isLanguageSupported(languageCode, ttsService) {
    if (!languageSupport[ttsService]) {
        return true; // Default to supported if service config not found
    }
    
    if (languageSupport[ttsService].supported === "all") {
        return true; // All languages supported
    }
    
    return languageSupport[ttsService].supported.includes(languageCode);
}

/**
 * Update language dropdown based on selected TTS service
 * This filters options to only show supported languages
 * 
 * @param {string} ttsService - Selected TTS service
 */
function updateLanguageDropdown(ttsService) {
    const select = document.getElementById('language-select');
    const currentValue = select.value;
    const options = select.querySelectorAll('option');
    
    // Enable/disable options based on support
    options.forEach(option => {
        const langCode = option.value;
        const isSupported = isLanguageSupported(langCode, ttsService);
        option.disabled = !isSupported;
        
        // Add visual cue for disabled options
        if (!isSupported) {
            option.style.color = '#999';
            option.style.fontStyle = 'italic';
            if (!option.textContent.includes('(unsupported)')) {
                option.textContent += ' (unsupported)';
            }
        } else {
            option.style.color = '';
            option.style.fontStyle = '';
            option.textContent = option.textContent.replace(' (unsupported)', '');
        }
    });
    
    // If current selection is not supported, select first supported language
    if (!isLanguageSupported(currentValue, ttsService)) {
        // Find first enabled option
        const firstSupported = Array.from(options).find(opt => !opt.disabled);
        if (firstSupported) {
            select.value = firstSupported.value;
            // Trigger change event
            const event = new Event('change');
            select.dispatchEvent(event);
        }
    }
    
    // Update language buttons in the quick selection area
    updateLanguageButtons(ttsService);
}

/**
 * Update the quick access language buttons based on TTS service support
 * 
 * @param {string} ttsService - Selected TTS service
 */
function updateLanguageButtons(ttsService) {
    const buttons = document.querySelectorAll('.language-btn');
    
    buttons.forEach(button => {
        const langCode = button.getAttribute('data-lang');
        const isSupported = isLanguageSupported(langCode, ttsService);
        
        if (!isSupported) {
            button.classList.add('unsupported');
            button.title = 'Unsupported with current TTS service';
            // Add visual indication
            if (!button.querySelector('.unsupported-icon')) {
                const icon = document.createElement('span');
                icon.className = 'unsupported-icon';
                icon.textContent = '⚠️';
                icon.style.fontSize = '0.7em';
                icon.style.marginLeft = '3px';
                button.appendChild(icon);
            }
        } else {
            button.classList.remove('unsupported');
            button.title = '';
            // Remove visual indication if exists
            const icon = button.querySelector('.unsupported-icon');
            if (icon) {
                button.removeChild(icon);
            }
        }
    });
}

/**
 * Update expanded language list in modal
 * 
 * @param {string} ttsService - Selected TTS service
 */
function updateExpandedLanguageList(ttsService) {
    const expandedList = document.getElementById('expanded-language-list');
    if (!expandedList) return;
    
    const buttons = expandedList.querySelectorAll('.expanded-language-btn');
    
    buttons.forEach(button => {
        const langCode = button.getAttribute('data-lang');
        const isSupported = isLanguageSupported(langCode, ttsService);
        
        if (!isSupported) {
            button.classList.add('unsupported');
            button.style.opacity = '0.5';
            button.style.backgroundColor = '#f8f8f8';
            button.title = 'Unsupported with current TTS service';
            
            // Add visual indication
            if (!button.querySelector('.unsupported-icon')) {
                const icon = document.createElement('span');
                icon.className = 'unsupported-icon';
                icon.textContent = '⚠️';
                icon.style.fontSize = '0.7em';
                icon.style.marginLeft = '5px';
                button.appendChild(icon);
            }
        } else {
            button.classList.remove('unsupported');
            button.style.opacity = '1';
            button.style.backgroundColor = '';
            button.title = '';
            
            // Remove visual indication if exists
            const icon = button.querySelector('.unsupported-icon');
            if (icon) {
                button.removeChild(icon);
            }
        }
    });
}

// Export functions for use in main script
window.LanguageSupport = {
    isSupported: isLanguageSupported,
    updateDropdown: updateLanguageDropdown,
    updateButtons: updateLanguageButtons,
    updateExpandedList: updateExpandedLanguageList
};