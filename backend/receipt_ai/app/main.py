from __future__ import annotations

import io
import os
import re
from typing import Any, Dict

import torch
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image
from transformers import DonutProcessor, VisionEncoderDecoderModel

MODEL_ID = os.getenv("DONUT_MODEL_ID", "naver-clova-ix/donut-base-finetuned-cord-v2")
API_KEY = os.getenv("RECEIPT_OCR_API_KEY")
TASK_PROMPT = "<s_cord-v2>"

app = FastAPI(title="Receipt OCR Service", version="1.0.0")

processor = DonutProcessor.from_pretrained(MODEL_ID)
model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID)
model.eval()

if torch.cuda.is_available():
    model.to("cuda")


def _parse_amount(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^\d.-]", "", value)
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _normalize_result(payload: Dict[str, Any]) -> Dict[str, Any]:
    total = (
        _parse_amount(payload.get("total"))
        or _parse_amount(payload.get("total_amount"))
        or _parse_amount(payload.get("amount"))
        or _parse_amount(payload.get("grand_total"))
        or _parse_amount(payload.get("food_total"))
    )

    merchant = (
        payload.get("vendor")
        or payload.get("merchant")
        or payload.get("merchant_name")
        or payload.get("store_name")
        or payload.get("nm")
    )

    date = payload.get("date") or payload.get("transaction_date") or payload.get("purchase_date")

    return {
        "merchantName": merchant,
        "amount": total,
        "date": date,
        "currency": payload.get("currency") or payload.get("currency_code") or "INR",
    }


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "model": MODEL_ID}


@app.post("/scan-receipt")
async def scan_receipt(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None),
) -> Dict[str, Any]:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid OCR API key")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload")

    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid image") from exc

    pixel_values = processor(image, return_tensors="pt").pixel_values
    if torch.cuda.is_available():
        pixel_values = pixel_values.to("cuda")

    decoder_input_ids = processor.tokenizer(
        TASK_PROMPT,
        add_special_tokens=False,
        return_tensors="pt",
    ).input_ids

    if torch.cuda.is_available():
        decoder_input_ids = decoder_input_ids.to("cuda")

    with torch.inference_mode():
        outputs = model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_length=model.config.decoder.max_position_embeddings,
            pad_token_id=processor.tokenizer.pad_token_id,
            eos_token_id=processor.tokenizer.eos_token_id,
            use_cache=True,
            bad_words_ids=[[processor.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
        )

    sequence = outputs.sequences
    decoded = processor.batch_decode(sequence, skip_special_tokens=True)[0]
    parsed = processor.token2json(decoded)

    normalized = _normalize_result(parsed)

    return {
        **parsed,
        **normalized,
        "requiresConfirmation": True,
    }
