// ==UserScript==
// @name         PC Configurator - Common Library
// @version      2026-01-19
// @description  Common library for automatic PC configuration scripts
// @author       Guillaume ELAMBERT
// @grant        none
// ==/UserScript==
'use strict';

/**
 * Result object containing configuration details and state
 */
class ConfigurationResult {
    constructor(configuration = {}, url = window.location.href, price = -1.0, applied_configuration = {}) {
        if (typeof price === "number") {
            this.price = price;
        } else {
            this.compute_price_from_string(price);
        }

        // Force configuration values to be lists
        for (const [key, value] of Object.entries(configuration)) {
            if (!Array.isArray(value)) {
                configuration[key] = [value];
            } else {
                configuration[key] = value;
            }
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
        this.price = parseFloat(price_str) || -1.0;
        return this.price;
    }

    get applied_indexes() {
        return this._applied_indexes;
    }

    compute_applied_indexes() {
        this._applied_indexes = {};
        for (const [key, value] of Object.entries(this.applied_configuration)) {
            this._applied_indexes[key] = this.configuration[key].findIndex((item) => {
                return this.constructor.checkItemMatch(value, item);
            });
        }
        return this._applied_indexes;
    }

    /**
     * Static method to check if item matches text
     * Can be overridden by subclasses for custom matching logic
     */
    static checkItemMatch(item, textToFind) {
        // Default implementation - should be overridden
        const title = item?.textContent || item || "";
        try {
            return title.trim().toLowerCase().includes(textToFind.trim().toLowerCase());
        } catch (error) {
            console.error("Error checking item match:", error, title, textToFind);
            return false;
        }
    }

    toJSON() {
        const appliedConfigItemsTitle = {};
        for (const [key, value] of Object.entries(this.applied_configuration)) {
            if (value) {
                appliedConfigItemsTitle[key] = this.constructor.extractItemTitle(value);
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

    /**
     * Static method to extract title from item
     * Should be overridden by subclasses
     */
    static extractItemTitle(item) {
        return item?.textContent?.trim() || item?.trim() || "";
    }

    toString() {
        return JSON.stringify(this, null, 2);
    }
}

/**
 * Abstract base class for PC configuration handlers
 */
class ConfigurationHandler {
    constructor(configuration, globalVarName = 'PC_CONFIG_RESULT') {
        if (this.constructor === ConfigurationHandler) {
            throw new Error("ConfigurationHandler is an abstract class and cannot be instantiated directly");
        }
        
        this.configuration = configuration;
        this.globalVarName = globalVarName;
        this.result = null;
    }

    // ============= ABSTRACT METHODS (must be implemented by subclasses) =============

    /**
     * Get configuration options from the page
     * @param {boolean} includeDisabled - Include disabled items
     * @param {boolean} onlySelected - Only get selected items
     * @returns {Array} Array of configuration option elements
     */
    getConfigurationOptions(includeDisabled = true, onlySelected = false) {
        throw new Error("getConfigurationOptions() must be implemented by subclass");
    }

    /**
     * Expand accordion/collapsible sections to reveal all options
     */
    expandAccordionItems() {
        throw new Error("expandAccordionItems() must be implemented by subclass");
    }

    /**
     * Get the price element from the page
     * @returns {Element|null} Price element
     */
    getPriceElement() {
        throw new Error("getPriceElement() must be implemented by subclass");
    }

    /**
     * Click on a configuration item
     * @param {Element} item - The item to click
     * @returns {Promise<boolean>} True if click was successful
     */
    async clickItem(item) {
        throw new Error("clickItem() must be implemented by subclass");
    }

    /**
     * Check if an item matches the search text
     * @param {Element} item - The item to check
     * @param {string} textToFind - Text to search for
     * @returns {boolean} True if item matches
     */
    checkItemMatch(item, textToFind) {
        throw new Error("checkItemMatch() must be implemented by subclass");
    }

    /**
     * Extract title/label from a configuration item
     * @param {Element} item - The item
     * @returns {string} Item title
     */
    extractItemTitle(item) {
        throw new Error("extractItemTitle() must be implemented by subclass");
    }

    /**
     * Get the ConfigurationResult class to use
     * @returns {Class} ConfigurationResult class or subclass
     */
    getResultClass() {
        return ConfigurationResult;
    }

    // ============= OPTIONAL HOOKS (can be overridden) =============

    /**
     * Hook called before applying configuration
     */
    async beforeApplyConfiguration() {
        // Optional hook - no-op by default
    }

    /**
     * Hook called after applying configuration
     * @param {ConfigurationResult} result - The result object
     */
    async afterApplyConfiguration(result) {
        // Optional hook - no-op by default
    }

    /**
     * Hook called after scrolling to price
     */
    async afterScrollToPrice() {
        // Optional hook - no-op by default
    }

    /**
     * Custom component ordering logic
     * @param {Object} foundItems - Found configuration items
     * @returns {Object} Ordered items
     */
    orderComponents(foundItems) {
        // Default ordering: case first, PSU second, GPU last, others in between
        const orderedKeys = {
            "case": foundItems.case || null,
            "PSU": foundItems.PSU || null,
            ...Object.fromEntries(Object.entries(foundItems).filter(([k]) => !["case", "PSU", "GPU"].includes(k))),
            "GPU": foundItems.GPU || null
        };
        return Object.fromEntries(Object.entries(orderedKeys).filter(([k, v]) => v));
    }

    // ============= COMMON IMPLEMENTATION METHODS =============

    /**
     * Find item by text in a list of items
     */
    findItemByText(textToFind, items) {
        return items.find(item => this.checkItemMatch(item, textToFind));
    }

    /**
     * Apply configuration to the page
     */
    async applyConfiguration() {
        await this.beforeApplyConfiguration();

        const foundItems = {};
        const ResultClass = this.getResultClass();
        const res = new ResultClass(this.configuration);

        // Set static methods for result class
        ResultClass.checkItemMatch = this.checkItemMatch.bind(this);
        ResultClass.extractItemTitle = this.extractItemTitle.bind(this);

        const items = this.getConfigurationOptions();
        
        // Find all matching items
        for (let [key, value] of Object.entries(res.configuration)) {
            if (typeof value === 'string') {
                value = [value];
            }

            for (const textToFind of value) {
                const item = this.findItemByText(textToFind, items);
                if (item) {
                    foundItems[key] = [...(foundItems[key] || []), item];
                    if (foundItems[key].length === value.length) {
                        break;
                    }
                }
            }
        }

        // Order components
        const orderedItems = this.orderComponents(foundItems);
        const nbItems = Object.values(orderedItems).flat().length;
        const foundEnabledItems = {};

        // Click items in order
        for (let i = 0; i < nbItems; i++) {
            for (const [key, value] of Object.entries(orderedItems)) {
                for (const item of value) {
                    if (foundEnabledItems[key] && value.indexOf(item) >= value.indexOf(foundEnabledItems[key])) {
                        continue;
                    }

                    if (await this.clickItem(item)) {
                        foundEnabledItems[key] = item;
                        break;
                    }
                }
            }
        }

        res.applied_configuration = foundEnabledItems;

        // Get price
        const priceElement = this.getPriceElement();
        if (priceElement) {
            res.compute_price_from_string(priceElement.textContent?.trim() || priceElement.innerText?.trim() || "");
        }

        await this.afterApplyConfiguration(res);

        return res;
    }

    /**
     * Verify that configuration was applied correctly
     */
    checkConfigurationApplied(configurationResult) {
        const selectedItems = this.getConfigurationOptions(false, true);
        const toReturn = {};
        let match = true;

        for (const [key, value] of Object.entries(configurationResult.configuration)) {
            if (!configurationResult.applied_configuration.hasOwnProperty(key)) {
                console.warn(`Configuration item "${key}" not found in results.`);
                match = false;
                continue;
            }

            const item = configurationResult.applied_configuration[key];
            let componentFound = false;

            for (const textToFind of value) {
                if (item && this.checkItemMatch(item, textToFind) && selectedItems.includes(item)) {
                    componentFound = true;
                    break;
                }
            }
            
            match = match && componentFound;
            toReturn[key] = item;
        }

        return {
            match: match,
            applied_components: toReturn
        };
    }

    /**
     * Scroll to price element
     */
    async scrollToPrice() {
        const priceElementWrapper = this.getPriceWrapper();
        
        if (priceElementWrapper) {
            const rect = priceElementWrapper.getBoundingClientRect();
            const scrollY = window.scrollY || document.documentElement.scrollTop;
            const scrollX = window.scrollX || document.documentElement.scrollLeft;
            let bottomOfElement = rect.top + scrollY + rect.height;

            // Custom adjustment hook
            bottomOfElement = this.adjustScrollPosition(bottomOfElement);

            window.scrollTo({
                top: bottomOfElement - window.innerHeight + 20,
                left: scrollX,
                behavior: 'auto'
            });
        }

        await this.afterScrollToPrice();
    }

    /**
     * Get price wrapper element (can be overridden)
     */
    getPriceWrapper() {
        return this.getPriceElement()?.closest('.price-wrapper, .price-box, #bogx_config_pricebox_wrap, .configurator .floatbar');
    }

    /**
     * Adjust scroll position (can be overridden for custom behavior)
     */
    adjustScrollPosition(bottomOfElement) {
        return bottomOfElement;
    }

    /**
     * Main execution method
     */
    async runAll(isRecursiveCall = false) {
        this.expandAccordionItems();

        const res = await this.applyConfiguration();
        const verified = this.checkConfigurationApplied(res);
        const verifiedResults = verified.applied_components || {};

        res.applied_configuration = verifiedResults;

        // Store result globally
        window[this.globalVarName] = JSON.parse(JSON.stringify(res));
        this.result = res;

        await this.scrollToPrice();

        if (verified.match) {
            console.log("Configuration applied successfully.");
            
            const nonZeroIndexes = Object.entries(res.applied_indexes).filter(([key, index]) => index !== 0);

            if (nonZeroIndexes.length > 0) {
                if (isRecursiveCall) {
                    console.log("Backup components applied:");
                    console.log(nonZeroIndexes.map(([key, index]) => `${key}: ${index + 1} choice used`).join('\n'));
                } else {
                    return await this.runAll(true);
                }
            }
            return true;
        }

        if (isRecursiveCall) return false;
        if (await this.runAll(true)) return true;
        
        console.log("Some items were not found or could not be applied. Missing elements:", 
            Object.keys(res.configuration).filter(key => !res.applied_configuration.hasOwnProperty(key)).join(', '));
        return false;
    }

    /**
     * Wait for page to be ready and execute
     */
    async execute() {
        if (document.readyState !== 'ready' && document.readyState !== 'complete') {
            await new Promise((resolve) => {
                window.addEventListener('pageshow', () => {
                    console.log("Page is loaded - pageshow event");
                    resolve();
                });
            });
        }

        return await this.runAll();
    }
}

// Export to global scope for userscript usage
if (typeof window !== 'undefined') {
    window.ConfigurationResult = ConfigurationResult;
    window.ConfigurationHandler = ConfigurationHandler;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConfigurationResult, ConfigurationHandler };
}