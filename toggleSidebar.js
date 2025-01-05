if (typeof chatContainer === "undefined") {
    var chatContainer = null; // Declare and initialize file-wide
}



// Define the addMessage function globally
function addMessage(sender, text) {
    const messageWrapper = document.createElement("div");
    messageWrapper.setAttribute("data-executioner", "true");
    messageWrapper.classList.add("executioner-element");
    messageWrapper.style.display = "flex";
    messageWrapper.style.marginBottom = "10px";

    const messageBubble = document.createElement("div");
    messageBubble.setAttribute("data-executioner", "true");
    messageBubble.classList.add("executioner-element");
    messageBubble.style.padding = "10px";
    messageBubble.style.borderRadius = "15px";
    messageBubble.style.maxWidth = "70%";
    messageBubble.style.wordWrap = "break-word";
    messageBubble.style.fontSize = "14px";
    messageBubble.style.boxShadow = "0px 1px 3px rgba(0, 0, 0, 0.2)";

    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to the bottom


    if (sender === "user") {
        messageWrapper.style.justifyContent = "flex-end";
        messageBubble.style.backgroundColor = "#DCF8C6";
        messageBubble.style.textAlign = "left";
        messageBubble.style.marginLeft = "auto";
    } else {
        messageWrapper.style.justifyContent = "flex-start";
        messageBubble.style.backgroundColor = "#ffffff";
        messageBubble.style.textAlign = "left";
    }

    messageBubble.innerText = text;
    messageWrapper.appendChild(messageBubble);

    // Ensure the wrapper gets the class and data-executioner attribute
    messageWrapper.classList.add("executioner-element");
    messageWrapper.setAttribute("data-executioner", "true");

    chatContainer.appendChild(messageWrapper);

    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to the bottom
}


(async () => {
    const STORAGE_KEY = "sidebarChatHistory";

    // Helper function to save chat history with timestamp
    async function saveChatHistory(history) {
        const timestamp = Date.now(); // Current timestamp in milliseconds
        await chrome.runtime.sendMessage({ type: "saveChatHistory", data: { history, timestamp } });
    }

    // Helper function to load chat history if it was stored within the last 10 minutes
    async function loadChatHistory() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "loadChatHistory" }, (response) => {
                if (!response || !response.history) {
                    resolve(null);
                    return;
                }

                const { history, timestamp } = response;
                const now = Date.now();
                console.log("Data received from loadChat:", history);

                // Check if the data was stored within the last 10 minutes (600,000 ms)
                if (now - timestamp <= 600000) {
                    resolve(history);
                } else {
                    resolve(null); // Data expired
                }
            });
        });
    }

    // Check if the sidebar already exists
    let existing = document.getElementById("llm-extension-sidebar");
    if (existing) {
        existing.style.display = existing.style.display === "none" ? "block" : "none";
        setTimeout(() => {
            const chatContainer = document.getElementById("chat-container");
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight; // Ensure scrolling to the bottom
            }
        }, 0); // Allow DOM updates before scrolling
        existing.querySelector("textarea").focus(); // Auto-focus input
        return;
    }
    

    // Create the sidebar
    // Create the sidebar
    const sidebar = document.createElement("div");
    sidebar.id = "llm-extension-sidebar";
    sidebar.setAttribute("data-executioner", "true");
    sidebar.classList.add("executioner-element");
    sidebar.style.position = "fixed";
    sidebar.style.top = "0";
    sidebar.style.right = "0"; // Ensures it stays on the right edge
    sidebar.style.width = "100%"; // Make sure it doesn't overflow the viewport width
    sidebar.style.maxWidth = "300px"; // Ensures consistent width
    sidebar.style.height = "100vh";
    sidebar.style.zIndex = "999999";
    sidebar.style.display = "flex";
    sidebar.style.flexDirection = "column";
    sidebar.style.backgroundColor = "#f0f0f0";
    sidebar.style.opacity = "0.96";


    // Sidebar header
    const header = document.createElement("div");
    header.classList.add("executioner-element");
    header.style.backgroundColor = "#075E54";
    header.style.color = "black";
    header.style.padding = "10px";
    header.style.fontSize = "24px";
    header.style.fontWeight = "bold";
    header.style.textAlign = "center";
    header.style.position = "relative";

    const infoIcon = document.createElement("div");
    infoIcon.innerText = "ⓘ"; // Unicode character for info
    infoIcon.style.position = "absolute"; // Use absolute positioning
    infoIcon.style.left = "10px"; // Flush against the left wall
    infoIcon.style.top = "50%"; // Vertically centered
    infoIcon.style.transform = "translateY(-50%)"; // Ensure perfect vertical centering
    infoIcon.style.cursor = "pointer";
    infoIcon.style.fontSize = "20px";


    // Add event listener to show an info card
    infoIcon.addEventListener("click", () => {
        const infoCard = document.getElementById("info-card");

        if (infoCard) {
            // Toggle visibility
            infoCard.style.display = infoCard.style.display === "none" ? "block" : "none";
        } else {
            // Create the info card
            const newInfoCard = document.createElement("div");
            newInfoCard.id = "info-card";
            newInfoCard.style.position = "absolute";
            newInfoCard.style.top = "40px"; // Position below the header
            newInfoCard.style.left = "10px";
            newInfoCard.style.backgroundColor = "#fff";
            newInfoCard.style.padding = "10px";
            newInfoCard.style.border = "1px solid #ccc";
            newInfoCard.style.borderRadius = "5px";
            newInfoCard.style.boxShadow = "0px 2px 5px rgba(0, 0, 0, 0.2)";
            newInfoCard.style.zIndex = "1000000";
            newInfoCard.style.width = "250px"; // Ensure proper width for the card
    
            // Add info text
            const infoText = document.createElement("p");
            infoText.innerText = "Demo project made by Landon Cummings. Testing applications of LLMs. Uses Amazon's Nova lite in the background. To learn more about this extension visit ";
            newInfoCard.appendChild(infoText);
    
            // Add the link
            const infoLink = document.createElement("a");
            infoLink.href = "https://landoncummings.com/BrowsingBoss-AutonomousBrowserControl";
            infoLink.innerText = "my website.";
            infoLink.style.color = "#007bff"; // Link color
            infoLink.style.textDecoration = "none"; // No underline by default
            infoLink.style.fontWeight = "bold";
            infoLink.target = "_blank"; // Open in a new tab
            infoLink.addEventListener("mouseover", () => {
                infoLink.style.textDecoration = "underline"; // Add underline on hover
            });
            infoLink.addEventListener("mouseout", () => {
                infoLink.style.textDecoration = "none"; // Remove underline on hover out
            });
    
            newInfoCard.appendChild(infoLink);

            const aftertext = document.createElement("p");
            aftertext.innerText = " For any business inquires or project ideas contact lndncmmngs@ gmail.com";
            newInfoCard.appendChild(aftertext);


            header.appendChild(newInfoCard);
        }
    
    });


    //            newInfoCard.innerText = "Demo project made by Landon Cummings. Testing applications of LLMs. Uses Amazon's Nova lite in the background. To learn more about this visit";

    header.appendChild(infoIcon);

    // Title
    const title = document.createElement("span");
    title.innerText = "EXECUTIONER";
    title.style.verticalAlign = "middle"; // Align with the info icon
    header.appendChild(title);

    // Close button
    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.position = "absolute";
    closeButton.style.top = "2px";
    closeButton.style.right = "10px";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.color = "#f0f0f0";
    closeButton.style.fontSize = "35px";
    closeButton.style.cursor = "pointer";

    closeButton.addEventListener("click", () => {
        chatContainer = null;
        chrome.runtime.sendMessage({ type: "reset" });
        sidebar.remove();
    });

    header.appendChild(closeButton);


    chatContainer = document.createElement("div");
    chatContainer.id = "chat-container";
    chatContainer.style.flex = "1";
    chatContainer.style.overflowY = "auto";
    chatContainer.style.padding = "10px";
    chatContainer.style.backgroundColor = "#ECE5DD";
    chatContainer.style.color = "black";

    // Input area
    const inputArea = document.createElement("div");
    inputArea.style.display = "flex";
    inputArea.style.borderTop = "1px solid #ccc";
    inputArea.style.backgroundColor = "#ffffff";
    inputArea.style.position = "sticky";
    inputArea.style.bottom = "0";

    const input = document.createElement("textarea");
    input.placeholder = "I will execute...";
    input.style.flex = "1";
    input.style.height = "40px";
    input.style.padding = "10px";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.fontSize = "14px";
    input.style.color = "black";
    input.style.resize = "none";
    input.focus();

    const sendButton = document.createElement("button");
    sendButton.innerText = "EXECUTE";
    sendButton.style.backgroundColor = "#075E54";
    sendButton.style.color = "black";
    sendButton.style.border = "none";
    sendButton.style.padding = "0 20px";
    sendButton.style.fontSize = "16px";
    sendButton.style.cursor = "pointer";

    // Append elements
    inputArea.appendChild(input);
    inputArea.appendChild(sendButton);
    sidebar.appendChild(header);
    sidebar.appendChild(chatContainer);
    sidebar.appendChild(inputArea);
    document.body.appendChild(sidebar);

    // Auto-focus the input field
    input.focus();

    // Load chat history if it exists
    const savedHistory = await loadChatHistory();
    if (savedHistory) {
        savedHistory.forEach(({ sender, text }) => addMessage(sender, text));
        setTimeout(() => {
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the bottom
            }
        }, 0);
    } else {
        const defaultMessage = "What shall I execute today?";
        addMessage("bot", defaultMessage);
        await saveChatHistory([{ sender: "bot", text: defaultMessage }]);
    }    

    // Handle send button click
    sendButton.addEventListener("click", async () => {
        const message = input.value.trim();
        if (!message) return;
        input.value = "";

        chrome.runtime.sendMessage({ type: "LLMQuery", prompt: message }, async (response) => {
            if (chrome.runtime.lastError) {
                addMessage("bot", "Error: Could not communicate with background.");
                return;
            }

            const botMessage = response.result || "No response from background script.";
            if (botMessage != "No response from background script."){
                addMessage("bot", botMessage);
            }
            

            const chatHistory = Array.from(chatContainer.children).map((bubble) => ({
                sender: bubble.style.justifyContent === "flex-end" ? "user" : "bot",
                text: bubble.innerText,
            }));
            await saveChatHistory(chatHistory);
        });
    });
})();

// Listener for "updateChatHistory"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "updateChatHistory") {
        const { data } = message;

        if (!chatContainer) {
            console.error("chatContainer is not initialized.");
            return;
        }

        chatContainer.innerHTML = "";
        data.history.forEach(({ sender, text }) => addMessage(sender, text));

        console.log("Chat history updated:", data.history);
    }
});
