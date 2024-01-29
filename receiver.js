import OpenAI from "openai";

let mediaRecorder;
let recordedChunks = [];
let audioContext;
let sourceNode;
let stream;
let fullTranscript = [];
let isDoingOCR = false;

document.addEventListener("DOMContentLoaded", function () {
  updateTranscriptOnPage();

  // Retrieve and set the system message
  let storedSystemMessage =
    localStorage.getItem("systemMessage") ||
    "This is a transcript of a youtube video, guess the content of the video.";

  document.getElementById("systemMessage").value = storedSystemMessage;

  // Retrieve and set the API key
  let storedApiKey = localStorage.getItem("userApiKey") || "";
  document.getElementById("apiKey").value = storedApiKey;

  if (storedApiKey) {
    document.body.scrollTop = document.body.scrollHeight;
  }

  // Retrieve full transcript from local storage
  let storedFullTranscript = localStorage.getItem("fullTranscript");
  if (storedFullTranscript) {
    fullTranscript = JSON.parse(storedFullTranscript);
    updateTranscriptOnPage();
  }

  // Add event listener for clearing the transcript
  document
    .getElementById("clearTranscript")
    .addEventListener("click", function () {
      fullTranscript = [];
      saveTranscript();
      updateTranscriptOnPage();
    });

  // Add event listener for updating the API key
  document
    .getElementById("updateApiKeyButton")
    .addEventListener("click", function () {
      let apiKey = document.getElementById("apiKey").value;
      localStorage.setItem("userApiKey", apiKey);
    });

  // Add event listener for updating the system message
  document
    .getElementById("updateSystemMessage")
    .addEventListener("click", function () {
      let newSystemMessage = document.getElementById("systemMessage").value;
      localStorage.setItem("systemMessage", newSystemMessage);
    });

  document
    .getElementById("typedMessage")
    .addEventListener("keydown", handleTypedMessage);

  document
    .getElementById("startRecording")
    .addEventListener("click", startRecording);

  document
    .getElementById("stopRecording")
    .addEventListener("click", stopRecording);

  document
    .getElementById("removeTranscriptOverlay")
    .addEventListener("click", removeTranscriptOverlay);

  document
    .getElementById("showTranscriptOverlay")
    .addEventListener("click", updateTranscriptOnPage);

  document
    .getElementById("takeScreenshot")
    .addEventListener("click", setSelectionListener);

  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    if (message.selection) {
      console.log("Selection start:", message.selection.start);
      console.log("Selection end:", message.selection.end);
      document.getElementById("takeScreenshot").disabled = false;
      updateTranscriptOnPage();
      // Here you could process the selected area
      if (!isDoingOCR) {
        isDoingOCR = true;
        captureScreenshot(message.selection, (dataUrl) => {
          // do ocr
          doOCR(dataUrl).then((text) => {
            console.log(text);
            fullTranscript.push({
              role: "user",
              content: text,
            });
            updateTranscriptOnPage();
            sendToChatgptCompletion();
            saveTranscript();
          });
        });
      }


    }
  });
});

const doOCR = async (image) => {
  const { createWorker } = Tesseract;
  const worker = createWorker({
    workerPath: chrome.runtime.getURL("worker.min.js"),
    langPath: chrome.runtime.getURL("traineddata"),
    corePath: chrome.runtime.getURL("tesseract-core.wasm.js"),
    workerBlobURL: false, // This line solves your error
    logger: (m) => console.log(m),
  });
  console.log("doing ocr");
  await worker.load();
  console.log("loading language");
  await worker.loadLanguage("eng");
  console.log("initializing language");
  await worker.initialize("eng");
  console.log("recognizing");
  const {
    data: { text },
  } = await worker.recognize(image);
  console.log("text");
  console.log(text);
  await worker.terminate();
  isDoingOCR = false;
  return text;
};

function captureScreenshot(selection, callback) {
  chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
    let img = new Image();
    img.onload = function () {
      let canvas = document.createElement("canvas");
      let ctx = canvas.getContext("2d");
      let width = Math.abs(selection.end.x - selection.start.x);
      let height = Math.abs(selection.end.y - selection.start.y);
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(
        img,
        selection.start.x,
        selection.start.y,
        width,
        height,
        0,
        0,
        width,
        height
      );
      callback(canvas.toDataURL());
    };
    img.src = dataUrl;
  });
}

function setSelectionListener() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: startSelectionTool,
    });
  });
  document.getElementById("takeScreenshot").disabled = true;
  removeTranscriptOverlay();
}

function startSelectionTool() {
  let selectionStart = null;
  let selectionEnd = null;
  let overlay = null;

  // update mouse cursor to crosshair
  document.body.style.cursor = "crosshair";

  function startSelection(event) {
    selectionStart = { x: event.clientX, y: event.clientY };
    overlay = document.createElement("div");
    overlay.id = "selectionOverlay";
    overlay.style.position = "fixed";
    overlay.style.background = "rgba(0, 0, 0, 0.5)";
    overlay.style.pointerEvents = "none";
    document.body.appendChild(overlay);
    document.addEventListener("mousemove", updateSelection);
    document.addEventListener("mouseup", endSelection);
  }

  function updateSelection(event) {
    selectionEnd = { x: event.clientX, y: event.clientY };
    let overlay = document.getElementById("selectionOverlay");
    document.body.style.cursor = "crosshair";
    if (overlay) {
      overlay.style.left = Math.min(selectionStart.x, selectionEnd.x) + "px";
      overlay.style.top = Math.min(selectionStart.y, selectionEnd.y) + "px";
      overlay.style.width = Math.abs(selectionStart.x - selectionEnd.x) + "px";
      overlay.style.height = Math.abs(selectionStart.y - selectionEnd.y) + "px";
    }
  }

  function endSelection(event) {
    document.removeEventListener("mousemove", updateSelection);
    document.removeEventListener("mouseup", endSelection);
    document.addEventListener("mousedown", startSelection);
    document.body.style.cursor = "default";
    let overlay = document.getElementById("selectionOverlay");
    if (overlay) {
      overlay.remove();
    }

    // Here you could process the selected area
    // For example, send it back to the extension
    chrome.runtime.sendMessage({
      selection: { start: selectionStart, end: selectionEnd },
    });
  }

  document.addEventListener("mousedown", startSelection);
}

function updateTranscriptOnPage() {
  const transcriptHtml = formatTranscriptForDisplay(fullTranscript);

  const showButton = document.getElementById("showTranscriptOverlay");
  const hideButton = document.getElementById("removeTranscriptOverlay");

  showButton.classList.add("hide");
  hideButton.classList.remove("hide");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: injectTranscriptOverlay,
      args: [transcriptHtml],
    });
  });
}

function scriptToRemoveTranscriptOverlay() {
  let overlay = document.getElementById("transcriptOverlay");
  if (overlay) {
    overlay.remove();
  }
}

function removeTranscriptOverlay() {
  const showButton = document.getElementById("showTranscriptOverlay");
  const hideButton = document.getElementById("removeTranscriptOverlay");

  hideButton.classList.add("hide");
  showButton.classList.remove("hide");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: scriptToRemoveTranscriptOverlay,
    });
  });
}

function injectTranscriptOverlay(transcriptHtml) {
  let overlay = document.getElementById("transcriptOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "transcriptOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "50%";
    overlay.style.left = "50%";
    overlay.style.transform = "translate(-50%, -50%)";
    overlay.style.width = "50%";
    overlay.style.maxWidth = "720px";
    overlay.style.height = "50%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)"; // Black background with opacity
    overlay.style.color = "white";
    overlay.style.border = "1px solid black";
    overlay.style.margionTop = "10px";
    overlay.style.boxSizing = "border-box";
    overlay.style.overflowY = "auto";
    overlay.style.zIndex = "1000";
    overlay.style.fontSize = "17px";
    overlay.style.fontWeight = "bold";
    overlay.style.lineHeight = "25.5px";
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = transcriptHtml;
  overlay.scrollTop = overlay.scrollHeight; // Auto-scroll to the bottom
}

function formatTranscriptForDisplay(fullTranscript) {
  return fullTranscript
    .map((transcript) => {
      return `<div 
      style='margin-bottom: 10px; padding: 10px; border: 1px solid black; border-radius: 5px; color: ${
        transcript.role === "user" ? "lightgray" : "white"
      };'
      class='${transcript.role}'>${transcript.content}</div>`;
    })
    .join("");
}

function injectOngoingMessage(message) {
  let transcriptOverlay = document.getElementById("transcriptOverlay");

  let ongoingMessage = document.getElementById("ongoingMessage");
  if (!ongoingMessage) {
    ongoingMessage = document.createElement("div");
    ongoingMessage.id = "ongoingMessage";
    ongoingMessage.style.fontSize = "17px";
    ongoingMessage.style.fontWeight = "bold";
    ongoingMessage.style.lineHeight = "25.5px";
    ongoingMessage.style.color = "white";
    ongoingMessage.style.padding = "10px";
    ongoingMessage.style.marginTop = "10px";
    transcriptOverlay.appendChild(ongoingMessage);
  }
  ongoingMessage.innerHTML = message;
  // scroll transript id element to bottom
  transcriptOverlay.scrollTop = transcriptOverlay.scrollHeight;
}

function startRecording() {
  chrome.tabCapture.capture(
    { audio: true, video: false },
    function (capturedStream) {
      stream = capturedStream; // Assign the captured stream to the global variable

      // Create an AudioContext and a source node from the stream
      audioContext = new AudioContext();
      sourceNode = audioContext.createMediaStreamSource(stream);

      // Connect the source node to the context's destination (system speakers)
      sourceNode.connect(audioContext.destination);

      // Set up MediaRecorder as before
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();

      // Update UI
      document.getElementById("startRecording").disabled = true;
      document.getElementById("startRecording").classList.add("hide");
      document.getElementById("stopRecording").disabled = false;
      document.getElementById("stopRecording").classList.remove("hide");
    }
  );
}

function stopRecording() {
  mediaRecorder.stop();
  sourceNode.disconnect(); // Disconnect from the audio context
  audioContext.close(); // Close the audio context

  if (stream) {
    // Stop each track in the stream to release the captured tab audio
    stream.getTracks().forEach((track) => track.stop());
  }

  // Update UI
  document.getElementById("stopRecording").disabled = true;
  document.getElementById("stopRecording").classList.add("hide");
  document.getElementById("startRecording").disabled = false;
  document.getElementById("startRecording").classList.remove("hide");
}

function handleDataAvailable(event) {
  if (event.data.size > 0) {
    recordedChunks.push(event.data);
  }
}

function handleStop() {
  let blob = new Blob(recordedChunks, {
    type: "audio/webm",
  });
  recordedChunks = [];

  // Convert blob to WAV file and send it for transcription
  convertBlobToWAV(blob).then((wavFile) => {
    sendForTranscription(wavFile);
  });
}

function convertBlobToWAV(blob) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(blob);
    fileReader.onloadend = () => {
      let arrayBuffer = fileReader.result;
      let wavFile = new Blob([arrayBuffer], { type: "audio/wav" });
      resolve(wavFile);
    };
    fileReader.onerror = (e) => {
      reject(e);
    };
  });
}

function saveTranscript() {
  localStorage.setItem("fullTranscript", JSON.stringify(fullTranscript));
}

function sendForTranscription(wavFile, userApiKey) {
  let formData = new FormData();
  formData.append("file", wavFile, "audio.wav");
  formData.append("model", "whisper-1");

  fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${document.getElementById("apiKey").value}`,
    },
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      // Append the new transcript to the fullTranscript array
      fullTranscript.push({
        role: "user",
        content: data.text,
      });
      updateTranscriptOnPage();
      sendToChatgptCompletion();
      saveTranscript();
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function handleTypedMessage(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const typedMessage = document.getElementById("typedMessage").value.trim();
    if (typedMessage) {
      // Process the typed message
      fullTranscript.push({
        role: "user",
        content: typedMessage,
      });
      updateTranscriptOnPage();
      sendToChatgptCompletion();
      saveTranscript();

      // Clear the text area after sending the message
      document.getElementById("typedMessage").value = "";
    }
  }
}

function displayOngoingMessage(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const activeTab = tabs[0];
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: injectOngoingMessage,
      args: [message],
    });
  });
}

async function sendToChatgptCompletion() {
  const openai = new OpenAI({
    apiKey: document.getElementById("apiKey").value,
    dangerouslyAllowBrowser: true,
  });

  // Retrieve the system message from the input field
  const systemMessage = {
    role: "system",
    content: document.getElementById("systemMessage").value,
  };

  // Combine the system message with the full transcript for the API call
  const messagesForApiCall = [systemMessage].concat(fullTranscript);

  const stream = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: messagesForApiCall,
    stream: true,
  });

  // Initialize a variable to store the ongoing response
  let ongoingResponse = "";

  for await (const data of stream) {
    // Append the new text to the ongoing response
    // Display the new message
    if (data.choices[0].delta.content) {
      ongoingResponse += data.choices[0].delta.content;

      displayOngoingMessage(ongoingResponse);
    }
  }

  fullTranscript.push({
    role: "assistant",
    content: ongoingResponse,
  });
  saveTranscript();
  displayOngoingMessage("");
  updateTranscriptOnPage();
}
