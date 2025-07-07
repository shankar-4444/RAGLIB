import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Filter, X, CheckCircle } from "lucide-react";
import { PDFDocument } from "@/store/libraryStore";

interface DocumentSelectorProps {
  documents: PDFDocument[];
  selectedDocuments: string[];
  onDocumentsChange: (documentIds: string[]) => void;
}

export const DocumentSelector = ({
  documents,
  selectedDocuments,
  onDocumentsChange,
}: DocumentSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDocument = (documentId: string) => {
    if (selectedDocuments.includes(documentId)) {
      onDocumentsChange(selectedDocuments.filter((id) => id !== documentId));
    } else {
      onDocumentsChange([...selectedDocuments, documentId]);
    }
  };

  const selectAllDocuments = () => {
    onDocumentsChange(documents.map((doc) => doc.id));
  };

  const clearSelection = () => {
    onDocumentsChange([]);
  };

  const getSelectedDocumentNames = () => {
    return documents
      .filter((doc) => selectedDocuments.includes(doc.id))
      .map((doc) => doc.name);
  };

  const getSelectedDocumentCount = () => {
    return selectedDocuments.length;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Document Context</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? "Hide" : "Show"}
          </Button>
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent className="space-y-4">
          {/* Selection Summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedDocuments.length === 0
                ? "Searching all documents"
                : `Searching ${getSelectedDocumentCount()} of ${
                    documents.length
                  } documents`}
            </div>
            <div className="flex space-x-2">
              {selectedDocuments.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              {selectedDocuments.length < documents.length && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllDocuments}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Select All
                </Button>
              )}
            </div>
          </div>

          {/* Selected Documents */}
          {selectedDocuments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Documents:</p>
              <div className="flex flex-wrap gap-2">
                {getSelectedDocumentNames().map((name, index) => (
                  <Badge
                    key={index}
                    variant="default"
                    className="flex items-center space-x-1"
                  >
                    <FileText className="h-3 w-3" />
                    <span>{name}</span>
                    <button
                      onClick={() =>
                        toggleDocument(
                          documents.find((doc) => doc.name === name)?.id || ""
                        )
                      }
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Document List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Available Documents:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center space-x-3 p-2 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={document.id}
                    checked={selectedDocuments.includes(document.id)}
                    onCheckedChange={() => toggleDocument(document.id)}
                  />
                  <label
                    htmlFor={document.id}
                    className="flex-1 cursor-pointer hover:text-primary transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {document.name}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {document.chunks.length} chunks • Uploaded{" "}
                      {new Date(document.uploadDate).toLocaleDateString()}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-1">
              <li>• Select specific documents to search only in those files</li>
              <li>
                • Leave all unchecked to search all documents in the library
              </li>
              <li>
                • Selected documents will be prioritized in search results
              </li>
              <li>• This works like selecting specific files for context</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
