import OpenAI from "openai";

let mediaRecorder;
let recordedChunks = [];
let audioContext;
let sourceNode;
let stream;
let fullTranscript = [];
let isRecording = false;

document.addEventListener("DOMContentLoaded", function () {
  // Retrieve and set the system message
  let storedSystemMessage =
    localStorage.getItem("systemMessage") ||
    "This is a transcript of a question from a software developer position interview, answer the question as if you were the interviewee. Make it short and easy to read, no examples, just text in the language of the question and with simple words. Make it sound like a real person, not a robot. As it would be a real conversation.";

  document.getElementById("systemMessage").value = storedSystemMessage;

  // Retrieve and set the API key
  let storedApiKey = localStorage.getItem("userApiKey") || "";
  document.getElementById("apiKey").value = storedApiKey;


  // Retrieve full transcript from local storage
  let storedFullTranscript = localStorage.getItem("fullTranscript");
  if (storedFullTranscript) {
    fullTranscript = JSON.parse(storedFullTranscript);
    displayTranscription();
  }

  // Add event listener for clearing the transcript
  document
    .getElementById("clearTranscript")
    .addEventListener("click", function () {
      fullTranscript = [];
      saveTranscript();
      displayTranscription();
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


  const recordingStatusElement = document.getElementById("recordingStatus");
  recordingStatusElement.textContent = "Not recording";

  document
    .getElementById("startRecording")
    .addEventListener("click", startRecording);

  document
    .getElementById("stopRecording")
    .addEventListener("click", stopRecording);
});

function startRecording() {
  isRecording = true;
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

      const recordingStatusElement = document.getElementById("recordingStatus");
      recordingStatusElement.textContent = "Recording...";
      recordingStatusElement.classList.add("recording");

      // Update UI
      document.getElementById("startRecording").disabled = true;
      document.getElementById("stopRecording").disabled = false;
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

  const recordingStatusElement = document.getElementById("recordingStatus");
  recordingStatusElement.textContent = "Not recording";
  recordingStatusElement.classList.remove("recording");

  // Update UI
  document.getElementById("stopRecording").disabled = true;
  document.getElementById("startRecording").disabled = false;
  isRecording = false;
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

  console.log("Sending for transcription...");
  console.log(formData);

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
      displayTranscription();
      sendToChatgptCompletion();
      saveTranscript();
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function displayTranscription() {
  // Update the transcriptElement to display the full conversation
  const transcriptElement = document.getElementById("transcript");
  transcriptElement.innerHTML = ""; // Clear the existing content

  // Iterate over each message in the fullTranscript array and display it
  fullTranscript.forEach((message) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.textContent =
      (message.role === "user" ? "Input: " : "Output: ") + message.content;
    messageElement.classList.add(message.role);
    transcriptElement.appendChild(messageElement);
  });
  document.body.scrollTop = document.body.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}

function displayOngoingMessage(message) {
  const ongoingMessageElement = document.getElementById("ongoingMessage");
  ongoingMessageElement.textContent = message + "...";
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
    model: "gpt-4-1106-preview",
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

      // scroll transript id element to bottom
      const transcriptElement = document.getElementById("transcript");
      transcriptElement.scrollTop = transcriptElement.scrollHeight;
  
      // Force browser to re-render the ongoing message
      const ongoingMessageElement = document.getElementById("ongoingMessage");
      document.body.scrollTop = document.body.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    
      const forceReflow = ongoingMessageElement.offsetHeight;
    }
  }

  fullTranscript.push({
    role: "assistant",
    content: ongoingResponse,
  });
  saveTranscript();
  displayOngoingMessage("");
  displayTranscription();
}
