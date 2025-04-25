/**
 * Language Support Module
 * 
 * This module handles all aspects of language support for the application,
 * including filtering languages based on TTS service capabilities and
 * providing UI elements for language selection.
 * 
 * It implements the facade pattern to provide a clean API for language operations.
 */

// Self-executing function to create a module with private state
(function(window) {
  // Language support information by TTS service
  const languageSupport = {
    // Browser Speech Synthesis support varies by browser
    // This is a conservative list of well-supported languages
    browser: {
      fullySupported: [
        'en', 'en-US', 'en-GB', 'en-AU', 'en-IN',
        'es', 'es-ES', 'es-MX', 'es-419',
        'fr', 'fr-FR', 'fr-CA',
        'de',
        'it',
        'zh', 'zh-CN', 'zh-TW',
        'ja',
        'ko',
        'pt', 'pt-BR', 'pt-PT',
        'ru'
      ],
      partiallySupported: [
        'ar', 'bg', 'ca', 'cs', 'da', 'nl', 'fi', 'el', 'he',
        'hi', 'hu', 'id', 'no', 'pl', 'ro', 'sk', 'sv', 'th', 
        'tr', 'uk', 'vi'
      ]
    },
    
    // OpenAI TTS service supports all languages listed in the selector
    openai: {
      // All languages are supported by OpenAI TTS
      fullySupported: [], // This will be populated at runtime with all available languages
      partiallySupported: []
    },
    
    // Silent mode doesn't actually speak, so all languages are "supported"
    silent: {
      fullySupported: [], // This will be populated at runtime with all available languages
      partiallySupported: []
    }
  };
  
  // Store references to DOM elements for efficiency
  let elements = {
    languageSelect: null,
    languageButtons: null,
    expandedLanguageList: null,
    showMoreButton: null
  };
  
  /**
   * Initialize the language support module
   */
  function init() {
    // Cache DOM elements
    elements.languageSelect = document.getElementById('language-select');
    elements.languageButtons = document.querySelectorAll('.language-btn');
    elements.expandedLanguageList = document.getElementById('expanded-language-list');
    elements.showMoreButton = document.getElementById('show-more-languages');
    
    // Populate the list of all languages for OpenAI and Silent services
    if (elements.languageSelect) {
      const allLanguages = [];
      const options = elements.languageSelect.querySelectorAll('option');
      
      options.forEach(option => {
        allLanguages.push(option.value);
      });
      
      languageSupport.openai.fullySupported = allLanguages;
      languageSupport.silent.fullySupported = allLanguages;
    }
    
    // Set up event listeners for language buttons
    setupEventListeners();
  }
  
  /**
   * Set up event listeners for language-related elements
   */
  function setupEventListeners() {
    // Language quick select buttons
    if (elements.languageButtons) {
      elements.languageButtons.forEach(button => {
        button.addEventListener('click', function() {
          const lang = this.getAttribute('data-lang');
          if (elements.languageSelect) {
            elements.languageSelect.value = lang;
            
            // Dispatch change event to trigger any listeners
            const event = new Event('change');
            elements.languageSelect.dispatchEvent(event);
            
            // Highlight the selected button
            updateButtonHighlighting(lang);
          }
        });
      });
    }
  }
  
  /**
   * Update the dropdown based on TTS service capabilities
   * @param {string} ttsService - The TTS service to filter languages for
   */
  function updateDropdown(ttsService) {
    if (!elements.languageSelect) return;
    
    const supportedLanguages = getSupportedLanguages(ttsService);
    const options = elements.languageSelect.querySelectorAll('option');
    
    options.forEach(option => {
      const langCode = option.value;
      const supported = isLanguageSupported(langCode, ttsService);
      
      // Disable or enable the option based on support
      option.disabled = !supported;
      
      // Add visual indication of support status
      if (supported) {
        option.removeAttribute('title');
        option.style.opacity = '1';
      } else {
        option.setAttribute('title', 'Not fully supported by ' + getTtsServiceName(ttsService));
        option.style.opacity = '0.5';
      }
    });
    
    // If current selection is not supported, switch to first supported language
    const currentLang = elements.languageSelect.value;
    if (!isLanguageSupported(currentLang, ttsService)) {
      const firstSupported = supportedLanguages[0] || 'en-US';
      elements.languageSelect.value = firstSupported;
      
      // Update button highlighting
      updateButtonHighlighting(firstSupported);
    }
  }
  
  /**
   * Update the button states for quick language selection
   * @param {string} ttsService - The TTS service to filter languages for
   */
  function updateButtons(ttsService) {
    if (!elements.languageButtons) return;
    
    elements.languageButtons.forEach(button => {
      const langCode = button.getAttribute('data-lang');
      const supported = isLanguageSupported(langCode, ttsService);
      
      // Enable/disable button and update appearance
      if (supported) {
        button.classList.remove('unsupported');
        button.removeAttribute('title');
      } else {
        button.classList.add('unsupported');
        button.setAttribute('title', 'Not fully supported by ' + getTtsServiceName(ttsService));
      }
    });
    
    // Update highlighting for current selection
    updateButtonHighlighting(elements.languageSelect ? elements.languageSelect.value : null);
  }
  
  /**
   * Update the expanded language list in the modal
   * @param {string} ttsService - The TTS service to filter languages for
   */
  function updateExpandedList(ttsService) {
    if (!elements.expandedLanguageList) return;
    
    // Clear existing content
    elements.expandedLanguageList.innerHTML = '';
    
    // Group languages by category
    const languageGroups = {};
    const optGroups = elements.languageSelect.querySelectorAll('optgroup');
    
    optGroups.forEach(group => {
      const groupName = group.label;
      languageGroups[groupName] = Array.from(group.querySelectorAll('option'))
        .map(option => {
          return {
            code: option.value,
            name: option.textContent,
            supported: isLanguageSupported(option.value, ttsService)
          };
        });
    });
    
    // Create a button for each language
    for (const groupName in languageGroups) {
      // Add group header
      const groupHeader = document.createElement('div');
      groupHeader.className = 'language-group-header';
      groupHeader.style.gridColumn = '1 / -1';
      groupHeader.style.borderBottom = '1px solid #ddd';
      groupHeader.style.marginTop = '10px';
      groupHeader.style.paddingBottom = '5px';
      groupHeader.style.fontWeight = 'bold';
      groupHeader.textContent = groupName;
      elements.expandedLanguageList.appendChild(groupHeader);
      
      // Add language buttons
      languageGroups[groupName].forEach(lang => {
        const button = document.createElement('button');
        button.className = 'expanded-language-btn';
        button.setAttribute('data-lang', lang.code);
        button.textContent = lang.name;
        
        // Add support indicator
        if (!lang.supported) {
          button.classList.add('unsupported');
          button.setAttribute('title', 'Not fully supported by ' + getTtsServiceName(ttsService));
        }
        
        // Highlight if currently selected
        if (elements.languageSelect && elements.languageSelect.value === lang.code) {
          button.classList.add('active');
        }
        
        // Add click handler
        button.addEventListener('click', function() {
          if (!lang.supported) return; // Do nothing if language not supported
          
          if (elements.languageSelect) {
            elements.languageSelect.value = lang.code;
            
            // Dispatch change event
            const event = new Event('change');
            elements.languageSelect.dispatchEvent(event);
            
            // Update button highlighting
            updateButtonHighlighting(lang.code);
            
            // Update modal button highlighting
            updateModalButtonHighlighting(lang.code);
            
            // Close modal
            const modal = document.getElementById('language-modal');
            if (modal) {
              modal.style.display = 'none';
            }
          }
        });
        
        elements.expandedLanguageList.appendChild(button);
      });
    }
  }
  
  /**
   * Highlight the currently selected language button
   * @param {string} selectedLang - The selected language code
   */
  function updateButtonHighlighting(selectedLang) {
    if (!elements.languageButtons) return;
    
    elements.languageButtons.forEach(button => {
      const langCode = button.getAttribute('data-lang');
      if (langCode === selectedLang) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  /**
   * Highlight the currently selected language in the modal
   * @param {string} selectedLang - The selected language code
   */
  function updateModalButtonHighlighting(selectedLang) {
    if (!elements.expandedLanguageList) return;
    
    const modalButtons = elements.expandedLanguageList.querySelectorAll('.expanded-language-btn');
    modalButtons.forEach(button => {
      const langCode = button.getAttribute('data-lang');
      if (langCode === selectedLang) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  /**
   * Check if a language is supported by a TTS service
   * @param {string} langCode - The language code to check
   * @param {string} ttsService - The TTS service to check against
   * @returns {boolean} - Whether the language is supported
   */
  function isLanguageSupported(langCode, ttsService) {
    // Default to browser TTS if not specified
    ttsService = ttsService || 'browser';
    
    const support = languageSupport[ttsService];
    if (!support) return false;
    
    // Check full support first
    if (support.fullySupported.includes(langCode)) return true;
    
    // Check partial support
    if (support.partiallySupported.includes(langCode)) return true;
    
    // Check if a parent language is supported
    // e.g., 'en-US' might not be explicitly listed, but 'en' is
    if (langCode.includes('-')) {
      const parentLang = langCode.split('-')[0];
      return support.fullySupported.includes(parentLang) || 
             support.partiallySupported.includes(parentLang);
    }
    
    return false;
  }
  
  /**
   * Get a list of supported languages for a TTS service
   * @param {string} ttsService - The TTS service to get languages for
   * @returns {string[]} - Array of supported language codes
   */
  function getSupportedLanguages(ttsService) {
    // Default to browser TTS if not specified
    ttsService = ttsService || 'browser';
    
    const support = languageSupport[ttsService];
    if (!support) return [];
    
    // Combine fully and partially supported languages
    return [...support.fullySupported, ...support.partiallySupported];
  }
  
  /**
   * Get a user-friendly name for a TTS service
   * @param {string} ttsService - The TTS service identifier
   * @returns {string} - The user-friendly name
   */
  function getTtsServiceName(ttsService) {
    const names = {
      browser: 'Browser Speech',
      openai: 'OpenAI TTS',
      silent: 'Silent Mode'
    };
    
    return names[ttsService] || ttsService;
  }
  
  // Public API
  const LanguageSupport = {
    init: init,
    updateDropdown: updateDropdown,
    updateButtons: updateButtons,
    updateExpandedList: updateExpandedList,
    isLanguageSupported: isLanguageSupported,
    isSupported: isLanguageSupported, // Alias for backward compatibility
    getSupportedLanguages: getSupportedLanguages
  };
  
  // Export to window
  window.LanguageSupport = LanguageSupport;
  
})(window);

// Initialize when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
  if (window.LanguageSupport) {
    window.LanguageSupport.init();
  }
});