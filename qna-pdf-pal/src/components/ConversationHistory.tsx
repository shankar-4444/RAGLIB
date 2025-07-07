import { useState } from "react";
import { useLibraryStore } from "@/store/libraryStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Search,
  Trash2,
  Calendar,
  Library,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConversationExport } from "./ConversationExport";

export const ConversationHistory = () => {
  const {
    conversations,
    libraries,
    setCurrentConversation,
    deleteConversation,
    updateConversationTitle,
    fetchConversation,
  } = useLibraryStore();
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Only show conversations that exist in the backend (i.e., have a valid id and are present in the store after fetchAllConversations)
  const validConversations = conversations.filter(
    (conv) => conv.id && typeof conv.id === "string" && conv.id.length === 36
  );

  const filteredConversations = validConversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.messages.some((msg) =>
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const handleSelectConversation = async (conversation: any) => {
    const fullConv = await fetchConversation(conversation.id);
    setCurrentConversation(fullConv);
    toast({
      title: "Conversation Loaded",
      description: `Switched to: ${fullConv.title}`,
    });
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation(conversationId);
    toast({
      title: "Conversation Deleted",
      description: "The conversation has been removed",
    });
  };

  const getLibraryName = (libraryId: string) => {
    const library = libraries.find((lib) => lib.id === libraryId);
    return library?.name || "Unknown Library";
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(date).getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Conversations Yet</h3>
          <p className="text-muted-foreground text-center">
            Start a conversation in the Chat tab to see your history here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Conversation History</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {filteredConversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p className="text-muted-foreground text-center">
              Try adjusting your search terms
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConversations
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            )
            .map((conversation) => (
              <Card
                key={conversation.id}
                className="cursor-pointer hover:shadow-md transition-all"
                onClick={() => handleSelectConversation(conversation)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base line-clamp-2 flex items-center">
                      {editingId === conversation.id ? (
                        <Input
                          value={editTitle}
                          autoFocus
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={async () => {
                            if (
                              editTitle.trim() &&
                              editTitle !== conversation.title
                            ) {
                              await updateConversationTitle(
                                conversation.id,
                                editTitle.trim()
                              );
                              toast({
                                title: "Title Updated",
                                description: "Conversation title updated.",
                              });
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              if (
                                editTitle.trim() &&
                                editTitle !== conversation.title
                              ) {
                                await updateConversationTitle(
                                  conversation.id,
                                  editTitle.trim()
                                );
                                toast({
                                  title: "Title Updated",
                                  description: "Conversation title updated.",
                                });
                              }
                              setEditingId(null);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          className="text-base py-1 px-2"
                        />
                      ) : (
                        <>
                          <span>{conversation.title}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 p-1 h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conversation.id);
                              setEditTitle(conversation.title);
                            }}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </CardTitle>
                    <div className="flex items-center space-x-1">
                      <ConversationExport
                        conversation={conversation}
                        libraryName={getLibraryName(conversation.libraryId)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Library className="h-3 w-3" />
                    <span>{getLibraryName(conversation.libraryId)}</span>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(conversation.updatedAt)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">
                      {conversation.messages.length}{" "}
                      {conversation.messages.length === 1
                        ? "message"
                        : "messages"}
                    </Badge>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Preview of last message */}
                  {conversation.messages.length > 0 && (
                    <div className="border-t pt-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {
                          conversation.messages[
                            conversation.messages.length - 1
                          ].content
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};
