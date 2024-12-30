// background.js
import { queryXAI } from './utils/api.js';

// Listen for messages from popup.js or elsewhere
chrome.runtime.onMessage.addListener((task, sender, sendResponse) => {
  // We only care about messages of type "LLMQuery"
  if (task.type === "LLMQuery") {
    (async () => {
      let test = true;
      let pageinformation = null;
      let selectedTab = null;
      let execResponse = null;
      let finishing = false;

      // We'll keep a history of instructions across all loops
      let instructionsHistory = [];

      console.log("Prompt received:", task.prompt);

      try {
        // 1) Find the currently active tab
        selectedTab = await getcurrenturl();
        console.log("Selected Tab:", selectedTab);

        // 2) Inject scripts in the order they are used
        await injectScriptsInOrder(selectedTab.id, [
          "utils/api.js",
          "content.js",
          "executor.js",
        ]);

        // 3) Retrieve visible elements and prepare the environment
        const [currentPageData, prepareResponse] = await Promise.all([
          sendMessageToTab(selectedTab.id, { type: "getVisibleElements" }),
        ]);

        pageinformation = currentPageData;

        console.log("Data from content.js:", pageinformation);

        
        // ----- Repeat up to x times -----
        for (let i = 0; i < 3; i++) {
          console.log(`=== Iteration ${i + 1} ===`);

          pageinformation = await sendMessageToTab(selectedTab.id, { type: "getVisibleElements" })

          // 4) Execute the task on the page
          execResponse = await sendMessageToTab(selectedTab.id, {
            type: "executeTask",
            pagedata: pageinformation,
            task: task.prompt,
            // Pass the instructions history each time
            pastInstructions: instructionsHistory,
          });

          console.log("Response from executor.js:", execResponse.LLMprompt);

          // 5) Now query the LLM (or mock it) and parse the response
          let LLMinstruction;
          try {
            if (test) {
                LLMinstruction = "22-\"input testing\"<DONE>\n\nI did this as a test of inputs"
                //LLMinstruction ="6\n\nI clicked on the element with index 6 because it is an anchor tag with the text \"flappy-bird-plus-ai\" and its href attribute leads to the Flappy Bird page on the website.";
            } else {
              const LLMresponse = await queryXAI(execResponse.LLMprompt);
              LLMinstruction = LLMresponse.choices[0].message.content;
            }
            console.log("LLMresponse content:", JSON.stringify(LLMinstruction));
            // Extract the part of LLMinstruction after the first newline
            const instructionAfterNewline = LLMinstruction.split("\n").slice(1).join("\n").trim();

            // Push only the part after the newline
            if (instructionsHistory == []) {
                instructionsHistory.push(instructionAfterNewline); // First entry
            } else {
                instructionsHistory[0] += `\n${instructionAfterNewline}`; // Append with newline
            }
            

            // Parse the LLM response
            const cleanllmresp = parseresponse(
              LLMinstruction,
              execResponse.filteredElements
            );

            // 6) Handle the parsed LLM instructions
            if (cleanllmresp.done){
                finishing = true
            }
            const action = Number(cleanllmresp.action);
            if (action === -1) {
              sendResponse({
                result: `Failed to proceed - ${cleanllmresp.justification}`,
              });
              return;
            } else if (action === 0) {
              // For action=0, navigate to a URL (then wait)
              selectedTab = await goToURL(cleanllmresp.inputtext, selectedTab.id);
            } else if (action === -5) {
              // For action=-5, consider the task complete
              sendResponse({ result: "Task Complete!" });
              return;
            } else {
              // For other positive indices, perform a click
              try {
                const clickResponse = await sendMessageToTab(selectedTab.id, {
                  type: "executeClick",
                  element: cleanllmresp.targetElement,
                  inputtext: cleanllmresp.inputtext,
                });
                console.log("Click response received:", clickResponse);

                sendResponse({
                  result: cleanllmresp.justification,
                  clickResponse,
                });
              } catch (error) {
                console.error("Error executing:", error.message);
                sendResponse({
                  result: "Error executing.",
                  error: error.message,
                });
              }
            }
          } catch (error) {

            console.error("Error querying XAI:", error.message);
            sendResponse({
              result: `Failed to process LLM response - ${error.message}`,
            });
            return; // Stop execution here if there's an error
          }

          await pause(1000);
          if (finishing){
            i = 1000
            sendResponse({ result: "Task accomplished!" });
          }

          // After finishing one iteration, proceed to the next
        }

        // If we reach here after 5 iterations without -5 or -1, we can say we're done.
        sendResponse({ result: "Maximum 5 iterations reached!" });
      } catch (error) {
        console.error("Error processing the task:", error.message);
        sendResponse({ result: `Error occurred: ${error.message}` });
      }
    })();

    // Return true to keep the message channel open for async operations
    return true;
  }
});

// --- Helper functions ---

function injectScriptsInOrder(tabId, scripts) {
  // Insert the scripts in order, one after another
  return scripts.reduce((promise, script) => {
    return promise.then(() => injectScript(tabId, script));
  }, Promise.resolve());
}

function injectScript(tabId, file) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: [file] }, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(`Error injecting ${file}: ${chrome.runtime.lastError.message}`)
        );
      } else {
        console.log(`${file} injected successfully.`);
        resolve();
      }
    });
  });
}

// Helper to send a message to a specific tab
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError || !response) {
        reject(
          new Error(
            `Error communicating with tab: ${
              chrome.runtime.lastError?.message || "No response"
            }`
          )
        );
      } else {
        resolve(response);
      }
    });
  });
}

/** 
 * Wait for the given tab to finish loading (after navigation).
 * We'll wait for a 'onCompleted' event in chrome.webNavigation.
 */
function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const handleCompleted = (details) => {
      if (details.tabId === tabId) {
        chrome.webNavigation.onCompleted.removeListener(handleCompleted);
        resolve();
      }
    };
    chrome.webNavigation.onCompleted.addListener(handleCompleted);
  });
}

/** 
 * A simple helper to wait/pause for a given number of milliseconds 
 */
function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseresponse(llmmessage, filteredElements) {

  let inputtext = null;
  let index = null;
  let targetElement = null;
  let done = false;

  if(llmmessage.includes("<DONE>")){
    done = true
    llmmessage = llmmessage.replace("<DONE>", "")
  }

  
  // Separate everything before and after the first newline
  const [beforeNewline, ...afterNewlineParts] = llmmessage.split("\n");
  const afterNewline = afterNewlineParts.join(" ").trim(); // Join and remove extra newlines


  if (beforeNewline.includes("-")) {
    // Split the first part (before newline) by "-" to extract the number and input text
    [index, ...inputtext] = beforeNewline.split("-");
    inputtext = inputtext.join("-").trim(); // Rejoin input text if it contains additional "-"
  } else {
    index = beforeNewline.trim(); // If no "-", the number is the entire first part
  }


  // Check if the index is valid
  if (index > 0) {
    if (isNaN(index) || index < 1 || index > filteredElements.length) {
      return {
        action: -1,
        justification: "Invalid index provided by LLM.",
      };
    }
    targetElement = filteredElements[index - 1];
    if (targetElement.text === "N/A") {
      targetElement.text = null;
    }
  }


  console.log("action number:", index);
  console.log("inputtext:", inputtext);
  console.log("justification:", afterNewline);
  console.log("Target element:", targetElement);

  // Construct the parsed response
  return {
    action: index || -1, // Default action if no number found
    inputtext: inputtext || "",
    justification: afterNewline.trim(),
    targetElement,
    done: done 
  };
}


async function goToURL(newUrl, id) {
    try {
      console.log("Attempting to navigate to:", newUrl);
  
      // Remove surrounding quotes and trim
      const sanitizedUrl = newUrl.replace(/^["']|["']$/g, "").trim();
  
      // Validate and normalize URL
      const url = new URL(
        sanitizedUrl.startsWith("http") ? sanitizedUrl : `https://${sanitizedUrl}`
      );
  
      // Wrap `chrome.tabs.update` in a Promise
      const updatedTab = await new Promise((resolve, reject) => {
        chrome.tabs.update(id, { url: url.href }, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log("Navigation successful to:", url.href);
            resolve(tab);
          }
        });
      });
  
      // Wait until the new page is loaded completely
      await waitForPageLoad(id);
  
      // Then add a small delay (0.7 second) before continuing
      await pause(1000);
  
      // Get the updated tab information
      const temptabinfo = await getcurrenturl();
  
      // Inject scripts after navigation
      console.log("Injecting scripts...");
      await injectScriptsInOrder(temptabinfo.id, [
        "utils/api.js",
        "content.js",
        "executor.js",
      ]);
      console.log("Scripts injected successfully. Proceeding with sendMessageToTab...");
  
      // Return the updated tab info
      return temptabinfo;
    } catch (error) {
      console.error("Invalid URL or navigation error:", error.message);
      throw error; // Rethrow the error for proper handling in the caller
    }
}
  

function getcurrenturl() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const selectedTab = tabs.find((tab) => tab.selected || tab.active);

      if (!selectedTab) {
        console.warn("No selected tab found.");
        reject(new Error("No selected tab available."));
        return;
      }

      console.log("Selected Tab URL:", selectedTab.url);
      resolve(selectedTab); // Resolve the promise with selectedTab
    });
  });
}


