// ==UserScript==
// @name         CSL Computer - Automatic Configuration
// @version      2026-01-19
// @description  Script to automatically select a predefined configuration on CSL-Computer.com
// @author       Guillaume ELAMBERT
// @match        https://www.csl-computer.com/*
// @require      https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/pc-configurator-common.js
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/csl-computer-automatic-configuration.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/PC-Configurator/csl-computer-automatic-configuration.js
// @icon         https://www.csl-computer.com/fr/apple-touch-icon-228.png
// @grant        none
// ==/UserScript==
'use strict';

const CSL_COMPUTER_CONFIG = window.CSL_COMPUTER_CONFIG || {
    "case": [
        "BoostBoxx Vitrum Advanced, blanc, éclairage aRGB avec commande, partie latérale en verre et façade en verre",
        "Fractal Design North, Chalk White, mesh partie latérale",
    ],
    "cooler": "MSI MAG CoreLiquid A13 240 White refroidissement à eau",
    "RAM": "32 Go DDR5-RAM, Dual Channel (2x 16 Go), 6000 MHz*, Kingston Fury Beast",
    "PSU": "1000 Watt be quiet ! Pure Power 13 M, ATX3.1, 94% d'efficacité, certifié 80 Plus Gold",
    "SSD": "1000 Go M.2 PCIe 4.0 SSD Western Digital Black SN850X, lecture/écriture: max. 7300 Mo/s | 6300 Mo/s",
    "GPU": "Gigabyte GeForce RTX 5080, Gigabyte RTX 5080 AORUS Master ICE 16G, 16 Go GDDR7, 1x HDMI, 3x DisplayPort, blanc",
    "CPU": "AMD Ryzen 7 9800X3D, 8x 4700 MHz",
    "motherboard": "GIGABYTE X870 AORUS Elite WIFI7 ICE"
};

/**
 * CSL Computer specific configuration handler
 */
class CSLComputerHandler extends ConfigurationHandler {
    constructor(configuration) {
        super(configuration, 'CSL_COMPUTER_CONFIG_RESULT');
    }

    getConfigurationOptions(includeDisabled = true, onlySelected = false) {
        let additionalSelector = '';

        if (onlySelected) {
            includeDisabled = false;
            additionalSelector += ':has(input:checked)';
        }

        if (!includeDisabled) {
            additionalSelector += ':not(.incompatible)';
        }

        const selector = `.upgrade-options > .group > details > .content > .components > .upgrade${additionalSelector}`;
        return Array.from(document.querySelectorAll(selector));
    }

    expandAccordionItems() {
        document.querySelectorAll('.upgrade-options > .group > details').forEach(item => {
            item.setAttribute('open', 'true');
        });
    }

    getPriceElement() {
        return document.querySelector('.configurator .conversion > .price-wrapper > .price-box .price');
    }

    getPriceWrapper() {
        return document.querySelector('.configurator .floatbar');
    }

    async clickItem(item) {
        if (!item || item.classList.contains('incompatible')) {
            return false;
        }

        const input = item.querySelector('input[type="radio"], input[type="checkbox"]');
        if (!input) {
            return false;
        }

        input.click();

        // Wait for loader to disappear
        await this.waitForLoaderToDisappear();

        // Close any dialogs and return success if no dialog was closed
        return !this.closeDialogs();
    }

    checkItemMatch(item, textToFind) {
        const titleElement = item.querySelector('label > span');
        let toReturn = false;
        let titleSubElements = null;

        if (titleElement) {
            titleSubElements = Array.from(titleElement.children);
            // Temporarily remove subelements to get clean text
            titleSubElements.forEach(subElement => titleElement.removeChild(subElement));
        }

        const title = titleElement?.textContent || item.textContent || item || "";
        
        try {
            toReturn = title.trim().toLowerCase().includes(textToFind.trim().toLowerCase());
        } catch (error) {
            console.error("Error checking item match:", error, title, textToFind);
            toReturn = false;
        }

        // Restore subelements
        if (titleElement && titleSubElements) {
            titleSubElements.forEach(subElement => titleElement.appendChild(subElement));
        }

        return toReturn;
    }

    extractItemTitle(item) {
        if (!item) return "";

        const titleElement = item.querySelector('label > span');
        
        if (!titleElement) {
            return item.textContent?.trim() || item.trim() || "";
        }

        const titleSubElements = Array.from(titleElement.children);
        
        // Temporarily remove subelements to get clean text
        titleSubElements.forEach(subElement => titleElement.removeChild(subElement));
        
        const title = titleElement.textContent.trim();
        
        // Restore subelements
        titleSubElements.forEach(subElement => titleElement.appendChild(subElement));
        
        return title;
    }

    async waitForLoaderToDisappear() {
        return new Promise((resolve) => {
            const loader = document.querySelector('.css_loader.validate');
            if (!loader) {
                return resolve();
            }

            const observer = new MutationObserver(() => {
                const loaderStillExists = document.querySelector('.css_loader.validate');
                if (!loaderStillExists) {
                    observer.disconnect();
                    resolve();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        });
    }

    closeDialogs() {
        const dialogs = document.querySelectorAll(".product-view .configurator > dialog");
        
        for (const dialog of dialogs) {
            const okBtn = dialog.querySelector('.toolbar > form > button[type="button"]');
            if (okBtn) {
                okBtn.click();
                continue;
            }
            
            const closeBtn = dialog.querySelector(".title > i");
            if (closeBtn) {
                closeBtn.click();
                continue;
            }
            
            // Remove dialog from DOM as fallback
            dialog.remove();
        }

        return dialogs.length > 0;
    }
}

// Execute when ready
(async () => {
    const handler = new CSLComputerHandler(CSL_COMPUTER_CONFIG);
    await handler.execute();
})();