import re
from typing import List, Dict, Any
from core.config import DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP

class AcademicTextSplitter:
    """
    Semantic recursive text chunker optimized for academic textbooks,
    lecture slides, and syllabus outlines.
    """

    def __init__(self, chunk_size: int = DEFAULT_CHUNK_SIZE, chunk_overlap: int = DEFAULT_CHUNK_OVERLAP):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_page(self, page_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Split a single page's text into semantically coherent chunks while
        inheriting and enriching metadata.
        """
        text = page_data.get("text", "").strip()
        if not text:
            return []

        # If text is smaller than chunk size, return as a single chunk
        if len(text) <= self.chunk_size:
            return [{
                "chunk_id": f"{page_data['source']}_p{page_data['page']}_c0",
                "text": text,
                "source": page_data["source"],
                "page": page_data["page"],
                "total_pages": page_data.get("total_pages", 1),
                "doc_type": page_data.get("doc_type", "UNKNOWN"),
                "section_header": self._extract_header(text),
                "char_count": len(text)
            }]

        raw_chunks = self._recursive_split(text)
        enriched_chunks = []

        for idx, chunk_text in enumerate(raw_chunks):
            chunk_clean = chunk_text.strip()
            if chunk_clean:
                enriched_chunks.append({
                    "chunk_id": f"{page_data['source']}_p{page_data['page']}_c{idx}",
                    "text": chunk_clean,
                    "source": page_data["source"],
                    "page": page_data["page"],
                    "total_pages": page_data.get("total_pages", 1),
                    "doc_type": page_data.get("doc_type", "UNKNOWN"),
                    "section_header": self._extract_header(chunk_clean),
                    "char_count": len(chunk_clean)
                })

        return enriched_chunks

    def split_documents(self, pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Split a list of page objects into a unified list of chunk objects."""
        all_chunks = []
        for page in pages_data:
            chunks = self.split_page(page)
            all_chunks.extend(chunks)
        return all_chunks

    def _recursive_split(self, text: str) -> List[str]:
        """Recursively split text on paragraphs, sentences, and words."""
        # Separation separators in priority order
        separators = ["\n\n", "\n", ". ", "; ", ", ", " "]
        return self._split_text_with_separators(text, separators)

    def _split_text_with_separators(self, text: str, separators: List[str]) -> List[str]:
        final_chunks = []
        separator = separators[-1]
        
        # Pick highest priority separator present in the text
        for s in separators:
            if s == "":
                separator = s
                break
            if s in text:
                separator = s
                break

        splits = text.split(separator) if separator else list(text)
        
        good_splits = []
        for s in splits:
            if s:
                good_splits.append(s)

        # Merge splits respecting chunk_size and chunk_overlap
        current_chunk = []
        current_length = 0

        for piece in good_splits:
            piece_len = len(piece) + (len(separator) if separator else 0)
            
            if current_length + piece_len > self.chunk_size and current_chunk:
                merged = separator.join(current_chunk) if separator else "".join(current_chunk)
                final_chunks.append(merged)
                
                # Keep overlap from current chunk
                overlap_chunk = []
                overlap_len = 0
                for prev_piece in reversed(current_chunk):
                    if overlap_len + len(prev_piece) <= self.chunk_overlap:
                        overlap_chunk.insert(0, prev_piece)
                        overlap_len += len(prev_piece)
                    else:
                        break
                
                current_chunk = overlap_chunk
                current_length = sum(len(p) for p in current_chunk) + (len(separator) * max(0, len(current_chunk) - 1))

            current_chunk.append(piece)
            current_length += piece_len

        if current_chunk:
            merged = separator.join(current_chunk) if separator else "".join(current_chunk)
            final_chunks.append(merged)

        return final_chunks

    def _extract_header(self, text: str) -> str:
        """Attempt to extract chapter/section header if present at the start of the chunk."""
        first_line = text.split("\n")[0].strip()
        # Look for headers like "# Chapter 1", "Module 2:", "1.1 Introduction"
        if re.match(r'^(#+|\d+\.|\b(Chapter|Module|Section|Unit|Topic)\b)', first_line, re.IGNORECASE):
            return first_line[:80]
        return ""
