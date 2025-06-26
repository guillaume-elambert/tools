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

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // Function to find items
    function findConfigItems(configItems) {
        const foundItems = {};
        const elements = Array.from(document.querySelectorAll('.bogx--flexbox.bogx--config.image-list'));
        for (const [key, item] of Object.entries(configItems)) {
            // Find the element that has a div with the class "title" with the text matching the item
            const element = elements.find(el => {
                const title = el.querySelector('.title');
                return title && title.textContent.trim().includes(item);
            });

            if (element) {
                foundItems[key] = element;
            }
        }
        return foundItems;
    }

    // pageshow event is used to ensure the script runs after the page is fully loaded
    window.addEventListener('pageshow', function() {
        const foundItems = findConfigItems(configItems);
        if (Object.keys(foundItems).length === Object.keys(configItems).length) {

            // Click on all .accordion-item elements
            document.querySelectorAll('.accordion-item button').forEach(item => {
                item.click();
            });
            
            for (const [key, element] of Object.entries(foundItems)) {
                element.style.border = '2px solid red'; // Highlight the element
                element.click(); // Click the element
                console.log(`Clicked on ${key}:`, element);
            }
            
        } else {
            console.log("Current found items:", foundItems);
        }
    });
});