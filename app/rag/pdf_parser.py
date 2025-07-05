import pdfplumber
from typing import List, Tuple, Dict, Any
import re
import fitz  # PyMuPDF for better text extraction
import pandas as pd
from PIL import Image
import pytesseract
import io

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        if end < len(text):
            last_space = chunk.rfind(' ')
            if last_space > chunk_size * 0.7:
                chunk = chunk[:last_space]
        chunks.append(chunk.strip())
        if end >= len(text):
            break
        start = end - overlap
    return [c for c in chunks if c]

def parse_pdf_and_chunk(file_path: str, toc: list = None) -> List[Tuple[str, int, int, dict]]:
    """
    Returns list of (chunk_text, page_number, chunk_index, metadata)
    metadata includes closest ToC entry, detected heading, and table information
    """
    results = []
    toc = toc or []
    toc_sorted = sorted(toc, key=lambda x: x['page']) if toc else []
    heading_pattern = re.compile(r"^(CHAPTER|SECTION|[A-Z][A-Z\s\d\-:]{5,})$")
    
    # Get total pages
    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)
    
    for page_num in range(1, total_pages + 1):
        # Use enhanced text extraction
        extraction_result = enhanced_text_extraction(file_path, page_num)
        text = extraction_result["text"]
        tables = extraction_result["tables"]
        
        if not text.strip():
            continue
            
        lines = text.splitlines()
        chunk_lines = []
        chunk_index = 0
        last_heading = None
        
        # Find closest ToC entry for this page
        toc_entry = None
        for entry in reversed(toc_sorted):
            if page_num >= entry['page']:
                toc_entry = entry
                break
        
        # Process text lines
        for line in lines:
            # Heading detection
            if heading_pattern.match(line.strip()):
                # If there is an existing chunk, save it
                if chunk_lines:
                    chunk_text = " ".join(chunk_lines).strip()
                    if chunk_text:
                        metadata = {
                            "toc_title": toc_entry['title'] if toc_entry else None,
                            "toc_page": toc_entry['page'] if toc_entry else None,
                            "heading": last_heading,
                            "has_tables": len(tables) > 0,
                            "table_count": len(tables)
                        }
                        results.append((chunk_text, page_num, chunk_index, metadata))
                        chunk_index += 1
                    chunk_lines = []
                last_heading = line.strip()
            chunk_lines.append(line)
        
        # Save any remaining chunk
        chunk_text = " ".join(chunk_lines).strip()
        if chunk_text:
            metadata = {
                "toc_title": toc_entry['title'] if toc_entry else None,
                "toc_page": toc_entry['page'] if toc_entry else None,
                "heading": last_heading,
                "has_tables": len(tables) > 0,
                "table_count": len(tables)
            }
            results.append((chunk_text, page_num, chunk_index, metadata))
        
        # Add table data as separate chunks if tables exist
        for table_idx, table in enumerate(tables):
            table_text = f"Table {table_idx + 1}:\n"
            if table.get("headers"):
                table_text += "Headers: " + " | ".join(table["headers"]) + "\n"
            table_text += "Data:\n"
            for row in table.get("data", [])[:5]:  # Limit to first 5 rows
                table_text += " | ".join(str(v) for v in row.values()) + "\n"
            if len(table.get("data", [])) > 5:
                table_text += f"... and {len(table['data']) - 5} more rows"
            
            metadata = {
                "toc_title": toc_entry['title'] if toc_entry else None,
                "toc_page": toc_entry['page'] if toc_entry else None,
                "heading": last_heading,
                "is_table": True,
                "table_index": table_idx,
                "table_rows": table.get("rows", 0),
                "table_columns": table.get("columns", 0)
            }
            results.append((table_text, page_num, chunk_index, metadata))
            chunk_index += 1
    
    return results

def extract_toc_from_pdf(file_path: str, max_pages: int = 10) -> list:
    """
    Extracts a Table of Contents (ToC) from the first max_pages of a PDF.
    Returns a list of dicts: [{"title": ..., "page": ...}, ...]
    """
    toc = []
    toc_pattern = re.compile(r"^(Chapter|Section|[0-9]+(\.[0-9]+)*)[\s\w\-:,.]*\.{2,}\s*(\d+)$", re.IGNORECASE)
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages]):
            lines = (page.extract_text() or "").splitlines()
            for line in lines:
                match = toc_pattern.match(line.strip())
                if match:
                    title = line.strip().rsplit(".", 1)[0].strip()
                    page_num = int(match.group(3))
                    toc.append({"title": title, "page": page_num})
    return toc

def extract_text_with_ocr(page_image: Image.Image) -> str:
    """Extract text from image using OCR when regular text extraction fails."""
    try:
        # Configure OCR for better accuracy
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()[]{}"\'-_/\\ '
        text = pytesseract.image_to_string(page_image, config=custom_config)
        return text.strip()
    except Exception as e:
        print(f"[WARNING] OCR failed: {e}")
        return ""

def extract_tables_from_page(page) -> List[Dict[str, Any]]:
    """Extract tables from a PDF page and convert to structured data."""
    tables = []
    try:
        # Extract tables using pdfplumber
        page_tables = page.extract_tables()
        for table_idx, table in enumerate(page_tables):
            if table and len(table) > 1:  # Ensure table has content
                # Convert to DataFrame for better handling
                df = pd.DataFrame(table[1:], columns=table[0] if table[0] else None)
                # Clean up the DataFrame
                df = df.dropna(how='all').dropna(axis=1, how='all')
                
                if not df.empty:
                    table_data = {
                        "table_index": table_idx,
                        "rows": len(df),
                        "columns": len(df.columns),
                        "data": df.to_dict('records'),
                        "headers": df.columns.tolist()
                    }
                    tables.append(table_data)
    except Exception as e:
        print(f"[WARNING] Table extraction failed: {e}")
    
    return tables

def enhanced_text_extraction(file_path: str, page_num: int) -> Dict[str, Any]:
    """Enhanced text extraction using multiple methods."""
    result = {
        "text": "",
        "tables": [],
        "images": [],
        "metadata": {}
    }
    
    try:
        # Method 1: Try pdfplumber first
        with pdfplumber.open(file_path) as pdf:
            if page_num <= len(pdf.pages):
                page = pdf.pages[page_num - 1]
                result["text"] = page.extract_text() or ""
                result["tables"] = extract_tables_from_page(page)
        
        # Method 2: If text extraction failed, try PyMuPDF
        if not result["text"].strip():
            doc = fitz.open(file_path)
            if page_num <= len(doc):
                page = doc[page_num - 1]
                result["text"] = page.get_text()
            doc.close()
        
        # Method 3: If still no text, try OCR
        if not result["text"].strip():
            doc = fitz.open(file_path)
            if page_num <= len(doc):
                page = doc[page_num - 1]
                # Convert page to image
                mat = fitz.Matrix(2, 2)  # Higher resolution for better OCR
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                result["text"] = extract_text_with_ocr(img)
            doc.close()
        
        # Extract metadata
        result["metadata"] = {
            "has_text": bool(result["text"].strip()),
            "has_tables": len(result["tables"]) > 0,
            "text_length": len(result["text"]),
            "table_count": len(result["tables"])
        }
        
    except Exception as e:
        print(f"[ERROR] Enhanced text extraction failed for page {page_num}: {e}")
        result["text"] = ""
    
    return result
