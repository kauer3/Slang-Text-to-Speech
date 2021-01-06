window.onload = function () {
    chrome.storage.local.set({ timeout: false, speaking: false });
    createContextMenu()
}

//# Initialize Speech API
const synth = window.speechSynthesis;

// Prevent alerts from being sent consecutive times
let alertSent = false;
chrome.tabs.onUpdated.addListener(() => {
    alertSent = false;
})
chrome.tabs.onActivated.addListener(() => {
    alertSent = false;
})

function sendAlert() {
    if (!alertSent) {
        chrome.notifications.create({ type: "basic", title: "Warning!", message: 'This website does not allow Slang to get the selected text trought the pop-up. Instead, right click the selected text and press "Speak".', iconUrl: "icon.png" });
        alertSent = true;
    }
    return;
}

//# Functions to prevent API bug
//* Due to an old bug, Speech API stops working after 15 sec paused or playing nonstop
function preventBug(action) {
    chrome.storage.local.get(["timeout"], function (result) {
        if (action === "play") {
            // If user hit play and keepPlaying is not active, call keepPlaying
            if (result.timeout !== "play") {
                chrome.storage.local.set({ timeout: "play", speaking: true });
                keepPlaying();
            }
            return;
        } else {
            // If user hit pause and keepPaused is not active, call keepPaused
            if (result.timeout !== "pause") {
                chrome.storage.local.set({ timeout: "pause", speaking: "paused" });
                keepPaused();
            }
            return;
        }
    });
}

// While playing, call API resume method every 14 sec to prevent bug
function keepPlaying() {
    chrome.storage.local.get(["speaking"], function (result) {
            if (result.speaking !== true || !synth.speaking) {
                chrome.storage.local.get(["timeout"], function (response) {
                    if (response.timeout === "play") {
                        chrome.storage.local.set({ timeout: false });
                    }
                });
                if (typeof timeoutPlay === 'undefined') {
                    return;
                } else {
                    clearTimeout(timeoutPlay);
                    return;
                }
            }
            synth.resume();
            timeoutPlay = setTimeout(keepPlaying, 14000);
    });
}

// While on paused state, call API pause method every 14 sec to prevent bug
function keepPaused() {
    chrome.storage.local.get(["speaking"], function (result) {
        if (result.speaking !== "paused" || !synth.speaking) {
            chrome.storage.local.get(["timeout"], function (response) {
                if (response.timeout === "pause") {
                    chrome.storage.local.set({ timeout: false });
                }
            });
            if (typeof timeoutPlay === 'undefined') {
                return;
            } else {
                clearTimeout(timeoutPause);
                return;
            }
        }
        synth.pause();
        timeoutPause = setTimeout(keepPaused, 14000);
    });
}

function speak(text, updatedText, nextSentence) {
    
    if (text) {

        // Declare object to hold settings and stores the text
        const speechSettings = new SpeechSynthesisUtterance(text);

        // Run on error
        speechSettings.onerror = function(event) {
            console.log(`An error has occurred with the speech synthesis: ${event.error}.`);
        }

        //... When finish speaking a sentence...
        speechSettings.onend = e => {
            //...if still speaking...
            if (synth.speaking) {
                //...message popup with the next sentence to be shown...
                chrome.runtime.sendMessage({ speaking: true, sentence: updatedText, highlight: nextSentence });
                //...and save updated text in case popup in loaded during speech
                chrome.storage.local.set({ lastText: updatedText, highlight: nextSentence });
            //...if spoke all sentences...
            } else {
                //...update speaking status in storage and message popup
                chrome.runtime.sendMessage({ speaking: false, sentence: updatedText });
                chrome.storage.local.set({ speaking: false, lastText: updatedText, highlight: nextSentence });
            }
        }

        // Get rate, pitch and volume from storage and set it to the API
        chrome.storage.sync.get(["rate"], function (result) {
            if (typeof result.rate !== 'undefined' && result.rate  !== undefined) {
                speechSettings.rate = result.rate/10;
            }
        });
        chrome.storage.sync.get(["pitch"], function (result) {
            if (typeof result.pitch !== 'undefined' && result.pitch !== undefined) {
                speechSettings.pitch = result.pitch/10;
            }
        });
        chrome.storage.sync.get(["volume"], function (result) {
            if (typeof result.volume !== 'undefined' && result.volume !== undefined) {
                speechSettings.volume = result.volume/10;
            }
        });
        
        //... Get selected voice from storage...
        chrome.storage.sync.get(["voice"], function (result) {
            // Voices array
            const voices = synth.getVoices();
            if (typeof result.voice === 'undefined' || result.voice === undefined) {
                speechSettings.voice = voices[3];
            } else {
                // Loop through voices
                for (let i = 0; i < voices.length; i++) {
                    if (voices[i].name === result.voice) {
                        //...and set it to the API
                        speechSettings.voice = voices[i];
                        break;
                    }
                }
            }
            //! Speak method needs to be called inside the (asynchronous) callback functions, otherwise it would run before them!
            synth.speak(speechSettings);
        });
    }
};

function format(givenText) {
    synth.cancel();
    chrome.storage.local.set({ popupEdited: false });
    let text = [];

    //* Different unicode invisible characters are used to keep track of points that later should be found by functions and methods
    // If text already have one of those invisible characters, delete them
    if (givenText.match(/‎|​|‏|‌| /g)) {
        givenText = givenText.replace(/‎|​|‏|‌/g, "").replaceAll(" ", " ");
    }
    // Replaces new lines with space + invisible character
    givenText = givenText.split(/\n|\r\n|\r/).join("‎").replace(/\s+/g, " ");

    // Replaces multiple spaces by single space, add invisible character after every sentence and replace less/greater-than by similar unicode character to prevent rendering html tags inside the popup
    givenText = givenText.replace(/\.\s+/g,".​ ").replace(/\?\s+/g,"?​ ").replace(/!\s+/g,"!​ ").replace(/:\s+/g,":​ ").replace(/</g,"＜").replace(/>/g,"＞");
    let sentences = [];

    // Match method splits the text into sentences but mantain the separator character
    sentences = givenText.match(/[^;‎​]+[;‎​]*/g);
    
    if (sentences !== null && sentences !== undefined) {
        // Checks each sentence
        for (let i = 0; i < sentences.length; i++) {
            if (sentences[i] !== null && sentences[i] !== undefined && (/[^\s‎]+/g).test(sentences[i])) {
                text.push(sentences[i].replaceAll("​", ""));
            }
        }
    }
    let updatedText = text[0];
    // Save updated text in case popup in loaded during speech
    chrome.storage.local.set({ lastText: "", highlight: updatedText });
    // Send message to popup with udated message in case popup is open
    chrome.runtime.sendMessage({ speaking: true, sentence: "", highlight: updatedText });
    for (let i = 0; i < text.length; i++) {
        if (i !== 0) {
            updatedText = updatedText.concat(text[i]);
        }
        // If loop is not in the last sentence, keep updating text
        if (i + 1 < text.length) {
            speak(text[i], updatedText, text[i + 1]);
        } else {
            speak(text[i], updatedText, "");
        }
    };
    return;
}

//# Receive message from popup
chrome.runtime.onMessage.addListener(
    (request) => {
        chrome.storage.local.get(["speaking"], function (status) {
            if (request.message === "play") {
                synth.resume();
                if (!synth.speaking) {
                    // If provided text is invalid, use last text
                    if (!(/[^\s‎]+/g).test(request.text)) {
                        chrome.storage.local.get(["text"], function (data) {
                            format(data.text);
                        });
                    } else {
                        format(request.text);
                        chrome.storage.local.set({ text: request.text });
                    }
                }
                // If script injection not allowed, alert user to use context menu
                if (request.alert) {
                    sendAlert()
                }
                if (status.speaking !== true) {
                    chrome.storage.local.set({ speaking: true });
                    preventBug("play");
                }
                return;
            }
            if (request.message === "pause" && synth.speaking) {
                if (status.speaking !== "paused" && synth.speaking) {
                    synth.pause();
                    preventBug("pause");
                }
                return;
            }
            if (request.message === "stop" && synth.speaking) {
                synth.cancel();
                chrome.storage.local.get(["timeout"], function (data) {
                    if (data.timeout !== false) {
                        chrome.storage.local.set({ timeout: false });
                    }
                    if (status.speaking !== false) {
                        chrome.storage.local.set({ speaking: false });
                    }
                });
                return;
            }
        });
    }
);