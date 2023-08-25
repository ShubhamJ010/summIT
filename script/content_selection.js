chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'summarize-selection') {
    const content = window.getSelection().toString()

    sendResponse({ content })
  }
})
