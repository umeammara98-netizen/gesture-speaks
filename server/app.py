"""Recognition API and SQLite accounts for Gesture Speaks."""

from contextlib import asynccontextmanager
import os
from pathlib import Path
import threading

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import db
from model import SignTransformer
from pipeline import FEAT_DIM, N_FRAMES, build_features, extract_from_frames, gloss, make_detectors, signs

ROOT = Path(__file__).resolve().parent
CHECKPOINT = ROOT / "models" / "word_transformer.pt"

_lock = threading.Lock()
_runtime = {
    "model": None,
    "classes": [],
    "n_frames": N_FRAMES,
    "feat_dim": FEAT_DIM,
    "detectors": None,
    "model_error": None,
}


def load_env():
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_checkpoint():
    _runtime["model"] = None
    _runtime["classes"] = []
    _runtime["model_error"] = None
    if not CHECKPOINT.exists():
        _runtime["model_error"] = (
            "The camera model file is missing (server/models/word_transformer.pt), so a held sign cannot be named yet."
        )
        return
    import torch

    try:
        blob = torch.load(CHECKPOINT, map_location="cpu", weights_only=False)
        classes = list(blob["classes"])
        n_frames = int(blob.get("n_frames", N_FRAMES))
        feat_dim = int(blob.get("feat_dim", FEAT_DIM))
        model = SignTransformer(feat_dim, len(classes), T=n_frames)
        model.load_state_dict(blob["state_dict"])
        model.eval()
        _runtime["model"] = model
        _runtime["classes"] = classes
        _runtime["n_frames"] = n_frames
        _runtime["feat_dim"] = feat_dim
    except Exception as exc:
        _runtime["model_error"] = f"Could not load word_transformer.pt: {exc}"


def detectors():
    if _runtime["detectors"] is None:
        pose, hand, mp = make_detectors()
        _runtime["detectors"] = (pose, hand, mp)
    return _runtime["detectors"]


def decode_frames(uploads):
    frames = []
    for upload in uploads:
        data = upload if isinstance(upload, (bytes, bytearray)) else None
        if data is None:
            continue
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if image is not None:
            frames.append(image)
    return frames


def predict(frames):
    if _runtime["model"] is None:
        raise HTTPException(status_code=503, detail=_runtime["model_error"])
    import torch

    with _lock:
        pose_det, hand_det, mp = detectors()
        raw = extract_from_frames(frames, pose_det, hand_det, mp, _runtime["n_frames"])
        features = build_features(raw)
    if features is None:
        raise HTTPException(
            status_code=422,
            detail="No pose detected. Step back so your shoulders and hands are in frame.",
        )
    if features.shape != (_runtime["n_frames"], _runtime["feat_dim"]):
        raise HTTPException(
            status_code=500,
            detail=f"Feature shape {tuple(features.shape)} does not match the checkpoint.",
        )
    model = _runtime["model"]
    with torch.no_grad():
        logits = model(torch.from_numpy(features).unsqueeze(0))
        probs = torch.softmax(logits, dim=1)[0]
    k = min(3, len(_runtime["classes"]))
    values, indexes = torch.topk(probs, k=k)
    top = []
    for score, index in zip(values.tolist(), indexes.tolist()):
        word = _runtime["classes"][index]
        top.append({"word": word, "urdu": gloss(word), "confidence": round(float(score), 4)})
    best = top[0]
    return {"word": best["word"], "urdu": best["urdu"], "confidence": best["confidence"], "top3": top}


class Credentials(BaseModel):
    email: str
    password: str
    name: str | None = None


class UserUpdate(BaseModel):
    admin: bool | None = None
    disabled: bool | None = None


def bearer_token(authorization: str | None):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing sign-in token.")
    return authorization.split(" ", 1)[1].strip()


def current_user(authorization: str | None = Header(default=None)):
    token = bearer_token(authorization)
    row = db.user_by_token(token)
    if row is None or row["disabled"]:
        raise HTTPException(status_code=401, detail="Sign in again.")
    return row


def require_admin(user=Depends(current_user)):
    if not user["admin"]:
        raise HTTPException(status_code=403, detail="Admin only.")
    return user


def clean_email(value):
    email = (value or "").strip().lower()
    if "@" not in email or " " in email or len(email) > 200:
        raise HTTPException(status_code=400, detail="Enter a valid email.")
    return email


@asynccontextmanager
async def lifespan(_app):
    load_env()
    db.init()
    load_checkpoint()
    yield


app = FastAPI(title="Gesture Speaks", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/signs")
def list_signs():
    return {"signs": signs()}


@app.get("/api/health")
def health():
    return {
        "model_loaded": _runtime["model"] is not None,
        "classes": len(_runtime["classes"]),
        "auth": "sqlite",
        "detail": _runtime["model_error"],
    }


@app.post("/api/recognize")
async def recognize(frames: list[UploadFile] = File(...)):
    decoded = []
    for item in frames:
        decoded.append(await item.read())
    images = decode_frames(decoded)
    if len(images) < 4:
        raise HTTPException(
            status_code=400,
            detail="Not enough frames. Keep the camera on, hold the sign, and try again.",
        )
    return predict(images)


@app.post("/api/auth/signup")
def signup(body: Credentials):
    email = clean_email(body.email)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Enter your name.")
    if len(body.password or "") < 6:
        raise HTTPException(status_code=400, detail="Use a password of at least 6 characters.")
    if db.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="That email already has an account.")
    row = db.create_user(email, name[:80], body.password)
    token = db.create_session(row["id"])
    return {"token": token, "user": db.public_user(row)}


@app.post("/api/auth/login")
def login(body: Credentials):
    email = clean_email(body.email)
    row = db.get_user_by_email(email)
    if row is None or not db.verify_password(body.password or "", row["password_hash"]):
        raise HTTPException(status_code=401, detail="That email and password did not match.")
    if row["disabled"]:
        raise HTTPException(status_code=403, detail="This account is disabled.")
    token = db.create_session(row["id"])
    return {"token": token, "user": db.public_user(row)}


@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {"user": db.public_user(user)}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)):
    token = bearer_token(authorization)
    db.delete_session(token)
    return {"ok": True}


@app.get("/api/admin/users")
def list_users(_admin=Depends(require_admin)):
    return {"users": [db.public_user(row) for row in db.list_users()]}


@app.patch("/api/admin/users/{uid}")
def update_user(uid: str, body: UserUpdate, admin=Depends(require_admin)):
    if body.admin is None and body.disabled is None:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    if not uid.isdigit():
        raise HTTPException(status_code=404, detail="User not found.")
    if body.disabled is True and uid == str(admin["id"]):
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")
    row = db.update_user(int(uid), admin=body.admin, disabled=body.disabled)
    if row is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return db.public_user(row)
