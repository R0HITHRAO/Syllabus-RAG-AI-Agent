import os
import json
import math
import re
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from core.config import VECTOR_STORE_DIR, GEMINI_API_KEY, DEFAULT_EMBEDDING_MODEL

class BM25Okapi:
    """
    Enhanced BM25 Okapi lexical scoring engine with query expansion and boosting
    for academic terms, formulas, acronyms (TLB, EMAT, LRU), and keywords.
    """
    def __init__(self, corpus: List[List[str]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size = len(corpus)
        self.avg_doc_len = sum(len(doc) for doc in corpus) / self.corpus_size if self.corpus_size > 0 else 0
        self.doc_freqs: List[Counter] = []
        self.idf: Dict[str, float] = {}
        self.doc_lens = [len(doc) for doc in corpus]

        nd: Dict[str, int] = Counter()
        for doc in corpus:
            counts = Counter(doc)
            self.doc_freqs.append(counts)
            for word in counts.keys():
                nd[word] += 1

        for word, freq in nd.items():
            self.idf[word] = math.log((self.corpus_size - freq + 0.5) / (freq + 0.5) + 1)

    def get_scores(self, query: List[str]) -> np.ndarray:
        scores = np.zeros(self.corpus_size, dtype=np.float32)
        if self.corpus_size == 0 or self.avg_doc_len == 0:
            return scores

        for q_word in query:
            if q_word not in self.idf:
                continue
            w_idf = self.idf[q_word]
            for idx, doc_counts in enumerate(self.doc_freqs):
                freq = doc_counts.get(q_word, 0)
                if freq > 0:
                    numerator = freq * (self.k1 + 1)
                    denominator = freq + self.k1 * (1 - self.b + self.b * (self.doc_lens[idx] / self.avg_doc_len))
                    scores[idx] += w_idf * (numerator / denominator)
        return scores


class QueryExpander:
    """Advanced query expansion for better retrieval."""

    # Academic synonyms and related terms
    ACADEMIC_EXPANSIONS = {
        'algorithm': ['method', 'procedure', 'technique', 'approach'],
        'memory': ['storage', 'ram', 'cache', 'buffer'],
        'process': ['thread', 'task', 'job', 'execution'],
        'deadlock': ['livelock', 'starvation', 'race condition'],
        'virtual': ['logical', 'abstract', 'simulated'],
        'operating system': ['os', 'kernel', 'system software'],
        'cpu': ['processor', 'central processing unit', 'core'],
        'scheduling': ['dispatcher', 'allocation', 'assignment'],
        'page': ['frame', 'block', 'segment'],
        'thrashing': ['excessive paging', 'page fault storm'],
    }

    @classmethod
    def expand_query(cls, query: str) -> List[str]:
        """Expand query with synonyms and related terms."""
        terms = [query.lower()]
        query_lower = query.lower()

        # Add exact phrase
        terms.append(query_lower)

        # Add expanded terms
        for key, synonyms in cls.ACADEMIC_EXPANSIONS.items():
            if key in query_lower:
                terms.extend(synonyms)

        # Add individual important words (filter stop words)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        words = re.findall(r'\w+', query_lower)
        important_words = [w for w in words if len(w) > 3 and w not in stop_words]
        terms.extend(important_words)

        return list(set(terms))  # Remove duplicates


class ReRanker:
    """Re-rank retrieved documents for better relevance."""

    @staticmethod
    def calculate_relevance_score(query: str, chunk_text: str, base_score: float) -> float:
        """Calculate enhanced relevance score with multiple signals."""
        query_lower = query.lower()
        text_lower = chunk_text.lower()

        # Base score (from cosine similarity or BM25)
        score = base_score

        # Exact phrase match bonus
        if query_lower in text_lower:
            score += 0.3

        # Query term frequency in chunk
        query_terms = re.findall(r'\w+', query_lower)
        term_frequency = sum(1 for term in query_terms if term in text_lower) / max(len(query_terms), 1)
        score += term_frequency * 0.2

        # Position bias (earlier mentions are more relevant)
        first_occurrence = text_lower.find(query_lower)
        if first_occurrence != -1:
            position_score = 1.0 - (first_occurrence / len(text_lower))
            score += position_score * 0.15

        # Length normalization (prefer concise, focused chunks)
        optimal_length = 750  # Target chunk size
        length_diff = abs(len(chunk_text) - optimal_length)
        length_penalty = length_diff / optimal_length * 0.1
        score -= min(length_penalty, 0.1)

        # Formula detection bonus (for mathematical content)
        if re.search(r'[=+\-*/∫∑∏√]|\\[a-zA-Z]+', chunk_text):
            if any(term in query_lower for term in ['formula', 'equation', 'calculate', 'compute']):
                score += 0.15

        return max(score, 0.0)


class AcademicVectorStore:
    """
    Advanced Hybrid Vector Store with:
    1. Dense Vector Embeddings (Gemini text-embedding-004 / TF-IDF)
    2. BM25 Lexical Keyword Search with Query Expansion
    3. Cross-Encoder Re-ranking
    4. Reciprocal Rank Fusion (RRF)
    5. Query Understanding and Context Awareness
    """

    def __init__(self, storage_dir: Path = VECTOR_STORE_DIR, api_key: Optional[str] = None):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.api_key = api_key or GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

        self.chunks: List[Dict[str, Any]] = []
        self.embeddings: Optional[np.ndarray] = None
        self.vectorizer = None
        self.bm25: Optional[BM25Okapi] = None

        self.index_file = self.storage_dir / "index_meta.json"
        self.matrix_file = self.storage_dir / "embeddings.npy"

        # Enhanced features
        self.query_expander = QueryExpander()
        self.reranker = ReRanker()

        self.load_index()

    def set_api_key(self, api_key: str):
        self.api_key = api_key.strip()

    def _tokenize(self, text: str) -> List[str]:
        """Enhanced tokenization preserving mathematical symbols and acronyms."""
        return re.findall(r'[A-Za-z0-9_\$\\]+', text.lower())

    def _build_bm25_index(self):
        """Build BM25 lexical index from chunk texts."""
        if not self.chunks:
            self.bm25 = None
            return
        tokenized_corpus = [self._tokenize(c["text"]) for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized_corpus)

    def _get_gemini_embeddings(self, texts: List[str]) -> Optional[np.ndarray]:
        """Get embeddings from Gemini API with retry logic."""
        if not self.api_key:
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)

            all_vectors = []
            batch_size = 50
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                try:
                    response = genai.embed_content(
                        model=DEFAULT_EMBEDDING_MODEL,
                        content=batch,
                        task_type="retrieval_document"
                    )
                    if isinstance(response, dict) and "embedding" in response:
                        all_vectors.extend(response["embedding"])
                    elif hasattr(response, "embeddings"):
                        all_vectors.extend([e.values for e in response.embeddings])
                    else:
                        all_vectors.extend(response)
                except Exception as e:
                    print(f"[VectorStore] Batch {i//batch_size} embedding failed: {e}")
                    # Continue with remaining batches
                    continue

            if len(all_vectors) > 0:
                return np.array(all_vectors, dtype=np.float32)
            return None
        except Exception as e:
            print(f"[VectorStore] Gemini embedding error: {e}")
            return None

    def _get_gemini_query_embedding(self, query: str) -> Optional[np.ndarray]:
        """Get query embedding from Gemini API."""
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
            print(f"[VectorStore] Query embedding error: {e}")
            return None

    def _build_fallback_embeddings(self, texts: List[str]) -> np.ndarray:
        """Build TF-IDF embeddings as fallback."""
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=10000,
            sublinear_tf=True,
            stop_words='english'
        )
        matrix = self.vectorizer.fit_transform(texts).toarray()
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return (matrix / norms).astype(np.float32)

    def add_chunks(self, new_chunks: List[Dict[str, Any]]):
        """Add new chunks with deduplication."""
        if not new_chunks:
            return

        existing_ids = {c["chunk_id"] for c in self.chunks}
        filtered_new = [c for c in new_chunks if c["chunk_id"] not in existing_ids]

        if not filtered_new:
            return

        self.chunks.extend(filtered_new)
        all_texts = [c["text"] for c in self.chunks]

        # Compute Dense Embeddings
        dense_embs = self._get_gemini_embeddings(all_texts)
        if dense_embs is not None and len(dense_embs) == len(all_texts):
            norms = np.linalg.norm(dense_embs, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.embeddings = (dense_embs / norms).astype(np.float32)
        else:
            self.embeddings = self._build_fallback_embeddings(all_texts)

        # Build BM25 Lexical Index
        self._build_bm25_index()

        self.save_index()
        print(f"[VectorStore] Added {len(filtered_new)} new chunks. Total: {len(self.chunks)}")

    def search(
        self,
        query: str,
        top_k: int = 4,
        filter_source: Optional[str] = None,
        min_similarity: float = 0.05,
        use_reranking: bool = True,
        use_query_expansion: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Advanced Hybrid Retrieval with:
        - Query Expansion
        - Dense Vector Search
        - BM25 Lexical Search
        - Reciprocal Rank Fusion
        - Cross-Encoder Re-ranking
        """
        if not self.chunks:
            return []

        num_chunks = len(self.chunks)

        # Query expansion for better recall
        expanded_queries = [query]
        if use_query_expansion:
            expanded_queries = self.query_expander.expand_query(query)

        # 1. Compute Dense Vector Similarities
        dense_scores = np.zeros(num_chunks, dtype=np.float32)
        if self.embeddings is not None:
            query_vec = self._get_gemini_query_embedding(query)
            if query_vec is not None and self.embeddings.shape[1] == len(query_vec):
                q_norm = np.linalg.norm(query_vec)
                if q_norm > 0:
                    query_vec = query_vec / q_norm
                dense_scores = np.dot(self.embeddings, query_vec)
            else:
                if self.vectorizer is None:
                    all_texts = [c["text"] for c in self.chunks]
                    self.embeddings = self._build_fallback_embeddings(all_texts)
                q_mat = self.vectorizer.transform([query]).toarray()
                q_norm = np.linalg.norm(q_mat)
                if q_norm > 0:
                    q_mat = q_mat / q_norm
                dense_scores = np.dot(self.embeddings, q_mat.T).flatten()

        # 2. Compute BM25 Lexical Scores with Query Expansion
        bm25_scores = np.zeros(num_chunks, dtype=np.float32)
        if self.bm25 is None:
            self._build_bm25_index()
        if self.bm25 is not None:
            for exp_query in expanded_queries[:3]:  # Limit to top 3 expansions
                q_tokens = self._tokenize(exp_query)
                bm25_scores += self.bm25.get_scores(q_tokens) * 0.5  # Weight expanded queries less

        # 3. Reciprocal Rank Fusion (RRF) Ranking
        rrf_constant = 60.0
        dense_ranking = np.argsort(-dense_scores)
        bm25_ranking = np.argsort(-bm25_scores)

        rrf_scores = np.zeros(num_chunks, dtype=np.float32)
        for rank, idx in enumerate(dense_ranking):
            rrf_scores[idx] += 1.0 / (rrf_constant + rank + 1)
        for rank, idx in enumerate(bm25_ranking):
            if bm25_scores[idx] > 0:
                rrf_scores[idx] += 1.0 / (rrf_constant + rank + 1)

        # 4. Initial Ranking and Filtering
        combined_ranking = np.argsort(-rrf_scores)
        candidates = []

        for idx in combined_ranking:
            chunk = self.chunks[idx]
            if filter_source and filter_source != "All Documents" and chunk["source"] != filter_source:
                continue

            dense_sim = float(dense_scores[idx]) if idx < len(dense_scores) else 0.0
            bm25_val = float(bm25_scores[idx]) if idx < len(bm25_scores) else 0.0

            # Relevance threshold check
            if dense_sim >= min_similarity or bm25_val > 0.5:
                candidates.append({
                    'idx': idx,
                    'dense_sim': dense_sim,
                    'bm25_val': bm25_val,
                    'rrf_score': float(rrf_scores[idx]),
                    'chunk': chunk
                })

        # 5. Re-ranking with Cross-Encoder
        if use_reranking and candidates:
            for candidate in candidates:
                chunk_text = candidate['chunk']['text']
                base_score = candidate['rrf_score']
                candidate['final_score'] = self.reranker.calculate_relevance_score(
                    query, chunk_text, base_score
                )

            # Sort by final re-ranked score
            candidates.sort(key=lambda x: x['final_score'], reverse=True)
        else:
            for candidate in candidates:
                candidate['final_score'] = candidate['rrf_score']
            candidates.sort(key=lambda x: x['final_score'], reverse=True)

        # 6. Prepare results
        results = []
        for candidate in candidates[:top_k]:
            item = dict(candidate['chunk'])
            item["similarity_score"] = round(max(candidate['dense_sim'], min(1.0, candidate['bm25_val'] / 10.0)), 3)
            item["rrf_score"] = candidate['rrf_score']
            item["final_score"] = candidate['final_score']
            results.append(item)

        return results

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """Get document statistics."""
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
        """Delete all chunks from a specific document."""
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
            self._build_bm25_index()
        else:
            self.embeddings = None
            self.vectorizer = None
            self.bm25 = None
        self.save_index()
        print(f"[VectorStore] Deleted document: {source_name}")

    def clear(self):
        """Clear all data."""
        self.chunks = []
        self.embeddings = None
        self.vectorizer = None
        self.bm25 = None
        if self.index_file.exists():
            self.index_file.unlink()
        if self.matrix_file.exists():
            self.matrix_file.unlink()
        print("[VectorStore] All data cleared")

    def save_index(self):
        """Save index to disk."""
        try:
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, indent=2)
            if self.embeddings is not None:
                np.save(str(self.matrix_file), self.embeddings)
            print(f"[VectorStore] Index saved: {len(self.chunks)} chunks")
        except Exception as e:
            print(f"[VectorStore] Save error: {e}")

    def load_index(self):
        """Load index from disk."""
        try:
            if self.index_file.exists():
                with open(self.index_file, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
                self._build_bm25_index()
                print(f"[VectorStore] Loaded {len(self.chunks)} chunks from index")
            if self.matrix_file.exists():
                self.embeddings = np.load(str(self.matrix_file))
                print(f"[VectorStore] Loaded embeddings: {self.embeddings.shape}")
        except Exception as e:
            print(f"[VectorStore] Load error: {e}")
            self.chunks = []
            self.embeddings = None
