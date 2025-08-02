import os
import logging
import re

from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import mysql.connector
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from functools import lru_cache
from sentence_transformers import SentenceTransformer
import numpy as np

embedding_model = SentenceTransformer('all-mpnet-base-v2')

# Load .env
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
REJECT_MESSAGE = "Xin lỗi! Hiện tại tôi chưa thể trả lời câu hỏi của bạn do kiến thức nằm ngoài dữ liệu tôi đang có.\n" \
                 "Vui lòng đợi hệ thống cập nhật hoặc liên hệ giáo viên Tin học của trường để được giải đáp.\n" \
                 " Xin cảm ơn!"

# MySQL config
MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST"),
    "user": os.getenv("MYSQL_USER"),
    "password": os.getenv("MYSQL_PASSWORD"),
    "database": os.getenv("MYSQL_DB"),
}

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class ChatPayload(BaseModel):
    session_id: str
    messages: List[dict]

# Caching QA

def get_cached_qa_pairs():
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT cauhoi, cautraloi, danhmuc FROM data")
        rows = cursor.fetchall()
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"❌ DB load error: {e}")
        return []

def get_vectorizer_and_matrix(qa_pairs, is_answer = False):
    # qa_pairs = get_cached_qa_pairs()
    data = [q.lower() for q, _, _ in qa_pairs]
    if is_answer:
        data = [a.lower() for _, a, _ in qa_pairs] 
    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform(data)
    return vectorizer, tfidf_matrix

def find_best_match(query, qa_pairs, is_answer = False):
    if not qa_pairs:
        return None, 0.0, None
    vectorizer, tfidf_matrix = get_vectorizer_and_matrix(qa_pairs, is_answer=is_answer)
    query_vec = vectorizer.transform([query.lower()])
    sims = cosine_similarity(query_vec, tfidf_matrix).flatten()
    idx = sims.argmax()
    score = sims[idx]
    new_request = [{'role': 'user', 'content': f'Chuyển câu hỏi và câu trả lời sau thành một câu trần thuật hoàn chỉnh và tự nhiên: "Câu hỏi: {qa_pairs[idx][0]} - Trả lời: {qa_pairs[idx][1]}"'}]
    completion = client.chat.completions.create(model="gpt-4o-mini", messages=new_request)
    answer = completion.choices[0].message.content
    return answer, score, idx

# def find_best_match_for_single(query, candidate, threshold=0.5):
#     """So sánh query với một candidate duy nhất bằng cosine similarity."""
#     vectorizer = TfidfVectorizer()
#     tfidf_matrix = vectorizer.fit_transform([query, candidate])
#     sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2]).flatten()
#     score = sims[0]
#     return candidate, score

def verify_answer_generated(session_id, reply, user_message, context, qa_pairs):
    final_answer = REJECT_MESSAGE
    answer, score, matched_index = find_best_match(reply, qa_pairs, is_answer = True)
    print(f"%%%%%% {2 + score} %%%%%%%%")
    if score >= 0.3:
        final_answer = aggregate_information(context, answer, user_message)
        score_h = hallucination_score(final_answer, answer)
    else:
        score_h = 0
    if score_h >= 0.6:
        final_answer = REJECT_MESSAGE
    print(f"~~~~~~ generate answer {reply} ~~~~~~~~")
    print(f"~~~~~~ answer từ hệ thống {answer} ~~~~~~~~")
    save_message_to_db(session_id, "user", user_message, danhmuc=0, hallucination_score = score_h)
    save_message_to_db(session_id, "assistant", final_answer, danhmuc=0, hallucination_score = score_h)

    return final_answer, score

def aggregate_information(context, answer, user_message):
    msg = f'Dựa vào thông tin "{answer}" được gợi ý từ hệ thống.' \
          f' Hãy đưa ra phản hồi cho câu hỏi "{user_message}", chỉ nêu trả lời đúng trọng tâm câu hỏi, không phân tích hay giải thích gì thêm'
    new_request = {'role': 'user', 'content': msg}
    context = context[:-1] + [new_request]
    completion = client.chat.completions.create(model="gpt-4o-mini", messages=context)
    reply = completion.choices[0].message.content
    print(f"##################### aggregate_information answer từ hệ thống: {answer} #####################")
    print(f"...........aggregate_informa answer cuối cùng: {reply} .....................")
    return reply

def split_sentences(text):
    # Tách câu đơn giản bằng dấu chấm, chấm hỏi, chấm than
    sentences = re.split(r'(?<=[.!?])\s+|\n+', text.strip())
    return [s.lower() for s in sentences if s]

def hallucination_score(final_answer, core_answer):
    sentences = split_sentences(final_answer)
    
    # Nếu chỉ có 1 câu, xử lý như cũ
    if len(sentences) == 1:
        vectorizer = TfidfVectorizer()
        vectorizer.fit([final_answer.lower(), core_answer.lower()])
        final_vec = vectorizer.transform([final_answer.lower()])
        core_vec = vectorizer.transform([core_answer.lower()])
        similarity = cosine_similarity(final_vec, core_vec)[0][0]
        return float(1 - similarity)
    
    # Nếu có nhiều câu, so sánh từng câu với core_answer
    similarities = []
    for sent in sentences:
        vectorizer = TfidfVectorizer()
        vectorizer.fit([sent.lower(), core_answer.lower()])
        sent_vec = vectorizer.transform([sent.lower()])
        core_vec = vectorizer.transform([core_answer.lower()])
        sim = cosine_similarity(sent_vec, core_vec)[0][0]
        similarities.append(sim)

    max_sim = max(similarities)
    return float(1 - max_sim)

# def save_message_to_db(session_id: str, role: str, content: str):
#     try:
#         conn = mysql.connector.connect(**MYSQL_CONFIG)
#         cursor = conn.cursor()
#         cursor.execute(
#             "INSERT INTO chat_history (session_id, role, content) VALUES (%s, %s, %s)",
#             (session_id, role, content)
#         )
#         conn.commit()
#         conn.close()
#     except Exception as e:
#         logger.error(f"❌ DB save error: {e}")
def save_message_to_db(session_id: str, role: str, content: str, danhmuc: int = 0, hallucination_score: float = 0):
    """
    Lưu tin nhắn cùng danhmuc vào bảng chat_history.
    danhmuc = 0 nếu câu trả lời ngoài knowledge base (từ GPT).
    """
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO chat_history (session_id, role, content, danhmuc, hallucination_score) 
            VALUES (%s, %s, %s, %s, %s)
            """,
            (session_id, role, content, danhmuc, hallucination_score),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"❌ DB save error: {e}")



@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/history/{session_id}")
def get_history(session_id: str):
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT role, content FROM chat_history WHERE session_id = %s ORDER BY created_at ASC",
            (session_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return {"messages": rows}
    except Exception as e:
        logger.error(f"❌ DB history load error: {e}")
        return {"messages": []}

@app.post("/chat")
async def chat(payload: ChatPayload, request: Request):
    body = await request.body()
    logger.info(f"📦 Payload: {body.decode('utf-8')}")
    session_id = payload.session_id
    user_message = payload.messages[-1]['content']
    qa_pairs = get_cached_qa_pairs()
    
    if not qa_pairs:
        score = 0
    answer, score, matched_index = find_best_match(user_message, qa_pairs)

    logger.info(f"🔍 TF-IDF score: {score:.2f} | {user_message}")

    # Lưu tin nhắn user
    #save_message_to_db(session_id, "user", user_message)
    print(f"\n\n Start new session \n\n")
    print(f"%%%%%% {1 + score} %%%%%%%%")
    if score >= 0.6:
        # Khi match được trong knowledge base
        # matched_index = None
        # vectorizer, tfidf_matrix = get_vectorizer_and_matrix()
        # sims = cosine_similarity(vectorizer.transform([user_message]), tfidf_matrix).flatten()
        # matched_index = sims.argmax()
        danhmuc = qa_pairs[matched_index][2] if matched_index is not None and len(qa_pairs[matched_index]) > 2 else 0
        context = payload.messages[-3:] if len(payload.messages) > 3 else payload.messages
        final_answer = aggregate_information(context, answer, user_message)
        score_h = hallucination_score(final_answer, answer)
        if score_h >= 0.6:
            final_answer = REJECT_MESSAGE
        save_message_to_db(session_id, "user", user_message, danhmuc=danhmuc, hallucination_score = score_h)
        save_message_to_db(session_id, "assistant", final_answer, danhmuc=danhmuc, hallucination_score = score_h)
        return {"response": final_answer, "source": "knowledge_base", "similarity": round(score, 2)}
    else:
        # Khi GPT tạo câu trả lời
        try:
            context = payload.messages[-3:] if len(payload.messages) > 3 else payload.messages
            print(f"=============================context: {context}==========================")
            completion = client.chat.completions.create(model="gpt-4o-mini", messages=context)
            reply = completion.choices[0].message.content
            final_answer, score = verify_answer_generated(session_id, reply, user_message, context, qa_pairs)
            return {"response": final_answer, "source": "gpt", "similarity": round(score, 2)}
        except Exception as e:
            logger.error(f"❌ GPT error: {e}")
            return {"response": f"❌ Lỗi khi gọi GPT: {e}", "source": "error"}

@app.get("/chat/grouped-unknown")
def get_grouped_unknown_questions_embedding():
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, role, content AS cauhoi 
            FROM chat_history 
            WHERE danhmuc = 0 AND id NOT IN (SELECT chat_history_id FROM mapping_data)
        """)
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        logger.error(f"❌ Lỗi khi tải chat_history: {e}")
        return {"groups": []}

    if not rows:
        return {"groups": []}

    # Encode tất cả câu hỏi
    questions = [row["cauhoi"] for row in rows if row['role'] == 'user']
    answers = [row["cauhoi"] for row in rows if row['role'] == 'assistant']
    embeddings = embedding_model.encode(questions)
    # answer_embeddings = embedding_model.encode(answers)
    new_rows = [row for row in rows if row['role'] == 'user']

    groups = []
    for idx, record in enumerate(new_rows):
        matched_index = None
        best_score = 0.0
        for i, group in enumerate(groups):
            sim_score = cosine_similarity(
                embeddings[idx].reshape(1, -1),
                group["embedding"].reshape(1, -1)
            )[0][0]

            if sim_score > best_score:
                best_score = sim_score
                matched_index = i

        if best_score >= 0.5:
            groups[matched_index]["ids"].append(record["id"])
            groups[matched_index]["count"] += 1
        else:
            groups.append({
                "representative": record["cauhoi"],
                "count": 1,
                "ids": [record["id"]],
                "embedding": embeddings[idx],
                "answers" : answers[idx]
            })

    # Loại bỏ embedding trước khi return
    result = []
    for group in groups:
        result.append({
            "representative": group["representative"],
            "count": group["count"],
            "ids": group["ids"],
            "answers": group["answers"]
        })

    return {"groups": result}