chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "executeTask") {
        const { url, elements } = message.data;

        console.log("executor.js received URL:", url);
        console.log("executor.js received elements:", elements);

        let targetElement = null;

        if (elements.length >= 5) {
            const rawtargetElement = elements[4]; // Get the 5th element (index 4)
            targetElement = {
                tag: rawtargetElement.tag,
                id: rawtargetElement.id || null,
                class: rawtargetElement.class || null,
                text: rawtargetElement.text || null,
                href: rawtargetElement.href || null
            };
        } else {
            console.warn("Less than target elements available in the array.");
        }

        // Process the URL and elements as needed
        const taskResult = `Processed ${elements.length} elements from ${url}`;
        console.log("Task result:", taskResult);

        // Send both the task result and the target element (if available)
        sendResponse({ 
            result: taskResult,
            fifthElement: fifthElement || "No target element available."
        });
    }
    return true; // Keep the channel open for async responses
});
