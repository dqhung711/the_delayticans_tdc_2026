import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Optional[dict] = None

@router.post("/chat")
async def chat(request: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    # Construct the prompt for Gemini
    # We'll convert the messages to Gemini's format
    contents = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg.content}]
        })

    # Add system instruction if needed
    system_instruction = "You are a helpful assistant for the TTC Delay Tracker app. You help users understand transit delay data for Toronto buses and streetcars. Be concise and professional."
    
    payload = {
        "contents": contents,
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 1024,
        }
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(GEMINI_URL, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            
            # Extract the response text
            if "candidates" in data and len(data["candidates"]) > 0:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return {"role": "assistant", "content": text}
            else:
                raise HTTPException(status_code=500, detail="Invalid response from Gemini API")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Gemini API error: {e.response.text}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
