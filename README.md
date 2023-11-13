# OpenAI Audio Assistant Chrome Extension

## Overview

The OpenAI Audio Assistant Chrome Extension is a cutting-edge tool designed to enhance productivity and assist with a variety of audio-based tasks. This extension is particularly useful for professionals and students who frequently engage in online meetings, interviews, or consume multimedia content.

## Demo 
https://github.com/felri/chrome-extension-transcript/assets/56592364/dccdf537-8565-407b-8113-5878a520faf2


## Local Installation and Setup

To use this extension, you need to clone the repository, install dependencies, and build the extension. Here's a step-by-step guide:

1. **Clone the Repository:**
```bash
git clone https://github.com/felri/chrome-extension-transcript
cd chrome-extension-transcript
```
2.  **Install Dependencies:**
   ```bash
npm install
```
3. **Build the Extension:**
```bash
npm run build
```
4. **Load the Extension in Chrome:**
- Open Chrome and navigate to `chrome://extensions/`
- Enable `Developer mode` by toggling the switch in the top right corner.
- Click on `Load unpacked` and select the `build` folder from your cloned repository.

5. **Start Using the Extension:**
- After loading the extension, you will see the OpenAI Audio Assistant icon in your browser toolbar.
- Click on it to start using the extension as per the earlier instructions.

Make sure to have Node.js and npm installed on your system to run these commands.



## Features

- **Audio Recording:** Capable of recording audio from your current browser tab, whether it's a video or live audio from platforms like Zoom or Google Meet.
- **Transcription via Whisper API:** Converts the recorded audio into text using OpenAI's Whisper API, ensuring accurate and efficient transcription.
- **Interaction with GPT-4 API:** Sends the transcribed text to the GPT-4 API along with a predefined user instruction, such as analyzing, summarizing, or generating a response based on the transcript.
- **Custom System Message:** Users can set a specific instruction or query at the start to guide the AI's response to the transcript.
- **Local Storage of API Keys:** API keys required for Whisper and GPT-4 APIs are securely stored in the browser's local storage for easy and secure access.
- **Open Source Code:** The codebase is open source, allowing users to review, modify, and understand how the extension operates.

## How to Use

1. **Install the Extension:** Add the OpenAI Audio Assistant to your Chrome browser.
2. **Set API Keys:** Enter your Whisper and GPT-4 API keys in the provided settings area. These keys will be stored locally for future use.
3. **Define System Message:** Specify the type of operation or response you need from GPT-4 regarding the transcribed text.
4. **Record Audio:** Activate the extension on a tab where audio is playing. This can be a video, an online meeting, or any other audio source.
5. **Transcription and Interaction:** The extension will transcribe the audio and interact with GPT-4 based on your predefined instructions.

## Privacy and Security

Your privacy is paramount. The extension does not store any personal data or recordings. All interactions are processed in real-time, and API keys are stored locally on your device.
