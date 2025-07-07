import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLibraryStore } from "@/store/libraryStore";
import { useToast } from "@/hooks/use-toast";
import {
  Book,
  Plus,
  Upload,
  Tag,
  Trash2,
  FileText,
  Calendar,
} from "lucide-react";
import { PDFUploader } from "./PDFUploader";

export const LibraryManager = () => {
  const {
    libraries,
    currentLibrary,
    createLibrary,
    deleteLibrary,
    setCurrentLibrary,
    createConversation,
    setCurrentConversation,
    conversations,
  } = useLibraryStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState("");
  const [newLibraryDescription, setNewLibraryDescription] = useState("");
  const [newLibraryTags, setNewLibraryTags] = useState("");
  const { toast } = useToast();

  const handleCreateLibrary = async () => {
    if (!newLibraryName.trim()) {
      toast({
        title: "Error",
        description: "Library name is required",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createLibrary(
        newLibraryName.trim(),
        newLibraryDescription.trim(),
        newLibraryTags.trim()
      );
      setNewLibraryName("");
      setNewLibraryDescription("");
      setNewLibraryTags("");
      toast({
        title: "Success",
        description: "Library created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create library",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteLibrary = async (libraryId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this library? This will also delete all documents and conversations."
      )
    ) {
      return;
    }

    try {
      await deleteLibrary(libraryId);
      toast({
        title: "Success",
        description: "Library deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete library",
        variant: "destructive",
      });
    }
  };

  const getTotalChunks = (library: any) => {
    return library.documents.reduce(
      (total: number, doc: any) => total + (doc.chunks?.length || 0),
      0
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Libraries</h2>
          <p className="text-muted-foreground">
            Organize your PDFs into subject-specific libraries
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Library
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Library</DialogTitle>
              <DialogDescription>
                Create a new library to organize your PDF documents by subject
                or topic.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="library-name">Library Name *</Label>
                <Input
                  id="library-name"
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  placeholder="e.g., Engineering Books, Research Papers"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="library-description">Description</Label>
                <Textarea
                  id="library-description"
                  value={newLibraryDescription}
                  onChange={(e) => setNewLibraryDescription(e.target.value)}
                  placeholder="Describe what this library contains..."
                  className="mt-1"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="library-tags">Tags</Label>
                <Input
                  id="library-tags"
                  value={newLibraryTags}
                  onChange={(e) => setNewLibraryTags(e.target.value)}
                  placeholder="e.g., engineering, research, textbooks (comma-separated)"
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Add tags to help organize and find your libraries
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  onClick={handleCreateLibrary}
                  disabled={isCreating || !newLibraryName.trim()}
                >
                  {isCreating ? "Creating..." : "Create Library"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {libraries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Book className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Libraries Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first library to start organizing PDFs
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Library
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Library</DialogTitle>
                  <DialogDescription>
                    Create a new library to organize your PDF documents by
                    subject or topic.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="library-name">Library Name *</Label>
                    <Input
                      id="library-name"
                      value={newLibraryName}
                      onChange={(e) => setNewLibraryName(e.target.value)}
                      placeholder="e.g., Engineering Books, Research Papers"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="library-description">Description</Label>
                    <Textarea
                      id="library-description"
                      value={newLibraryDescription}
                      onChange={(e) => setNewLibraryDescription(e.target.value)}
                      placeholder="Describe what this library contains..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="library-tags">Tags</Label>
                    <Input
                      id="library-tags"
                      value={newLibraryTags}
                      onChange={(e) => setNewLibraryTags(e.target.value)}
                      placeholder="e.g., engineering, research, textbooks (comma-separated)"
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Add tags to help organize and find your libraries
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      onClick={handleCreateLibrary}
                      disabled={isCreating || !newLibraryName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create Library"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraries.map((library) => (
            <Card
              key={library.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                currentLibrary?.id === library.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setCurrentLibrary(library)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Book className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{library.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLibrary(library.id);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {library.description && (
                  <CardDescription className="text-sm">
                    {library.description}
                  </CardDescription>
                )}
                {library.tags && library.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {library.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{library.documents.length} documents</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span>{getTotalChunks(library)} chunks</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-3 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    Created {new Date(library.created_at).toLocaleDateString()}
                  </span>
                </div>

                {currentLibrary?.id === library.id && (
                  <div className="mt-4">
                    <PDFUploader />
                  </div>
                )}
                <div className="flex justify-end mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Count existing chats for this library for naming
                      const count =
                        conversations.filter((c) => c.libraryId === library.id)
                          .length + 1;
                      const title = `Chat with ${library.name} #${count}`;
                      const newConversation = await createConversation(
                        library.id,
                        title
                      );
                      setCurrentConversation(newConversation);
                    }}
                  >
                    + New Chat
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
