chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'summarize') {
    chrome.tabs.executeScript(
      sender.tab.id,
      { file: 'content.js' },
      function () {
        chrome.tabs.sendMessage(sender.tab.id, message, sendResponse)
      }
    )
    return true
  }

  if (message.action === 'summarize-selection') {
    chrome.tabs.executeScript(
      sender.tab.id,
      { file: 'content_selection.js' },
      function () {
        chrome.tabs.sendMessage(sender.tab.id, message, sendResponse)
      }
    )
    return true
  }
})
