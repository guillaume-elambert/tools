// ==UserScript==
// @name         MemoryPC - Automatic Configuration
// @version      2026-01-19
// @description  Script to automatically select a predefined configuration on MemoryPC.fr
// @author       Guillaume ELAMBERT
// @match        https://www.memorypc.fr/*
// @require      https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/pc-configurator-common.js
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/memorypc-automatic-configuration.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/memorypc-automatic-configuration.js
// @icon         https://www.memorypc.fr/media/63/40/4a/1707991535/apple.png
// @grant        none
// ==/UserScript==
'use strict';

const MEMORYPC_CONFIG = window.MEMORYPC_CONFIG || {
    "case"       : [
        "Fractal Design North Chalk White TG Clear Tint - Fenêtre en verre",
        "Fractal Design North XL Chalk White TG Clear Tint - Fenêtre en verre"
    ],
    "CPU"        : "AMD Ryzen 7 9700X, 8x 3.80GHz",
    "cooler"     : "Arctic Liquid Freezer III Pro 360 A-RGB - 360mm - blanc",
    "motherboard": "ASUS TUF Gaming B650-E WIFI",
    "RAM"        : "32Go DDR5 RAM 6000 MHz Corsair Vengeance RGB white CL30 (2x 16GB - Dual Channel)",
    "GPU"        : "NVIDIA GeForce RTX 5080 - 16Go - changement de fabricant - compatible DLSS 4",
    "SSD"        : "1000 Go WD Black SN7100 (Lecture : 7250MB/s | Ecriture : 6900MB/s)",
    "PSU"        : "be quiet ! Pure Power 12 M - 850W entièrement modulable - 80 PLUS Gold"
};

/**
 * MemoryPC specific configuration handler
 */
class MemoryPCHandler extends ConfigurationHandler {
    constructor(configuration) {
        super(configuration, 'MEMORYPC_CONFIG_RESULT');
    }

    getConfigurationOptions(includeDisabled = true, onlySelected = false) {
        let additionalSelector = '';

        if (onlySelected) {
            includeDisabled = false;
            additionalSelector += '.selected';
        }

        if (!includeDisabled) {
            additionalSelector += ':not(.is--disabled)';
        }

        const selector = `.bogx--flexbox.bogx--config.image-list${additionalSelector}`;
        return Array.from(document.querySelectorAll(selector));
    }

    expandAccordionItems() {
        document.querySelectorAll('.accordion-item.bogx--group-wrap').forEach(() => {
            document.querySelectorAll('.accordion-button.collapsed').forEach(el => 
                el.classList.remove('collapsed')
            );
            document.querySelectorAll('.accordion-collapse').forEach(el => 
                el.classList.add('show')
            );
        });
    }

    getPriceElement() {
        return document.querySelector('#bogx_config_total');
    }

    getPriceWrapper() {
        return document.querySelector('#bogx_config_pricebox_wrap');
    }

    async clickItem(item) {
        if (!item) {
            return false;
        }

        if (!item.classList.contains('is--disabled')) {
            item.click();
            return true;
        }

        return false;
    }

    checkItemMatch(item, textToFind) {
        const title = item.querySelector('.title')?.textContent || item;
        
        try {
            return title.trim().toLowerCase().includes(textToFind.trim().toLowerCase());
        } catch (error) {
            console.error("Error checking item match:", error, title, textToFind);
            return false;
        }
    }

    extractItemTitle(item) {
        if (!item) return "";
        
        const title = item.querySelector('.title')?.textContent || item;
        return typeof title === 'string' ? title.trim() : "";
    }

    adjustScrollPosition(bottomOfElement) {
        // Check if buy form is fixed and adjust scroll position
        const buyForm = document.querySelector('#productDetailPageBuyProductForm > div');
        
        if (buyForm && getComputedStyle(buyForm).position === 'fixed') {
            bottomOfElement += buyForm.offsetHeight;
        }
        
        return bottomOfElement;
    }
}

// Handle cookie banner before executing configuration
DOMUtils.waitForElementThenExecute(
    '#usercentrics-root',
    (banner) => {
        const shadowRoot = banner.shadowRoot;
        if (!shadowRoot) return false;
        const denyButton = shadowRoot.querySelector("button[data-testid='uc-deny-all-button']");
        if (!denyButton) return false;
        console.log('[MemoryPC] Clicking deny-all button on cookie banner');
        denyButton.click();
        return true;

    },
    40,    // MaxRetries
    500,   // Retry interval
    20000  // Timeout
);

// Execute when ready
(async () => {
    const handler = new MemoryPCHandler(MEMORYPC_CONFIG);
    await handler.execute();
})();