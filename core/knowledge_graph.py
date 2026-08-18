import re
import json
from typing import Dict, List, Any, Optional

class KnowledgeGraphGenerator:
    """
    Constructs an interactive force-directed concept mind-map and knowledge graph
    from syllabus documents, chunk indices, and topic relationships.
    """
    def __init__(self, vector_store=None):
        self.vector_store = vector_store

    def build_graph(self, filter_source: Optional[str] = None) -> Dict[str, Any]:
        """
        Builds graph topology (nodes and links) from available vector store chunks
        or preloaded academic domain structures.
        """
        nodes = []
        links = []
        node_ids = set()

        def add_node(nid, label, group, size=18, chapter="Core", desc="", formula=""):
            if nid not in node_ids:
                nodes.append({
                    "id": nid,
                    "label": label,
                    "group": group,
                    "size": size,
                    "chapter": chapter,
                    "description": desc,
                    "formula": formula
                })
                node_ids.add(nid)

        def add_link(source, target, relationship="related_to", strength=1.0):
            links.append({
                "source": source,
                "target": target,
                "relationship": relationship,
                "strength": strength
            })

        # 1. Root & Core Chapters
        add_node("root", "Course Syllabus", "root", size=32, chapter="Overview", desc="Root curriculum domain")
        
        # 2. Operating Systems & Computer Science Concepts
        add_node("ch_memory", "Memory Management", "chapter", size=26, chapter="Chapter 1", desc="Virtual memory, paging, segmentation, and address translation.")
        add_node("ch_deadlocks", "Deadlocks & Concurrency", "chapter", size=26, chapter="Chapter 2", desc="Deadlock characterization, avoidance, banker's algorithm, and recovery.")
        add_node("ch_scheduling", "CPU Scheduling", "chapter", size=24, chapter="Chapter 3", desc="Process scheduling algorithms, preemptive/non-preemptive, and turnarounds.")
        add_node("ch_storage", "Storage & File Systems", "chapter", size=24, chapter="Chapter 4", desc="Disk scheduling, inodes, file allocation methods, and caching.")

        add_link("root", "ch_memory", "contains", 1.0)
        add_link("root", "ch_deadlocks", "contains", 1.0)
        add_link("root", "ch_scheduling", "contains", 1.0)
        add_link("root", "ch_storage", "contains", 1.0)

        # 3. Sub-concepts for Memory Management
        add_node("paging", "Paging & Page Tables", "concept", size=20, chapter="Chapter 1", desc="Fixed-size memory partitioning using Page Tables and Frames.")
        add_node("tlb", "Translation Lookaside Buffer (TLB)", "concept", size=20, chapter="Chapter 1", desc="High-speed associative hardware cache for page table lookups.")
        add_node("emat", "Effective Memory Access Time (EMAT)", "formula", size=22, chapter="Chapter 1", desc="Formula determining memory latency with TLB hit ratios.", formula="EMAT = h * (c + m) + (1 - h) * (c + 2m)")
        add_node("page_replacement", "Page Replacement Policies", "concept", size=20, chapter="Chapter 1", desc="FIFO, LRU, and Optimal algorithms handling page faults.")
        add_node("lru", "LRU Algorithm", "algorithm", size=18, chapter="Chapter 1", desc="Evicts the least recently used page to minimize future faults.")
        add_node("belady", "Belady's Anomaly", "concept", size=18, chapter="Chapter 1", desc="Phenomenon in FIFO where increasing frames increases page faults.")

        add_link("ch_memory", "paging", "subconcept", 0.9)
        add_link("paging", "tlb", "hardware_accelerator", 0.9)
        add_link("tlb", "emat", "governs", 1.0)
        add_link("ch_memory", "page_replacement", "subconcept", 0.9)
        add_link("page_replacement", "lru", "implements", 0.8)
        add_link("page_replacement", "belady", "exhibits_in_fifo", 0.8)

        # 4. Sub-concepts for Deadlocks & Concurrency
        add_node("coffman", "4 Coffman Conditions", "concept", size=20, chapter="Chapter 2", desc="Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.")
        add_node("bankers", "Banker's Algorithm", "algorithm", size=22, chapter="Chapter 2", desc="Dijkstra's deadlock avoidance algorithm testing safe state vectors.", formula="Need[i][j] = Max[i][j] - Allocation[i][j]")
        add_node("safe_state", "Safe State Verification", "concept", size=18, chapter="Chapter 2", desc="State where an execution sequence exists preventing deadlocks.")
        add_node("semaphores", "Semaphores & Mutex", "concept", size=20, chapter="Chapter 2", desc="Synchronization primitives: wait() (P) and signal() (V).")

        add_link("ch_deadlocks", "coffman", "characterized_by", 1.0)
        add_link("ch_deadlocks", "bankers", "avoidance_method", 1.0)
        add_link("bankers", "safe_state", "ensures", 0.9)
        add_link("ch_deadlocks", "semaphores", "synchronization", 0.8)

        # 5. Sub-concepts for CPU Scheduling
        add_node("round_robin", "Round Robin (RR)", "algorithm", size=18, chapter="Chapter 3", desc="Preemptive time-sliced CPU scheduling based on a quantum.")
        add_node("sjf", "Shortest Job First (SJF)", "algorithm", size=18, chapter="Chapter 3", desc="Minimizes average waiting time; optimal non-preemptive schedule.")
        add_node("priority_sched", "Priority Scheduling & Aging", "concept", size=18, chapter="Chapter 3", desc="Prevents starvation by gradually increasing waiting priority.")

        add_link("ch_scheduling", "round_robin", "algorithm", 0.8)
        add_link("ch_scheduling", "sjf", "algorithm", 0.8)
        add_link("ch_scheduling", "priority_sched", "solves_starvation", 0.8)

        # 6. Extract dynamic concepts from vector store if documents are loaded
        if self.vector_store and len(self.vector_store.chunks) > 0:
            for i, chunk in enumerate(self.vector_store.chunks[:10]):
                txt = chunk.get("text", "")
                # Find capitalized key terms
                terms = re.findall(r'\b[A-Z][a-zA-Z]{3,}(?:\s+[A-Z][a-zA-Z]+)?\b', txt)
                for term in terms[:2]:
                    term_id = "dyn_" + re.sub(r'\W+', '_', term.lower())
                    if term_id not in node_ids and len(term) > 4:
                        add_node(
                            term_id,
                            term,
                            "dynamic",
                            size=16,
                            chapter=chunk.get("source", "Syllabus"),
                            desc=f"Extracted from {chunk.get('source')} (Page {chunk.get('page')})"
                        )
                        # Link to a relevant chapter
                        if "memory" in txt.lower() or "page" in txt.lower():
                            add_link("ch_memory", term_id, "mentions", 0.6)
                        elif "deadlock" in txt.lower() or "process" in txt.lower():
                            add_link("ch_deadlocks", term_id, "mentions", 0.6)
                        else:
                            add_link("root", term_id, "references", 0.5)

        return {
            "nodes": nodes,
            "links": links,
            "stats": {
                "total_nodes": len(nodes),
                "total_links": len(links),
                "chapters_count": 4
            }
        }
