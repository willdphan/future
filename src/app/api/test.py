# run api: uvicorn src.app.api.test:app --reload
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import uvicorn

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Adjust this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key="sk-proj-sX4t00Nk2uUjaESNtp4iT3BlbkFJPQ4WZr6dXnOxQ5lnmfXz")

class Action(BaseModel):
    action: str

@app.post("/api/generate-outcomes")
async def generate_outcomes(action: Action):
    try:
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an assistant that generates possible outcomes for given actions."},
                {"role": "user", "content": f"Given the action: '{action.action}', list 4 possible outcomes. make them no longer than 10 words,  each on a new line:"}
            ]
        )
        outcomes = completion.choices[0].message.content.strip().split('\n')
        return {"outcomes": outcomes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))