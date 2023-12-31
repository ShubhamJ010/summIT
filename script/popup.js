document.addEventListener("DOMContentLoaded", async function () {
  loadMain();

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: "summarize-selection",
  });
  const content = response.content;
  // console.log("content:" + content);

  if (!content || content.trim().length === 0) {
    document.getElementById("main-page").classList.remove("hidden");
    loadMainPage();
  } else {
    document.getElementById("side-page").innerHTML = "processing...";
    document.getElementById("side-page").classList.remove("hidden");
    document.getElementById("summarize-this-page-button").disabled = "true";
    await requestGPTAPI(content.trim(), "side-page");
    const sp = document.getElementById("side-page").textContent;
    copyToClipboard(sp);
    document.getElementById("copy-button").style.display = "block";
    document.getElementById("copy-button").innerHTML = "Copied!!";
  }
});

function loadMain() {
  var editIcon = document.getElementById("editIcon");
  var saveIcon = document.getElementById("saveIcon");
  editIcon.addEventListener("click", function () {
    editIcon.parentElement.classList.add("hidden");
    saveIcon.parentElement.classList.remove("hidden");
  });
  saveIcon.addEventListener("click", function () {
    storeApiKey();
    saveIcon.parentElement.classList.add("hidden");
    editIcon.parentElement.classList.remove("hidden");
  });

  // get user's api key from storage and render it to the apiKeyStored span
  chrome.storage.sync.get(["apiKey"], function (result) {
    const apiKey = result.apiKey;
    if (!apiKey) {
      editIcon.parentElement.classList.add("hidden");
      saveIcon.parentElement.classList.remove("hidden");
    } else {
      document.getElementById("apiKeyStored").textContent =
        retainThreeCharacters(apiKey);
    }
  });
}

function loadMainPage() {
  const summarizeThisPageButton = document.getElementById(
    "summarize-this-page-button"
  );

  const copyButton = document.getElementById("copy-button");
  const summaryInput = document.getElementById("output");
  // summaryInput.addEventListener("input", function () {
  //   const hasContent = summaryInput.textContent.trim().length > 0;
  //   if (hasContent) {
  //     copyButton.style.display = "block";
  //   } else {
  //     copyButton.style.display = "none";
  //   }
  // });
  copyButton.addEventListener("click", function () {
    const summaryText = document.getElementById("summary").textContent;

    copyToClipboard(summaryText);
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy to Clipboard";
    }, 2000);
  });

  summarizeThisPageButton.addEventListener("click", function () {
    summarizeThisPageButton.disabled = "true";
    document.getElementById("summary").innerHTML = "processing...";
    summaryInput.style.display = "block";
    sendMessage()
      .then((summary) => {
        summarizeThisPageButton.disabled = false;
        if (typeof summary === "string") {
          document.getElementById("summary").innerHTML = summary;
        }
        // console.log(summary);
      })
      .then(() => (copyButton.style.display = "block"));
  });
}

const sendMessage = async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    // console.log("tabid" + tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "summarize",
    });
    const content = response.content;
    // console.log("🎊🎊content:" + content);

    let summary = "";
    let flag = true;

    // if words is empty, return
    if (!content.length || !content.trim().length) {
      flag = false;
      summary = "Web page content is empty";
    }

    if (flag) summary = await requestGPTAPI(content.trim(), "summary");

    return summary;
  } catch (error) {
    return error.message + " Refresh";
  }
};

// a function to request GPTAPI and get therepsonse
async function requestGPTAPI(content, ele) {
  //fetch api key
  const apiKey = await readSyncStorage("apiKey");

  // is for apiKey is empty
  if (!apiKey || !apiKey.trim().length) {
    document.getElementById(
      ele
    ).innerHTML = `Please enter your API key , You can get your API key from https://openai.com/`;
    return false;
  }

  if (!content || !content.trim().length) {
    document.getElementById(ele).innerHTML = "text is empty";
    return false;
  }

  // remove all the new line characters
  content = content
    .replace(/(\r\n|\n|\r)/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const system_content =
    "You are a helpful assistant that can analyze text input and generate a concise and coherent summary that captures the main points of the input.";
  const promptTemplate = `Please summarize the following text.Divide it into 1. Provide Summary
2. Provide Major Points mentioned on the page You may include a brief introduction and conclusion if necessary. Your summary should be no more than 5-15 sentences long and should be in a list format, with each point numbered or bulleted:`;
  const prompt = `${promptTemplate}\n${content}`;
  const messages = [
    { role: "system", content: system_content },
    { role: "user", content: prompt },
  ];
  // console.log("🎊🎊messages: " + messages);
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-3.5-turbo-16k",
    messages: messages,
    stream: true,
  };
  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });

    // console.log("response: " + response);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    if (response.status !== 200) {
      const { _, value } = await reader.read();
      const error = JSON.parse(decoder.decode(value));
      throw new Error(error.error.message);
    }

    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      // split the response by data: and get the last part
      // console.log("VAlUE: " + value);
      // console.log("DVALUE: " + decoder.decode(value));
      const dataArry = decoder.decode(value).split("data:");
      // iterate dataArry and get the last part
      // console.log("DATAARRAY: " + dataArry);
      for (data of dataArry) {
        if (
          typeof data === "string" &&
          data.trim().length > 0 &&
          data.trim().startsWith("{")
        ) {
          // console.log("DATA: " + data);
          const dataObj = JSON.parse(data);
          const dataConetent = dataObj.choices[0].delta.content;
          if (dataConetent) content += dataConetent;
        }
      }
      // console.log("CONTENT: " + content);
      const formattedContent = content.split("\n").map(wrapInXML).join("");
      // console.log("FORMATCONTENT: " + formattedContent);
      document.getElementById(
        ele
      ).innerHTML = `<ul class='response-content'>${formattedContent}</ul>`;
    }

    return true;
  } catch (error) {
    document.getElementById(
      ele
    ).innerHTML = `OpenAI API Error: ${error.message}`;
    return false;
  }
}

//functions
function wrapInXML(para) {
  // if the para starts with a number and a dot, wrap it in a list item
  if (para.match(/^\d+\./)) {
    return `<li>${para}</li>`;
  } else {
    return `<p>${para}</p>`;
  }
}

// a function to retains api key three characters before and after
function retainThreeCharacters(apiKey) {
  const length = apiKey.length;
  const firstThree = apiKey.slice(0, 3);
  const lastThree = apiKey.slice(length - 3, length);
  return `${firstThree}...${lastThree}`;
}

// a function to store user's api key
function storeApiKey() {
  const apiKey = document.getElementById("apiKey").value;

  if (apiKey.length) {
    chrome.storage.sync.set({ apiKey }, function () {
      document.getElementById(
        "apiKeyStored"
      ).innerHTML = `<span>${retainThreeCharacters(apiKey)}</span>`;
    });
  }
}

const readSyncStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync
      .get([key])
      .then((result) => {
        resolve(result[key]);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
//add to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
