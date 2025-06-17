import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import WordScramble from "./WordScramble";
import "./Chat.css";

function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [learningWord, setLearningWord] = useState(false);
  const [scrambleSentence, setScrambleSentence] = useState("");
  // const [playingScramble, setPlayingScramble] = useState(false);
  const messagesEndRef = useRef(null);

  // Generate a simple session ID (in a real app, you'd want something more robust)
  const sessionId =
    localStorage.getItem("chatSessionId") ||
    `session_${Math.random().toString(36).substring(2, 9)}`;

  // Save session ID to localStorage
  if (!localStorage.getItem("chatSessionId")) {
    localStorage.setItem("chatSessionId", sessionId);
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to learn a new word and play a word scramble game
  const handleLearnWordWithGame = async () => {
    if (loading || learningWord) return;

    setLearningWord(true);

    try {
      // Use the chat endpoint directly with a learning request
      const message = "I want to learn a new word and practice it";
      
      // Add user message to chat
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: message, sender: "user" },
      ]);
      
      // Add empty AI message that will be updated
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "", sender: "ai" },
      ]);
      
      // Create EventSource for streaming
      const eventSource = new EventSource(
        `http://localhost:8080/chat?prompt=${encodeURIComponent(message)}&sessionId=${encodeURIComponent(sessionId.substring(0, 36))}`
      );
      
      let fullResponse = "";
      
      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          eventSource.close();
          setLearningWord(false);
          return;
        }
        
        try {
          const data = JSON.parse(event.data);
          
          // Handle word game data
          if (data.wordGame) {
            setScrambleSentence(data.wordGame.scrambleSentence);
            
            // Mark the current message as a game
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].gameType = "scramble";
              return newMessages;
            });
            
            return;
          }
          
          if (data.chunk) {
            fullResponse += data.chunk;
            
            // Update the AI message with the accumulated text
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].text = fullResponse;
              return newMessages;
            });
          }
          
          if (data.error) {
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].text = `Error: ${data.error}`;
              return newMessages;
            });
            eventSource.close();
            setLearningWord(false);
          }
        } catch (e) {
          console.error("Error parsing SSE data:", e);
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setLearningWord(false);
        
        // Only update with error if we haven't received any response yet
        if (!fullResponse) {
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1].text = "Connection error. Please try again.";
            return newMessages;
          });
        }
      };
    } catch (error) {
      console.error("Error:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "Sorry, something went wrong.", sender: "ai" },
      ]);
      setLearningWord(false);
    }
  };

  // Handle game completion
  const handleGameComplete = (success) => {
    if (success) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          text: "Great job! Would you like to play another word scramble game?",
          sender: "ai",
        },
      ]);
    }
    setLearningWord(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { text: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setLoading(true);
    setInput("");

    // Limit prompt size to prevent header size issues
    const limitedPrompt = input.substring(0, 2000);

    try {
      // Add an empty AI message that will be updated with streaming content
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "", sender: "ai" },
      ]);

      // Create EventSource for streaming
      const eventSource = new EventSource(
        `http://localhost:8080/chat?prompt=${encodeURIComponent(
          limitedPrompt
        )}&sessionId=${encodeURIComponent(sessionId.substring(0, 36))}`
      );

      let fullResponse = "";

      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          eventSource.close();
          setLoading(false);
          return;
        }

        try {
          const data = JSON.parse(event.data);

          // Handle word game data from backend
          if (data.wordGame) {
            setScrambleSentence(data.wordGame.scrambleSentence);

            // Mark the current message as a game
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].gameType = "scramble";
              return newMessages;
            });

            return;
          }

          if (data.chunk) {
            fullResponse += data.chunk;

            // Update the AI message with the accumulated text
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].text = fullResponse;
              return newMessages;
            });
          }

          if (data.error) {
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages];
              newMessages[newMessages.length - 1].text = `Error: ${data.error}`;
              return newMessages;
            });
            eventSource.close();
            setLoading(false);
          }
        } catch (e) {
          console.error("Error parsing SSE data:", e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setLoading(false);

        // Only update with error if we haven't received any response yet
        if (!fullResponse) {
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            newMessages[newMessages.length - 1].text =
              "Connection error. Please try again.";
            return newMessages;
          });
        }
      };
    } catch (error) {
      console.error("Error:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "Sorry, something went wrong.", sender: "ai" },
      ]);
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            {message.sender === "ai" ? (
              <>
                <ReactMarkdown>{message.text}</ReactMarkdown>
                {message.gameType === "scramble" && scrambleSentence && (
                  <WordScramble
                    sentence={scrambleSentence}
                    onComplete={handleGameComplete}
                  />
                )}
              </>
            ) : (
              message.text
            )}
          </div>
        ))}
        {loading && <div className="message ai loading">Thinking...</div>}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || learningWord}
        />
        <button
          type="submit"
          disabled={loading || learningWord || !input.trim()}
        >
          Send
        </button>
        <button
          type="button"
          onClick={handleLearnWordWithGame}
          disabled={loading || learningWord}
          className="learn-word-btn"
        >
          Learn & Practice
        </button>
      </form>
    </div>
  );
}

export default Chat;
