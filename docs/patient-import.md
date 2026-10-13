# Patient import

The Patients screen lazily opens the importer. Parsing happens in the browser;
no AI provider, uploaded-file endpoint, API key, or extra paid service is used.
Only doctor-approved patient objects go to the existing authenticated Supabase
patient table when the doctor presses Confirm and save.

## Formats and review

- XLSX: sheets, shared/inline strings, cached formula values with a warning,
  styled Excel dates and zero-padded identifiers. No macros or formula execution.
- UTF-8/UTF-16 CSV, TSV and TXT: quoted cells/newlines; Arabic/Persian digits.
- DOCX tables and labelled paragraphs; text PDF using a local PDF.js worker.
- Labelled text records are separated only by explicit patient-name labels.
  Repeated money fields are ambiguous, never silently added together.
- Column mapping can override every suggestion. Dates and decimal separators
  have explicit controls; ambiguous auto-detection stops for review.
- Each included patient needs individual approval; edits reset that approval.
  Duplicate name/file/phone matches are suggestions, not automatic merges.
- Source text and unmapped columns are retained in `importSource.original`.

Limits: 10 MB compressed file; 25 MB expanded archive; 500 records per sheet,
60 columns, 20 XLSX sheets, 50 PDF pages, 15,000 characters per cell and a 2 MB
serialized save batch. Import one selected sheet/page at a time. Unsupported
files are rejected rather than partially imported without notice.

This is rule-based extraction, not general semantic AI. Scanned PDFs, images,
handwriting, legacy XLS and embedded attachments are not imported. Convert to a
supported text format first. PDF reading order and unlabelled text may require
manual mapping/correction. Historical notes are retained as text, not converted
into guessed clinical findings or tooth-chart procedures.

## Accounting

`patient.openingBalance` is an optional, confirmed signed balance with currency
and an optional source date. Missing financial values remain unknown. A credit
is negative. Foreign/mixed currencies require explicit correction; no FX rate
is invented. Opening balances affect amount due, but do not create receipts,
payments, fees or new cash-flow revenue. An unresolved balance must not appear
as a settled patient. Currency changes flag older balances for review.

Overview contains the editable imported history/opening balance and retained
source. Normal patient fields remain editable through the existing patient form.
Word export includes historical notes, source and opening-balance status.

## Persistence and retries

One Supabase INSERT statement inserts the selected records atomically under
existing RLS and subscription enforcement. Deterministic UUIDs include clinic,
file SHA-256, stable sheet identifier and source row. Filename is excluded from
identity. `ON CONFLICT DO NOTHING` prevents retries from overwriting later edits.
Re-uploading identical rows excludes them in review. Existing patients are
never merged or updated by import. Renumbered/modified files use duplicate
suggestions rather than silently replacing old records.

Local developer mode writes the whole batch in one local DB save. Public demo
and expired-subscription mode cannot commit. During a save the form is locked,
sign-out is blocked and closing the browser warns about a pending write.
No production migration, new table or service credential is required.

## Verification

`node --test tests/patient-import.test.mjs` covers decimal/date ambiguity,
missing values, labelled text, conflicts, duplicates, credits, currencies,
idempotency, tenant separation and mocked atomic write failures/retries.

Development-only `/import-preview.html` exercises the real importer with
fictional records and an in-memory save. Its format-check button generates XLSX,
DOCX and PDF fixtures and checks browser decoding. It never uses the backend.
The preview is not an entry point of the production build.

Production database writes have not been exercised with real patient records.
