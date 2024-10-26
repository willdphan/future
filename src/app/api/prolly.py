# Create Keys
# modal secret create my-api-keys GROQ_API_KEY={key} EXA_API_KEY={key}

# Deploy
# Run: modal deploy src/app/api/prolly.py

import os
import re
import traceback
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import modal
from modal import Image, web_endpoint, App
import requests
from typing import List, Optional, Dict

# modal labs app name
app = App("fastapi-groq-api")

# install necessary packages
image = (
    Image.debian_slim()
    .pip_install("fastapi", "uvicorn", "groq", "pydantic", "requests")
)

###########
# CLASSES #
###########

class Query(BaseModel):
    query: str

class Outcome(BaseModel):
    option_number: int
    title: str
    description: str
    probability: float
    hyperlinks: List[Dict[str, str]] = []  

class OutcomesResponse(BaseModel):
    outcomes: List[Outcome]

# responsible for interacting with the Groq API.
# provides a method to create chat completions using the Groq language model.
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

# responsible for interacting with the Exa API.
# provides a method to perform searches using the Exa search engine.
class Exa:
    def __init__(self, api_key):
        self.api_key = api_key
        self.api_base = "https://api.exa.ai"

    def search(self, query, num_results=5, use_autoprompt=True):
        url = f"{self.api_base}/search"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "query": query,
            "num_results": num_results,
            "use_autoprompt": use_autoprompt
        }
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"EXA API error: {str(e)}")
            return {"results": []}
        
##########
# PROMPT #
##########

# Define the prompt template as a separate variable
OUTCOME_PROMPT_TEMPLATE = """You are an assistant that generates possible outcomes for given actions.
Given the setting and action: '{query}', and considering this additional context:

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

##############
# FUNCTIONS #
#############

# Process the results from the Exa API search
# Extracts titles and URLs from the search results
# Returns a formatted context string and a list of hyperlinks
def process_exa_results(exa_data):
    exa_context = ""
    hyperlinks = []
    if 'results' in exa_data and isinstance(exa_data['results'], list):
        for result in exa_data['results']:
            exa_context += f"\nTitle: {result.get('title', '')}\nURL: {result.get('url', '')}\n"
            hyperlinks.append(result.get('url', ''))
    return exa_context, hyperlinks

# Send a prompt to the Groq API and get the response
# Uses the Mixtral 8x7B model with specific parameters
# Returns the generated content or raises an error if the API call fails
def get_groq_response(client, prompt):
    try:
        chat_completion = client.chat_completions_create(
            messages=[{"role": "user", "content": prompt}],
            model="mixtral-8x7b-32768",
            temperature=0.7,
            max_tokens=4000,
        )
        return chat_completion['choices'][0]['message']['content']
    except Exception as e:
        raise ValueError(f"Error calling Groq API: {str(e)}")

# Parse the Groq API response into structured Outcome objects
def parse_outcomes_with_links(response_text: str, hyperlinks: List[str]) -> List[Outcome]:
    # Initialize lists to store outcomes and current outcome details
    outcomes = []
    current_outcome = None
    current_description = []
    current_hyperlinks = []

    # Process the response text line by line
    for line in response_text.split('\n'):
        # Check if line is a new outcome title
        if title_match := re.match(r'(\d+)\.\s*(.*?)\s*\((\d+(?:\.\d+)?)%\)', line):
            # 1. If there's a current outcome, add it to the outcomes list
            if current_outcome:
                outcomes.append(Outcome(
                    option_number=current_outcome[0],
                    title=current_outcome[1],
                    description='\n'.join(current_description).strip(),
                    probability=current_outcome[2],
                    hyperlinks=current_hyperlinks,
                ))
            # 2. Start a new outcome
            current_outcome = (int(title_match.group(1)), title_match.group(2), float(title_match.group(3)))
            current_description, current_hyperlinks = [], []

        # Check if line contains a hyperlink
        elif hyperlink_match := re.search(r'<a href="(.*?)">(.*?)</a>', line):
            url = hyperlink_match.group(1)
            text = hyperlink_match.group(2)
            # Only add the hyperlink if it's in the provided hyperlinks list
            if url in hyperlinks:
                current_hyperlinks.append({"url": url, "text": text})
            current_description.append(line)
        # If none of the above, add line to description
        elif current_outcome:
            current_description.append(line)

    # Add the last outcome if there is one
    if current_outcome:
        outcomes.append(Outcome(
            option_number=current_outcome[0],
            title=current_outcome[1],
            description='\n'.join(current_description).strip(),
            probability=current_outcome[2],
            hyperlinks=current_hyperlinks,
        ))

    return outcomes

############
# ENDPOINT #
############

# Generate possible outcomes based on a given query using Groq and EXA APIs
@app.function(image=image, secrets=[modal.Secret.from_name("my-api-keys")])
@web_endpoint(method="POST")
def outcomes(query: Query):
    try:
        # Get API keys
        GROQ_API_KEY = os.getenv('GROQ_API_KEY')
        EXA_API_KEY = os.getenv('EXA_API_KEY')

        # EXA API call and processing
        exa_client = Exa(api_key=EXA_API_KEY)
        exa_data = exa_client.search(query.query)
        exa_context, hyperlinks = process_exa_results(exa_data)

        # Groq API call
        client = Groq(api_key=GROQ_API_KEY)
        prompt = OUTCOME_PROMPT_TEMPLATE.format(query=query.query, exa_context=exa_context)
        groq_response = get_groq_response(client, prompt)

        # Parse outcomes
        outcomes = parse_outcomes_with_links(groq_response, hyperlinks)

        if not outcomes:
            raise ValueError("No outcomes were generated")

        return OutcomesResponse(outcomes=outcomes)

    except Exception as e:
        error_msg = f"Error in outcomes: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(status_code=500, content={"detail": error_msg})

@app.function(image=image)
@web_endpoint()
def fastapi_app():
    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.post("/outcomes", response_model=OutcomesResponse)(outcomes.apply)

    return app

# To run locally for testing
if __name__ == "__main__":
    app.serve()
