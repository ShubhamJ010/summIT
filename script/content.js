chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'summarize') {
    const content = document.body.innerText

    sendResponse({ content })
  }
})
