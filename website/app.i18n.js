// app.i18n.js - Internationalization Support
// Translations are loaded from /lang/en.json and /lang/ar.json

(function () {
    // Cache for loaded translations
    let translations = {
        en: {},
        ar: {}
    };

    let currentLang = localStorage.getItem('app-language') || 'en';

    // Load translations synchronously at startup
    function loadTranslationsSync(lang) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `lang/${lang}.json`, false); // false = synchronous
            xhr.send(null);
            if (xhr.status === 200) {
                translations[lang] = JSON.parse(xhr.responseText);
            }
        } catch (error) {
            console.warn(`Error loading translations for ${lang}:`, error);
        }
    }

    // Load both translation files immediately
    loadTranslationsSync('en');
    loadTranslationsSync('ar');

    // Get translated string
    window.t = function (key) {
        const langData = translations[currentLang] || {};
        const enData = translations['en'] || {};
        return langData[key] || enData[key] || key;
    };

    // Set language
    window.setLanguage = function (lang) {
        if (!['en', 'ar'].includes(lang)) return;

        currentLang = lang;
        localStorage.setItem('app-language', lang);

        // Keep layout LTR, only translate text
        document.documentElement.setAttribute('dir', 'ltr');
        document.documentElement.setAttribute('lang', lang);

        // Apply translations to all elements with data-i18n
        applyTranslations();

        // Dispatch event so dynamic content can re-render
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    };

    // Apply translations to DOM
    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = t(key);
            }
        });

        // Apply to placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = t(key);
            }
        });

        // Apply to titles (tooltip)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = t(key);
            }
        });
    }

    // Get current language
    window.getCurrentLanguage = function () {
        return currentLang;
    };

    // Re-apply translations (call this after dynamic content is added)
    window.applyTranslations = applyTranslations;

    // Initialize on DOM ready
    window.initI18n = function () {
        // Set language select value and wire up handler
        const langSelect = document.getElementById('languageSelect');
        if (langSelect) {
            langSelect.value = currentLang;
            langSelect.onchange = () => {
                setLanguage(langSelect.value);
            };
        }

        // Apply translations to static DOM elements
        applyTranslations();
    };

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initI18n);
    } else {
        initI18n();
    }
})();

