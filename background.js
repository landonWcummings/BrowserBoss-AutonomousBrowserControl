import { queryNova } from './dist/api.bundle.js';

let chatHistoryData = { history: [], timestamp: 0 };
let instructionsHistory = [];
const MAX_REQUESTS_PER_DAY = 25; // Set your daily request limit
const STORAGE_KEY = "LLMQueryLimits";



chrome.action.onClicked.addListener(async (tab) => {
    // Inject script that toggles a sidebar on the page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["toggleSidebar.js"]
    });
  });
  

chrome.runtime.onMessage.addListener((task, sender, sendResponse) => {
    if (task.type === "saveChatHistory") {
        // Save history with timestamp
        chatHistoryData = {
            ...chatHistoryData,
            history: [...chatHistoryData.history, ...task.data.history],
            timestamp: task.data.timestamp || Date.now(),
        };
              console.log("Chat history saved:", chatHistoryData);
        chrome.tabs.query({}, (tabs) => {
          tabs
          // Keep only tabs whose URL starts with http:// or https://
          .filter(t => t.url && /^https?:\/\//i.test(t.url))
          .forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: "updateChatHistory",
              data: chatHistoryData,
            });
          });
      
        });

        sendResponse({ success: true });

    } else if (task.type === "loadChatHistory") {
        // Return stored chat history
        console.log("Received request to loadchathistory. sending: ", chatHistoryData)
        sendResponse(chatHistoryData);
    }else if (task.type === "reset"){
      cleanup()
      chatHistoryData = { history: [], timestamp: 0 };

    }else if (task.type === "LLMQuery") {
      (async () => {

      chatHistoryData.history.push({ sender: "user", text: task.prompt });
      console.log("User message added to chat history:", chatHistoryData);
          
      if (!(await canMakeLLMQuery())) {
        addBotMessageToHistory("Daily limit reached. Please try again tomorrow or contact lndncmmngs@gmail.com for a pro account.");
        sendResponse({ success: true, error: "Daily limit reached." });
        console.log("Daily limit reached.")
        
      }else{
        let test = false;
        let pageinformation = null;
        let selectedTab = null;
        let execResponse = null;
        let finishing = false;
        console.log("chat history after addition: ", chatHistoryData)
        addBotMessageToHistory("Initializing")
        
        // We'll keep a history of instructions across all loops
        

        console.log("Prompt received:", task.prompt);

        try {
          // 1) Find the currently active tab
          selectedTab = await getcurrenturl();
          console.log("Selected Tab:", selectedTab);

          // 2) Inject scripts in the order they are used
          await injectScriptsInOrder(selectedTab.id, [
            //"utils/api.js",
            "content.js",
            "executor.js",
          ]);

          // 3) Retrieve visible elements and prepare the environment
          const [currentPageData] = await Promise.all([
            sendMessageToTab(selectedTab.id, { type: "getVisibleElements" }),
          ]);

          pageinformation = currentPageData;

          console.log("Data from content.js:", pageinformation);

          
          // ----- Repeat up to x times -----
          let maxit = 3
          for (let i = 0; i < maxit; i++) {
            console.log(`=== Iteration ${i + 1} ===`);

            await injectScriptsInOrder(selectedTab.id, [
              //"utils/api.js",
              "content.js",
              "executor.js",
            ]);

            

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
                  //LLMinstruction = "0-\"https://www.amazon.com/\"<DONE>\n\nI did this as a test of inputs"
                  LLMinstruction = "22-\"Initial test query\" \n\nI entered an initial test query into the textarea to simulate user interaction for testing purposes."
                  //LLMinstruction = "22-\"input testing\"<DONE>\n\nI did this as a test of inputs"
                  //LLMinstruction ="6\n\nI clicked on the element with index 6 because it is an anchor tag with the text \"flappy-bird-plus-ai\" and its href attribute leads to the Flappy Bird page on the website.";
              } else {
                LLMinstruction = await queryNova(execResponse.LLMprompt);
              }
              console.log("Extracted instruction from Nova:", LLMinstruction);
              

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
                  addBotMessageToHistory(`Failed to proceed - ${cleanllmresp.justification}`);
                return;
              } else if (action === 0) {
                // For action=0, navigate to a URL (then wait)
                addBotMessageToHistory(cleanllmresp.justification)
                selectedTab = await goToURL(cleanllmresp.inputtext, selectedTab.id);
              } else if (action === -5) {
                // For action=-5, consider the task complete
                addBotMessageToHistory(`Task Complete! ${cleanllmresp.justification}`);
                cleanup()
                return;
              } else {
                // For other positive indices, perform a click
                try {
                  addBotMessageToHistory(cleanllmresp.justification)
                  const clickResponse = await sendMessageToTab(selectedTab.id, {
                    type: "executeClick",
                    element: cleanllmresp.targetElement,
                    inputtext: cleanllmresp.inputtext,
                  });
                  console.log("Click response received:", clickResponse);

                  
                } catch (error) {
                  console.error("Error executing:", error.message);
                  addBotMessageToHistory(`Error executing: ${error.message}`);
                }
              }
            } catch (error) {

              console.error("Error querying nova:", error.message);
                addBotMessageToHistory(`Failed to process LLM response - ${error.message}`);
                cleanup()
              return; // Stop execution here if there's an error
            }

            await pause(600);
            if (finishing){
              i = 1000
              addBotMessageToHistory("Task accomplished!");
              cleanup()
            }

            // After finishing one iteration, proceed to the next
            if (i==maxit-1){
              addBotMessageToHistory(`Maximum ${maxit} iterations reached!`);
              cleanup()

            }
          }

        } catch (error) {
          console.error("Error processing the task:", error.message);
          addBotMessageToHistory(`Error occurred: ${error.message}`);
          cleanup()
        }
      }
    })();

    // Return true to keep the message channel open for async operations
    return true;
  }
});

// --- Helper functions ---

async function injectScriptsInOrder(tabId, scripts) {
  for (const script of scripts) {
      try {
          await injectScript(tabId, script);
      } catch (error) {
          console.error(`Failed to inject script: ${script}`, error);
          throw new Error(`Error injecting script: ${script}`);
      }
  }
  console.log("All scripts injected successfully.");
}

function cleanup(){
  instructionsHistory = [];

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

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    console.log(`Sending message to tab ${tabId}:`, message);
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`Error communicating with tab ${tabId}:`, chrome.runtime.lastError.message);
        reject(new Error(`Error communicating with tab: ${chrome.runtime.lastError.message}`));
      } else if (!response) {
        console.error(`No response received from content script in tab ${tabId}`);
        reject(new Error("No response received from content script."));
      } else {
        console.log(`Response from tab ${tabId}:`, response);
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
  llmmessage = llmmessage.replace(/\\n/g, "\n").replace(/\\"/g, '"');

  // Separate everything before and after the first newline
  const [beforeNewline, ...afterNewlineParts] = llmmessage.split("\n");
  const afterNewline = llmmessage
  .split("\n")
  .filter(line => line.trim() !== "") // Remove empty lines
  .slice(1) // Skip the first part before the first newline
  .join(" ") // Join remaining lines into one sentence
  .trim(); 

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

  if (llmmessage.slice(0,2) === "-1"){
    index = -1
  }

  if (llmmessage.slice(0,2) === "-5"){
    index = -5
  }



  instructionsHistory.push(afterNewline); 

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
        await pause(800);

        // Get the updated tab information
        const temptabinfo = await getcurrenturl();

        // Inject scripts after navigation
        console.log("Injecting scripts...");
        await injectScriptsInOrder(temptabinfo.id, [
            //"utils/api.js",
            "content.js",
            "executor.js",
        ]);

        await pause(300);

        console.log("Scripts injected successfully.");

        // Reopen the sidebar
        console.log("Reopening sidebar...");
        await chrome.scripting.executeScript({
            target: { tabId: temptabinfo.id },
            files: ["toggleSidebar.js"],
        });
        console.log("Sidebar reopened successfully.");

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

function getStoredLimits() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || { count: 0, date: new Date().toDateString() });
    });
  });
}

function updateStoredLimits(newData) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: newData }, resolve);
  });
}


async function canMakeLLMQuery() {
  const limits = await getStoredLimits();
  const today = new Date().toDateString();

  console.log("current total requests: ", limits)
  if (limits.date !== today) {
    // Reset the count for a new day
    await updateStoredLimits({ count: 1, date: today });
    return true; // Allow the query
  }

  if (limits.count >= MAX_REQUESTS_PER_DAY) {
    return false; // Exceeded the daily limit
  }

  // Increment the count
  await updateStoredLimits({ count: limits.count + 1, date: today });
  return true; // Allow the query
}



function addBotMessageToHistory(botMessage) {
    chatHistoryData.history.push({ sender: "bot", text: botMessage });
    console.log("Updated chat history with bot message:", chatHistoryData);

    // Notify all tabs about the updated chat history
    chrome.tabs.query({}, (tabs) => {
      tabs
      .filter(t => t.url && /^https?:\/\//i.test(t.url))
      .forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          type: "updateChatHistory",
          data: chatHistoryData,
        });
      });
  
    });
}
