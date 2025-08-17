// DOM Elements
const splashScreen = document.getElementById("splash-screen") //  to hide the intro splash after 2.5s.
const chatContainer = document.getElementById("chat-container") // to show/hide chat UI.
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
let currentUploadedImage = null // stores uploaded image so it can be sent to API.
let recognition = null //speech recognition object (for voice input).
let isListening = false //  whether microphone is actively recording.
let apiKey = localStorage.getItem("gemini-api-key") || ""//saved API key (from localStorage so it persists even after refresh).
let soundEnabled = localStorage.getItem("sound-enabled") !== "false"

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings
  loadSettings() //Loads saved preferences (dark mode, API key, sound).

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

//Converts an uploaded image into a Base64 string so it can be sent to the API.
function toBase64(imageDataUrl) {
  return new Promise((resolve, reject) => {
    if (typeof imageDataUrl === "string") {
      // If already a Data URL, strip the prefix
      const base64 = imageDataUrl.split(",")[1];
      resolve(base64);
    } else if (imageDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(imageDataUrl);
    } else {
      reject("Unsupported image type");
    }
  });
}

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

// Set up event listeners Central place where all UI event bindings are set up.
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
async function sendMessage() {
  const message = userInput.value.trim()
  const hasImage = currentUploadedImage !== null

  if (!message && !hasImage) {
    showNotification("Please enter a message or upload an image")
    return
  }

  // Add user message to chat
  if (hasImage) {
    addMessageToChat("user", message || "Uploaded an image", currentUploadedImage)
  } else {
    addMessageToChat("user", message)
  }

  // Clear input and image
  userInput.value = ""
  const imageToProcess = currentUploadedImage
  removeUploadedImage()

  // Show typing indicator
  showTypingIndicator()

  // Play sound if enabled
  if (soundEnabled) {
    playSound("send")
  }

  try {
    // Get AI response
    const response = await processWithGemini(message, imageToProcess)

    // Hide typing indicator
    hideTypingIndicator()

    // Add AI response to chat
    addMessageToChat("bot", response)

    // Play sound if enabled
    if (soundEnabled) {
      playSound("receive")
    }
  } catch (error) {
    hideTypingIndicator()
    addMessageToChat("bot", "Sorry, I encountered an error. Please try again.")
    console.error("Send message error:", error)
  }

  // Auto-resize textarea
  autoResizeTextarea()
}

// Process message with Gemini API
const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

async function processWithGemini(message, image = null) {
  if (!apiKey) {
    return "Please set your Gemini API key in the settings to continue."
  }

  try {
    const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`

    // If image is present
    if (image) {
      // Convert data URL to base64 (remove data:image/jpeg;base64, prefix)
      const base64Image = image.split(",")[1]

      const body = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: "image/jpeg", // Default to jpeg, could be improved to detect actual type
                  data: base64Image,
                },
              },
              {
                text: message || "Please describe this image in detail.",
              },
            ],
          },
        ],
      }
      
// This sends a POST request to Gemini with:
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message || "API Error")
      }

      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyze this image. Please try again."
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
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message || "API Error")
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again."
  } catch (error) {
    console.error("Error processing with Gemini:", error)
    return `Error: ${error.message}. Please check your API key and try again.`
  }
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
    showNotification("Please select an image file (JPG, PNG, GIF, WebP)")
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

    showNotification("Image uploaded successfully! You can now send it with your message.")
  }

  reader.onerror = () => {
    showNotification("Error reading the image file. Please try again.")
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
    case "send":
      oscillator.type = "sine"
      oscillator.frequency.value = 800
      gainNode.gain.value = 0.1
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
      break
    case "receive":
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

// Show typing indicator
function showTypingIndicator() {
  typingIndicator.classList.add("visible")
}

// Hide typing indicator
function hideTypingIndicator() {
  typingIndicator.classList.remove("visible")
}
