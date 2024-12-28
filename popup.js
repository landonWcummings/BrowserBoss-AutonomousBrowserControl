document.addEventListener("DOMContentLoaded", () => {
    console.log("Popup script loaded!");

    // Add an event listener for the "Run" button click
    document.getElementById("run").addEventListener("click", () => {
        const prompt = document.getElementById("prompt").value;
        console.log("User input:", prompt);

        // Send the message to the background script
        chrome.runtime.sendMessage({ type: "LLMQuery", prompt }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error handling response:", chrome.runtime.lastError.message);
                document.getElementById("output").innerText = "Error: Could not fetch tab data.";
                return;
            }

            // Display the response
            if (response && response.result) {
                document.getElementById("output").innerText = `Fetched Data: ${response.result}`;
            } else {
                document.getElementById("output").innerText = "No data received from the tab.";
            }
        });
    });
});
