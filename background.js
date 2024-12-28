chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LLMQuery") {
        chrome.tabs.query({}, (tabs) => {
            const selectedTab = tabs.find(tab => tab.selected === true || tab.active === true);

            if (!selectedTab) {
                console.warn("No selected tab found.");
                sendResponse({ result: "No selected tab available." });
                return;
            }

            console.log("Selected Tab:", selectedTab.url);

            // Inject `content.js`
            chrome.scripting.executeScript(
                {
                    target: { tabId: selectedTab.id },
                    files: ["content.js"]
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error injecting content script:", chrome.runtime.lastError.message);
                        sendResponse({ result: "Failed to inject content script." });
                        return;
                    }

                    // Request visible elements and URL from `content.js`
                    chrome.tabs.sendMessage(selectedTab.id, { type: "getVisibleElements" }, (response) => {
                        if (chrome.runtime.lastError || !response) {
                            console.error("Error communicating with content script or empty response:", chrome.runtime.lastError?.message || "No response");
                            sendResponse({ result: "Failed to fetch visible elements." });
                            return;
                        }

                        console.log("Data from content.js:", response);

                        // Inject `executor.js`
                        chrome.scripting.executeScript(
                            {
                                target: { tabId: selectedTab.id },
                                files: ["executor.js"]
                            },
                            () => {
                                if (chrome.runtime.lastError) {
                                    console.error("Error injecting executor script:", chrome.runtime.lastError.message);
                                    sendResponse({ result: "Failed to inject executor script." });
                                    return;
                                }

                                console.log("executor.js injected successfully.");

                                // Send data to `executor.js`
                                chrome.tabs.sendMessage(selectedTab.id, { type: "executeTask", data: response }, (execResponse) => {
                                    if (chrome.runtime.lastError || !execResponse) {
                                        console.error("Error communicating with executor.js:", chrome.runtime.lastError?.message || "No response");
                                        sendResponse({ result: "Failed to process data with executor script." });
                                        return;
                                    }

                                    console.log("Response from executor.js:", execResponse);

                                    // Check if the target element is available
                                    if (execResponse.targetElement) {
                                        // Send `executeClick` message with the target element
                                        chrome.tabs.sendMessage(selectedTab.id, {
                                            type: "executeClick",
                                            element: execResponse.targetElement
                                        }, (clickResponse) => {
                                            if (clickResponse?.status === "success") {
                                                console.log(clickResponse.message);
                                            } else {
                                                console.error(clickResponse?.message || "Unknown error during executeClick.");
                                            }
                                        });
                                    } else {
                                        console.warn("No target element available to click.");
                                    }

                                    sendResponse({ result: "Data successfully processed and click executed." });
                                });
                            }
                        );
                    });
                }
            );
        });

        return true; // Keep the channel open for async responses
    }
});
