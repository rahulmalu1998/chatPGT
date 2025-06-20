const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ limit: "1mb", extended: true }));
// Serve static files from public
app.use(express.static(path.join(__dirname, "public")));
// For React Router: serve index.html for any unknown route

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Store chat sessions by sessionId
const chatSessions = {};

// Store word game data by session
const sessionWordGames = {};

// Function to check if a prompt is about learning words using AI
const isWordLearningRequest = async (session, prompt) => {
  try {
    const classificationPrompt = `Analyze this user message and determine if it's a request to learn new words, vocabulary, or word meanings.

User message: "${prompt}"
Chat Session: "${session}"

Respond with only "YES" if the user is asking to:
- Learn new words or vocabulary
- Get word definitions or meanings
- Understand what a word means
- Practice vocabulary
- Get help with word pronunciation
- Learn synonyms or antonyms
- Any other word/vocabulary learning request

Respond with only "NO" for all other types of requests (general chat, other topics, etc.)

Response:`;

    const result = await model.generateContent(classificationPrompt);
    const response = result.response.text().trim().toUpperCase();

    return response === "YES";
  } catch (error) {
    console.error("Error in word learning classification:", error);
    // Fallback to keyword-based detection if AI fails
    const learningKeywords = [
      "learn word",
      "vocabulary",
      "meaning",
      "definition",
      "what does",
      "what is",
    ];
    return learningKeywords.some((keyword) =>
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );
  }
};

// Function to generate a word learning game with comprehension check
const generateWordLearningGame = async (prompt) => {
  try {
    const wordPrompt = `Generate a random advanced English word that would be good for vocabulary building, to ${prompt}. 
    Then create a simple sentence (5-8 words) using this word that would be good for a word scramble game.
    Also create a simple multiple-choice comprehension question about the word to check understanding.
    Make sure the scramble sentence uses the word in a natural way.
    Respond in JSON format with the following structure:
    {
      "word": "the word",
      "definition": "brief definition",
      "partOfSpeech": "noun/verb/adjective/etc",
      "example": "A sentence using the word correctly",
      "scrambleSentence": "A simple sentence using the word for scramble game",
      "comprehensionQuestion": "A question to check understanding of the word",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": "The correct option (A, B, C, or D)"
    }
    Only return the JSON, nothing else.`;

    const result = await model.generateContent(wordPrompt);
    const response = result.response.text();

    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Error parsing word data:", e);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating word game:", error);
    return null;
  }
};

// Handle both POST and GET requests for chat
const handleChat = async (req, res) => {
  // Get parameters from either body (POST) or query (GET)
  const prompt = req.method === "POST" ? req.body.prompt : req.query.prompt;
  const sessionId =
    req.method === "POST" ? req.body.sessionId : req.query.sessionId;

  if (!prompt) {
    return res.status(400).send({ error: "Prompt is required" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    // Create or get existing chat session
    if (!chatSessions[sessionId]) {
      chatSessions[sessionId] = model.startChat();
    }
    const chat = chatSessions[sessionId];

    // Check if user is in word learning mode or wants to learn words
    const isLearningRequest = await isWordLearningRequest(chat, prompt);

    if (isLearningRequest || sessionWordGames[sessionId]) {
      let wordData = sessionWordGames[sessionId];

      // Generate new word data only if it's a new learning request
      if (isLearningRequest) {
        wordData = await generateWordLearningGame(prompt);
        if (wordData && wordData.word) {
          sessionWordGames[sessionId] = wordData;

          // Create enhanced prompt with word learning context
          const systemPrompt = `You are a language learning assistant. You're helping a user learn the word "${
            wordData.word
          }".
        
Word information:
- Word: ${wordData.word}
- Part of Speech: ${wordData.partOfSpeech}
- Definition: ${wordData.definition}
- Example: ${wordData.example}
- Comprehension Question: ${wordData.comprehensionQuestion}
- Options: ${JSON.stringify(wordData.options)}
- Correct Answer: ${wordData.correctAnswer}
- Practice Sentence: ${wordData.scrambleSentence}

Follow these steps in order:
1. First, introduce the word with its definition and example.
2. Ask if they understand the word.
3. When they respond, present the comprehension question with multiple choice options.
4. After they answer, tell them if they're correct and explain if needed.
5. Then say "Now let's practice using this word in a sentence" and tell them you'll show them a word scramble game.

Important: When you reach step 5, include the exact phrase "SHOW_WORD_SCRAMBLE" at the end of your response.`;

          // Send the enhanced prompt to the existing chat
          const result = await chat.sendMessageStream(systemPrompt);

          let fullResponse = "";
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
      }
    } else {
      // Clear word learning session if user is not learning words
      if (sessionWordGames[sessionId]) {
        delete sessionWordGames[sessionId];
      }
    }

    // Send message to the chat session with streaming
    const result = await chat.sendMessageStream(prompt);

    let fullResponse = "";
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullResponse += text;
      let cleanResponse = text;
      if (cleanResponse.includes("SHOW_WORD_SCRAMBLE")) {
        cleanResponse = cleanResponse.replace("SHOW_WORD_SCRAMBLE", "");
      }
      res.write(`data: ${JSON.stringify({ chunk: cleanResponse })}\n\n`);
      // Check if this response contains our marker for showing the word game
      if (text.includes("SHOW_WORD_SCRAMBLE") && sessionWordGames[sessionId]) {
        // Send the word game data
        res.write(
          `data: ${JSON.stringify({
            wordGame: sessionWordGames[sessionId],
          })}\n\n`
        );
        delete sessionWordGames[sessionId];
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error generating content:", error);
    res.write(
      `data: ${JSON.stringify({ error: "Failed to generate content" })}\n\n`
    );
    res.end();
  }
};

// Register both POST and GET handlers for the chat endpoint
app.post("/chat", handleChat);
app.get("/chat", handleChat);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
