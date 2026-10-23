import numpy as np
from fastembed import TextEmbedding

model = TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir="./models_cache")

docs = [
    "Please do not eat for 4 hours before a CT scan with contrast agent.",
    "The CT scan itself usually takes only a few minutes.",
    "Please remove jewelry, glasses and metal objects from the area being scanned.",
    "After receiving contrast agent, you should drink plenty of water.",
]
questions = [
    "Can I eat before my scan?",
    "How long does it take?",
    "Do I have to take off my earrings?",
    "What should I do afterwards?",
    "Where is the cafeteria?",
]

d = np.array(list(model.embed(docs)));      d /= np.linalg.norm(d, axis=1, keepdims=True)
q = np.array(list(model.embed(questions))); q /= np.linalg.norm(q, axis=1, keepdims=True)

for i, question in enumerate(questions):
    scores = d @ q[i]
    best = int(np.argmax(scores))
    print(f"\nQ: {question}\n-> {docs[best]}  (score {scores[best]:.2f})")
