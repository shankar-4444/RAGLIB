import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useLibraryStore } from "@/store/libraryStore";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

export const PDFUploader = () => {
  const { currentLibrary, fetchLibraries } = useLibraryStore();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "processing" | "success" | "error"
  >("idle");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentFile, setCurrentFile] = useState<string>("");
  const [currentFileSize, setCurrentFileSize] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleUpload(Array.from(files));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length > 0) {
      handleUpload(pdfFiles);
    } else {
      toast({
        title: "Invalid files",
        description: "Please select PDF files only",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const uploadFileWithProgress = (
    file: File,
    libraryId: string
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Invalid response format"));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(
              new Error(
                errorData.detail || `Upload failed with status ${xhr.status}`
              )
            );
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error("Upload was cancelled"));
      });

      xhr.open("POST", `${API_BASE}/libraries/${libraryId}/documents`);
      xhr.send(formData);
    });
  };

  const cancelUpload = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setUploadedFiles([]);
    setCurrentFile("");
    setCurrentFileSize(0);
    setTotalFiles(0);
    setErrorMessage("");
    setIsUploading(false);
  };

  const handleUpload = async (files: File[]) => {
    if (!currentLibrary) {
      toast({
        title: "No library selected",
        description: "Please select a library first",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");
    setUploadedFiles([]);
    setTotalFiles(files.length);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check file size (20MB limit)
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(
            `File ${file.name} is too large. Maximum size is 20MB.`
          );
        }

        // Set current file being uploaded
        setCurrentFile(file.name);
        setCurrentFileSize(file.size);
        setUploadProgress(0);

        // Upload file with real progress tracking
        const result = await uploadFileWithProgress(file, currentLibrary.id);
        setUploadedFiles((prev) => [...prev, file.name]);

        // Show processing status
        setUploadStatus("processing");
        setUploadProgress(100);

        // Brief processing indicator (actual processing happens on backend)
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setUploadStatus("success");

      // Refresh libraries to show new documents
      await fetchLibraries();

      toast({
        title: "Upload successful",
        description: `Successfully uploaded ${files.length} PDF${
          files.length > 1 ? "s" : ""
        }`,
      });

      // Reset after success
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadProgress(0);
        setUploadedFiles([]);
      }, 3000);
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetUpload = () => {
    setUploadStatus("idle");
    setUploadProgress(0);
    setUploadedFiles([]);
    setErrorMessage("");
  };

  if (!currentLibrary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload PDFs to "{currentLibrary.name}"</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            uploadStatus === "uploading" || uploadStatus === "processing"
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {uploadStatus === "idle" && (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop PDF files here, or click to select
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Select Files
              </Button>
            </div>
          )}

          {uploadStatus === "uploading" && (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-primary animate-pulse" />
              <p className="text-sm font-medium">
                Uploading files... ({uploadedFiles.length + 1}/{totalFiles})
              </p>
              {currentFile && (
                <p className="text-xs font-medium text-primary">
                  Current: {currentFile} ({formatFileSize(currentFileSize)})
                </p>
              )}
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                {Math.round(uploadProgress)}% complete
              </p>
              {uploadedFiles.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Uploaded: {uploadedFiles.join(", ")}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={cancelUpload}
                className="mt-2"
              >
                Cancel Upload
              </Button>
            </div>
          )}

          {uploadStatus === "processing" && (
            <div className="space-y-2">
              <div className="h-8 w-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Processing PDFs...</p>
              <p className="text-xs text-muted-foreground">
                Extracting text and generating embeddings
              </p>
              <p className="text-xs text-muted-foreground">
                This may take a few moments...
              </p>
            </div>
          )}

          {uploadStatus === "success" && (
            <div className="space-y-2">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
              <p className="text-sm font-medium text-green-600">
                Upload successful!
              </p>
              <div className="space-y-1">
                {uploadedFiles.map((fileName, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-xs"
                  >
                    <FileText className="h-3 w-3 text-green-500" />
                    <span>{fileName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="space-y-2">
              <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
              <p className="text-sm font-medium text-red-600">Upload failed</p>
              <p className="text-xs text-red-500">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={resetUpload}>
                Try Again
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {/* File Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Maximum file size: 20MB per PDF</p>
          <p>• Supported format: PDF only</p>
          <p>• Files will be processed and indexed for search</p>
        </div>

        {/* Current Library Stats */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Current library: {currentLibrary.documents.length} document
            {currentLibrary.documents.length !== 1 ? "s" : ""}
          </span>
          <Badge variant="secondary">
            {currentLibrary.documents.reduce(
              (total, doc) => total + (doc.chunks?.length || 0),
              0
            )}{" "}
            chunks
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
