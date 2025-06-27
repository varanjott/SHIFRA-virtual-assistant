// DOM Elements
const splashScreen = document.getElementById("splash-screen")
const chatContainer = document.getElementById("chat-container")
const chatMessages = document.getElementById("chat-messages")
const userInput = document.getElementById("user-input")
const sendButton = document.getElementById("send-button")
const themeToggle = document.getElementById("theme-toggle")
const themeSwitch = document.getElementById("theme-switch")
const settingsButton = document.getElementById("settings-button")
const settingsDrawer = document.getElementById("settings-drawer")
const closeSettings = document.getElementById("close-settings")
const overlay = document.getElementById("overlay")
const clearChatButton = document.getElementById("clear-chat")
const typingIndicator = document.getElementById("typing-indicator")
const voiceInputButton = document.getElementById("voice-input-button")
const imageUploadButton = document.getElementById("image-upload-button")
const imageUpload = document.getElementById("image-upload")
const imagePreviewContainer = document.getElementById("image-preview-container")
const imagePreview = document.getElementById("image-preview")
const removeImageButton = document.getElementById("remove-image")
const apiKeyInput = document.getElementById("api-key-input")
const soundSwitch = document.getElementById("sound-switch")

// State variables
let darkMode = false
let currentUploadedImage = null
let recognition = null
let isListening = false
let apiKey = localStorage.getItem("gemini-api-key") || ""
let soundEnabled = localStorage.getItem("sound-enabled") !== "false"

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings
  loadSettings()

  // Show splash screen for 2.5 seconds
  setTimeout(() => {
    splashScreen.style.opacity = "0"
    setTimeout(() => {
      splashScreen.style.display = "none"
      chatContainer.classList.add("visible")
    }, 500)
  }, 2500)

  // Set up event listeners
  setupEventListeners()

  // Initialize speech recognition if available
  initSpeechRecognition()

  // Auto-resize textarea
  userInput.addEventListener("input", autoResizeTextarea)
})

// Load settings from localStorage
function loadSettings() {
  // Load theme preference
  darkMode = localStorage.getItem("dark-mode") === "true"
  if (darkMode) {
    document.body.classList.add("dark-mode")
    document.body.classList.remove("light-mode")
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>'
    themeSwitch.checked = true
  }

  // Load API key
  if (apiKey) {
    apiKeyInput.value = apiKey
  }

  // Load sound preference
  soundSwitch.checked = soundEnabled
}

// Set up event listeners
function setupEventListeners() {
  // Send message on button click
  sendButton.addEventListener("click", sendMessage)

  // Send message on Enter key (but allow Shift+Enter for new line)
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })

  // Theme toggle
  themeToggle.addEventListener("click", toggleTheme)
  themeSwitch.addEventListener("change", toggleTheme)

  // Settings drawer
  settingsButton.addEventListener("click", openSettings)
  closeSettings.addEventListener("click", closeSettingsDrawer)
  overlay.addEventListener("click", closeSettingsDrawer)

  // Clear chat
  clearChatButton.addEventListener("click", clearChat)

  // Voice input
  voiceInputButton.addEventListener("click", toggleVoiceInput)

  // Image upload
  imageUploadButton.addEventListener("click", () => imageUpload.click())
  imageUpload.addEventListener("change", handleImageUpload)
  removeImageButton.addEventListener("click", removeUploadedImage)

  // Save API key
  apiKeyInput.addEventListener("blur", saveApiKey)

  // Sound toggle
  soundSwitch.addEventListener("change", toggleSound)

  // Add click event to all copy buttons
  document.addEventListener("click", (e) => {
    if (e.target.closest(".copy-button")) {
      const messageContent = e.target.closest(".message").querySelector(".message-content p").textContent
      copyToClipboard(messageContent)
    }
  })
}

// Send message function
function sendMessage() {
  const message = userInput.value.trim()

  // Don't send empty messages unless there's an image
  if (!message && !currentUploadedImage) return

  // Add user message to chat
  addMessageToChat("user", message, currentUploadedImage)

  // Clear input
  userInput.value = ""
  autoResizeTextarea()

  // Show typing indicator
  typingIndicator.classList.add("visible")

  // Process with Gemini API
  processWithGemini(message, currentUploadedImage)
    .then((response) => {
      // Hide typing indicator
      typingIndicator.classList.remove("visible")

      // Add bot response to chat
      addMessageToChat("bot", response)

      // Play sound if enabled
      if (soundEnabled) {
        playSound("message-received")
      }
    })
    .catch((error) => {
      console.error("Error:", error)
      typingIndicator.classList.remove("visible")
      addMessageToChat("bot", "Sorry, I encountered an error. Please try again or check your API key.")
    })

  // Remove uploaded image after sending
  if (currentUploadedImage) {
    removeUploadedImage()
  }

  // Play sound if enabled
  if (soundEnabled) {
    playSound("message-sent")
  }
}

// Process message with Gemini API
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function processWithGemini(message, image = null) {
  if (!apiKey) {
    return "Please set your Gemini API key in the settings to continue.";
  }

  try {
    const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

    // If image is present
    if (image) {
      const base64Image = await toBase64(image);

      const body = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: image.type,
                  data: base64Image,
                },
              },
              {
                text: message || "Please describe the image.",
              },
            ],
          },
        ],
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini could not respond to the image.";
    }

    // For text only
    const body = {
      contents: [
        {
          parts: [
            {
              text: message,
            },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini returned no response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while connecting to Gemini API.";
  }
}
// Simulate response for demo purposes
function simulateResponse(message) {
  const responses = [
    "I understand you're asking about " + message + ". That's an interesting topic! Here's what I know...",
    "Thanks for your message! Based on what you've asked, I'd suggest...",
    "Great question! Let me provide some information about " + message + "...",
    "I've processed your request about '" + message + "'. Here's my response...",
    "I'm happy to help with your question about " + message + ". Here's what I can tell you...",
  ]

  return (
    responses[Math.floor(Math.random() * responses.length)] +
    " This is a simulated response. In a real implementation, this would be replaced with the actual response from the Gemini API."
  )
}

// Simulate image analysis response
function simulateImageAnalysisResponse() {
  const responses = [
    "It appears to be an image containing some interesting elements. I can see various objects and colors.",
    "This image shows what looks like a scene with several details that I can analyze further if you'd like.",
    "I've analyzed the visual content of this image and can identify several key components.",
    "The image you've shared contains visual information that I can describe in detail.",
    "Based on my analysis, this image depicts a scene with various elements worth noting.",
  ]

  return (
    responses[Math.floor(Math.random() * responses.length)] +
    " This is a simulated image analysis. In a real implementation, this would be replaced with the actual analysis from the Gemini API."
  )
}

// Add message to chat
function addMessageToChat(role, content, image = null) {
  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${role}-message`

  if (image) {
    messageDiv.classList.add("message-with-image")
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  const messageHTML = `
        <div class="message-content">
            <p>${content}</p>
            ${image ? `<img src="${image}" alt="Uploaded image" class="message-image">` : ""}
        </div>
        <div class="message-info">
            <span class="timestamp">${timestamp}</span>
            ${role === "bot" ? '<button class="copy-button" title="Copy to clipboard"><i class="fas fa-copy"></i></button>' : ""}
        </div>
    `

  messageDiv.innerHTML = messageHTML
  chatMessages.appendChild(messageDiv)

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight

  // Add typing animation for bot messages
  if (role === "bot") {
    const paragraph = messageDiv.querySelector("p")
    const text = paragraph.textContent
    paragraph.textContent = ""

    let i = 0
    const typingSpeed = 10 // ms per character

    function typeWriter() {
      if (i < text.length) {
        paragraph.textContent += text.charAt(i)
        i++
        setTimeout(typeWriter, typingSpeed)
      }
    }

    typeWriter()
  }
}

// Toggle theme
function toggleTheme() {
  darkMode = !darkMode

  if (darkMode) {
    document.body.classList.add("dark-mode")
    document.body.classList.remove("light-mode")
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>'
    themeSwitch.checked = true
  } else {
    document.body.classList.add("light-mode")
    document.body.classList.remove("dark-mode")
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>'
    themeSwitch.checked = false
  }

  // Save preference
  localStorage.setItem("dark-mode", darkMode)
}

// Open settings drawer
function openSettings() {
  settingsDrawer.classList.add("open")
  overlay.classList.add("visible")
}

// Close settings drawer
function closeSettingsDrawer() {
  settingsDrawer.classList.remove("open")
  overlay.classList.remove("visible")
}

// Clear chat
function clearChat() {
  // Keep only the first welcome message
  while (chatMessages.children.length > 1) {
    chatMessages.removeChild(chatMessages.lastChild)
  }

  closeSettingsDrawer()

  // Play sound if enabled
  if (soundEnabled) {
    playSound("clear-chat")
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Show a temporary tooltip or notification
      showNotification("Copied to clipboard!")

      // Play sound if enabled
      if (soundEnabled) {
        playSound("copy")
      }
    })
    .catch((err) => {
      console.error("Failed to copy: ", err)
    })
}

// Show notification
function showNotification(message) {
  const notification = document.createElement("div")
  notification.className = "notification"
  notification.textContent = message

  document.body.appendChild(notification)

  // Fade in
  setTimeout(() => {
    notification.style.opacity = "1"
  }, 10)

  // Remove after 2 seconds
  setTimeout(() => {
    notification.style.opacity = "0"
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 2000)
}

// Auto-resize textarea
function autoResizeTextarea() {
  userInput.style.height = "auto"
  userInput.style.height = userInput.scrollHeight + "px"
}

// Initialize speech recognition
function initSpeechRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join("")

      userInput.value = transcript
      autoResizeTextarea()
    }

    recognition.onend = () => {
      voiceInputButton.innerHTML = '<i class="fas fa-microphone"></i>'
      voiceInputButton.classList.remove("active")
      isListening = false
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error)
      voiceInputButton.innerHTML = '<i class="fas fa-microphone"></i>'
      voiceInputButton.classList.remove("active")
      isListening = false
    }
  } else {
    voiceInputButton.style.display = "none"
    console.log("Speech recognition not supported in this browser")
  }
}

// Toggle voice input
function toggleVoiceInput() {
  if (!recognition) return

  if (isListening) {
    recognition.stop()
    voiceInputButton.innerHTML = '<i class="fas fa-microphone"></i>'
    voiceInputButton.classList.remove("active")
  } else {
    recognition.start()
    voiceInputButton.innerHTML = '<i class="fas fa-microphone-slash"></i>'
    voiceInputButton.classList.add("active")
    isListening = true

    // Play sound if enabled
    if (soundEnabled) {
      playSound("voice-start")
    }
  }
}

// Handle image upload
function handleImageUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  // Check if file is an image
  if (!file.type.match("image.*")) {
    showNotification("Please select an image file")
    return
  }

  // Check file size (limit to 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showNotification("Image size should be less than 5MB")
    return
  }

  const reader = new FileReader()

  reader.onload = (e) => {
    const imageDataUrl = e.target.result

    // Display image preview
    imagePreview.src = imageDataUrl
    imagePreviewContainer.classList.remove("hidden")

    // Store the image data URL
    currentUploadedImage = imageDataUrl

    // Play sound if enabled
    if (soundEnabled) {
      playSound("image-upload")
    }
  }

  reader.readAsDataURL(file)
}

// Remove uploaded image
function removeUploadedImage() {
  imagePreviewContainer.classList.add("hidden")
  imagePreview.src = ""
  currentUploadedImage = null
  imageUpload.value = ""
}

// Save API key
function saveApiKey() {
  apiKey = apiKeyInput.value.trim()
  localStorage.setItem("gemini-api-key", apiKey)
  showNotification("API key saved")
}

// Toggle sound
function toggleSound() {
  soundEnabled = soundSwitch.checked
  localStorage.setItem("sound-enabled", soundEnabled)
}

// Play sound effects
function playSound(type) {
  if (!soundEnabled) return

  // In a real implementation, you would have actual sound files
  // This is a placeholder using the Web Audio API to generate simple sounds

  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  switch (type) {
    case "message-sent":
      oscillator.type = "sine"
      oscillator.frequency.value = 800
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
      break
    case "message-received":
      oscillator.type = "sine"
      oscillator.frequency.value = 600
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
      break
    case "copy":
      oscillator.type = "sine"
      oscillator.frequency.value = 1200
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.05)
      break
    case "clear-chat":
      oscillator.type = "triangle"
      oscillator.frequency.value = 400
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.2)
      break
    case "voice-start":
      oscillator.type = "sine"
      oscillator.frequency.value = 880
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
      break
    case "image-upload":
      oscillator.type = "sine"
      oscillator.frequency.value = 700
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.15)
      break
  }
}
