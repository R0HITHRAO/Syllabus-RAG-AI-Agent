import os
import json
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from core.config import VECTOR_STORE_DIR, GEMINI_API_KEY, DEFAULT_EMBEDDING_MODEL

class AcademicVectorStore:
    """
    Persistent semantic vector index for academic course materials.
    Supports Gemini dense embeddings and robust TF-IDF semantic embeddings fallback.
    """

    def __init__(self, storage_dir: Path = VECTOR_STORE_DIR, api_key: Optional[str] = None):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        
        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: Optional[np.ndarray] = None
        self.vectorizer = None # Used for fallback TF-IDF embeddings
        
        self.index_file = self.storage_dir / "index_meta.json"
        self.matrix_file = self.storage_dir / "embeddings.npy"
        
        self.load_index()

    def set_api_key(self, api_key: str):
        """Update Gemini API Key dynamically."""
        self.api_key = api_key.strip()

    def _get_gemini_embeddings(self, texts: List[str]) -> Optional[np.ndarray]:
        """Generate dense embeddings via Gemini API text-embedding-004."""
        if not self.api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            
            # Batch generate embeddings in chunks of 50
            all_vectors = []
            batch_size = 50
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                response = genai.embed_content(
                    model=DEFAULT_EMBEDDING_MODEL,
                    content=batch,
                    task_type="retrieval_document"
                )
                if isinstance(response, dict) and "embedding" in response:
                    emb = response["embedding"]
                    all_vectors.extend(emb)
                elif hasattr(response, "embeddings"):
                    all_vectors.extend([e.values for e in response.embeddings])
                else:
                    all_vectors.extend(response)
                    
            return np.array(all_vectors, dtype=np.float32)
        except Exception as e:
            print(f"[VectorStore] Gemini API embedding notice: {e}. Using local semantic embedding engine.")
            return None

    def _get_gemini_query_embedding(self, query: str) -> Optional[np.ndarray]:
        """Generate single query embedding via Gemini API."""
        if not self.api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            response = genai.embed_content(
                model=DEFAULT_EMBEDDING_MODEL,
                content=query,
                task_type="retrieval_query"
            )
            if isinstance(response, dict) and "embedding" in response:
                return np.array(response["embedding"], dtype=np.float32)
            elif hasattr(response, "embeddings") and response.embeddings:
                return np.array(response.embeddings[0].values, dtype=np.float32)
            return None
        except Exception as e:
            return None

    def _build_fallback_embeddings(self, texts: List[str]) -> np.ndarray:
        """High-dimensional TF-IDF vectorizer fallback with subword n-grams."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=10000,
            sublinear_tf=True,
            stop_words='english'
        )
        matrix = self.vectorizer.fit_transform(texts).toarray()
        # L2 normalize
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return (matrix / norms).astype(np.float32)

    def add_chunks(self, new_chunks: List[Dict[str, Any]]):
        """Add new document chunks to the vector index and re-persist."""
        if not new_chunks:
            return

        # Avoid duplicate chunks by chunk_id
        existing_ids = {c["chunk_id"] for c in self.chunks}
        filtered_new = [c for c in new_chunks if c["chunk_id"] not in existing_ids]
        
        if not filtered_new:
            return

        self.chunks.extend(filtered_new)
        all_texts = [c["text"] for c in self.chunks]

        # Compute embeddings
        dense_embs = self._get_gemini_embeddings(all_texts)
        if dense_embs is not None and len(dense_embs) == len(all_texts):
            # Normalize dense embeddings
            norms = np.linalg.norm(dense_embs, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.embeddings = (dense_embs / norms).astype(np.float32)
        else:
            self.embeddings = self._build_fallback_embeddings(all_texts)

        self.save_index()

    def search(self, query: str, top_k: int = 4, filter_source: Optional[str] = None, min_similarity: float = 0.05) -> List[Dict[str, Any]]:
        """
        Execute semantic similarity search against indexed course material.
        Returns top-k matching chunks with similarity score and metadata.
        """
        if not self.chunks or self.embeddings is None:
            return []

        # Generate query vector
        query_vec = self._get_gemini_query_embedding(query)
        if query_vec is not None and self.embeddings.shape[1] == len(query_vec):
            # Normalize
            q_norm = np.linalg.norm(query_vec)
            if q_norm > 0:
                query_vec = query_vec / q_norm
            similarities = np.dot(self.embeddings, query_vec)
        else:
            # Fallback vectorizer
            if self.vectorizer is None:
                all_texts = [c["text"] for c in self.chunks]
                self.embeddings = self._build_fallback_embeddings(all_texts)
            
            q_mat = self.vectorizer.transform([query]).toarray()
            q_norm = np.linalg.norm(q_mat)
            if q_norm > 0:
                q_mat = q_mat / q_norm
            similarities = np.dot(self.embeddings, q_mat.T).flatten()

        # Filter by document source if specified
        results = []
        for idx, score in enumerate(similarities):
            chunk = self.chunks[idx]
            if filter_source and filter_source != "All Documents" and chunk["source"] != filter_source:
                continue
            if score >= min_similarity:
                res_item = dict(chunk)
                res_item["similarity_score"] = float(score)
                results.append(res_item)

        # Sort by similarity descending
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """Return summary statistics of all ingested course documents."""
        docs: Dict[str, Dict[str, Any]] = {}
        for c in self.chunks:
            src = c["source"]
            if src not in docs:
                docs[src] = {
                    "source": src,
                    "doc_type": c.get("doc_type", "UNKNOWN"),
                    "total_pages": c.get("total_pages", 1),
                    "chunk_count": 0,
                    "total_chars": 0
                }
            docs[src]["chunk_count"] += 1
            docs[src]["total_chars"] += len(c.get("text", ""))
        return list(docs.values())

    def delete_document(self, source_name: str):
        """Remove a specific document and all its chunks from the vector index."""
        self.chunks = [c for c in self.chunks if c["source"] != source_name]
        if self.chunks:
            all_texts = [c["text"] for c in self.chunks]
            dense_embs = self._get_gemini_embeddings(all_texts)
            if dense_embs is not None:
                norms = np.linalg.norm(dense_embs, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                self.embeddings = (dense_embs / norms).astype(np.float32)
            else:
                self.embeddings = self._build_fallback_embeddings(all_texts)
        else:
            self.embeddings = None
            self.vectorizer = None
        self.save_index()

    def clear(self):
        """Clear all indexed data and delete stored files."""
        self.chunks = []
        self.embeddings = None
        self.vectorizer = None
        if self.index_file.exists():
            self.index_file.unlink()
        if self.matrix_file.exists():
            self.matrix_file.unlink()

    def save_index(self):
        """Persist chunks metadata and embedding matrix to disk."""
        try:
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, indent=2)
            if self.embeddings is not None:
                np.save(str(self.matrix_file), self.embeddings)
        except Exception as e:
            print(f"[VectorStore] Error saving index: {e}")

    def load_index(self):
        """Load chunks metadata and embedding matrix from disk."""
        try:
            if self.index_file.exists():
                with open(self.index_file, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
            if self.matrix_file.exists():
                self.embeddings = np.load(str(self.matrix_file))
        except Exception as e:
            print(f"[VectorStore] Error loading index: {e}")
            self.chunks = []
            self.embeddings = None
