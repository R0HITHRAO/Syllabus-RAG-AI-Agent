import urllib.request, json

base = 'http://localhost:8000'

def test_get(path):
    try:
        r = urllib.request.urlopen(f'{base}{path}', timeout=5)
        return f'OK: {r.status}'
    except Exception as e:
        return f'ERROR: {type(e).__name__}: {str(e)[:60]}'

def test_post(path, data=None):
    try:
        body = json.dumps(data).encode() if data is not None else None
        headers = {'Content-Type': 'application/json'} if data is not None else {}
        req = urllib.request.Request(f'{base}{path}', data=body, headers=headers, method='POST')
        r = urllib.request.urlopen(req, timeout=10)
        return f'OK: {r.status}'
    except Exception as e:
        return f'ERROR: {type(e).__name__}: {str(e)[:60]}'

print('=== COMPREHENSIVE API TESTS ===')
print()
print('Health & Status:')
print(f'  {test_get("/api/status")}')
print(f'  {test_get("/api/graph/data")}')
print(f'  {test_get("/api/analytics/overview")}')
print(f'  {test_get("/api/agent/personas")}')
print()
print('Chat (Agent Mode):')
print(f'  {test_post("/api/chat", {"query": "Hello world", "mode": "agent", "persona": "general"})}')
print(f'  {test_post("/api/chat/stream", {"query": "Hello world", "mode": "agent", "persona": "general"})}')
print()
print('Quiz System:')
print(f'  Generate: {test_post("/api/quiz/generate", {"topic": "Memory Management", "num_questions": 2, "difficulty": "easy"})}')
print(f'  Submit: {test_post("/api/quiz/submit", {"quiz": [{"id": 1, "question": "q", "options": [], "correct_option": "A"}], "user_answers": {1: "A"}})}')
print(f'  Export: {test_post("/api/quiz/export", {"quiz": [{"id": 1, "question": "q?", "options": ["A. a", "B. b"], "correct_option": "A", "explanation": "ans", "source_doc": "s", "source_page": 1}], "topic": "Test", "quiz_type": "MCQ", "include_answers": True})}')
print()
print('Study Tools:')
print(f'  Flashcards: {test_post("/api/flashcards", {"topic": "test", "num_cards": 2})}')
print(f'  Cheatsheet: {test_post("/api/cheatsheet", {})}')
print(f'  Podcast: {test_post("/api/podcast/generate", {"topic": "test"})}')
print()
print('Utilities:')
print(f'  Code Run: {test_post("/api/code/run", {"code": "print(42)"})}')
print(f'  Clear: {test_post("/api/clear", {})}')
print(f'  Config Key: {test_post("/api/config/key", {"api_key": "test123"})}')
print(f'  Sample Load: {test_post("/api/sample/load", {})}')
print()
print('=== TEST SUMMARY ===')
path_names = [
    '/api/status', '/api/graph/data', '/api/analytics/overview', '/api/agent/personas',
    '/api/chat', '/api/chat/stream', '/api/quiz/generate', '/api/quiz/submit',
    '/api/quiz/export', '/api/flashcards', '/api/cheatsheet', '/api/podcast/generate',
    '/api/code/run', '/api/clear', '/api/config/key', '/api/sample/load',
]
results = [
    test_get('/api/status'),
    test_get('/api/graph/data'),
    test_get('/api/analytics/overview'),
    test_get('/api/agent/personas'),
    test_post('/api/chat', {'query': 'Hello', 'mode': 'agent'}),
    test_post('/api/chat/stream', {'query': 'Hello', 'mode': 'agent'}),
    test_post('/api/quiz/generate', {'topic': 'test', 'num_questions': 2, 'difficulty': 'easy'}),
    test_post('/api/quiz/submit', {'quiz': [], 'user_answers': {}}),
    test_post('/api/quiz/export', {'quiz': [{'id': 1, 'question': 'q', 'options': ['A. a'], 'correct_option': 'A', 'explanation': 'e', 'source_doc': 's', 'source_page': 1}], 'topic': 'T', 'quiz_type': 'MCQ', 'include_answers': True}),
    test_post('/api/flashcards', {'topic': 'test', 'num_cards': 2}),
    test_post('/api/cheatsheet', {}),
    test_post('/api/podcast/generate', {'topic': 'test'}),
    test_post('/api/code/run', {'code': 'print(1)'}),
    test_post('/api/clear', {}),
    test_post('/api/config/key', {'api_key': 'test'}),
    test_post('/api/sample/load', {}),
]

passed = sum(1 for r in results if r.startswith('OK'))
failed = sum(1 for r in results if not r.startswith('OK'))
print(f'Passed: {passed}/{len(results)}')
print(f'Failed: {failed}/{len(results)}')

if failed > 0:
    print()
    print('Failed endpoints:')
    for i, r in enumerate(results):
        if not r.startswith('OK'):
            print(f'  {path_names[i]}: {r}')


