"""
Generate sample MOU PDF documents for 2 partnerships and upload to Supabase Storage.
Run: cd backend && python seed_mou_pdfs.py
"""
import os, io
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

from supabase import create_client

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

# Try to create bucket
try:
    supabase.storage.create_bucket("mou-documents", {"public": True})
    print("[OK] Created mou-documents bucket")
except Exception:
    print("[OK] mou-documents bucket already exists")


def generate_mou_pdf(party_a, party_b, region, terms, mou_hash, nft_address, date_str):
    """Generate a simple PDF using only built-in libraries (no external deps)."""
    # Minimal PDF structure
    lines = [
        "%PDF-1.4",
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj",
        "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj",
    ]

    # Build text content
    text_lines = [
        "=" * 60,
        "MEMORANDUM OF UNDERSTANDING",
        "Partnership Agreement - AUTOSUP Platform",
        "=" * 60,
        "",
        f"Date: {date_str}",
        "",
        "PARTIES:",
        f"  Party A (Supplier): {party_a}",
        f"  Party B (Distributor): {party_b}",
        "",
        f"DISTRIBUTION REGION: {region}",
        "",
        "-" * 60,
        "TERMS AND CONDITIONS:",
        "-" * 60,
        "",
    ]
    # Wrap terms to 60 chars per line
    words = terms.split()
    line = ""
    for w in words:
        if len(line) + len(w) + 1 > 58:
            text_lines.append(f"  {line}")
            line = w
        else:
            line = f"{line} {w}" if line else w
    if line:
        text_lines.append(f"  {line}")

    text_lines += [
        "",
        "-" * 60,
        "DIGITAL VERIFICATION:",
        "-" * 60,
        f"  MOU Hash (SHA-256): {mou_hash[:32]}",
        f"                      {mou_hash[32:]}",
        f"  NFT Address: {nft_address}",
        f"  Blockchain: Solana Devnet",
        "",
        "=" * 60,
        "This document is digitally verified on Solana blockchain.",
        "Any modification will invalidate the on-chain hash.",
        "=" * 60,
    ]

    # Convert to PDF stream
    stream_content = ""
    y = 750
    for tl in text_lines:
        safe = tl.replace("(", "\\(").replace(")", "\\)")
        stream_content += f"BT /F1 9 Tf 50 {y} Td ({safe}) Tj ET\n"
        y -= 14
        if y < 50:
            break

    stream = f"4 0 obj<</Length {len(stream_content)}>>stream\n{stream_content}endstream\nendobj"
    lines.append(stream)

    # Build PDF
    pdf_content = "\n".join(lines)
    xref_offset = len(pdf_content)
    pdf_content += f"\nxref\n0 6\n0000000000 65535 f \n"
    pdf_content += f"trailer<</Size 6/Root 1 0 R>>\nstartxref\n{xref_offset}\n%%EOF"

    return pdf_content.encode("latin-1")


# Get 2 partnerships to generate PDFs for
partnerships = supabase.table("partnerships").select("*").eq("status", "accepted").eq("type", "supplier_distributor").limit(2).execute().data or []

if not partnerships:
    print("No accepted partnerships found!")
    exit()

# Get user names
import requests as req
headers = {"apikey": os.getenv("SUPABASE_KEY"), "Authorization": f"Bearer {os.getenv('SUPABASE_KEY')}"}
resp = req.get(f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users", headers=headers, timeout=15)
name_map = {}
for u in resp.json().get("users", []):
    meta = u.get("user_metadata", {}) or {}
    name_map[u["id"]] = meta.get("business_name", meta.get("full_name", ""))

for p in partnerships:
    approver_name = name_map.get(p["approver_id"], "Supplier")
    requester_name = name_map.get(p["requester_id"], "Distributor")
    pid = p["id"]

    print(f"\nGenerating PDF for: {approver_name} <-> {requester_name}")

    pdf_bytes = generate_mou_pdf(
        party_a=approver_name,
        party_b=requester_name,
        region=p.get("mou_region", ""),
        terms=p.get("mou_terms", ""),
        mou_hash=p.get("mou_hash", ""),
        nft_address=p.get("nft_mint_address", "N/A"),
        date_str=datetime.utcnow().strftime("%d %B %Y"),
    )

    filename = f"MOU_{approver_name.replace(' ', '_')}_{requester_name.replace(' ', '_')}.pdf"
    file_path = f"mou/{pid}/{filename}"

    try:
        supabase.storage.from_("mou-documents").upload(file_path, pdf_bytes, {"content-type": "application/pdf"})
        file_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/mou-documents/{file_path}"
        print(f"  [UPLOADED] {file_url}")

        # Update partnership with document URL
        supabase.table("partnerships").update({"mou_document_url": file_url}).eq("id", pid).execute()
        print(f"  [UPDATED] Partnership record")
    except Exception as e:
        print(f"  [ERR] {e}")

print("\nDone!")
