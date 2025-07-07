import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Tag, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "@/store/libraryStore";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

interface PDFTaggerProps {
  document: PDFDocument;
  libraryId: string;
  onUpdate: () => void;
}

export const PDFTagger = ({
  document,
  libraryId,
  onUpdate,
}: PDFTaggerProps) => {
  const [newTag, setNewTag] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const currentTags = document.tags
    ? document.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag)
    : [];

  const addTag = async () => {
    if (!newTag.trim()) return;

    const tag = newTag.trim().toLowerCase();
    if (currentTags.includes(tag)) {
      toast({
        title: "Tag already exists",
        description: "This tag is already applied to this document.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const updatedTags = [...currentTags, tag].join(", ");
      const response = await fetch(
        `${API_BASE}/libraries/${libraryId}/documents/${document.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: updatedTags }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update tags");
      }

      setNewTag("");
      onUpdate();
      toast({
        title: "Tag added",
        description: `Added tag "${tag}" to ${document.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add tag. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    setIsLoading(true);
    try {
      const updatedTags = currentTags
        .filter((tag) => tag !== tagToRemove)
        .join(", ");
      const response = await fetch(
        `${API_BASE}/libraries/${libraryId}/documents/${document.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: updatedTags }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update tags");
      }

      onUpdate();
      toast({
        title: "Tag removed",
        description: `Removed tag "${tagToRemove}" from ${document.name}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove tag. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Tag className="h-5 w-5" />
          <span>Document Tags</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{document.name}</p>

          {/* Current Tags */}
          <div className="flex flex-wrap gap-2">
            {currentTags.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No tags added yet
              </p>
            ) : (
              currentTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(tag)}
                    disabled={isLoading}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>

          {/* Add New Tag */}
          <div className="flex space-x-2">
            <Input
              placeholder="Add a tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={addTag}
              disabled={!newTag.trim() || isLoading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Tags help you filter questions to specific documents. Use
            descriptive tags like "textbook", "manual", "research", etc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
