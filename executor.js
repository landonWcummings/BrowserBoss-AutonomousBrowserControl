const MAX_CHAR_LIMIT = 200000; // Character limit for the model input

const cleanText = (text) => {
    if (!text) return null;
    let removedContent = [];

    // Remove <script> blocks
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
        removedContent.push(`SCRIPT BLOCK: ${match}`);
        return "⚠️";
    });

    // Remove <style> blocks
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
        removedContent.push(`STYLE BLOCK: ${match}`);
        return "⚠️";
    });

    // Remove JS calls, inline CSS, and HTML tags
    text = text.replace(/window\.\w+[^;]*;/g, (m) => {
        removedContent.push(`JS CALL: ${m}`);
        return "⚠️";
    });
    text = text.replace(/[\w\-]+\s*:\s*[^;]+;/g, (m) => {
        removedContent.push(`INLINE CSS: ${m}`);
        return "⚠️";
    });
    text = text.replace(/<\/?[^>]+(>|$)/g, (m) => {
        removedContent.push(`HTML TAG: ${m}`);
        return "";
    });

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    // If we see “tech jargon,” truncate from that point forward
    const jargonPatterns = /function|self\.__|@keyframes|\.className|data:image|font-size|document\.|var\s+\w+|gtag|hljs|doctype|createElement|innerHTML|\[\[Prototype\]\]/i;
    if (jargonPatterns.test(text)) {
        const index = text.search(jargonPatterns);
        removedContent.push(`JARGON DETECTED -> truncated from index ${index}`);
        text = text.slice(0, index).trim();
    }

    // Remove repeated quotes
    text = text.replace(/"{2,}/g, '"');

    // Replace meaningless single words
    const meaninglessPatterns = /\b(undefined|null|NaN|true|false)\b/i;
    text = text.replace(meaninglessPatterns, "⚠️");

    // Cut out large repeated sequences
    text = text.replace(
        /(\b[\w’']+\b(?:\s+\b[\w’']+\b){2,})(?:\s+\1)+/gi,
        (full, capture) => {
            removedContent.push(`INTRA-ELEMENT REPETITION: ${full}`);
            return capture;
        }
    );

    // If we see "⚠️", we truncate from there
    const truncationIndex = text.indexOf("⚠️");
    if (truncationIndex !== -1) {
        removedContent.push(`TRUNCATED CONTENT: ${text.slice(truncationIndex)}`);
        text = text.slice(0, truncationIndex).trim();
    }

    // Hard limit to 1000 characters
    const LIMIT = 1000;
    if (text.length > LIMIT) {
        removedContent.push(`OVERLY LONG TEXT -> truncated after ${LIMIT} chars.`);
        text = text.slice(0, LIMIT) + "...";
    }

    // Debug log
    if (removedContent.length > 0) {
        console.log("Removed/Truncated content:", removedContent);
    }

    return text.length > 1 ? text : null;
};

const deduplicateInputs = (elements) => {
    const seen = new Set();
    return elements.filter((el) => {
        if (el.tag !== "INPUT" && el.tag !== "TEXTAREA") return true; // Keep non-input elements untouched

        const uniqueKey = JSON.stringify({
            tag: el.tag,
            text: el.text,
            href: el.href || null,
            attributes: el.attributes || null, // Add other relevant properties if needed
        });

        if (seen.has(uniqueKey)) {
            return false; // Skip duplicates
        }

        seen.add(uniqueKey);
        return true; // Keep unique elements
    });
};

const filterElements = (elements) => {
    const uniqueElements = new Set();
    const filtered = [];

    const skipTags = new Set(["TABLE", "TBODY", "TR", "TD"]);

    elements.forEach((el, index) => {
        if (skipTags.has(el.tag)) {
            return; // Skip these tags
        }

        const isTextInput = el.tag === "INPUT" || el.tag === "TEXTAREA";

        // Clean text
        const cleaned = cleanText(el.text || "");
        if (!cleaned && !isTextInput) return; // Exclude non-input elements with no text

        const shortOrJunk = !isTextInput && cleaned.length < 1;

        if (shortOrJunk) {
            return; 
        }

        const elementKey = JSON.stringify({
            tag: el.tag,
            text: cleaned,
            href: el.href && el.href.length ? el.href : "",
        });

        if (uniqueElements.has(elementKey)) {
            return; // Skip duplicates
        }
        uniqueElements.add(elementKey);

        const item = {
            originalIndex: index + 1,
            tag: el.tag,
            text: cleaned,
            href: el.href && el.href.length ? el.href : null,
            id: el.id || null,
            class: el.class || null,
            type: el.type || null,
            visible: el.visible || null,
            ariaLabel: el.ariaLabel || null,
            ariaLabelledBy: el.ariaLabelledBy || null,
            role: el.role || null,
            placeholder: el.placeholder || null,
            name: el.name || null,
            alt: el.alt || null,
            title: el.title || null,
            rect: el.rect || null,
            isClickable: el.isClickable || null,
            isFocusable: el.isFocusable || null,
            form: el.form || null,
        };

        filtered.push(item);
    });

    // Deduplicate INPUT and TEXTAREA elements
    const deduplicated = deduplicateInputs(filtered);

    // Reassign sequential indices
    return deduplicated.map((el, i) => ({ ...el, index: i + 1 }));
};





const truncateElements = (elements, charLimit) => {
    let currentCharCount = 0;
    const truncatedElements = [];

    for (const element of elements) {
        const elementString = JSON.stringify(element);
        const elementLength = elementString.length;

        if (currentCharCount + elementLength > charLimit) {
            break;
        }

        truncatedElements.push(element);
        currentCharCount += elementLength;
    }

    console.log(`Truncated to ${truncatedElements.length} elements to stay under ${charLimit} characters.`);
    return truncatedElements;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "executeTask") {
        const { url, elements } = message.pagedata;
        console.log("received elements: ", elements)

        const filteredElements = filterElements(elements);
        

        const truncatedElements = truncateElements(filteredElements, MAX_CHAR_LIMIT);

        console.log("truncated elements: ", filteredElements)
        const LLMprompt = `
            Your task today is '${message.task}'. Currently, you are at '${url}'.
            ${
                message.pastInstructions?.length
                    ? "Past actions - " + message.pastInstructions.join(", ")
                    : ""
            }
            Here are the key page elements on the screen right now:
            ${JSON.stringify(
                truncatedElements.map((element) => {
                    // Only include these specific keys if they are non-null
                    const allowedKeys = [
                        "index",
                        "tag",
                        "text",
                        "href",
                        "rect",
                        "isClickable",
                        "ariaLabel",
                        "ariaLabelledBy",
                        "placeholder",
                        "value"
                    ];
            
                    const obj = {};
                    for (const key of allowedKeys) {
                        if (element[key] !== null && element[key] !== undefined) {
                            // If the key is `rect`, round its values
                            if (key === "rect" && typeof element[key] === "object") {
                                obj[key] = {};
                                for (const [rectKey, rectValue] of Object.entries(element[key])) {
                                    obj[key][rectKey] = Math.round(rectValue); // Round the rect values
                                }
                            } else {
                                obj[key] = element[key];
                            }
                        }
                    }
                    return obj;
                }),
                null,
                2
            )}
            Respond with a single number between 1 and ${truncatedElements.length} to interact with that element.
            Or respond with a number-text to enter text into an element, e.g., 3-"login info".
            Provide a single sentence at the end justifying why you did what you did.
            Respond with -1 if '${message.task}' is unclear or not feasible, and justify.
            Respond with -5 if task is complete.
            Respond with 0-"URL" to navigate to a new url. 
            Add a <DONE> at the end of your message if you will have completed the task after this action.
        `.trim();


        sendResponse({
            LLMprompt,
            title: "You are an LLM autonomously controlling a browser.",
            filteredElements:truncatedElements,
        });

        return true;
    }
});
