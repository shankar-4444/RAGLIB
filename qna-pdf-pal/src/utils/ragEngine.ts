import { Library } from "@/store/libraryStore";

export interface RAGResponse {
  content: string;
  sources: string[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function generateResponse(
  query: string,
  library: Library,
  documentIds?: string[],
  responseLength: "short" | "medium" | "long" = "medium"
): Promise<RAGResponse> {
  if (!library?.id) {
    return {
      content: "No library selected.",
      sources: [],
    };
  }
  const response = await fetch(`${API_BASE}/libraries/${library.id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: query,
      document_ids: documentIds || undefined,
      response_length: responseLength,
    }),
  });
  if (!response.ok) {
    return {
      content: "Failed to get a response from the backend.",
      sources: [],
    };
  }
  const data = await response.json();
  return {
    content: data.answer,
    sources: data.sources || [],
  };
}
