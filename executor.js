const cleanText = (text) => {
    if (!text) return null;
    let removedContent = []; // To store removed or truncated content

    // Replace script blocks with truncation symbol and log the removed content
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
        removedContent.push(`SCRIPT BLOCK: ${match}`);
        return "⚠️";
    });

    // Replace style blocks with truncation symbol and log the removed content
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
        removedContent.push(`STYLE BLOCK: ${match}`);
        return "⚠️";
    });

    // Replace JS calls like `window.*` with truncation symbol and log
    text = text.replace(/window\.\w+[^;]*;/g, (match) => {
        removedContent.push(`JS CALL: ${match}`);
        return "⚠️";
    });

    // Replace inline CSS (key:value;) with truncation symbol and log
    text = text.replace(/[\w\-]+\s*:\s*[^;]+;/g, (match) => {
        removedContent.push(`INLINE CSS: ${match}`);
        return "⚠️";
    });

    // Remove HTML tags and log them
    text = text.replace(/<\/?[^>]+(>|$)/g, (match) => {
        removedContent.push(`HTML TAG: ${match}`);
        return "";
    });

    // Normalize whitespace
    text = text.replace(/[\s\n\t]+/g, " ").trim();

    // Detect the start of jargon/code and insert truncation symbol
    const jargonPatterns = /function|self\.__|@keyframes|\.className|data:image|font-size|document\.|var\s+\w+|gtag|hljs|doctype|createElement|innerHTML|\[\[Prototype\]\]/i;
    if (jargonPatterns.test(text)) {
        const match = text.match(jargonPatterns)[0];
        removedContent.push(`JARGON DETECTED: ${match}`);
        text = text.replace(jargonPatterns, "⚠️");
    }

    // Remove repeated quotes or meaningless sequences
    text = text.replace(/"{2,}/g, (match) => {
        removedContent.push(`REPEATED QUOTES: ${match}`);
        return "";
    });

    // Replace meaningless patterns and log them
    const meaninglessPatterns = /\b(undefined|null|NaN|true|false)\b/i;
    if (meaninglessPatterns.test(text)) {
        const match = text.match(meaninglessPatterns)[0];
        removedContent.push(`MEANINGLESS PATTERN: ${match}`);
        text = text.replace(meaninglessPatterns, "⚠️");
    }

    // Truncate overly long text or when truncation symbol is detected
    const truncationIndex = text.indexOf("⚠️");
    if (truncationIndex !== -1) {
        removedContent.push(`TRUNCATED CONTENT: ${text.slice(truncationIndex)}`);
        text = text.slice(0, truncationIndex).trim();
    }
    if (text.length > 1000) {
        removedContent.push(`OVERLY LONG TEXT: ${text.slice(1000)}`);
        text = `${text.slice(0, 1000)}...`;
    }

    // Log removed content for debugging
    if (removedContent.length > 0) {
        console.log("Removed/Truncated Content:", removedContent);
    }

    return text.length > 2 ? text : null;
};
const filterElements = (elements) => {
    const uniqueContent = new Set();
    const uniqueElements = new Set();
    const staticContent = [];

    const filtered = elements
        .map((el, index) => {
            // Process each element
            const processedElement = {
                originalIndex: index,
                tag: el.tag || null,
                text: cleanText(el.text),
                href: el.href || null,
                type: el.type || null,
                role: el.role || null,
                placeholder: el.placeholder || null,
            };

            // Filter out null or empty properties
            return Object.fromEntries(
                Object.entries(processedElement).filter(([_, value]) => value !== null)
            );
        })
        .filter((el) => {
            // Skip elements with null text
            if (!el.text) return false;
        
            // Create a unique key based on element properties
            const uniqueKey = JSON.stringify({
                tag: el.tag,
                text: el.text,
                href: el.href,
                type: el.type,
                role: el.role,
                placeholder: el.placeholder,
            });
        
            // Check if the element is unique
            if (uniqueElements.has(uniqueKey)) {
                return false; // Duplicate element, filter it out
            }
            uniqueElements.add(uniqueKey);
        
            return true;
        
        
        })
        .map((el, newIndex) => ({ ...el, index: newIndex + 1 })); // Assign new indices for LLM

    // Add a final element for aggregated static content
    if (staticContent.length > 0) {
        filtered.push({
            tag: "STATIC_CONTENT",
            text: staticContent.join(" "),
            index: filtered.length + 1,
        });
    }

    return filtered;
};


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Message received in executor.js:", message);

    if (message.type === "executeTask") {
        const { url, elements } = message.pagedata;
        const plan = message.plan

        // Clean and filter elements
        const filteredElements = filterElements(elements);

        console.log("executor.js filtered elements:", filteredElements);

        // Build the LLM prompt
        const LLMprompt = `
            Your task today is '${message.task}'. Currently, you are at '${url}'.
            The plan is: ${plan}
            ${message.pastInstructions && message.pastInstructions.length > 0 ? `Past actions - ${message.pastInstructions.join(", ")}` : ""}
            Here are the key page elements on the screen right now:
            ${JSON.stringify(filteredElements.map(({ index, tag, text, href }) => ({ index, tag, text, href })), null, 2)}
            Respond with a single number between 1 and ${filteredElements.length} to interact with that element.
            Or respond with a number-text to enter text into an element, e.g., 3-"login info".
            Provide a single sentence at the end justifying why you did what you did.
            Respond with -1 if '${message.task}' is unclear or not feasible, and justify.
            Respond with -5 if task is complete. Respond with 0-"URL" to navigate to a new url. Add a <DONE> at the end of your message if you will have completed the task after this action.
        `.trim();


        sendResponse({
            LLMprompt: LLMprompt.trim(),
            title: "You are an LLM autonomously controlling a browser.",
            filteredElements: filteredElements
        });

        return true; // Indicate asynchronous response
    }

    if (message.type === "prepare") {
        const  url  = message.url;
        const task = message.task

        // Build the LLM prompt
        const LLMplanprompt = `
            You are currently at '${url}'. Make a very concise numbered list of steps that should be taken in order to accomplish '${task}'.
            You are allowed to input text, click on page elements, and navigate to new URLS. This is done through a interace for you so respond with click-"some on page element", navigate to-"URL", or input text"some page element and text to input. Keep it open-ended as you likely don't know what to do at a page"
            If the task -'${task}' is not clear, unfeasable, or not a task that can be accomplished respond with -1_"<sentance why it is unfeasable>" otherwise respond with a numbered of clear steps to take in order to complete the task.
        `;

        //console.log("LLM plan prompt: ", LLMplanprompt)
        sendResponse({
            LLMplanprompt: LLMplanprompt.trim()
        });

        return true; // Indicate asynchronous response
    }
    return false;
});
