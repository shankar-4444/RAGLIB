import { useState, useRef, useEffect } from "react";
import { useLibraryStore } from "@/store/libraryStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Bot, User, AlertCircle, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateResponse } from "@/utils/ragEngine";
import { DocumentSelector } from "@/components/DocumentSelector";

export const ChatInterface = () => {
  const {
    currentLibrary,
    currentConversation,
    setCurrentConversation,
    createConversation,
    addMessage,
    conversations,
  } = useLibraryStore();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [responseLength, setResponseLength] = useState<
    "short" | "medium" | "long"
  >("medium");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages]);

  // Auto-switch to library-specific conversation when library changes
  useEffect(() => {
    if (currentLibrary) {
      // Find existing conversation for this library
      const libraryConversation = conversations.find(
        (conv) => conv.libraryId === currentLibrary.id
      );

      // If current conversation doesn't belong to this library, switch to library conversation or create new one
      if (
        !currentConversation ||
        currentConversation.libraryId !== currentLibrary.id
      ) {
        if (libraryConversation) {
          setCurrentConversation(libraryConversation);
        } else {
          (async () => {
            const newConversation = await createConversation(
              currentLibrary.id,
              `Chat with ${currentLibrary.name}`
            );
            setCurrentConversation(newConversation);
          })();
        }
      }
    }
  }, [
    currentLibrary,
    conversations,
    currentConversation,
    setCurrentConversation,
    createConversation,
  ]);

  const handleSendMessage = async () => {
    if (!input.trim() || !currentLibrary || isLoading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: "user" as const,
      timestamp: new Date(),
    };

    let conversation = currentConversation;

    // Create new conversation if none exists for this library
    if (!conversation || conversation.libraryId !== currentLibrary.id) {
      conversation = await createConversation(
        currentLibrary.id,
        input.trim().slice(0, 50) + (input.length > 50 ? "..." : "")
      );
      setCurrentConversation(conversation);
    }

    // Add user message
    addMessage(conversation.id, userMessage);
    setInput("");
    setIsLoading(true);

    try {
      // Generate AI response using RAG with document filtering and response length
      const response = await generateResponse(
        input.trim(),
        currentLibrary,
        selectedDocuments,
        responseLength
      );

      const assistantMessage = {
        id: crypto.randomUUID(),
        content: response.content,
        role: "assistant" as const,
        timestamp: new Date(),
        sources: response.sources,
      };

      addMessage(conversation.id, assistantMessage);
    } catch (error) {
      console.error("Error generating response:", error);

      const errorMessage = {
        id: crypto.randomUUID(),
        content:
          "I apologize, but I'm having trouble processing your request right now. Please try again later.",
        role: "assistant" as const,
        timestamp: new Date(),
      };

      addMessage(conversation.id, errorMessage);

      toast({
        title: "Error",
        description: "Failed to generate response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to send message
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSendMessage();
      }

      // Ctrl/Cmd + K to focus input
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const inputElement = document.querySelector(
          'input[placeholder*="Ask a question"]'
        ) as HTMLInputElement;
        inputElement?.focus();
      }

      // Escape to clear input
      if (e.key === "Escape") {
        setInput("");
        const inputElement = document.querySelector(
          'input[placeholder*="Ask a question"]'
        ) as HTMLInputElement;
        inputElement?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyboardShortcuts);
    return () =>
      document.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [input, handleSendMessage]);

  const handleNewChat = async () => {
    if (!currentLibrary) return;
    // Count existing chats for this library for naming
    const count =
      conversations.filter((c) => c.libraryId === currentLibrary.id).length + 1;
    const title = `Chat with ${currentLibrary.name} #${count}`;
    const newConversation = await createConversation(currentLibrary.id, title);
    setCurrentConversation(newConversation);
  };

  if (!currentLibrary) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Library Selected</h3>
          <p className="text-muted-foreground text-center">
            Please select a library from the Libraries tab to start chatting
          </p>
        </CardContent>
      </Card>
    );
  }

  if (currentLibrary.documents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Documents Available</h3>
          <p className="text-muted-foreground text-center">
            Upload some PDFs to your library to start asking questions
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Chat with "{currentLibrary.name}"</span>
            <Badge variant="secondary">
              {currentLibrary.documents.length}{" "}
              {currentLibrary.documents.length === 1 ? "PDF" : "PDFs"}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {currentConversation?.messages.length === 0 ||
            !currentConversation ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Start a Conversation
                </h3>
                <p className="text-muted-foreground">
                  Ask me anything about the documents in your library
                </p>
              </div>
            ) : (
              currentConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    message.role === "user"
                      ? "flex-row-reverse space-x-reverse"
                      : ""
                  }`}
                >
                  <div
                    className={`p-2 rounded-full ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 ${
                      message.role === "user" ? "text-right" : ""
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[80%] ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">
                            Sources:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {message.sources.map((source, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {source}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-full bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="inline-block p-3 rounded-lg bg-muted">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input and Controls */}
          <div className="space-y-2">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question about your documents..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="outline" size="sm" onClick={handleNewChat}>
                + New Chat
              </Button>
            </div>

            {/* Response Length Control */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  Response length:
                </span>
                <Select
                  value={responseLength}
                  onValueChange={(value: "short" | "medium" | "long") =>
                    setResponseLength(value)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">Keyboard Shortcuts:</p>
                      <p className="text-xs">⌘/Ctrl + Enter: Send message</p>
                      <p className="text-xs">⌘/Ctrl + K: Focus input</p>
                      <p className="text-xs">Escape: Clear input</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Document Selector and Preview */}
          {currentLibrary.documents.length > 1 && (
            <div className="mt-4">
              <DocumentSelector
                documents={currentLibrary.documents}
                selectedDocuments={selectedDocuments}
                onDocumentsChange={setSelectedDocuments}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
