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

const configItems = {
    "case"       : "Fractal Design North Chalk White TG Clear Tint - Fenêtre en verre",
    "CPU"        : "AMD Ryzen 7 9700X, 8x 3.80GHz",
    "cooler"     : "Arctic Liquid Freezer III Pro 360 A-RGB - 360mm - blanc",
    "motherboard": "ASUS TUF Gaming B650-E WIFI",
    "RAM"        : "32Go DDR5 RAM 6000 MHz Corsair Vengeance RGB white CL30 (2x 16GB - Dual Channel)",
    "GPU"        : "NVIDIA GeForce RTX 5080 - 16Go - changement de fabricant - compatible DLSS 4",
    "SSD"        : "1000 Go WD Black SN7100 (Lecture : 7250MB/s | Ecriture : 6900MB/s)",
    "PSU"        : "be quiet ! Pure Power 12 M - 850W entièrement modulable - 80 PLUS Gold"
};

function findItemByText(text, items) {
    const textLower = text.trim().toLowerCase();
    return items.find(item => {
        const title = item.querySelector('.title');
        return title && title.textContent.trim().toLowerCase().includes(textLower);
    });
}

function getConfigurationOptions(includeDisabled = true) {
    const selector = `.bogx--flexbox.bogx--config.image-list${includeDisabled ? '' : ':not(.is--disabled)'}`;
    return Array.from(document.querySelectorAll(selector));
}
function applyConfiguration(configuration, retry = true) {
    const foundItems = {};

    // Find items matching configuration
    const items = getConfigurationOptions();
    for (const [key, value] of Object.entries(configuration)) {
        const item = findItemByText(value, items);
        if (item) {
            foundItems[key] = item;
        }
    }

    // Reorganize foundItems: case first, PSU second, GPU last, others in between
    // Doing this to avoid compatibility issues with the GPU needing a bigger case or PSU
    const orderedKeys = {
        "case": foundItems.case ? foundItems.case : null,
        "PSU": foundItems.PSU ? foundItems.PSU : null,
        ...Object.fromEntries(Object.entries(foundItems).filter(([k]) => !["case", "PSU", "GPU"].includes(k))),
        "GPU": foundItems.GPU ? foundItems.GPU : null
    };

    // Filter key values having a not defined value and create orderedItems
    const orderedItems = Object.fromEntries(Object.entries(orderedKeys).filter(([k, v]) => v));
    const foundEnabledItems = {};
    const retryItems = {};

    const check_item = (key, item) => {
        if ( !item ) return

        if (!item.classList.contains('is--disabled')) {
            item.click();
            foundEnabledItems[key] = item;
        } else if ( retry ) {
            retryItems[key] = item;
        }
    }

    // Click on each item in the orderedItems
    // This will ensure that the items are clicked in the correct order
    for (const [key, item] of Object.entries(orderedItems)) {
        check_item(key, item);
    }

    // If retry is true, check the items that were not found or were disabled
    for (const [key, item] of Object.entries(retryItems)) {
        check_item(key, item);
    }

    return foundEnabledItems;
}

function expandAccordionItems() {
    // Click on all .accordion-item elements to expand them
    document.querySelectorAll('.accordion-item.bogx--group-wrap').forEach(item => {
        document.querySelectorAll('.accordion-button.collapsed').forEach(el => el.classList.remove('collapsed'));
        document.querySelectorAll('.accordion-collapse').forEach(el => el.classList.add('show'));
    });
}

function run_all() {
    // Click on all .accordion-item elements
    expandAccordionItems();

    // Apply the configuration
    const res = applyConfiguration(configItems, true);
    
    if (Object.keys(res).length === Object.keys(configItems).length) {
        console.log("Configuration applied successfully.");
        return;
    }

    console.log("Some items were not found or could not be applied. Missing elements:", Object.keys(configItems).filter(key => !res.hasOwnProperty(key)).join(', '));
}

if( document.readyState !== 'ready' && document.readyState !== 'complete' ) {
    // If the document is not ready, wait for the pageshow event
    window.addEventListener('pageshow', run_all);
} else {
    run_all();
}
