if (typeof myVariable === "undefined") {
    // Declare it now
    var MAX_CHAR_LIMIT = 200000;
  
}
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
        //console.log("Removed/Truncated content:", removedContent);
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
        // Skip elements with the class 'executioner-element'
        if (el.class && typeof el.class === "string" && el.class.includes("executioner-element")) {
            return; // Exclude this element
        }

        if (el.text && typeof el.text === "string" && (el.text.toLowerCase().includes("execute") || el.text.toLowerCase().includes("execution"))) {
            return;
        }

        // Skip specific tags
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
            attributes: el.attributes || null, // Include attributes for reference
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
        console.log("past actions: ", message.pastInstructions)
        const LLMprompt = `
            Your task today is '${message.task}'. Currently, you are at '${url}'.
            ${
                message.pastInstructions?.length
                    ? "Past actions - " + message.pastInstructions.join(", ")
                    : ""
            }
            Here are the key page elements on the current page right now:
            ${JSON.stringify(
                truncatedElements
                    .filter((element) => {
                        const rect = element?.rect;
            
                        // Exclude elements without a rect or with a very small area
                        if (!rect || rect.width * rect.height < 5) {
                            return false;
                        }
            
                        // Exclude elements with rect.x < -100
                        if (rect.x < -100) {
                            return false;
                        }
            
                        return true; // Include element if it passes the conditions
                    })
                    .map((element) => {
                        // Only include these specific keys if they are non-null
                        const allowedKeys = [
                            "index",
                            "tag",
                            "text",
                            "href",
                            "isClickable",
                            "ariaLabel",
                            "ariaLabelledBy",
                            "placeholder",
                            "value",
                            "onScreenArea", // Add the calculated on-screen area
                        ];
            
                        const obj = {};
                        for (const key of allowedKeys) {
                            if (key === "onScreenArea") {
                                // Calculate the on-screen area and include it
                                const rect = element?.rect;
                                if (rect) {
                                    obj[key] = Math.round(rect.width * (rect.height / 1000));
                                }
                            } else if (element[key] !== null && element[key] !== undefined) {
                                obj[key] = element[key];
                            }
                        }
                        return obj;
                    }),
                null,
                2
            )}            
            Respond with a single number between 1 and ${truncatedElements.length} to interact with the element that contains that aformentioned index. Make sure the elements size and location on screen, along with it other elements help complete ${message.task}
            Or respond with a number-text to input text into ONLY a INPUT, TEXTAREA or DIV do not input into a SPAN for example. example: 3-"login info"
            Provide a single sentence at the end justifying why you did what you did. This should be after a newline.
            Respond with -1 if '${message.task}' is unclear or not possible, even with multiple steps.
            Respond with -5 if task is complete.
            Append a <DONE> at the end of your message if you will have completely finished ${message.task}. If this action will finish the task then append the <DONE>
            Respond with 0-"{URL}" to navigate to a new url. Only respond with a -"{URL} if the first number is 0"
            Respond once. Your choices for a response are a positive number, -5,-1,0-"[URL]" plus the justification.
        `.trim();


        sendResponse({
            LLMprompt,
            title: "You are an LLM autonomously controlling a browser.",
            filteredElements:truncatedElements,
        });

        
    }
});
