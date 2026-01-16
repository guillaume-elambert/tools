// ==UserScript==
// @name         CSL Computer - Automatic Configuration
// @version      2026-01-16
// @description  Script to automatically select a predefined configuration on CSL-Computer.com
// @author       Guillaume ELAMBERT
// @match        https://www.csl-computer.com/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/CSL-Computer/csl-computer-automatic-configuration.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/CSL-Computer/csl-computer-automatic-configuration.js
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
}

class ConfigurationResult {
    constructor(configuration={}, url=window.location.href, price=-1.0, applied_configuration={}) {
        if (typeof price === "number") {
            this.price = price;
        } else {
            this.compute_price_from_string(price);
        }

        // Force configuration values to be lists
        for (const [key, value] of Object.entries(configuration)) {
            // If not array, convert to array
            if (!Array.isArray(value)) {
                configuration[key] = [value];
                continue;
            }
            configuration[key] = value;
        }

        this.configuration = configuration;
        this._applied_configuration = applied_configuration;
        this.url = url;
        this._applied_indexes = {};
        this.compute_missing_components();
    }

    get applied_configuration() {
        return this._applied_configuration;
    }

    set applied_configuration(configuration) {
        this._applied_configuration = configuration;
        this.compute_missing_components();
        this.compute_applied_indexes();
    }

    was_fully_applied() {
        return (
            Object.keys(this.missing_components).length === 0 &&
            Object.keys(this.configuration).every(
                key => key in this.applied_configuration
            )
        );
    }

    compute_missing_components() {
        this.missing_components = {};
        for (const key in this.configuration) {
            if (!(key in this.applied_configuration)) {
                this.missing_components[key] = this.configuration[key];
            }
        }
        return this.missing_components;
    }

    compute_price_from_string(price_str) {
        // Remove all non-digit and non-comma characters, replace comma with dot, and trim
        price_str = price_str.replace(/[^\d,]/g, "").replace(",", ".").trim();
        this.price = parseFloat(price_str) || -1.0; // If parseFloat fails, set price to -1.0
        return this.price;
    }

    get applied_indexes() {
        return this._applied_indexes;
    }

    compute_applied_indexes() {
        this._applied_indexes = {};
        // Find in configuration the indexes of the applied configuration
        for (const [key, value] of Object.entries(this.applied_configuration)) {
            this._applied_indexes[key] = this.configuration[key].findIndex((item) => {
                return checkItemMatch(value, item);
            });
        }
        return this._applied_indexes;
    }


    // Override the method to transform the object to a json object
    toJSON() {
        const appliedConfigItemsTitle = {};
        for (const [key, value] of Object.entries(this.applied_configuration)) {
            if (!value) continue;

            const titleElement = value.querySelector('label > span')

            if(!titleElement) {
                appliedConfigItemsTitle[key] = value.textContent.trim() || value.trim() || "";
                continue;
            }

            const titleSubElements = titleElement.children;
            // Remove all subelements for the title
            for (const subElement of titleSubElements) {
                titleElement.removeChild(subElement);
            }
            
            appliedConfigItemsTitle[key] = titleElement.textContent.trim();
            
            for (const subElement of titleSubElements || []) {
                titleElement.appendChild(subElement);
            }
        }

        return {
            price: this.price,
            configuration: this.configuration,
            applied_configuration: appliedConfigItemsTitle,
            missing_components: this.missing_components,
            applied_indexes: this.applied_indexes,
            url: this.url
        };
    }

    toString() {
        return JSON.stringify(this, null, 2);
    }
}


function checkItemMatch(item, textToFind) {
    const titleElement = item.querySelector('label > span')
    let toReturn = false;
    let titleSubElements = null;

    if(titleElement) {
        titleSubElements = titleElement.children;
        // Remove all subelements for the title
        for (const subElement of titleSubElements) {
            titleElement.removeChild(subElement);
        }
    }

    const title = titleElement.textContent || item.textContent || item || "";
    try {
        toReturn = title.trim().toLowerCase().includes(textToFind.trim().toLowerCase());
    } catch (error) {
        console.error("Error checking item match:", error, title, textToFind);
        toReturn = false;
    }

    // Re-add all subelements for the title
    for (const subElement of titleSubElements || []) {
        titleElement.appendChild(subElement);
    }

    return toReturn;
}

function findItemByText(textToFind, items) {
    return items.find(item => checkItemMatch(item, textToFind));
}

function getConfigurationOptions(includeDisabled = true, onlySelected = false) {
    let additionnalSelector = '';

    if (onlySelected) {
        includeDisabled = false; // If onlySelected is true, we don't want to include disabled items
        additionnalSelector += ':has(input:checked)';
    }

    if (!includeDisabled) {
        additionnalSelector += ':not(.incompatible)';
    }
    const selector = `.upgrade-options > .group > details > .content > .components > .upgrade${additionnalSelector}`
    // const selector = `.bogx--flexbox.bogx--config.image-list${additionnalSelector}`;
    return Array.from(document.querySelectorAll(selector));
}

async function applyConfiguration(configuration) {
    const foundItems = {};

    const res = new ConfigurationResult(configuration);

    // Find items matching configuration
    const items = getConfigurationOptions();
    for (let [key, value] of Object.entries(res.configuration)) {
        // Check if value is a string
        if (typeof value === 'string') {
            // Make it an array
            value = [value];
        }

        for (const textToFind of value) {
            const item = findItemByText(textToFind, items);
            if (!item) continue;
            
            foundItems[key] = [...(foundItems[key] || []), item];
            if (foundItems[key].length == value.length) {
                // If we found all items for this key, break the loop
                break;
            }
        }
    }

    // Reorganize foundItems: case first, PSU second, GPU last, others in between
    // Doing this to avoid compatibility issues with the GPU needing a bigger case or PSU
    const orderedKeys = {
        "case": foundItems.case || null,
        "PSU": foundItems.PSU || null,
        ...Object.fromEntries(Object.entries(foundItems).filter(([k]) => !["case", "PSU", "GPU"].includes(k))),
        "GPU": foundItems.GPU || null
    };

    // Filter key values having a not defined value and create orderedItems
    const orderedItems = Object.fromEntries(Object.entries(orderedKeys).filter(([k, v]) => v));
    const nbItems = Object.values(orderedItems).flat().length;
    const foundEnabledItems = {};

    const waitForLoaderToDisappear = () => {
        return new Promise((resolve) => {
            // If no loader exists, resolve immediately
            const loader = document.querySelector('.css_loader.validate');
            if (!loader) {
                return resolve();
            }

            // Observe DOM changes to detect when loader is removed
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
    };

    // Returns true if a dialog was closed
    const closeDialog = () => {
        // body > div.page > div > main > div.product-view.uproduct > div.product-card.detail > div.configurator > dialog:nth-child(4)
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
            // Else remove the dialog from the DOM
            dialog.remove();
        }

        return dialogs.length > 0;
    } 

    const check_and_click_item = async (item) => {
        if (!item || item.classList.contains('incompatible')) return false;

        const input = item.querySelector('input[type="radio"], input[type="checkbox"]');
        if (!input) return false;


        input.click();

        // Wait for loader to disappear before proceeding
        await waitForLoaderToDisappear();

        // Returns false if a dialog was closed
        return !closeDialog();
    };
    // Clicking on configuration components
    // Do it while some elements are present but disabled
    // This is to avoid incompatibility issues like cooler too big for the case or PSU not enough power for the GPU
    for(let i=0; i < nbItems /*&& nbItems > Object.keys(foundEnabledItems).length*/; i++) {

        // Iterate over orderedItems not in the dictionary foundEnabledItems
        for (const [key, value] of Object.entries(orderedItems)) {
            for (const item of value) {
                // Check if the item in foundEnabledItems[key] is not defined or is after in the list of items (backup component)
                if (foundEnabledItems[key] && value.indexOf(item) >= value.indexOf(foundEnabledItems[key])) {
                    continue; // Skip this item if it is already in foundEnabledItems[key]
                }

                if(await check_and_click_item(item)) {
                    // Add the key value to foundEnabledItems
                    foundEnabledItems[key] = item;
                    break
                }
            }
        }
    }

    res.applied_configuration = foundEnabledItems;

    // Get price
    const priceElement = document.querySelector('.configurator .conversion > .price-wrapper > .price-box .price');
    if (priceElement) {
        res.compute_price_from_string(priceElement.innerText.trim());
    }

    return res;
}

function expandAccordionItems() {
    // Click on all .accordion-item elements to expand them
    document.querySelectorAll('.upgrade-options > .group > details').forEach(item => {
        item.setAttribute('open', 'true');
    });
}

function checkConfigurationApplied(configurationResult) {
    const selectedItems = getConfigurationOptions(false, true);
    const toReturn = {}
    let match = true;

    for (const [key, value] of Object.entries(configurationResult.configuration)) {
        // If the key is not in results, return false
        if (!configurationResult.applied_configuration.hasOwnProperty(key)) {
            console.warn(`Configuration item "${key}" not found in results.`);
            match = false;
            continue;
        }

        // If the value of the key in results does not match the value in configuration, return false
        const item = configurationResult.applied_configuration[key];

        let componentFound = false;
        // Iterate over each possible value in the wanted configuration to check if one of them matches the item
        for (const textToFind of value) {
            if (item && checkItemMatch(item, textToFind) && selectedItems.includes(item)) {
                componentFound = true;
                break;
            }
        }
        match = match && componentFound;

        // If the item matches, add it to toReturn
        toReturn[key] = item;
    }

    return {
        'match': match,
        'applied_components': toReturn
    };
}

async function runAll(is_recursive_call=false) {
    // Click on all .accordion-item elements
    expandAccordionItems();

    // Apply the configuration
    const res = await applyConfiguration(CSL_COMPUTER_CONFIG, true);
    const verified = checkConfigurationApplied(res);
    const verifiedResults = verified.applied_components || {};

    res.applied_configuration = verifiedResults;

    // Store the result in a global variable
    window.CSL_COMPUTER_CONFIG_RESULT = JSON.parse(JSON.stringify(res));

    // Scroll to the price container (#bogx_config_pricebox_wrap) so the bottom of the element is the bottom of the screen
    const priceElementWrapper = document.querySelector('.configurator .floatbar');

    // Make sure also it is visible, like if an element is above him (z-index or position absolute or something like that), that it gets visible
    if (priceElementWrapper) {
        let rect = priceElementWrapper.getBoundingClientRect();
        let scrollY = window.scrollY || document.documentElement.scrollTop;
        let scrollX = window.scrollX || document.documentElement.scrollLeft;
        let bottomOfElement = rect.top + scrollY + rect.height;

        // Scroll to the bottom of the element
        window.scrollTo({
            top: bottomOfElement - window.innerHeight + 20, // 20px padding
            left: scrollX,
            behavior: 'auto'
        });
    }

    if (verified.match) {
        console.log("Configuration applied successfully.");
        // Check if the applied indexes are computed correctly
        const nonZeroIndexes = Object.entries(res.applied_indexes).filter(([key, index]) => {
            return index != 0;
        });

        if (nonZeroIndexes.length > 0) {
            if(is_recursive_call){
                console.log("Backup components applied:")
                console.log(nonZeroIndexes.map(([key, index]) => `${key}: ${index+1} choice used`).join('\n'));
            } else {
                // Retry to apply configuration, in case backup components were wrongly used
                runAll(true);
            }
        }
        return true;
    }

    if(is_recursive_call) return false
    if(runAll(true)) return true
    console.log("Some items were not found or could not be applied. Missing elements:", Object.keys(res.configuration).filter(key => !res.applied_configuration.hasOwnProperty(key)).join(', '));
    return false
}

if( document.readyState !== 'ready' && document.readyState !== 'complete' ) {
    // If the document is not ready, wait for the pageshow event
    window.addEventListener('pageshow', async () => await runAll());
} else {
    await runAll();
}