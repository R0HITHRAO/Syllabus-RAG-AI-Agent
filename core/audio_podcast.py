import os
import json
import re
from typing import List, Dict, Any, Optional
from core.config import DEFAULT_MODEL
from core.vector_store import AcademicVectorStore

class AudioPodcastGenerator:
    """
    NotebookLM-Style 2-Host Audio Deep Dive Podcast Synthesizer.
    Generates realistic, conversational study podcasts between two AI hosts:
    - Alex (Host 1): Curious, intuitive Concept Explorer.
    - Taylor (Host 2): Analytical, technical Engineering Specialist.
    """

    def __init__(self, vector_store: AcademicVectorStore, model_name: str = DEFAULT_MODEL):
        self.vector_store = vector_store
        self.model_name = model_name

    def generate_podcast_script(self, topic: str = "Key Course Concepts", filter_source: Optional[str] = None) -> Dict[str, Any]:
        """Generate structured 2-host podcast dialogue script."""
        chunks = self.vector_store.search(topic, top_k=6, filter_source=filter_source)
        context_str = "\n\n".join([f"[{c['source']} | Page {c['page']}]: {c['text']}" for c in chunks]) if chunks else ""

        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")

        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(
                    model_name=self.model_name,
                    system_instruction=(
                        "You are an executive producer creating a viral, engaging educational audio podcast "
                        "in the style of Google NotebookLM. Write a lively, conversational 2-host study dialogue between "
                        "Alex (curious, intuitive host) and Taylor (sharp, practical engineering co-host). "
                        "Make it sound completely natural with spoken banter, real-world analogies, and clear exam takeaways. "
                        "Return ONLY a valid JSON object matching the requested schema."
                    )
                )

                prompt = (
                    f"Target Topic: {topic}\n"
                    f"Verified Course Context:\n{context_str}\n\n"
                    "Generate a 6 to 8 turn podcast dialogue. Return JSON with this structure:\n"
                    "{\n"
                    '  "title": "Deep Dive: [Topic Name]",\n'
                    '  "summary": "Short 1-sentence episode summary",\n'
                    '  "dialogue": [\n'
                    '    {"speaker": "alex", "text": "Spoken line..."},\n'
                    '    {"speaker": "taylor", "text": "Spoken line..."}\n'
                    "  ]\n"
                    "}"
                )

                response = model.generate_content(prompt)
                raw_text = response.text.strip()
                json_match = re.search(r'\{[\s\S]*\}', raw_text)
                if json_match:
                    data = json.loads(json_match.group(0))
                    data["hosts"] = self._get_host_profiles()
                    return data
            except Exception as e:
                print(f"[AudioPodcast] Gemini call notice: {e}")

        # High-Quality Fallback Podcast Script
        return self._generate_builtin_podcast_script(topic, context_str)

    def _get_host_profiles(self) -> Dict[str, Any]:
        return {
            "alex": {
                "name": "Alex",
                "role": "Concept Explorer",
                "avatar": "🎙️",
                "pitch": 1.12,
                "rate": 1.02,
                "color": "#8b5cf6"
            },
            "taylor": {
                "name": "Taylor",
                "role": "Engineering Specialist",
                "avatar": "🎧",
                "pitch": 0.88,
                "rate": 0.98,
                "color": "#06b6d4"
            }
        }

    def _generate_builtin_podcast_script(self, topic: str, context_str: str) -> Dict[str, Any]:
        topic_clean = topic.strip().title()

        if "deadlock" in topic.lower() or "banker" in topic.lower():
            dialogue = [
                {
                    "speaker": "alex",
                    "text": f"Welcome back to the SyllabusAI Deep Dive! Today, Taylor and I are breaking down {topic_clean}. Taylor, deadlocks sound scary—what's the core intuition?"
                },
                {
                    "speaker": "taylor",
                    "text": "Think of a busy four-way intersection where four cars arrive at the exact same second, and each car is waiting for the one on their right to move. Nobody can proceed. That's a classic deadlock!"
                },
                {
                    "speaker": "alex",
                    "text": "Right, so in computer terms, processes are holding onto resources while waiting for resources held by others. And there are four specific conditions that make this happen, right?"
                },
                {
                    "speaker": "taylor",
                    "text": "Exactly! The Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. If you break even one of those four links, deadlock is mathematically impossible."
                },
                {
                    "speaker": "alex",
                    "text": "And that leads us straight to Dijkstra's Banker's Algorithm. How does that prevent the system from getting into trouble?"
                },
                {
                    "speaker": "taylor",
                    "text": "The algorithm acts just like a cautious bank teller. It only grants a loan if it can guarantee that all customers can eventually be satisfied in a Safe Sequence. Never enter an Unsafe State!"
                },
                {
                    "speaker": "alex",
                    "text": "That's such a clean way to remember it for exam day. Break circular wait, or use the Banker's safety check to stay in a safe sequence. Awesome recap, Taylor!"
                }
            ]
        elif "memory" in topic.lower() or "page" in topic.lower() or "emat" in topic.lower():
            dialogue = [
                {
                    "speaker": "alex",
                    "text": f"Welcome to our study session on {topic_clean}! Taylor, virtual memory translation can feel overwhelming with all the address splits. How do you visualize it?"
                },
                {
                    "speaker": "taylor",
                    "text": "Think of the CPU's logical address as a book index with a chapter number and page number. The Memory Management Unit translates that page into a physical frame in RAM."
                },
                {
                    "speaker": "alex",
                    "text": "And to speed that lookup up, we have the Translation Lookaside Buffer, or TLB. What happens when we calculate Effective Memory Access Time?"
                },
                {
                    "speaker": "taylor",
                    "text": "That's the famous EMAT formula! If alpha is our hit ratio, EMAT equals epsilon plus main memory access time, plus an extra memory penalty times one minus alpha on a TLB miss."
                },
                {
                    "speaker": "alex",
                    "text": "So a higher TLB hit ratio directly protects us from the costly double-memory lookup penalty! And what about Belady's Anomaly in FIFO replacement?"
                },
                {
                    "speaker": "taylor",
                    "text": "Belady's Anomaly is a classic exam favorite: with pure FIFO, adding more physical frames can paradoxically increase page faults! That's why LRU and Optimal page replacement are so crucial."
                },
                {
                    "speaker": "alex",
                    "text": "Brilliant breakdown. Keep your TLB hit ratio high, watch out for Belady's in FIFO, and remember the EMAT weighted average formula!"
                }
            ]
        else:
            dialogue = [
                {
                    "speaker": "alex",
                    "text": f"Hey everyone, welcome to our audio deep dive on {topic_clean}! Taylor, what is the absolute most important takeaway students need to know here?"
                },
                {
                    "speaker": "taylor",
                    "text": "The key is understanding the fundamental trade-off. Every algorithmic system balances time complexity, space overhead, and hardware constraints."
                },
                {
                    "speaker": "alex",
                    "text": "And when reviewing the lecture notes, looking at how the primary equations and definitions connect makes solving practice exam problems so much easier."
                },
                {
                    "speaker": "taylor",
                    "text": "100%! Always write down the given variables first, check boundary conditions, and verify your steps against standard edge cases."
                },
                {
                    "speaker": "alex",
                    "text": "Fantastic advice! That wraps up our quick deep dive. Head over to the Exam Arena to test yourself on these exact concepts!"
                }
            ]

        return {
            "title": f"Deep Dive: {topic_clean}",
            "summary": f"A dynamic 2-host conversational masterclass breaking down {topic_clean} with practical analogies and exam strategies.",
            "hosts": self._get_host_profiles(),
            "dialogue": dialogue
        }
