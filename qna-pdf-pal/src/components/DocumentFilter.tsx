import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X, FileText } from "lucide-react";
import { PDFDocument } from "@/store/libraryStore";

interface DocumentFilterProps {
  documents: PDFDocument[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const DocumentFilter = ({
  documents,
  selectedTags,
  onTagsChange,
}: DocumentFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get all unique tags from documents
  const allTags = Array.from(
    new Set(
      documents
        .flatMap((doc) =>
          doc.tags
            ? doc.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag)
            : []
        )
        .map((tag) => tag.toLowerCase())
    )
  ).sort();

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    onTagsChange([]);
  };

  const getFilteredDocumentCount = () => {
    if (selectedTags.length === 0) return documents.length;

    return documents.filter((doc) => {
      const docTags = doc.tags
        ? doc.tags
            .split(",")
            .map((tag) => tag.trim().toLowerCase())
            .filter((tag) => tag)
        : [];
      return selectedTags.some((tag) => docTags.includes(tag));
    }).length;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Document Filter</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? "Hide" : "Show"}
          </Button>
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4">
          {/* Filter Summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedTags.length === 0
                ? "Searching all documents"
                : `Searching ${getFilteredDocumentCount()} of ${
                    documents.length
                  } documents`}
            </div>
            {selectedTags.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Show which documents are being searched */}
          {selectedTags.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              <p className="font-medium mb-1">Documents being searched:</p>
              <div className="space-y-1">
                {documents
                  .filter((doc) => {
                    const docTags = doc.tags
                      ? doc.tags
                          .split(",")
                          .map((tag) => tag.trim().toLowerCase())
                          .filter((tag) => tag)
                      : [];
                    return selectedTags.some((tag) => docTags.includes(tag));
                  })
                  .map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-2">
                      <FileText className="h-3 w-3" />
                      <span>{doc.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="default"
                  className="flex items-center space-x-1"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => toggleTag(tag)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Available Tags */}
          {allTags.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Available Tags:</p>
              <div className="grid grid-cols-2 gap-2">
                {allTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={tag}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <label
                      htmlFor={tag}
                      className="text-sm cursor-pointer hover:text-primary transition-colors"
                    >
                      {tag}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No tags available. Add tags to documents to filter by them.
            </p>
          )}

          {/* Filter Info */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-1">
              <li>• Select tags to search only in documents with those tags</li>
              <li>• Leave empty to search all documents in the library</li>
              <li>
                • Multiple tags work as OR (documents with any of the selected
                tags)
              </li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
