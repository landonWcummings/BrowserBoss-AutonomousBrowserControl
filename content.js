console.log("Content script loaded!");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "getVisibleElements") {
        const currentUrl = window.location.href;

        // Get visible elements
        const elements = Array.from(document.querySelectorAll("*")).filter(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 &&
                   rect.height > 0 &&
                   style.visibility !== "hidden" &&
                   style.display !== "none";
        }).map(el => ({
            tag: el.tagName,
            id: el.id || null,
            class: el.className || null,
            text: el.textContent.trim() || null,
            href: el.href || null,
            type: el.type || null
        }))
        .filter(el => {
            // Exclude elements with no meaningful content
            if (!el.id && !el.class && !el.text && !el.href && !el.type) {
                return false;
            }
            // Exclude elements by tag name
            const excludedTags = ["svg", "circle", "path"];
            return !excludedTags.includes(el.tag.toLowerCase());
        });

        sendResponse({ url: currentUrl, elements });
        return true; // Keep the channel open for async responses
    }

    if (message.type === "executeClick") {
        const element = message.element;
        const inputtext = message.inputtext;
    
        if (!element) {
            console.warn("No element provided in the message.");
            sendResponse({ status: "error", message: "No element provided" });
            return true;
        }
    
        const { tag, id, class: className, text, value } = element;
    
        // Build the selector based on available properties
        let selector = tag;
        if (id) {
            selector += `[id="${id}"]`;
        } else if (className) {
            const classes = className.split(' ').filter(Boolean).join('.');
            if (classes) {
                selector += `.${classes}`;
            }
        }
        console.log("Selector:", selector);
    
        // Query elements matching the selector
        const candidates = Array.from(document.querySelectorAll(selector));
        console.log("Candidates:", candidates);
    
        // Match elements by text or value if provided
        const matchedElement = candidates.find(el =>
            (!text || el.textContent.trim() === text) &&
            (!value || el.value === value)
        );
    
        if (matchedElement) {
            if (inputtext && (matchedElement.tagName === "INPUT" || matchedElement.tagName === "TEXTAREA")) {
                // Type the inputtext into the element
                matchedElement.value = inputtext;
    
                // Dispatch an input event to simulate user typing
                const inputEvent = new Event("input", { bubbles: true });
                matchedElement.dispatchEvent(inputEvent);
    
                console.log("Input text entered:", inputtext);
                sendResponse({ status: "success", message: "Text entered successfully" });
            } else {
                // Click the element
                matchedElement.click();
                console.log("Element clicked:", matchedElement);
                sendResponse({ status: "success", message: "Element clicked successfully" });
            }
        } else {
            console.warn("No matching element found for:", element);
            sendResponse({ status: "error", message: "No matching element found" });
        }
        return true; // Keep the channel open for async responses
    }
    
});
