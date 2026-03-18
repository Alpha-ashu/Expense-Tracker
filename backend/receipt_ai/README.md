# Receipt AI Service (FastAPI + Donut)

This service runs `naver-clova-ix/donut-base-finetuned-cord-v2` and exposes a receipt scan API for the Node backend proxy.

## Endpoint

- `POST /scan-receipt`
- multipart field: `file`
- response: JSON extracted fields from Donut plus normalized fallback fields

## Run locally

```bash
cd backend/receipt_ai
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Environment

- `DONUT_MODEL_ID` (optional): defaults to `naver-clova-ix/donut-base-finetuned-cord-v2`
- `RECEIPT_OCR_API_KEY` (optional): if set, request must include `x-api-key`

## Notes

- Model loading is done once at startup.
- For production, run on GPU for lower latency.
- This service is intended to be called by backend `/api/v1/receipts/scan`, not directly by mobile/web clients.
