from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os
import base64
import json
from pathlib import Path
from dotenv import load_dotenv
from openai import AsyncOpenAI
from fastapi import FastAPI
from fastapi.templating import Jinja2Templates


app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env", override=True)

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise RuntimeError("OPENAI_API_KEY not found")

client = AsyncOpenAI(api_key=api_key)

print("OpenAI client initialized successfully")

# Configure static files
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)

# Configure templates
templates = Jinja2Templates(
    directory=str(BASE_DIR / "templates")
)



@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"result": None}
    )


@app.post("/diagnose")
async def diagnose(file: UploadFile = File(...)):

    allowed_types = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed"
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty"
        )

    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be 10MB or smaller"
        )

    base64_image = base64.b64encode(
        image_bytes
    ).decode("utf-8")

    image_url = (
        f"data:{file.content_type};base64,{base64_image}"
    )

    prompt = """
    You are an agricultural plant disease specialist.

    Examine the uploaded plant leaf image.

    Identify:
    1. Plant name
    2. Most likely disease
    3. Causative organism
    4. Visible symptoms
    5. Recommended treatment
    6. Prevention measures

    If the image is unclear, healthy, or not a plant,
    say so. Do not invent a disease.

    Explain uncertainty and possible alternative
    diagnoses where appropriate.

    Only recommend pesticides approved for the
    relevant crop and location, if known.
    Do not invent product registration or dosage.

    Return valid JSON using exactly these keys:
    plant, disease, cause, symptoms,
    treatment, prevention, confidence_note

    The symptoms, treatment and prevention values
    should be arrays of strings.
    All other values should be strings.
    """

    try:
        response = await client.responses.create(
            model="gpt-4.1-mini",
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": prompt
                        },
                        {
                            "type": "input_image",
                            "image_url": image_url
                        }
                    ]
                }
            ],
            text={
                "format": {
                    "type": "json_object"
                }
            }
        )

        result = json.loads(response.output_text)

        return {
            "success": True,
            "result": result
        }

    except (OpenAIError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Disease analysis failed. Please try again."
        ) from exc