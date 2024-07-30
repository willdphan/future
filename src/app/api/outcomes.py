# NAwLZrLY3xLaiyUt7bghPA
"""
Try different RAG methods with eval.
"""


# Reddit API credentials
# reddit = praw.Reddit(
#     client_id="NAwLZrLY3xLaiyUt7bghPA",
#     client_secret="22GEFssTVzkVGRyQYo_igSZlJkQAUg",
#     user_agent="python:com.williamphan.NAwLZrLY3xLaiyUt7bghPA:v1.0 (by /u/jasonle123)"
# )

# import os
# # Set OpenAI API key
# os.environ['OPENAI_API_KEY'] = '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'


from llama_index.core import Document, VectorStoreIndex, Settings
from pydantic import BaseModel
from llama_index.llms.openai import OpenAI
import logging
import sys
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk import download
from collections import Counter
from llama_index.core import PromptTemplate
from llama_index.core.node_parser import SentenceSplitter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Tuple
import re
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Adjust this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Set up logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

# Download necessary NLTK data
download('punkt')
download('stopwords')

import asyncpraw

# Reddit API credentials
reddit = asyncpraw.Reddit(
    client_id="NAwLZrLY3xLaiyUt7bghPA",
    client_secret="22GEFssTVzkVGRyQYo_igSZlJkQAUg",
    user_agent="python:com.williamphan.NAwLZrLY3xLaiyUt7bghPA:v1.0 (by /u/jasonle123)"
)

# Set OpenAI API key
os.environ['OPENAI_API_KEY'] = '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'

def truncate_text(text, max_length=500):
    return text[:max_length] + "..." if len(text) > max_length else text

async def find_relevant_subreddits(query, subreddit_names, num_subreddits=4):
    vectorizer = TfidfVectorizer(stop_words='english')
    subreddit_descriptions = []
    
    for subreddit_name in subreddit_names:
        try:
            subreddit = await reddit.subreddit(subreddit_name)
            await subreddit.load()  # Load the subreddit data
            description = f"{subreddit.display_name} {subreddit.public_description}"
            subreddit_descriptions.append(description)
        except Exception as e:
            print(f"Error fetching description for r/{subreddit_name}: {e}")
            subreddit_descriptions.append("")
    
    all_texts = subreddit_descriptions + [query]
    
    tfidf_matrix = vectorizer.fit_transform(all_texts)
    cosine_similarities = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1]).flatten()
    
    top_subreddits = sorted(zip(subreddit_names, cosine_similarities), key=lambda x: x[1], reverse=True)[:num_subreddits]
    
    return [subreddit for subreddit, _ in top_subreddits]

async def collect_reddit_content(subreddit_names, thread_limit=2, comment_limit=2):
    documents = []
    subreddit_count = 0
    thread_count = 0
    comment_count = 0
    
    for subreddit_name in subreddit_names:
        try:
            subreddit = await reddit.subreddit(subreddit_name)
            await subreddit.load()  # Load the subreddit data
            subreddit_thread_count = 0
            async for submission in subreddit.hot(limit=thread_limit):
                await submission.load()  # Load the submission data
                submission.comment_sort = 'top'
                await submission.comments.replace_more(limit=0)
                top_comments = await submission.comments.list()
                top_comments = top_comments[:comment_limit]
                
                thread_content = f"Title: {submission.title}\n\nContent: {truncate_text(submission.selftext)}\n\nComments:\n"
                comments_data = []
                for comment in top_comments:
                    await comment.load()  # Load the comment data
                    truncated_comment = truncate_text(comment.body)
                    thread_content += f"[Upvotes: {comment.score}] {truncated_comment}\n\n"
                    comments_data.append({
                        'body': truncated_comment,
                        'score': comment.score
                    })
                    comment_count += 1
                
                doc = Document(
                    text=thread_content,
                    metadata={
                        'subreddit': subreddit_name,
                        'thread_title': submission.title,
                        'url': submission.url,
                        'upvotes': submission.score,
                        'comments': comments_data
                    }
                )
                documents.append(doc)
                subreddit_thread_count += 1
                thread_count += 1
            
            print(f"Collected {subreddit_thread_count} threads from r/{subreddit_name}")
            subreddit_count += 1
        except Exception as e:
            print(f"Error collecting content from r/{subreddit_name}: {e}")
    
    print(f"\nTotal subreddits processed: {subreddit_count}")
    print(f"Total threads collected: {thread_count}")
    print(f"Total comments collected: {comment_count}")
    print(f"Total documents created: {len(documents)}")
    
    return documents

def parse_outcomes(response_text: str) -> List[Tuple[int, str, str, float]]:
    outcomes = []
    lines = response_text.split('\n')
    current_outcome = None
    current_description = ""

    for line in lines:
        # Match the outcome number, title, and probability
        match = re.match(r'(\d+)\.\s*(.*?)\s*\((\d+(?:\.\d+)?)%\)', line)
        if match:
            if current_outcome:
                outcomes.append((current_outcome[0], current_outcome[1], current_description.strip(), current_outcome[2]))
            option_number = int(match.group(1))
            title = match.group(2)
            probability = float(match.group(3))
            current_outcome = (option_number, title, probability)
            current_description = ""
        elif line.strip().startswith("Title:"):
            # Skip the title line as we've already captured it
            continue
        elif line.strip().startswith("Detailed description:"):
            # Start of the detailed description
            current_description = line.replace("Detailed description:", "").strip()
        elif line.strip().startswith("Probability:"):
            # Skip the probability line as we've already captured it
            continue
        else:
            # Append to the current description
            current_description += " " + line.strip()

    if current_outcome:
        outcomes.append((current_outcome[0], current_outcome[1], current_description.strip(), current_outcome[2]))

    return outcomes

# ... rest of the code remains the same ...
def calculate_probabilities(outcomes: List[str], source_nodes: List) -> List[Tuple[int, str, str, float]]:
    total_score = sum(node.score for node in source_nodes)
    probabilities = []
    for i, outcome in enumerate(outcomes):
        if i < len(source_nodes):
            prob = (source_nodes[i].score / total_score) * 100
        else:
            prob = 100 / len(outcomes)  # Equal distribution for any extra outcomes
        probabilities.append((i+1, f"Outcome {i+1}", outcome, round(prob, 2)))
    return probabilities

class Query(BaseModel):
    query: str

class Outcome(BaseModel):
    option_number: int
    title: str
    description: str
    probability: float

class OutcomesResponse(BaseModel):
    outcomes: List[Outcome]
    relevant_subreddits: List[str]
    sources: List[dict]

@app.post("/generate-outcomes", response_model=OutcomesResponse)
async def generate_outcomes(query: Query):
        # Log the incoming query
    print(f"Received query: {query.query}")
    # Set up LLM
    llm = OpenAI(temperature=0, model="gpt-3.5-turbo", max_tokens=500)  # Adjust max_tokens as needed

    # List of top social subreddits
    all_subreddits = [
        'AskReddit', 'relationships', 'relationship_advice', 'dating_advice',
        'socialskills', 'CasualConversation', 'Advice', 'AskMen', 'AskWomen',
        'dating', 'Tinder', 'OkCupid', 'seduction', 'socialanxiety',
        'MakeNewFriendsHere', 'r4r', 'ForeverAlone', 'self', 'confession',
        'offmychest', 'TrueOffMyChest', 'tifu', 'TwoXChromosomes', 'AskMenOver30',
        'AskWomenOver30', 'AskMenAdvice', 'AskWomenAdvice', 'dating_over_30',
        'datingoverthirty', 'RelationshipsOver35', 'LongDistance', 'love',
        'Marriage', 'Divorce', 'BreakUps', 'ExNoContact', 'sociallife',
        'SocialEngineering', 'howtonotgiveafuck', 'DecidingToBeBetter',
        'selfimprovement', 'confidence', 'GetMotivated', 'socialanxiety',
        'Anxiety', 'depression', 'mentalhealth', 'SuicideWatch'
    ]
    
    # Find relevant subreddits
    relevant_subreddits = await find_relevant_subreddits(query.query, all_subreddits, num_subreddits=5)
    
    # Collect Reddit content from relevant subreddits
    documents = await collect_reddit_content(relevant_subreddits)
    
    if not documents:
        raise HTTPException(status_code=404, detail="No content found.")

    # Create the index with a node parser
    node_parser = SentenceSplitter(chunk_size=1024, chunk_overlap=20)
    Settings.llm = llm
    Settings.node_parser = node_parser
    index = VectorStoreIndex.from_documents(documents)

    # Modify the custom prompt to encourage longer descriptions
    custom_prompt = PromptTemplate(
        "You are an assistant that generates possible outcomes for given actions based on relevant Reddit content.\n"
        "Context: {context_str}\n"
        "Human: Given the action: '{query_str}', list 4-5 possible outcomes. For each outcome, provide:\n"
        "1. A short title (3-5 words)\n"
        "2. A detailed description (at least 200 words) explaining the outcome, its implications, and any relevant context. Use multiple paragraphs if necessary.\n"
        "3. The probability of occurring (as a percentage).\n"
        "Format each outcome as follows:\n"
        "1. Detailed description (XX%)\n"
        "The probabilities should sum up to 100%.\n"
        "Assistant: "
    )

    # Query the index
    query_engine = index.as_query_engine(
        similarity_top_k=5,
        text_qa_template=custom_prompt
    )
    response = query_engine.query(query.query)
        # Log the response from the query
    print(f"Query response: {response}")

    # Parse outcomes and probabilities
    outcomes_with_probs = parse_outcomes(str(response))

    # If parsing fails, calculate probabilities based on relevance scores
    if not outcomes_with_probs:
        outcomes = str(response).split('\n')
        outcomes_with_probs = calculate_probabilities(outcomes, response.source_nodes)

    # Prepare the response
    outcomes = [Outcome(option_number=opt, title=title, description=desc, probability=prob) for opt, title, desc, prob in outcomes_with_probs]

    # Log the outcomes
    print("Generated outcomes:")
    for outcome in outcomes:
        print(f"Option {outcome.option_number}: {outcome.title} - {outcome.description} ({outcome.probability}%)")

    sources = []
    for node in response.source_nodes:
        sources.append({
            "relevance_score": node.score,
            "subreddit": node.metadata['subreddit'],
            "thread_title": node.metadata['thread_title'],
            "url": node.metadata['url'],
            "upvotes": node.metadata['upvotes'],
            "top_comments": [{"body": comment['body'], "score": comment['score']} for comment in node.metadata['comments'][:5]]
        })

    return OutcomesResponse(
        outcomes=outcomes,
        relevant_subreddits=relevant_subreddits,
        sources=sources
    )

if __name__ == "__main__":
    import uvicorn
    import asyncio
    
    async def main():
        config = uvicorn.Config("src.app.api.outcomes:app", host="0.0.0.0", port=8000, reload=True)
        server = uvicorn.Server(config)
        await server.serve()
    
    asyncio.run(main())
