"""Landmark features from the training notebook.

Pose indexes, wrist crops, 48-frame sampling, and the 226-wide feature
vector match the Colab cells that produced word_transformer.pt.
"""

from pathlib import Path
import json
import urllib.request

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
MP_DIR = ROOT / "mp_models"
POSE_PATH = MP_DIR / "pose_landmarker.task"
HAND_PATH = MP_DIR / "hand_landmarker.task"

POSE_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)
HAND_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

N_FRAMES = 48
POSE_IDX = [0, 11, 12, 13, 14, 15, 16]
WRISTS = [(15, [19, 17]), (16, [20, 18])]
FEAT_DIM = 14 + 84 + 126 + 2
SIGNS_PATH = Path(__file__).resolve().parents[1] / "src" / "data" / "signs.json"
_SIGNS = None


def signs():
    global _SIGNS
    if _SIGNS is None:
        _SIGNS = json.loads(SIGNS_PATH.read_text(encoding="utf-8"))
    return _SIGNS


def gloss(word):
    key = str(word).strip().lower()
    for sign in signs():
        if sign["english"].lower() == key:
            return sign["urdu"]
    return word


def ensure_task_files():
    MP_DIR.mkdir(parents=True, exist_ok=True)
    for path, url in ((POSE_PATH, POSE_URL), (HAND_PATH, HAND_URL)):
        if not path.exists() or path.stat().st_size < 1000:
            urllib.request.urlretrieve(url, path)


def make_detectors():
    import mediapipe as mp
    from mediapipe.tasks import python as mp_tasks
    from mediapipe.tasks.python import vision

    ensure_task_files()
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=str(POSE_PATH)),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=0.3,
        min_pose_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    ))
    hand = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=str(HAND_PATH)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.2,
        min_hand_presence_confidence=0.2,
        min_tracking_confidence=0.2,
    ))
    return pose, hand, mp


def _mp_image(mp, rgb):
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))


def process_frame(bgr, pose_det, hand_det, mp, prev_pose):
    height, width = bgr.shape[:2]
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    long_side = max(height, width)
    small = rgb if long_side <= 960 else cv2.resize(
        rgb, (int(width * 960 / long_side), int(height * 960 / long_side))
    )
    res = pose_det.detect(_mp_image(mp, small))
    pose_ok = len(res.pose_landmarks) > 0
    if pose_ok:
        pose = np.array(
            [[lm.x * width, lm.y * height] for lm in res.pose_landmarks[0]],
            dtype=np.float32,
        )
    else:
        pose = prev_pose

    hands = np.zeros((2, 21, 3), np.float32)
    hand_ok = np.zeros(2, bool)
    if pose is not None:
        shoulder = max(float(np.linalg.norm(pose[11] - pose[12])), 20.0)
        side = 1.3 * shoulder
        for slot, (wrist, refs) in enumerate(WRISTS):
            center = (pose[wrist] + pose[refs[0]] + pose[refs[1]]) / 3.0
            x0 = int(max(0, center[0] - side / 2))
            x1 = int(min(width, center[0] + side / 2))
            y0 = int(max(0, center[1] - side / 2))
            y1 = int(min(height, center[1] + side / 2))
            if x1 - x0 < 24 or y1 - y0 < 24:
                continue
            crop = cv2.resize(rgb[y0:y1, x0:x1], (256, 256))
            found = hand_det.detect(_mp_image(mp, crop))
            if len(found.hand_landmarks) > 0:
                crop_w, crop_h = x1 - x0, y1 - y0
                hands[slot] = [
                    [x0 + lm.x * crop_w, y0 + lm.y * crop_h, lm.z * crop_w]
                    for lm in found.hand_landmarks[0]
                ]
                hand_ok[slot] = True

    pose_sub = pose[POSE_IDX] if pose is not None else np.zeros((len(POSE_IDX), 2), np.float32)
    return pose_sub.astype(np.float32), pose_ok, hands, hand_ok, pose


def extract_from_frames(frames, pose_det, hand_det, mp, n_frames=N_FRAMES):
    total = len(frames)
    if total <= 0:
        raise ValueError("No frames were received.")
    wanted = np.linspace(0, total - 1, n_frames).round().astype(int)
    pose = np.zeros((n_frames, len(POSE_IDX), 2), np.float32)
    pose_ok = np.zeros(n_frames, bool)
    hands = np.zeros((n_frames, 2, 21, 3), np.float32)
    hand_ok = np.zeros((n_frames, 2), bool)
    prev = None
    for index, frame_index in enumerate(wanted):
        pose_sub, ok, frame_hands, frame_hand_ok, full_pose = process_frame(
            frames[int(frame_index)], pose_det, hand_det, mp, prev
        )
        pose[index] = pose_sub
        pose_ok[index] = ok
        hands[index] = frame_hands
        hand_ok[index] = frame_hand_ok
        if full_pose is not None:
            prev = full_pose
    return {"pose": pose, "pose_ok": pose_ok, "hands": hands, "hand_ok": hand_ok}


def fill_missing(arr, ok):
    idx = np.where(ok)[0]
    if len(idx) == 0:
        return None
    out = arr.copy()
    for k in range(len(arr)):
        if not ok[k]:
            out[k] = arr[idx[np.abs(idx - k).argmin()]]
    return out


def build_features(raw):
    pose = fill_missing(raw["pose"], raw["pose_ok"])
    if pose is None:
        return None
    n = len(pose)
    center = np.median((pose[:, 1] + pose[:, 2]) / 2, axis=0)
    shoulder = max(float(np.median(np.linalg.norm(pose[:, 1] - pose[:, 2], axis=1))), 1e-3)
    pose_f = ((pose - center) / shoulder).reshape(n, -1)
    hands, ok = raw["hands"], raw["hand_ok"]
    hand_global = (hands[..., :2] - center) / shoulder
    size = np.maximum(
        np.linalg.norm(hands[:, :, 9, :2] - hands[:, :, 0, :2], axis=-1), 1e-3
    )[:, :, None, None]
    hand_local = (hands - hands[:, :, 0:1, :]) / size
    mask = ok[:, :, None, None]
    hand_global = hand_global * mask
    hand_local = hand_local * mask
    features = np.concatenate(
        [
            pose_f,
            hand_global.reshape(n, -1),
            hand_local.reshape(n, -1),
            ok.astype(np.float32),
        ],
        axis=1,
    )
    return np.clip(features, -8, 8).astype(np.float32)
