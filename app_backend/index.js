const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Store chat sessions by sessionId
const chatSessions = {};

app.post("/chat", (req, res) => {
  const { prompt, sessionId } = req.body;
  if (!prompt) {
    return res.status(400).send({ error: "Prompt is required" });
  }

  // Create or get existing chat session
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = model.startChat();
  }
  const chat = chatSessions[sessionId];

  // Send message to the chat session
  chat
    .sendMessage(prompt)
    .then((result) => {
      const response = result.response.text();
      res.send({ response });
    })
    .catch((error) => {
      console.error("Error generating content:", error);
      res.status(500).send({ error: "Failed to generate content" });
    });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
