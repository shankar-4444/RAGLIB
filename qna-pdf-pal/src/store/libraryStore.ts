import { create } from "zustand";
import { persist } from "zustand/middleware";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export interface PDFDocument {
  id: string;
  name: string;
  file?: File;
  uploadDate: Date;
  tags?: string;
  chunks: DocumentChunk[];
  embeddings?: number[][];
}

export interface DocumentChunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

export interface Library {
  id: string;
  name: string;
  description?: string;
  documents: PDFDocument[];
  createdAt: Date;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  sources?: string[];
}

export interface Conversation {
  id: string;
  libraryId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface LibraryStore {
  libraries: Library[];
  currentLibrary: Library | null;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  fetchLibraries: () => Promise<void>;
  createLibrary: (
    name: string,
    description?: string,
    tags?: string
  ) => Promise<void>;
  deleteLibrary: (id: string) => Promise<void>;
  setCurrentLibrary: (library: Library | null) => void;
  addDocument: (libraryId: string, document: PDFDocument) => void;
  removeDocument: (libraryId: string, documentId: string) => void;
  createConversation: (
    libraryId: string,
    title: string
  ) => Promise<Conversation>;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  deleteConversation: (conversationId: string) => void;
  updateConversationTitle: (
    conversationId: string,
    newTitle: string
  ) => Promise<void>;
  fetchAllConversations: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchConversation: (conversationId: string) => Promise<Conversation>;
}

export const useLibraryStore = create<LibraryStore>()(
  persist(
    (set, get) => ({
      libraries: [],
      currentLibrary: null,
      conversations: [],
      currentConversation: null,

      initialize: async () => {
        await get().fetchLibraries();
        await get().fetchAllConversations();
      },

      fetchLibraries: async () => {
        const res = await fetch(`${API_BASE}/libraries`);
        const libs = await res.json();
        // For each library, fetch its documents
        const libraries: Library[] = await Promise.all(
          libs.map(async (lib: any) => {
            const docRes = await fetch(
              `${API_BASE}/libraries/${lib.id}/documents`
            );
            const docs = await docRes.json();
            return {
              ...lib,
              documents: docs.map((doc: any) => ({
                ...doc,
                uploadDate: new Date(doc.upload_date),
                tags: doc.tags || "",
                chunks: doc.chunks || [],
              })),
              createdAt: new Date(lib.created_at),
              tags: lib.tags
                ? lib.tags.split(",").map((tag: string) => tag.trim())
                : [],
            };
          })
        );
        set((state) => {
          let currentLibrary = state.currentLibrary;
          if (
            !currentLibrary ||
            !libraries.some((lib) => lib.id === currentLibrary.id)
          ) {
            currentLibrary = libraries.length > 0 ? libraries[0] : null;
          }
          return { libraries, currentLibrary };
        });
        await get().fetchAllConversations();
      },

      createLibrary: async (
        name: string,
        description?: string,
        tags?: string
      ) => {
        const res = await fetch(`${API_BASE}/libraries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, tags }),
        });
        if (!res.ok) throw new Error("Failed to create library");
        await get().fetchLibraries();
      },

      deleteLibrary: async (id: string) => {
        await fetch(`${API_BASE}/libraries/${id}`, { method: "DELETE" });
        await get().fetchLibraries();
      },

      setCurrentLibrary: (library: Library | null) => {
        set({ currentLibrary: library });
      },

      addDocument: (libraryId: string, document: PDFDocument) => {
        set((state) => ({
          libraries: state.libraries.map((lib) =>
            lib.id === libraryId
              ? { ...lib, documents: [...lib.documents, document] }
              : lib
          ),
        }));
      },

      removeDocument: (libraryId: string, documentId: string) => {
        set((state) => ({
          libraries: state.libraries.map((lib) =>
            lib.id === libraryId
              ? {
                  ...lib,
                  documents: lib.documents.filter(
                    (doc) => doc.id !== documentId
                  ),
                }
              : lib
          ),
        }));
      },

      createConversation: async (libraryId: string, title: string) => {
        const res = await fetch(
          `${API_BASE}/libraries/${libraryId}/conversations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          }
        );
        if (!res.ok) throw new Error("Failed to create conversation");
        await get().fetchAllConversations();
        // Return the latest conversation for this library with this title
        const { conversations } = get();
        return conversations.find(
          (c) => c.libraryId === libraryId && c.title === title
        );
      },

      addMessage: async (conversationId: string, message: ChatMessage) => {
        // Save message to backend first
        const res = await fetch(
          `${API_BASE}/libraries/conversations/${conversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
          }
        );
        if (!res.ok) throw new Error("Failed to save message");
        // After saving, fetch the updated conversation
        await get().fetchConversation(conversationId);
      },

      setCurrentConversation: (conversation: Conversation | null) => {
        if (conversation) {
          const { libraries } = get();
          const library = libraries.find(
            (lib) => lib.id === conversation.libraryId
          );
          if (library) {
            set({ currentLibrary: library });
          }
        }
        set({ currentConversation: conversation });
      },

      deleteConversation: async (conversationId: string) => {
        set((state) => ({
          conversations: state.conversations.filter(
            (conv) => conv.id !== conversationId
          ),
          currentConversation:
            state.currentConversation?.id === conversationId
              ? null
              : state.currentConversation,
        }));
        // Also delete from backend
        await fetch(`${API_BASE}/libraries/conversations/${conversationId}`, {
          method: "DELETE",
        });
        // Immediately sync with backend to ensure state is correct
        await get().fetchAllConversations();
      },

      updateConversationTitle: async (
        conversationId: string,
        newTitle: string
      ) => {
        const res = await fetch(
          `${API_BASE}/libraries/conversations/${conversationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          }
        );
        if (!res.ok) throw new Error("Failed to update conversation title");
        await get().fetchAllConversations();
      },

      fetchAllConversations: async () => {
        const { libraries } = get();
        let allConvs: Conversation[] = [];
        for (const lib of libraries) {
          const res = await fetch(
            `${API_BASE}/libraries/${lib.id}/conversations`
          );
          if (res.ok) {
            const convs = await res.json();
            allConvs = allConvs.concat(
              convs.map((conv: any) => ({
                ...conv,
                libraryId: conv.library_id,
                createdAt: new Date(conv.created_at),
                updatedAt: new Date(conv.updated_at),
              }))
            );
          }
        }
        // Only keep conversations that exist in the backend
        set({ conversations: allConvs });
      },

      fetchConversation: async (conversationId: string) => {
        const res = await fetch(
          `${API_BASE}/libraries/conversations/${conversationId}`
        );
        if (!res.ok) throw new Error("Failed to fetch conversation");
        const conv = await res.json();
        conv.libraryId = conv.library_id;
        conv.createdAt = new Date(conv.created_at);
        conv.updatedAt = new Date(conv.updated_at);
        // Update the conversation in the store
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, ...conv } : c
          ),
          currentConversation: conv,
        }));
        return conv;
      },
    }),
    {
      name: "library-store",
      partialize: (state) => ({
        libraries: state.libraries,
        conversations: state.conversations,
      }),
      migrate: async (persistedState, version) => {
        // Remove conversations with IDs that are not valid UUIDs (local-only)
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const state = persistedState as any;
        return {
          ...state,
          conversations: (state.conversations || []).filter((conv: any) =>
            uuidRegex.test(conv.id)
          ),
        };
      },
    }
  )
);
