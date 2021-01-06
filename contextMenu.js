function createContextMenu() {
    chrome.contextMenus.create({
        "title": 'Speak "%s"',
        "contexts": ["selection"],
        "id": "readPage"
    }); 
};

chrome.contextMenus.onClicked.addListener(function (context) {
    chrome.tabs.executeScript({ code: "window.getSelection().toString();" }, function (selection) {
        if (typeof selection === 'undefined' || selection === undefined || selection === null) {
            if ((/[^\s‎]+/g).test(context.selectionText)) {
                play(context.selectionText);
            } 
            sendAlert()
        } else if ((/[^\s‎​]+/g).test(selection.toString())) {
            play(selection.toString());
        } else if ((/[^\s‎]+/g).test(context.selectionText)) {
            play(context.selectionText);
        }
    });
});

function play(text) {
    if ((/[^\s‎]+/g).test(text)) {
        format(text);
        chrome.storage.local.set({ "text": text, timeout: false });
    } else {
        chrome.storage.local.get(["text"], function (result) {
            format(result.text);
        });
    }
    preventBug("play");
}
