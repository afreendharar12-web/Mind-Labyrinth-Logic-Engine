import os
import google.generativeai as genai
import fitz  # PyMuPDF
import docx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import json

# --- Load Environment Variables & Configure Gemini API ---
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    # Use a model from the user's verified list
    model = genai.GenerativeModel('models/gemini-pro-latest') 
else:
    print("Warning: GEMINI_API_KEY not found. Generator Mode will not work.")
    model = None

# --- Initialize FastAPI App ---
app = FastAPI()

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Structures ---

# GRAPH for Adventure Mode
game_map = {
    "ENTRANCE": {
        "description": "You stand at the stone entrance of the Mind's Labyrinth. To proceed, you must prove your worth.",
        "question": "What number comes next in the sequence: 1, 4, 9, 16, __?",
        "answer": "25",
        "next_node": "HALL_OF_NUMBERS"
    },
    "HALL_OF_NUMBERS": {
        "description": "The walls of this hall are covered in cryptic sequences. A heavy stone door is sealed by a numerical lock.",
        "question": "If a train travels at 60 km/h, how many meters does it travel in 9 seconds?",
        "answer": "150",
        "next_node": "BRIDGE_OF_LOGIC"
    },
    "BRIDGE_OF_LOGIC": {
        "description": "A chasm blocks your path. A spectral bridge appears, but it is unstable. To cross, you must solve a riddle of logic.",
        "question": "A is the father of B. But B is not the son of A. How is that possible?",
        "answer": "b is his daughter",
        "next_node": "GARDEN_OF_WORDS"
    },
    "GARDEN_OF_WORDS": {
        "description": "You enter a tranquil garden where words bloom like flowers. To pass, the gatekeeper asks a question.",
        "question": "Which word is the odd one out: SWIFT, QUICK, RAPID, SLOW?",
        "answer": "slow",
        "next_node": "CHAMBER_OF_ANALOGIES"
    },
    "CHAMBER_OF_ANALOGIES": {
        "description": "This circular chamber hums with energy. To proceed, you must complete the analogy on the wall.",
        "question": "Doctor is to Hospital as Teacher is to ________?",
        "answer": "school",
        "next_node": "FINAL_GATE"
    },
    "FINAL_GATE": {
        "description": "You stand before the final gate. It is adorned with a puzzle involving probability.",
        "question": "What is the probability of getting a sum of 8 when two fair dice are thrown? (Format: X/36)",
        "answer": "5/36",
        "next_node": "TREASURY_OF_WISDOM"
    },
    "TREASURY_OF_WISDOM": {
        "description": "Congratulations! You have navigated the labyrinth and reached the Treasury of Wisdom.",
        "question": None,
    }
}
player_state_adventure = {"current_node_key": "ENTRANCE"}


# BINARY TREE for Adaptive Quiz (NOW WITH ANSWERS)
quiz_tree = {
    'root': {
        'question': "A man buys an article for $27.50 and sells it for $28.60. Find his gain percent.",
        'answer': "4",
        'left': 'easy1',   # incorrect
        'right': 'medium2'  # correct
    },
    'easy1': {
        'question': "What is 5% of 200?",
        'answer': "10",
        'left': 'easy2',
        'right': 'medium1'
    },
    'easy2': {
        'question': "If a car travels 120 km in 2 hours, what is its speed in km/h?",
        'answer': "60",
        'left': None,
        'right': 'medium1'
    },
    'medium1': {
        'question': "A and B together can do a piece of work in 10 days. If A alone can do it in 15 days, in how many days can B do it alone?",
        'answer': "30",
        'left': 'easy2',
        'right': 'medium2'
    },
    'medium2': {
        'question': "The sum of two numbers is 40 and their difference is 4. What is the ratio of the two numbers? (Format: X:Y)",
        'answer': "11:9",
        'left': 'medium1',
        'right': 'hard1'
    },
    'hard1': {
        'question': "A sum of money at simple interest amounts to $815 in 3 years and to $854 in 4 years. The sum is?",
        'answer': "698",
        'left': 'medium2',
        'right': 'hard2'
    },
    'hard2': {
        'question': "A boat running downstream covers a distance of 16 km in 2 hours while for covering the same distance upstream, it takes 4 hours. What is the speed of the boat in still water (in km/h)?",
        'answer': "6",
        'left': 'hard1',
        'right': None # End of quiz (mastery)
    }
}


# --- Pydantic Models for Request Body ---
class AnswerRequest(BaseModel):
    answer: str

# --- API Endpoints ---

# --- Adventure Mode Endpoints ---
@app.get("/api/adventure")
def get_adventure_state():
    node = game_map[player_state_adventure["current_node_key"]]
    return {"description": node["description"], "question": node.get("question")}

@app.post("/api/adventure/answer")
def submit_adventure_answer(request: AnswerRequest):
    node = game_map[player_state_adventure["current_node_key"]]
    is_correct = request.answer.strip().lower() == node["answer"].lower()
    
    if is_correct:
        next_node_key = node.get("next_node")
        if next_node_key:
            player_state_adventure["current_node_key"] = next_node_key
            return {"result": "correct"}
        else:
            return {"result": "finished"}
    else:
        return {"result": "incorrect"}

@app.post("/api/adventure/reset")
def reset_adventure():
    player_state_adventure["current_node_key"] = "ENTRANCE"
    return {"message": "Adventure mode has been reset."}


# --- Adaptive Quiz Endpoints (UPDATED) ---
@app.get("/api/adaptive-quiz/{node_key}")
def get_adaptive_question(node_key: str):
    if node_key in quiz_tree:
        return {"question": quiz_tree[node_key]["question"]}
    raise HTTPException(status_code=404, detail="Question node not found")

@app.post("/api/adaptive-quiz/{node_key}")
def submit_adaptive_answer(node_key: str, request: AnswerRequest):
    if node_key not in quiz_tree:
        raise HTTPException(status_code=404, detail="Question node not found")
    
    node = quiz_tree[node_key]
    # Allow for answers with '%' or '$' symbols to be stripped.
    user_answer = request.answer.strip().lower().replace('%','').replace('$', '')
    correct_answer = node["answer"].lower()

    is_correct = user_answer == correct_answer
    
    if is_correct:
        next_node_key = node.get("right")
        return {"result": "correct", "next_node_key": next_node_key}
    else:
        next_node_key = node.get("left")
        return {"result": "incorrect", "next_node_key": next_node_key}


# --- Generator Mode Endpoints ---
def extract_text_from_file(file: UploadFile):
    content_type = file.content_type
    try:
        if content_type == "application/pdf":
            doc = fitz.open(stream=file.file.read(), filetype="pdf")
            text = "".join(page.get_text() for page in doc)
            return text
        elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            doc = docx.Document(file.file)
            return "\n".join([para.text for para in doc.paragraphs])
        elif content_type == "text/plain":
            return file.file.read().decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {e}")

@app.post("/api/generate-questions")
async def generate_questions_from_file(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=503, detail="AI model is not configured. Please set GEMINI_API_KEY.")

    extracted_text = extract_text_from_file(file)
    if not extracted_text or len(extracted_text) < 20:
         raise HTTPException(status_code=400, detail="File is empty or contains too little text.")

    prompt = f"""
    Based on the following text, generate exactly 10 multiple-choice aptitude questions.
    The questions should be a mix of logical reasoning, verbal ability, or quantitative analysis inspired by the text.
    For each question, provide 4 options (A, B, C, D) and clearly indicate the correct answer, and provide a short, helpful hint.

    Format the output as a clean JSON array of objects. Each object must have "question", "options" (an array of strings), "answer" (a string), and "hint" (a string).
    Do not wrap the JSON in markdown backticks.

    Example JSON output format:
    [
      {{
        "question": "What is the capital of France?",
        "options": ["A. London", "B. Berlin", "C. Paris", "D. Madrid"],
        "answer": "C. Paris",
        "hint": "This city is famous for the Eiffel Tower."
      }}
    ]

    Here is the text:
    ---
    {extracted_text[:4000]}
    ---
    """
    try:
        response = model.generate_content(prompt)
        cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
        # Validate that the response is proper JSON
        json.loads(cleaned_response)
        return {"questions_json": cleaned_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating or parsing questions from AI: {e}")

