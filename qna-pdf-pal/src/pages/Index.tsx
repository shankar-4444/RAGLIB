import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LibraryManager } from "@/components/LibraryManager";
import { ChatInterface } from "@/components/ChatInterface";
import { ConversationHistory } from "@/components/ConversationHistory";
import { Settings } from "@/components/Settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLibraryStore } from "@/store/libraryStore";
import {
  Book,
  MessageSquare,
  History,
  Settings as SettingsIcon,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [activeTab, setActiveTab] = useState("libraries");
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const { currentLibrary } = useLibraryStore();

  // Handle scroll to bottom
  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  // Show/hide scroll to bottom button based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      // Show button when not at bottom (with some threshold)
      setShowScrollBottom(documentHeight - scrollPosition > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">QnA PDF Pal</h1>
              <p className="text-sm text-muted-foreground">
                Upload PDFs, organize them into libraries, and ask questions
                powered by AI
              </p>
              {currentLibrary && (
                <div className="mt-1 text-xs text-primary">
                  Current Library:{" "}
                  <span className="font-medium">{currentLibrary.name}</span>
                </div>
              )}
            </div>
            <ThemeToggle />
          </div>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger
                value="libraries"
                className="flex items-center gap-2"
              >
                <Book className="h-4 w-4" />
                Libraries
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content with top padding to account for fixed header */}
      <div className="pt-48">
        <div className="container mx-auto px-4 pb-6">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsContent value="libraries" className="mt-0">
              <LibraryManager />
            </TabsContent>

            <TabsContent value="chat" className="mt-0">
              <ChatInterface />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <ConversationHistory />
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <Settings />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollBottom && (
        <Button
          variant="outline"
          size="sm"
          onClick={scrollToBottom}
          className="fixed bottom-6 right-6 h-12 w-12 p-0 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-40"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default Index;
