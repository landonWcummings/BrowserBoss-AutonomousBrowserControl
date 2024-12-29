// background.js
import { queryXAI } from './utils/api.js';

// Listen for messages from popup.js or elsewhere
chrome.runtime.onMessage.addListener((task, sender, sendResponse) => {
  // We only care about messages of type "LLMQuery"
  if (task.type === "LLMQuery") {
    (async () => {
      let test = true;
      let pageinformation = null;
      let cleanllmresp = null;
      let selectedTab = null;
      let planprompt = null;
      let plan = null;
      let LLMinstruction = null;

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
          sendMessageToTab(selectedTab.id, {
            type: "prepare",
            url: selectedTab.url,
            task: task.prompt,
          }),
        ]);

        pageinformation = currentPageData;
        planprompt = prepareResponse;

        console.log("Data from content.js:", pageinformation);
        console.log("Prepare response:", planprompt);

        try {
            if (test){
                plan = "go go go!"
            }else{
                console.log("planning prompt: ", planprompt.LLMplanprompt)
                const LLMplanresponse = await queryXAI(planprompt.LLMplanprompt);
                plan = LLMplanresponse.choices[0].message.content;
            }
            console.log("LLMplan content:", JSON.stringify(plan));

            
            //plan = "-1_\"this is unfeasible\""
            
            let keepgoing = parseplan(plan)
            if (keepgoing != ""){
                sendResponse({
                    result: keepgoing
                  });
                return
            }

        } catch (error) {
            console.error("Error querying XAI plan:", error);
        }

        // 4) Execute the task on the page
        const execResponse = await sendMessageToTab(selectedTab.id, {
            type: "executeTask",
            pagedata: pageinformation,
            task: task.prompt,
            plan: plan,
        });
  
        console.log("Response from executor.js:", execResponse.LLMprompt);
        // 5) Now query the LLM (or mock it) and parse the response
        try {
          if (test){
            LLMinstruction = "6\n\nI clicked on the element with index 6 because it is an anchor tag with the text \"flappy-bird-plus-ai\" and its href attribute leads to the Flappy Bird page on the website.";
          }else {
            const LLMresponse = await queryXAI(execResponse.LLMprompt);
            LLMinstruction = LLMresponse.choices[0].message.content
          }
          console.log("LLMresponse content:", JSON.stringify(LLMinstruction));

          

          // Parse the LLM response
          cleanllmresp = parseresponse(
            LLMinstruction,
            execResponse.filteredElements
          );
        } catch (error) {
          console.error("Error querying XAI:", error.message);
          sendResponse({
            result: `Failed to process LLM response - ${error.message}`,
          });
          return; // Important: Stop execution here if there's an error
        }

        // 6) Handle the parsed LLM instructions
        const action = Number(cleanllmresp.action);
        if (action === -1) {
          sendResponse({
            result: `Failed to proceed - ${cleanllmresp.justification}`,
          });
          return;
        } else if (action === 0) {
          // For action=0, navigate to a URL
          goToURL(cleanllmresp.inputtext, selectedTab.id);
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
        console.error("Error processing the task:", error.message);
        sendResponse({ result: `Error occurred: ${error.message}`});
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

function parseresponse(llmmessage, filteredElements) {
  // Separate everything before and after the first newline
  const [beforeNewline, ...afterNewlineParts] = llmmessage.split("\n");
  const afterNewline = afterNewlineParts.join(" ").trim(); // Join and remove all newlines

  let inputtext = null;
  let index = null;
  let targetElement = null;

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
  console.log("Target element", targetElement);

  // Construct the parsed response
  return {
    action: index || -1, // Default action if no number found
    inputtext: inputtext || "",
    justification: afterNewline,
    targetElement,
  };
}

const goToURL = (newUrl, id) => {
  try {
    console.log("Attempting to navigate to:", newUrl);

    // Remove surrounding quotes and trim
    const sanitizedUrl = newUrl.replace(/^["']|["']$/g, "").trim();

    // Validate and normalize URL
    const url = new URL(
      sanitizedUrl.startsWith("http") ? sanitizedUrl : `https://${sanitizedUrl}`
    );

    chrome.tabs.update(id, { url: url.href }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error("Error navigating to URL:", chrome.runtime.lastError.message);
      } else {
        console.log("Navigation successful to:", url.href);
      }
    });
  } catch (error) {
    console.error("Invalid URL or navigation error:", error.message);
  }
};

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


function parseplan(plan) {
    if (plan.length > 2){
        let firsttwo = plan.slice(0, 2);
        if (firsttwo === "-1"){
            let justification = plan.slice(3)
            if (justification.slice(0,1) === "\""){
                justification = justification.slice(1,justification.length-1)
            }
            return `Error - ${justification}` ;
            
        }
    }
    return ""

}