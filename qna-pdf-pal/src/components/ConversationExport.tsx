import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, MessageSquare, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConversationExportProps {
  conversation: {
    id: string;
    title: string;
    messages: Array<{
      id: string;
      content: string;
      role: string;
      timestamp: Date;
      sources?: string[];
    }>;
    created_at: Date;
    updated_at: Date;
  };
  libraryName: string;
}

export const ConversationExport = ({
  conversation,
  libraryName,
}: ConversationExportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"markdown" | "text">(
    "markdown"
  );
  const [previewContent, setPreviewContent] = useState("");
  const { toast } = useToast();

  const generateExportContent = (format: "markdown" | "text") => {
    const timestamp = new Date().toISOString();
    const header =
      format === "markdown"
        ? `# Conversation: ${conversation.title}\n\n**Library:** ${libraryName}\n**Exported:** ${timestamp}\n\n---\n\n`
        : `Conversation: ${
            conversation.title
          }\n\nLibrary: ${libraryName}\nExported: ${timestamp}\n\n${"=".repeat(
            50
          )}\n\n`;

    const messages = conversation.messages
      .map((msg) => {
        const time = new Date(msg.timestamp).toLocaleString();
        const role = msg.role === "user" ? "👤 You" : "🤖 Assistant";

        let content =
          format === "markdown"
            ? `### ${role} (${time})\n\n${msg.content}\n\n`
            : `${role} (${time})\n${msg.content}\n\n`;

        if (msg.sources && msg.sources.length > 0) {
          const sources =
            format === "markdown"
              ? `**Sources:** ${msg.sources.join(", ")}\n\n`
              : `Sources: ${msg.sources.join(", ")}\n\n`;
          content += sources;
        }

        return content;
      })
      .join("");

    return header + messages;
  };

  const handlePreview = () => {
    const content = generateExportContent(exportFormat);
    setPreviewContent(content);
  };

  const handleExport = () => {
    const content = generateExportContent(exportFormat);
    const blob = new Blob([content], {
      type: exportFormat === "markdown" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_${new Date().toISOString().split("T")[0]}.${
      exportFormat === "markdown" ? "md" : "txt"
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Conversation exported as ${exportFormat.toUpperCase()}`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Export Conversation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export Options */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Format:</span>
              <Select
                value={exportFormat}
                onValueChange={(value: "markdown" | "text") =>
                  setExportFormat(value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="text">Plain Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handlePreview} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>

          {/* Conversation Info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{conversation.title}</h4>
              <Badge variant="secondary">
                {conversation.messages.length} messages
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Created:{" "}
                  {new Date(conversation.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>
                  Updated:{" "}
                  {new Date(conversation.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          {previewContent && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Preview:</h4>
              <Textarea
                value={previewContent}
                readOnly
                className="h-64 font-mono text-xs"
                placeholder="Click 'Preview' to see the export content..."
              />
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export {exportFormat.toUpperCase()}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
