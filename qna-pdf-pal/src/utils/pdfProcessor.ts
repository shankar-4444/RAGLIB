
import * as pdfjsLib from 'pdfjs-dist';
import { DocumentChunk } from '@/store/libraryStore';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  embeddings?: number[][];
}

export async function processPDF(file: File): Promise<ProcessedDocument> {
  try {
    console.log('Starting PDF processing for:', file.name);
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const chunks: DocumentChunk[] = [];
    const chunkSize = 1000; // characters per chunk
    const chunkOverlap = 200; // overlap between chunks
    
    console.log(`Processing ${pdf.numPages} pages...`);
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Extract text from page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (pageText.length === 0) continue;
      
      // Split page text into chunks
      const pageChunks = createChunks(pageText, chunkSize, chunkOverlap);
      
      pageChunks.forEach((chunkText, index) => {
        chunks.push({
          id: crypto.randomUUID(),
          content: chunkText,
          pageNumber: pageNum,
          chunkIndex: index,
        });
      });
    }
    
    console.log(`Created ${chunks.length} chunks from PDF`);
    
    // Generate embeddings for chunks (placeholder for now)
    // In a real implementation, you would use a proper embedding model
    const embeddings = await generateEmbeddings(chunks.map(chunk => chunk.content));
    
    return {
      chunks,
      embeddings,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error('Failed to process PDF file');
  }
}

function createChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    let chunk = text.substring(startIndex, endIndex);
    
    // Try to break at word boundaries
    if (endIndex < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ');
      if (lastSpaceIndex > chunk.length * 0.7) {
        chunk = chunk.substring(0, lastSpaceIndex);
      }
    }
    
    chunks.push(chunk.trim());
    
    if (endIndex >= text.length) break;
    
    startIndex = endIndex - overlap;
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Placeholder implementation
  // In a real app, you would use a proper embedding model like:
  // - OpenAI embeddings API
  // - HuggingFace transformers
  // - Local embedding models
  
  console.log('Generating embeddings for', texts.length, 'chunks');
  
  // Return mock embeddings for now
  return texts.map(() => 
    Array.from({ length: 384 }, () => Math.random() - 0.5)
  );
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
