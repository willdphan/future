import os
import re
import traceback
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from modal import Image, Secret, web_endpoint, App
import requests
from typing import List, Optional, Dict  # Add Dict here

app = App("fastapi-groq-api")

image = (
    Image.debian_slim()
    .pip_install("fastapi", "uvicorn", "groq", "pydantic", "requests")
)

# Hardcode the Groq API key (for development only)
GROQ_API_KEY = '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'

# Add EXA API key (make sure to set this in your environment or secrets)
EXA_API_KEY = os.environ.get('EXA_API_KEY', 'af5bcded-d8cd-4f27-938e-003b8a359e08')

class Query(BaseModel):
    query: str

class CodeSnippet(BaseModel):
    language: str
    code: str

class Outcome(BaseModel):
    option_number: int
    title: str
    description: str
    probability: float
    hyperlinks: List[Dict[str, str]] = []  
    code_snippets: List[CodeSnippet] = []

class OutcomesResponse(BaseModel):
    outcomes: List[Outcome]

class Groq:
    def __init__(self, api_key):
        self.api_key = api_key
        self.api_base = "https://api.groq.com/openai/v1"

    def chat_completions_create(self, messages, model, temperature, max_tokens):
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        response = requests.post(f"{self.api_base}/chat/completions", headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    
# Remove the global exception handler

@app.function(image=image)
@web_endpoint(method="POST")
def generate_outcomes(query: Query):
    try:
        print(f"Received query: {query.query}")
        
        # EXA API call
        exa_url = "https://api.exa.ai/search"
        exa_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {EXA_API_KEY}"
        }
        exa_payload = {
            "query": query.query,
            "num_results": 5,
            "use_autoprompt": True
        }

        try:
            exa_response = requests.post(exa_url, json=exa_payload, headers=exa_headers)
            exa_response.raise_for_status()
            exa_data = exa_response.json()
            print(f"EXA response: {exa_data}")
        except requests.RequestException as e:
            print(f"EXA API error: {str(e)}")
            exa_data = {"results": []}

        # Process EXA results
        exa_context = ""
        hyperlinks = []
        if 'results' in exa_data and isinstance(exa_data['results'], list):
            for result in exa_data['results']:
                exa_context += f"\nTitle: {result.get('title', '')}\nSnippet: {result.get('snippet', '')}\nURL: {result.get('url', '')}\n"
                hyperlinks.append(result.get('url', ''))
        
        print(f"Processed EXA context: {exa_context}")
        print(f"Hyperlinks: {hyperlinks}")

        # Set up Groq client
        client = Groq(api_key=GROQ_API_KEY)

        # Groq prompt including EXA context
        prompt = f"""You are an assistant that generates possible outcomes for given actions.
        Given the setting and action: '{query.query}', and considering this additional context:

        {exa_context}

        List 4-5 possible outcomes. For each outcome, provide:
        1. A short title (3-5 words)
        2. A detailed description (at least 500 words) explaining the outcome, its implications, and any relevant context. Use multiple paragraphs if necessary.
        3. The probability of occurring (as a percentage).
        4. Reference the provided URLs where appropriate in your description using HTML anchor tags like this: <a href="http://example.com">link text</a>. Use the actual URLs provided in the context. Must use sources to help provide possible outcomes in user's scenario in EVERY POSSIBLE OUTCOME.

        Format each outcome as follows:
        1. Title (XX%)
        Detailed description with hyperlinks...

        The probabilities should sum up to 100%.
        """

        try:
            chat_completion = client.chat_completions_create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="mixtral-8x7b-32768",
                temperature=0.7,
                max_tokens=4000,
            )
            groq_response = chat_completion['choices'][0]['message']['content']
            print(f"Groq response: {groq_response}")
        except Exception as e:
            error_msg = f"Error calling Groq API: {str(e)}"
            print(error_msg)
            return JSONResponse(status_code=500, content={"detail": error_msg})

        if not groq_response or len(groq_response.strip()) < 10:
            error_msg = "Failed to generate meaningful outcomes"
            print(error_msg)
            return JSONResponse(status_code=500, content={"detail": error_msg})

        try:
            outcomes = parse_outcomes_with_code_and_links(groq_response, hyperlinks)
        except Exception as e:
            error_msg = f"Error parsing outcomes: {str(e)}\nTraceback: {traceback.format_exc()}"
            print(error_msg)
            return JSONResponse(status_code=500, content={"detail": error_msg})

        if not outcomes:
            error_msg = "No outcomes were generated"
            print(error_msg)
            return JSONResponse(status_code=500, content={"detail": error_msg})

        print("Generated outcomes:")
        for outcome in outcomes:
            print(f"Option {outcome.option_number}: {outcome.title} - {outcome.description} ({outcome.probability}%)")
            print(f"Hyperlinks: {outcome.hyperlinks}")
            for snippet in outcome.code_snippets:
                print(f"Code snippet ({snippet.language}):\n{snippet.code}")

        return OutcomesResponse(outcomes=outcomes)

    except Exception as e:
        error_msg = f"Unexpected error in generate_outcomes: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(status_code=500, content={"detail": error_msg})

def parse_outcomes_with_code_and_links(response_text: str, hyperlinks: List[str]) -> List[Outcome]:
    outcomes = []
    lines = response_text.split('\n')
    current_outcome = None
    current_description = ""
    current_code_snippets = []
    current_hyperlinks = []

    for line in lines:
        title_match = re.match(r'(\d+)\.\s*(.*?)\s*\((\d+(?:\.\d+)?)%\)', line)
        code_start_match = re.match(r'\[CODE:(.*?)\]', line)
        code_end_match = re.match(r'\[/CODE\]', line)
        hyperlink_match = re.search(r'<a href="(.*?)">(.*?)</a>', line)
        
        if title_match:
            if current_outcome:
                outcomes.append(Outcome(
                    option_number=current_outcome[0],
                    title=current_outcome[1],
                    description=current_description.strip(),
                    probability=current_outcome[2],
                    hyperlinks=current_hyperlinks,
                    code_snippets=current_code_snippets
                ))
            option_number = int(title_match.group(1))
            title = title_match.group(2)
            probability = float(title_match.group(3))
            current_outcome = (option_number, title, probability)
            current_description = ""
            current_code_snippets = []
            current_hyperlinks = []
        elif code_start_match:
            language = code_start_match.group(1)
            code_content = ""
        elif code_end_match:
            current_code_snippets.append(CodeSnippet(language=language, code=code_content.strip()))
        elif hyperlink_match:
            url = hyperlink_match.group(1)
            text = hyperlink_match.group(2)
            current_hyperlinks.append({"url": url, "text": text})
            current_description += line + "\n"
        elif current_outcome:
            if code_start_match:
                code_content += line + "\n"
            else:
                current_description += line + "\n"

    if current_outcome:
        outcomes.append(Outcome(
            option_number=current_outcome[0],
            title=current_outcome[1],
            description=current_description.strip(),
            probability=current_outcome[2],
            hyperlinks=current_hyperlinks,
            code_snippets=current_code_snippets
        ))

    return outcomes

@app.function(image=image)
@web_endpoint()
def fastapi_app():
    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.post("/generate-outcomes", response_model=OutcomesResponse)(generate_outcomes.apply)

    return app

# To run locally for testing
if __name__ == "__main__":
    app.serve()

# To deploy
# Run: modal deploy src/app/api/groq.py

# curl -X POST https://willdphan--fastapi-groq-api-generate-outcomes.modal.run -H "Content-Type: application/json" -d '{"query": "test query"}'