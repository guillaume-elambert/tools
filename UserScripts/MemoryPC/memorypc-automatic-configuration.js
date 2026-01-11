// ==UserScript==
// @name         MemoryPC - Automatic Configuration
// @version      2024-07-18
// @description  Script to automatically select a predefined configuration on MemoryPC.fr
// @author       Guillaume ELAMBERT
// @match        https://www.memorypc.fr/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/MemoryPC/memorypc-automatic-configuration.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/MemoryPC/memorypc-automatic-configuration.js
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
            if (value) {
                const title = value.querySelector('.title').textContent || value;
                if (title) {
                    appliedConfigItemsTitle[key] = title.trim();
                }
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
    const title = item.querySelector('.title')?.textContent || item;
    try {
        return title.trim().toLowerCase().includes(textToFind.trim().toLowerCase());
    } catch (error) {
        console.error("Error checking item match:", error, title, textToFind);
        return false;
    }
}

function findItemByText(textToFind, items) {
    return items.find(item => checkItemMatch(item, textToFind));
}

function getConfigurationOptions(includeDisabled = true, onlySelected = false) {
    let additionnalSelector = '';

    if (onlySelected) {
        includeDisabled = false; // If onlySelected is true, we don't want to include disabled items
        additionnalSelector += '.selected';
    }

    if (!includeDisabled) {
        additionnalSelector += ':not(.is--disabled)';
    }

    const selector = `.bogx--flexbox.bogx--config.image-list${additionnalSelector}`;
    return Array.from(document.querySelectorAll(selector));
}

function applyConfiguration(configuration) {
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
            if (item) {
                foundItems[key] = [...(foundItems[key] || []), item];

                if (foundItems[key].length == value.length) {
                    // If we found all items for this key, break the loop
                    break;
                }
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

    const check_and_click_item = (item) => {
        if ( !item ) return false;

        if (!item.classList.contains('is--disabled')) {
            item.click();
            return true;
        }

        return false
    }

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

                if(check_and_click_item(item)) {
                    // Add the key value to foundEnabledItems
                    foundEnabledItems[key] = item;
                    break
                }
            }
        }
    }

    res.applied_configuration = foundEnabledItems;

    // Get price
    const priceElement = document.querySelector('#bogx_config_total');
    if (priceElement) {
        res.compute_price_from_string(priceElement.textContent.trim());
    }

    return res;
}

function expandAccordionItems() {
    // Click on all .accordion-item elements to expand them
    document.querySelectorAll('.accordion-item.bogx--group-wrap').forEach(item => {
        document.querySelectorAll('.accordion-button.collapsed').forEach(el => el.classList.remove('collapsed'));
        document.querySelectorAll('.accordion-collapse').forEach(el => el.classList.add('show'));
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

function runAll(is_recursive_call=false) {
    // Click on all .accordion-item elements
    expandAccordionItems();

    // Apply the configuration
    const res = applyConfiguration(MEMORYPC_CONFIG, true);
    const verified = checkConfigurationApplied(res);
    const verifiedResults = verified.applied_components || {};

    res.applied_configuration = verifiedResults;

    // Store the result in a global variable
    window.MEMORYPC_CONFIG_RESULT = JSON.parse(JSON.stringify(res));

    // Scroll to the price container (#bogx_config_pricebox_wrap) so the bottom of the element is the bottom of the screen
    const priceElementWrapper = document.querySelector('#bogx_config_pricebox_wrap');

    // Make sure also it is visible, like if an element is above him (z-index or position absolute or something like that), that it gets visible
    if (priceElementWrapper) {
        let rect = priceElementWrapper.getBoundingClientRect();
        let scrollY = window.scrollY || document.documentElement.scrollTop;
        let scrollX = window.scrollX || document.documentElement.scrollLeft;
        let bottomOfElement = rect.top + scrollY + rect.height;

        // If the add to cart form is fixed, scroll down the height of the buyForm element so the price gets visible
        const buyForm = document.querySelector('#productDetailPageBuyProductForm > div');
        if (buyForm && getComputedStyle(buyForm).position === 'fixed') {
            // Scroll down the height of the buyForm element
            bottomOfElement += buyForm.offsetHeight;
        }
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
            console.log("Backup components applied:")
            console.log(nonZeroIndexes.map(([key, index]) => `${key}: ${index+1} choice used`).join('\n'));
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
    window.addEventListener('pageshow', () => runAll());
} else {
    runAll();
}
