//# Initialize Web Speech API
const synth = window.speechSynthesis;

//# Access DOM Elements
const voiceSelect = document.querySelector("#voice-select");
const rate = document.querySelector("#rate");
const rateValue = document.querySelector("#rate-value");
const pitch = document.querySelector("#pitch");
const pitchValue = document.querySelector("#pitch-value");
const volume = document.querySelector("#volume");
const volumeValue = document.querySelector("#volume-value");
const textarea = document.querySelector("#txt");

// Identify popup state
let selectionPriority = true;

// Initialize voices array
let voices = [];

function getVoices() {
    voices = synth.getVoices();

    // Loop through voices and create option for each one
    voices.forEach(voice => {
        // Create option element
        const option = document.createElement("option");

        // Fill option with voice and language
        option.textContent = voice.name + "(" + voice.lang + ")";
        
        // Set needed option attributes
        option.setAttribute("data-lang", voice.lang);
        option.setAttribute("data-name", voice.name);
        voiceSelect.appendChild(option);
    })
}

//# Event listeners for settings and values changes

volume.addEventListener("change", e => updateSettings("volume"));

rate.addEventListener("change", e => updateSettings("rate"));

pitch.addEventListener("change", e => updateSettings("pitch"));

voiceSelect.addEventListener("change", e => updateSettings("voice"));

textarea.addEventListener("input", e => updateSettings("text"));

textarea.addEventListener("paste", e => updateSettings("paste"));

textarea.addEventListener("blur", e => updateSettings("blur"));

// Update voice, rate, pitch and text content when changed by the user
function updateSettings(key) {
    switch (key) {
        case "voice":
            const selectedVoice = voiceSelect.selectedOptions[0].getAttribute("data-name")
            console.log(selectedVoice);
            chrome.storage.sync.set({ "voice": selectedVoice }, function () {
                console.log(`Voice is set to ${selectedVoice}`);
            });
            break;
        case "rate":
            rateValue.textContent = rate.value;
            chrome.storage.sync.set({ "rate": rate.value }, function () {
                console.log(`Rate is set to ${rate.value}`);
            });
            break;
        case "pitch":
            pitchValue.textContent = pitch.value;
            chrome.storage.sync.set({ "pitch": pitch.value }, function () {
                console.log(`Pitch is set to ${pitch.value}`);
            });
            break;
        case "volume":
            volumeValue.textContent = volume.value;
            chrome.storage.sync.set({ "volume": volume.value }, function () {
                console.log(`volume is set to ${volume.value}`);
            });
            break;
        case "text":
            chrome.storage.local.get(["speaking", "popupEdited"], function (data) {
                resizeTextarea();
                if (!data.popupEdited) {
                    if (data.speaking !== false) {
                        preventHTML("‏");
                    }
                    chrome.storage.local.set({ popupEdited: true });
                }
            });
            break;
        case "paste":
            // Waits 4 milliseconds because the paste event is triggered before the text is pasted
            setTimeout(function () {
                preventHTML("‌");
                resizeTextarea();
            });
            break;
        case "blur":
            if ((/[^\s‎​]+/g).test(textarea.innerText)) {
                chrome.storage.local.set({ popupText: textarea.innerText });
            }
            break;
    }
}

//# Event listeners for button clicks

// Play button
document.querySelector("#playbtn").onclick = () => {
    chrome.storage.local.get(["speaking"], function (status) {
        // *Inject script and get selection
        chrome.tabs.executeScript({ code: "window.getSelection().toString();" }, function (selection) {
            // If cannot get selection
            if (typeof selection === 'undefined' || selection === undefined || selection === null) {
                chrome.runtime.sendMessage({ message: "play", text: textarea.innerText, alert: true });
            // If popup text wasn´t edited after last popup load and selected text is valid
            } else if (selectionPriority && (/[^\s‎​]+/g).test(selection.toString())) {
                chrome.runtime.sendMessage({ message: "play", text: selection.toString() });
                if (status.speaking === false) {
                    selectionPriority = false;
                }
            // If popup text is valid
            } else if ((/[^\s‎​]+/g).test(textarea.innerText)) {
                chrome.runtime.sendMessage({ message: "play", text: textarea.innerText });
            } else {
                chrome.runtime.sendMessage({ message: "play", text: selection.toString() });
            }
        });
    });
};

// Pause button
document.querySelector("#pausebtn").onclick = () => {
    chrome.runtime.sendMessage({ message: "pause" });
};

// Stop button
document.querySelector("#stopbtn").onclick = () => {
    // Message background
    chrome.runtime.sendMessage({ message: "stop" });
    selectText();
};

//# Event listener for background messages

chrome.runtime.onMessage.addListener(
    (request) => {
        chrome.storage.local.get(["popupEdited"], function (popup) {
            console.log(request);
            console.log(request.sentence);
            if (!popup.popupEdited) {
                let spoken = request.sentence.replace(/‎+/g, "<br>").replaceAll(" ", " ");
                // If speech is not complete, update text
                if (request.speaking) {
                    let char = "‍";
                    // Prints spoken text and highlight sentence being spoken
                    textarea.innerHTML = (`${spoken}<span style="color:yellow;">${request.highlight.trimEnd()}</span>${char}`);
                    textarea.scrollTop = 99999;
                    // If text is focused, set cursor to the end of the text
                    if (document.activeElement === textarea) {
                        setCaretPosition(char);
                    }
                // If speech is complete, remove highlight and select all text
                } else if (request.speaking === false) {
                    textarea.innerHTML = spoken;
                    textarea.scrollTop = 4;
                    selectText();
                }
                resizeTextarea();
            }
        });
    }
);

//# Functions

function resizeTextarea() {
    textarea.style.height = "30px";
    textarea.style.height = (textarea.scrollHeight) + "px";
    // If text is bigger than max height, show scrollbar and scroll to the end of the text
    if (textarea.scrollHeight > 435) {
        textarea.style.overflow = "auto";
    } else if (textarea.style.overflow !== "hidden") {
        textarea.style.overflow = "hidden";
    }
    return;
}

function selectText() {
    let selection = window.getSelection();
    let range = document.createRange();
    range.selectNodeContents(textarea);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
}

// Prevent HTML from being rendered in content editable element
function preventHTML(mark) {
    markCursorPosition(mark);
    textarea.innerText = textarea.innerText;
    setCaretPosition(mark);
}

// Mark actual cursor position with invisible character so it can be found later
function markCursorPosition(mark) {
    if (textarea.innerText.match(mark)) {
        textarea.innerText = textarea.innerText.replace(mark, "");
    }
    let selection = window.getSelection();
    let range = selection.getRangeAt(0);
    range.deleteContents();
    let node = document.createTextNode(mark);
    range.insertNode(node);
    for (let position = 0; position < textarea.length; position++) {
        selection.modify("move", "right", "character");
    };
    return;
}

function setCaretPosition(mark) {
    // Loop through all child nodes
    for (var node of textarea.childNodes) {
        // If is a text node
        if (node.nodeType == 3) {
            // If is the node where the cursor was
            if (node.textContent.match(mark)) {
                let pos = node.textContent.search(mark);
                let range = document.createRange();
                let sel = window.getSelection();
                range.setStart(node, pos);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
        }
    }
    return;
}

//# Update text and chosen settings when the popup is opened
window.onload = function () {
    // Call function to populate select list of voices
    getVoices();
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = getVoices;
    }

    // Update volume value
    chrome.storage.sync.get(["volume"], function (result) {
        if (result.volume) {
            // Range
            volume.value = result.volume;
            // Range badge
            volumeValue.textContent = result.volume;
        }
    });

    // Update rate value
    chrome.storage.sync.get(["rate"], function (result) {
        if (result.rate) {
            // Range
            rate.value = result.rate;
            // Range badge
            rateValue.textContent = result.rate;
        }
    });

    // Update pitch
    chrome.storage.sync.get(["pitch"], function (result) {
        if (result.pitch) {
            // Range
            pitch.value = result.pitch;
            // Range badge
            pitchValue.textContent = result.pitch;
        }
    });

    // Update voice
    chrome.storage.sync.get(["voice"], function (result) {
        const len = voiceSelect.options.length;
        if (result.voice) {
            for (let i = 0; i < len; i++) {
                if (voiceSelect.options[i].getAttribute("data-name") === result.voice) {
                    voiceSelect.options[i].setAttribute("selected", "selected");
                    break;
                }
            }
        } else {
            voiceSelect.options[3].setAttribute("selected", "selected");
        }
    });

    // Update textarea content
    chrome.storage.local.get(["popupEdited", "popupText", "lastText", "highlight", "speaking"], function (data) {
        // Checks which text to print and formats
        if (data.popupEdited && (/[^\s‎​]+/g).test(data.popupText)) {
            textarea.innerText = data.popupText.replace(/‎+/g, "<br>").replace(/‏+|‌+/g, "").replaceAll(" ", " ");
        } else if (data.lastText || data.highlight) {
            textarea.innerHTML = (`${data.lastText}<span style="color:yellow;">${data.highlight}</span>`).replace(/‎+/g, "<br>").replace(/‏+|‌+/g, "").replaceAll(" ", " ");
        }
        resizeTextarea();
        if (data.speaking === false) {
            //...call stop method to prevent bugs...
            chrome.runtime.sendMessage({ message: "stop" });
            //...and select all text
            selectText();
            textarea.scrollTop = 4;
        } else {
            textarea.scrollTop = 99999;
        }
    });
};