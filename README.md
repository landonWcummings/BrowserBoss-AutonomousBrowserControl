Browser boss - a chrome extension

This extension leverages the capabilities of Large language models to autonomously control and operate a browser. 
visit [my website](https://landoncummings.com) to learn more about this project

Technical overview:

1 - When user chooses to execute a task, the first thing that is done is the current url along with all the page elements of a page are recorded in this format:

{
    "index": 11,
    "tag": "A",
    "text": "snakePlusAi-V1-NEAT",
    "href": "https://www.landoncummings.com/snakePlusAi-V1-NEAT",
    "isClickable": true,
    "onScreenArea": 6
  },
  {
    "index": 12,
    "tag": "A",
    "text": "WhartonInvestmentQuant",
    "href": "https://www.landoncummings.com/WhartonInvestmentQuant",
    "isClickable": true,
    "onScreenArea": 6
  },
  {
    "index": 13,
    "tag": "DIV",
    "text": "Other Projects",
    "onScreenArea": 6
  },
  {
    "index": 14,
    "tag": "BUTTON",
    "text": "Other Projects",
    "isClickable": true,
    "onScreenArea": 6
  },
  {
    "index": 15,
    "tag": "DIV",
    "text": "Welcome to landoncummings.comSelect a repository from the navigation bar to view its details.⬇️ or ask Grok something ⬇️Ask xAI's Grok
    "onScreenArea": 748
  },

(this simple page had 22 notable elements but truncated for example purposes)

All useful information about all elements are collected. Many elements are filtered out based on the information about them.


2 - Next all the collected information is processed and a very intentional prompt is produced. This prompt instructs how the LLM should respond and enables it to effectively click, input text, and navigate to a new URLs it provides. The variable data that the prompt includes is the following:
current tab
all current page elements
user instruction
and all past actions from the LLM concerning this request

On very busy websites (such as amazon and youtube) the prompt can reach over 200000 characters from all the elements included. At this point it is truncated as all the important information is usually in the first few hundred. 

Fun fact: developing this I passed over 2 million input tokens into LLMs. That is roughly 8 million characters; that could have included all of Shakespear's works more than twice.


3 - The full prompt is passed to the LLM (in this case the LLM is Amazon's Nova Lite) and a response is collected. The LLM is also asked to justify why it chose what it did


4 - Next the prompt is parsed to learn what element to interact with, if text should be inputted, if the program should navigate to a new url, or if the program is finished. Here we also collect the justification.


5 - The desired action is carried out and the user is shown the justification.


6 - steps 1-5 are repeated until the task is complete or the program reaches the max number of iterations.