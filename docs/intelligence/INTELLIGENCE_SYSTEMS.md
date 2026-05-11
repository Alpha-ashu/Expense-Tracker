# Kanakku Intelligence Systems Documentation

This document outlines the architecture, logic, and implementation details for Kanakku's core intelligence features: **OCR Bill Scanning**, **Bank Statement Analysis**, and **Voice Financial Assistance**.

---

## 1. OCR Intelligence Engine (Bill & Receipt Scanner)

### **Overview**
The OCR engine converts physical receipt images into structured transaction data. It is designed for high accuracy even with low-quality mobile photos.

### **Implementation Logic**
1.  **Preprocessing (Multi-Variant Strategy)**:
    *   Instead of one pass, the system generates 3 variants of the image: `Original`, `Clean` (Grayscale/Contrast), and `Enhanced` (Sharpened).
    *   This increases the chance of successful character recognition on wrinkled or dimly lit receipts.
2.  **Engine**: Powered by **Tesseract.js**, lazy-loaded to optimize initial bundle size.
3.  **Result Scoring**:
    *   Each variant is processed, and the resulting text is "scored" based on financial signals.
    *   **Signals**: Presence of `INR/Rs` symbols, valid dates, recognized merchant names, and line-item tables.
    *   The highest-scoring variant is selected as the primary result.
4.  **Garbage Detection**:
    *   A proprietary `looksLikeGarbageMerchant` algorithm filters out OCR noise (e.g., "aiatea", random character strings) to ensure only valid merchant names are suggested.
5.  **Multilingual Support**:
    *   If confidence is < 55%, the engine retries with a combined language model (`eng+hin+spa`) to support regional receipts.

---

## 2. Bank Statement Scanner

### **Overview**
Designed for structured documents (PDFs or long screenshots), this engine extracts entire transaction histories rather than single entries.

### **Implementation Logic**
1.  **Metadata Extraction**:
    *   Uses regex anchors to find `Account Number`, `Statement Period`, and `Opening/Closing Balances`.
2.  **Transaction Table Parsing**:
    *   **Line-by-Line Scan**: Detects date-prefixed lines and parses trailing amount columns.
    *   **Column Inference**: Intelligently identifies `Debit` vs `Credit` based on:
        *   Suffixes (`CR` / `DR`).
        *   Column alignment (multi-value line parsing).
        *   Keyword analysis (`Salary`, `Refund` -> Credit; `ATM`, `POS` -> Debit).
3.  **Automatic Categorization**:
    *   Maps bank narration strings to Finora categories using a keyword dictionary (e.g., `NEFT`, `UPI`, `IMPS`).
4.  **Confidence Calculation**:
    *   Weighted score based on the successful extraction of account details and the number of valid transactions found.

---

## 3. Voice Financial Assistant

### **Overview**
Allows hands-free expense logging using natural language. It supports both live speech and transcript file uploads.

### **Implementation Logic**
1.  **Speech Engine**: Uses the **Web Speech API** (`SpeechRecognition`) for real-time, low-latency transcription.
2.  **NLP Parsing (The "Kanakku" Logic)**:
    *   **Pattern Matching**: Extracts amounts, merchants, and dates from raw strings.
    *   **Multi-Transaction Support**: Splits sentences on conjunctions ("and", "also", "then") to log multiple expenses at once.
    *   **Word-to-Number**: A normalization layer converts verbal numbers ("fifty five hundred") into numeric values (`5500`).
3.  **Contextual Awareness**:
    *   Handles relative dates like "today", "yesterday", or "last Friday".
    *   Learns from user feedback; if a user corrects an AI-suggested category, the system saves that merchant-category pair for future accuracy.
4.  **Fallback Strategy**:
    *   If the primary NLP parser fails, it passes the text to the `KanakkuIntelligenceEngine` for a more intensive strategic analysis.

---

## 4. Integration & UI
*   **Shared Types**: All systems return standardized results compatible with the `Transaction` interface.
*   **Deduplication**: Every scanned transaction is hashed to prevent duplicate entries if the same bill or statement is scanned twice.
*   **Security**: All processing (OCR/Voice) happens **locally on the device** where possible to ensure financial privacy.
