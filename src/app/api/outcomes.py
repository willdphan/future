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


import praw
from llama_index.core import Document, VectorStoreIndex, Settings
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

# Set up logging
logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logging.getLogger().addHandler(logging.StreamHandler(stream=sys.stdout))

# Download necessary NLTK data
download('punkt')
download('stopwords')

reddit = praw.Reddit(
    client_id="NAwLZrLY3xLaiyUt7bghPA",
    client_secret="22GEFssTVzkVGRyQYo_igSZlJkQAUg",
    user_agent="python:com.williamphan.NAwLZrLY3xLaiyUt7bghPA:v1.0 (by /u/jasonle123)"
)

import os
# Set OpenAI API key
os.environ['OPENAI_API_KEY'] = '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'

def truncate_text(text, max_length=200):
    return text[:max_length] + "..." if len(text) > max_length else text

def find_relevant_subreddits(query, subreddit_names, num_subreddits=4):
    vectorizer = TfidfVectorizer(stop_words='english')
    subreddit_descriptions = []
    
    for subreddit_name in subreddit_names:
        try:
            subreddit = reddit.subreddit(subreddit_name)
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

def collect_reddit_content(subreddit_names, thread_limit=4, comment_limit=5):
    documents = []
    subreddit_count = 0
    thread_count = 0
    comment_count = 0
    
    for subreddit_name in subreddit_names:
        try:
            subreddit = reddit.subreddit(subreddit_name)
            subreddit_thread_count = 0
            for submission in subreddit.hot(limit=thread_limit):
                submission.comment_sort = 'top'
                submission.comments.replace_more(limit=0)
                top_comments = submission.comments.list()[:comment_limit]
                
                thread_content = f"Title: {submission.title}\n\nContent: {truncate_text(submission.selftext)}\n\nComments:\n"
                comments_data = []
                for comment in top_comments:
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

def main():
    # Set up LLM
    llm = OpenAI(temperature=0, model="gpt-3.5-turbo")

    # Get user query
    user_query = input("Enter your search query for Reddit threads: ")
    
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
    relevant_subreddits = find_relevant_subreddits(user_query, all_subreddits, num_subreddits=10)
    print(f"Most relevant subreddits: {', '.join(relevant_subreddits)}")
    
    # Collect Reddit content from relevant subreddits
    documents = collect_reddit_content(relevant_subreddits)
    
    if not documents:
        print("No content found.")
        return

    # Create the index with a node parser
    node_parser = SentenceSplitter(chunk_size=1024, chunk_overlap=20)
    Settings.llm = llm
    Settings.node_parser = node_parser
    index = VectorStoreIndex.from_documents(documents)

    # Create a custom prompt
    custom_prompt = PromptTemplate(
        "Based on the most relevant Reddit content to this scenario: '{query_str}', "
        "and after analyzing the most upvoted and relevant comments from the most relevant threads, "
        "what are 4-5 possible outcomes or scenarios that could happen? Provide a brief description for each.\n"
        "Context: {context_str}\n"
        "Human: {query_str}\n"
        "Assistant: "
    )

    # Query the index
    query_engine = index.as_query_engine(
        similarity_top_k=5,
        text_qa_template=custom_prompt
    )
    response = query_engine.query(user_query)

    print("\nPossible Outcomes:")
    print(response)

    # Print the content of the most relevant threads and comments
    print("\nMost Relevant Threads and Comments:")
    for i, node in enumerate(response.source_nodes, 1):
        print(f"\nSource {i}:")
        print(f"Relevance Score: {node.score}")
        print(f"Subreddit: {node.metadata['subreddit']}")
        print(f"Thread Title: {node.metadata['thread_title']}")
        print(f"URL: {node.metadata['url']}")
        print(f"Thread Upvotes: {node.metadata['upvotes']}")
        print("\nTop Comments:")
        for j, comment in enumerate(node.metadata['comments'][:5], 1):  # Print top 5 comments
            print(f"  {j}. [Upvotes: {comment['score']}] {comment['body']}")

if __name__ == "__main__":
    main()