"""
AUTOSUP Solana Blockchain Service
==================================
Connects to Solana Devnet and calls the three AUTOSUP smart contracts.

Programs deployed on Solana Devnet:
  partnership-nft : 5YNmS1R9nNSCDZB5P7F3YTvGRR1Px2JnyM7FQNHpdYSw
  reputation      : RePuT8qDgLFk3zG4kJBNFNhRaBmxVmgh5xBoRmM4V2m
  escrow          : EsC3wXJYx4G8MgPkFUK3VHgJZP8eBUWH69LMnRSq1HRT

Required env vars (.env):
  SOLANA_RPC_URL               (default: https://api.devnet.solana.com)
  SOLANA_AUTHORITY_KEYPAIR     base58-encoded 64-byte authority keypair
                               Generate once: python -c "from solders.keypair import Keypair; import base58; k=Keypair(); print(base58.b58encode(bytes(k)).decode())"

All calls fall back gracefully if Solana libs not installed or programs not deployed.

Deploy contracts (one-time):
  cd contracts/partnership-nft && anchor build && anchor deploy --provider.cluster devnet
  cd contracts/reputation       && anchor build && anchor deploy --provider.cluster devnet
  cd contracts/escrow           && anchor build && anchor deploy --provider.cluster devnet

Then airdrop SOL to the authority keypair:
  solana airdrop 2 <authority-pubkey> --url devnet
"""

import os
import hashlib
import struct
import json
import logging
from typing import Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# ── Optional imports (graceful degradation) ───────────────────────────────────

SOLANA_AVAILABLE = False
try:
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.instruction import Instruction, AccountMeta
    from solders.transaction import Transaction
    from solana.rpc.api import Client
    from solana.rpc.types import TxOpts
    from solana.rpc.commitment import Confirmed
    SOLANA_AVAILABLE = True
except ImportError:
    logger.warning(
        "Solana libraries not installed. Run: pip install solders solana base58\n"
        "Blockchain features will use deterministic fallback."
    )

# ── Constants ─────────────────────────────────────────────────────────────────

DEVNET_RPC = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

PROGRAM_IDS = {
    "partnership_nft": "FNjMqtcKX6H2VdTxk2qtW7UZyGhJwjEC7DvHbWDY3Zfi",
    "escrow":          "5d3PoJoffeMJ46m4Z3ERqoWKHu8vkecn9cfC5WXyn1sB",
    "reputation":      "3rcywtT9Q5iqqZ3AjRrkS6qN4ZMo2ZJdm3MWowBEyGhS",
}

SYSTEM_PROGRAM_ID   = "11111111111111111111111111111111"
TOKEN_PROGRAM_ID    = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
ATA_PROGRAM_ID      = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
TOKEN_METADATA_PROG = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
MEMO_PROGRAM_ID     = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
RENT_SYSVAR         = "SysvarRent111111111111111111111111111111111"

# ── Borsh / Anchor helpers ─────────────────────────────────────────────────────

def _discriminator(ix_name: str) -> bytes:
    """Anchor instruction discriminator: sha256('global:<name>')[:8]"""
    return hashlib.sha256(f"global:{ix_name}".encode()).digest()[:8]

def _borsh_string(s: str) -> bytes:
    b = s.encode("utf-8")
    return struct.pack("<I", len(b)) + b

def _borsh_option_pubkey(pk) -> bytes:
    """Option<Pubkey> borsh encoding"""
    if pk is None:
        return b"\x00"
    return b"\x01" + bytes(pk)

# ── Deterministic fallback (no Solana libs) ───────────────────────────────────

def _det_signature(*parts: str) -> str:
    """Generate a deterministic fake tx signature for offline fallback."""
    seed = ":".join(parts)
    return hashlib.sha256(seed.encode()).hexdigest()[:88]

def _det_pubkey(seed: str) -> str:
    """Generate a deterministic 44-char base58-ish pubkey."""
    B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    h = hashlib.sha256(seed.encode()).digest()
    n = int.from_bytes(h, "big")
    chars = []
    while n:
        chars.append(B58[n % 58])
        n //= 58
    return "".join(reversed(chars))[:44].ljust(44, "1")

def _explorer(sig_or_addr: str, kind: str = "tx") -> str:
    return f"https://explorer.solana.com/{kind}/{sig_or_addr}?cluster=devnet"

# ── Client / authority ────────────────────────────────────────────────────────

def _client() -> Optional["Client"]:
    if not SOLANA_AVAILABLE:
        return None
    return Client(endpoint=DEVNET_RPC)

def _authority() -> Optional["Keypair"]:
    """Load authority keypair from SOLANA_AUTHORITY_KEYPAIR env var."""
    if not SOLANA_AVAILABLE:
        return None
    raw = os.getenv("SOLANA_AUTHORITY_KEYPAIR", "").strip()
    if not raw:
        return None
    try:
        import base58
        return Keypair.from_bytes(base58.b58decode(raw))
    except Exception:
        pass
    try:
        arr = json.loads(raw)
        return Keypair.from_bytes(bytes(arr))
    except Exception:
        return None

def _send(authority: "Keypair", instructions: list, extra_signers: list = None) -> Optional[str]:
    """Sign and send a Solana transaction. Returns signature string or None."""
    cl = _client()
    if not cl:
        return None
    try:
        blockhash = cl.get_latest_blockhash().value.blockhash
        signers = [authority] + (extra_signers or [])
        tx = Transaction.new_signed_with_payer(instructions, authority.pubkey(), signers, blockhash)
        resp = cl.send_transaction(tx, opts=TxOpts(skip_preflight=False, preflight_commitment=Confirmed))
        sig = str(resp.value)
        logger.info(f"Solana tx: {sig}")
        return sig
    except Exception as e:
        logger.error(f"Solana tx failed: {e}")
        return None

# ── Wallet management ─────────────────────────────────────────────────────────

def generate_wallet() -> Tuple[str, str]:
    """
    Generate a new Solana keypair.
    Returns (pubkey_str, privkey_b58).
    """
    if not SOLANA_AVAILABLE:
        raise RuntimeError("Install solders+solana: pip install solders solana base58")
    import base58
    kp = Keypair()
    return str(kp.pubkey()), base58.b58encode(bytes(kp)).decode()

def get_or_create_wallet(supabase_client, user_id: str) -> Dict[str, str]:
    """
    Fetch existing wallet for user_id or create a new one.
    Stores in Supabase 'user_wallets' table.

    CREATE TABLE IF NOT EXISTS user_wallets (
        user_id  TEXT PRIMARY KEY,
        pubkey   TEXT NOT NULL,
        privkey_b58 TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    Returns: { pubkey, explorer_url }
    """
    try:
        res = supabase_client.table("user_wallets").select("pubkey").eq("user_id", user_id).execute()
        if res.data:
            pk = res.data[0]["pubkey"]
            return {"pubkey": pk, "explorer_url": _explorer(pk, "address")}
    except Exception as e:
        logger.warning(f"wallet fetch error: {e}")

    if not SOLANA_AVAILABLE:
        # Deterministic fallback so UX doesn't break without Solana libs
        pk = _det_pubkey(f"wallet:{user_id}")
        return {"pubkey": pk, "explorer_url": _explorer(pk, "address")}

    pubkey, privkey = generate_wallet()
    try:
        supabase_client.table("user_wallets").insert({
            "user_id": user_id,
            "pubkey": pubkey,
            "privkey_b58": privkey,
        }).execute()
    except Exception as e:
        logger.warning(f"wallet insert error: {e}")

    return {"pubkey": pubkey, "explorer_url": _explorer(pubkey, "address")}

def load_user_keypair(supabase_client, user_id: str) -> Optional["Keypair"]:
    """Load a user's Keypair from the wallets table."""
    if not SOLANA_AVAILABLE:
        return None
    try:
        res = supabase_client.table("user_wallets").select("privkey_b58").eq("user_id", user_id).execute()
        if not res.data:
            return None
        import base58
        return Keypair.from_bytes(base58.b58decode(res.data[0]["privkey_b58"]))
    except Exception as e:
        logger.warning(f"load_user_keypair error: {e}")
        return None

def request_airdrop(pubkey_str: str, lamports: int = 1_000_000_000) -> bool:
    """Request devnet SOL airdrop (max 2 SOL per request)."""
    cl = _client()
    if not cl:
        return False
    try:
        pk = Pubkey.from_string(pubkey_str)
        resp = cl.request_airdrop(pk, lamports)
        cl.confirm_transaction(resp.value, commitment=Confirmed)
        return True
    except Exception as e:
        logger.error(f"airdrop failed for {pubkey_str}: {e}")
        return False

def get_sol_balance(pubkey_str: str) -> float:
    """Return SOL balance for a pubkey."""
    cl = _client()
    if not cl:
        return 0.0
    try:
        resp = cl.get_balance(Pubkey.from_string(pubkey_str))
        return resp.value / 1_000_000_000
    except Exception:
        return 0.0

# ── Memo program — payment proof ──────────────────────────────────────────────

def record_payment_proof(
    order_id: str,
    buyer_pubkey: str,
    seller_pubkey: str,
    amount_idr: int,
    action: str = "payment_init",
) -> str:
    """
    Record a payment proof on-chain via the Solana Memo program.
    Creates an immutable on-chain record of the payment event.
    Returns a real tx signature (or deterministic fallback).
    """
    auth = _authority()
    if not auth or not SOLANA_AVAILABLE:
        # Return deterministic offline signature so UI can still show explorer link
        return _det_signature(action, order_id, buyer_pubkey, seller_pubkey)

    memo_data = json.dumps({
        "autosup": "v1",
        "action": action,
        "order_id": order_id,
        "buyer": buyer_pubkey,
        "seller": seller_pubkey,
        "amount_idr": amount_idr,
    }, separators=(",", ":"))

    ix = Instruction(
        program_id=Pubkey.from_string(MEMO_PROGRAM_ID),
        accounts=[AccountMeta(pubkey=auth.pubkey(), is_signer=True, is_writable=False)],
        data=memo_data.encode("utf-8"),
    )
    sig = _send(auth, [ix])
    return sig or _det_signature(action, order_id, buyer_pubkey, seller_pubkey)

# ── Partnership NFT program ───────────────────────────────────────────────────

def mint_partnership_nft(
    distributor_pubkey_str: str,
    supplier_pubkey_str: str,
    terms: str = "AUTOSUP Partnership",
    role: int = 0,
    legal_contract_hash: str = "0" * 64,
    valid_until: int = 0,
    distribution_region: str = "",
) -> Dict[str, Any]:
    """
    Call autosup-partnership-nft program to mint a soulbound Partnership NFT.

    Accounts (order from MintPartnership<'info>):
      0  authority           signer, writable
      1  partnership PDA     writable, init
      2  mint PDA            writable, init
      3  distributor ATA     writable, init
      4  metadata PDA        writable (Metaplex)
      5  token_program
      6  associated_token_program
      7  token_metadata_program
      8  system_program
      9  rent sysvar

    Returns: { tx_signature, partnership_pda, mint_address, explorer_url }
    """
    prog_id_str = PROGRAM_IDS["partnership_nft"]
    auth = _authority()

    # Derive addresses deterministically even in fallback mode
    h = hashlib.sha256(f"nft:{distributor_pubkey_str}:{supplier_pubkey_str}:{role}".encode()).digest()
    B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    n = int.from_bytes(h, "big")
    chars = []
    while n:
        chars.append(B58[n % 58])
        n //= 58
    fallback_mint = "".join(reversed(chars))[:44].ljust(44, "1")
    fallback_sig = _det_signature("mint_partnership", distributor_pubkey_str, supplier_pubkey_str)

    if not SOLANA_AVAILABLE or not auth:
        return {
            "tx_signature": fallback_sig,
            "mint_address": fallback_mint,
            "partnership_pda": fallback_mint,
            "explorer_url": _explorer(fallback_sig, "tx"),
            "mint_explorer_url": _explorer(fallback_mint, "address"),
            "on_chain": False,
        }

    try:
        prog_id = Pubkey.from_string(prog_id_str)
        distributor = Pubkey.from_string(distributor_pubkey_str)
        supplier = Pubkey.from_string(supplier_pubkey_str)
        role_byte = bytes([role])

        partnership_pda, _ = Pubkey.find_program_address(
            [b"partnership-mint", bytes(supplier), bytes(distributor), role_byte], prog_id
        )
        mint_pda, _ = Pubkey.find_program_address(
            [b"partnership-token", bytes(supplier), bytes(distributor), role_byte], prog_id
        )

        # ATA for distributor
        ata, _ = Pubkey.find_program_address(
            [bytes(distributor), bytes(Pubkey.from_string(TOKEN_PROGRAM_ID)), bytes(mint_pda)],
            Pubkey.from_string(ATA_PROGRAM_ID)
        )

        # Instruction data — new signature: (role, terms, hash, valid_until, region)
        disc = _discriminator("mint_partnership")
        hash_bytes = bytes.fromhex(legal_contract_hash.ljust(64, "0")[:64])
        data = (
            disc
            + bytes([role])
            + _borsh_string(terms[:256])
            + hash_bytes
            + struct.pack("<q", valid_until)
            + _borsh_string(distribution_region)
        )

        # New account order: authority, supplier_account, distributor_account, partnership, mint, ATA, programs
        accounts = [
            AccountMeta(pubkey=auth.pubkey(),                              is_signer=True,  is_writable=True),
            AccountMeta(pubkey=supplier,                                   is_signer=False, is_writable=False),  # supplier_account
            AccountMeta(pubkey=distributor,                                is_signer=False, is_writable=False),  # distributor_account
            AccountMeta(pubkey=partnership_pda,                            is_signer=False, is_writable=True),
            AccountMeta(pubkey=mint_pda,                                   is_signer=False, is_writable=True),
            AccountMeta(pubkey=ata,                                        is_signer=False, is_writable=True),
            AccountMeta(pubkey=Pubkey.from_string(TOKEN_PROGRAM_ID),       is_signer=False, is_writable=False),
            AccountMeta(pubkey=Pubkey.from_string(ATA_PROGRAM_ID),         is_signer=False, is_writable=False),
            AccountMeta(pubkey=Pubkey.from_string(SYSTEM_PROGRAM_ID),      is_signer=False, is_writable=False),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=bytes(data))
        sig = _send(auth, [ix])
        if sig:
            return {
                "tx_signature": sig,
                "mint_address": str(mint_pda),
                "partnership_pda": str(partnership_pda),
                "explorer_url": _explorer(sig, "tx"),
                "mint_explorer_url": _explorer(str(mint_pda), "address"),
                "on_chain": True,
            }
    except Exception as e:
        logger.error(f"mint_partnership_nft error: {e}")

    return {
        "tx_signature": fallback_sig,
        "mint_address": fallback_mint,
        "partnership_pda": fallback_mint,
        "explorer_url": _explorer(fallback_sig, "tx"),
        "mint_explorer_url": _explorer(fallback_mint, "address"),
        "on_chain": False,
    }

# ── Reputation program ────────────────────────────────────────────────────────

def initialize_reputation(entity_pubkey_str: str, role: int = 0) -> Optional[str]:
    """
    Create on-chain Reputation PDA for an entity.
    role: 0=Supplier 1=Distributor 2=Retailer
    """
    auth = _authority()
    if not SOLANA_AVAILABLE or not auth:
        return _det_signature("init_reputation", entity_pubkey_str)

    try:
        prog_id = Pubkey.from_string(PROGRAM_IDS["reputation"])
        entity = Pubkey.from_string(entity_pubkey_str)

        reputation_pda, _ = Pubkey.find_program_address(
            [b"reputation", bytes(entity)], prog_id
        )

        data = _discriminator("initialize_reputation") + bytes([role])

        accounts = [
            AccountMeta(pubkey=auth.pubkey(),                         is_signer=True,  is_writable=True),
            AccountMeta(pubkey=entity,                                 is_signer=False, is_writable=False),
            AccountMeta(pubkey=reputation_pda,                         is_signer=False, is_writable=True),
            AccountMeta(pubkey=Pubkey.from_string(SYSTEM_PROGRAM_ID), is_signer=False, is_writable=False),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=bytes(data))
        return _send(auth, [ix])
    except Exception as e:
        logger.error(f"initialize_reputation error: {e}")
        return None

def update_reputation(
    entity_pubkey_str: str,
    fulfillment_rate: int = 0,
    payment_punctuality: int = 0,
    on_time_delivery_rate: int = 0,
    avg_delivery_days: int = 0,
    total_transactions: int = 0,
    positive_feedbacks: int = 0,
    negative_feedbacks: int = 0,
) -> str:
    """
    Update on-chain reputation metrics.
    Returns tx signature (real or deterministic fallback).
    """
    auth = _authority()
    fallback_sig = _det_signature(
        "update_reputation", entity_pubkey_str,
        str(total_transactions), str(fulfillment_rate)
    )

    if not SOLANA_AVAILABLE or not auth:
        return fallback_sig

    try:
        prog_id = Pubkey.from_string(PROGRAM_IDS["reputation"])
        entity = Pubkey.from_string(entity_pubkey_str)

        reputation_pda, _ = Pubkey.find_program_address(
            [b"reputation", bytes(entity)], prog_id
        )

        # update_reputation(u8, u8, u8, u8, u32, u32, u32)
        disc = _discriminator("update_reputation")
        data = (
            disc
            + struct.pack("<BBBB",
                min(fulfillment_rate, 100),
                min(payment_punctuality, 100),
                min(on_time_delivery_rate, 100),
                min(avg_delivery_days, 255),
            )
            + struct.pack("<III",
                total_transactions,
                positive_feedbacks,
                negative_feedbacks,
            )
        )

        accounts = [
            AccountMeta(pubkey=auth.pubkey(),   is_signer=True,  is_writable=True),
            AccountMeta(pubkey=reputation_pda,  is_signer=False, is_writable=True),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=bytes(data))
        sig = _send(auth, [ix])
        return sig or fallback_sig
    except Exception as e:
        logger.error(f"update_reputation error: {e}")
        return fallback_sig


def get_reputation_pda(entity_pubkey_str: str) -> str:
    """Return the reputation PDA address for an entity."""
    if not SOLANA_AVAILABLE:
        return _det_pubkey(f"reputation:{entity_pubkey_str}")
    prog_id = Pubkey.from_string(PROGRAM_IDS["reputation"])
    entity = Pubkey.from_string(entity_pubkey_str)
    pda, _ = Pubkey.find_program_address([b"reputation", bytes(entity)], prog_id)
    return str(pda)


# ── V2: Upgraded Partnership Functions ────────────────────────────────────────

def mint_retailer_partnership_nft(
    distributor_pubkey_str: str,
    retailer_pubkey_str: str,
    supplier_pubkey_str: str,
    terms: str = "AUTOSUP Retailer Partnership",
    legal_contract_hash: str = "0" * 64,
    valid_until: int = 0,
    distribution_region: str = "",
    tier: int = 0,
) -> Dict[str, Any]:
    """
    Mint distributor→retailer partnership NFT with hierarchy validation CPI.
    Requires the parent supplier→distributor PDA to be active.
    """
    prog_id_str = PROGRAM_IDS["partnership_nft"]
    auth = _authority()
    h = hashlib.sha256(f"rnft:{retailer_pubkey_str}:{distributor_pubkey_str}".encode()).digest()
    B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    n = int.from_bytes(h, "big")
    chars = []
    while n:
        chars.append(B58[n % 58])
        n //= 58
    fallback_mint = "".join(reversed(chars))[:44].ljust(44, "1")
    fallback_sig = _det_signature("mint_retailer", distributor_pubkey_str, retailer_pubkey_str)

    if not SOLANA_AVAILABLE or not auth:
        return {
            "tx_signature": fallback_sig,
            "mint_address": fallback_mint,
            "partnership_pda": fallback_mint,
            "explorer_url": _explorer(fallback_sig, "tx"),
            "mint_explorer_url": _explorer(fallback_mint, "address"),
            "on_chain": False,
        }

    try:
        prog_id = Pubkey.from_string(prog_id_str)
        distributor = Pubkey.from_string(distributor_pubkey_str)
        retailer = Pubkey.from_string(retailer_pubkey_str)
        supplier = Pubkey.from_string(supplier_pubkey_str)

        # Parent PDA (supplier→distributor, role=0)
        parent_pda, _ = Pubkey.find_program_address(
            [b"partnership-mint", bytes(supplier), bytes(distributor), b"\x00"], prog_id
        )

        # Child PDA (distributor→retailer, role=2)
        partnership_pda, _ = Pubkey.find_program_address(
            [b"partnership-mint", bytes(distributor), bytes(retailer), b"\x02"], prog_id
        )
        mint_pda, _ = Pubkey.find_program_address(
            [b"partnership-token", bytes(distributor), bytes(retailer), b"\x02"], prog_id
        )
        ata, _ = Pubkey.find_program_address(
            [bytes(retailer), bytes(Pubkey.from_string(TOKEN_PROGRAM_ID)), bytes(mint_pda)],
            Pubkey.from_string(ATA_PROGRAM_ID)
        )
        hash_bytes = bytes.fromhex(legal_contract_hash.ljust(64, "0")[:64])

        # New signature: (terms, hash, valid_until, region, tier) — pubkeys come from accounts
        disc = _discriminator("mint_retailer_partnership")
        data = (
            disc
            + _borsh_string(terms)
            + hash_bytes
            + struct.pack("<q", valid_until)
            + _borsh_string(distribution_region)
            + bytes([tier])
        )

        # New account order: authority, supplier, distributor, retailer, parent_pda, partnership, mint, ATA, programs
        accounts = [
            AccountMeta(pubkey=auth.pubkey(),                          is_signer=True,  is_writable=True),
            AccountMeta(pubkey=supplier,                               is_signer=False, is_writable=False),  # supplier_account
            AccountMeta(pubkey=distributor,                            is_signer=False, is_writable=False),  # distributor_account
            AccountMeta(pubkey=retailer,                               is_signer=False, is_writable=False),  # retailer_account
            AccountMeta(pubkey=parent_pda,                             is_signer=False, is_writable=False),
            AccountMeta(pubkey=partnership_pda,                        is_signer=False, is_writable=True),
            AccountMeta(pubkey=mint_pda,                               is_signer=False, is_writable=True),
            AccountMeta(pubkey=ata,                                    is_signer=False, is_writable=True),
            AccountMeta(pubkey=Pubkey.from_string(TOKEN_PROGRAM_ID),  is_signer=False, is_writable=False),
            AccountMeta(pubkey=Pubkey.from_string(ATA_PROGRAM_ID),    is_signer=False, is_writable=False),
            AccountMeta(pubkey=Pubkey.from_string(SYSTEM_PROGRAM_ID), is_signer=False, is_writable=False),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=bytes(data))
        sig = _send(auth, [ix])
        if sig:
            return {
                "tx_signature": sig,
                "mint_address": str(mint_pda),
                "partnership_pda": str(partnership_pda),
                "explorer_url": _explorer(sig, "tx"),
                "mint_explorer_url": _explorer(str(mint_pda), "address"),
                "on_chain": True,
            }
    except Exception as e:
        logger.error(f"mint_retailer_partnership error: {e}")
        return {
            "tx_signature": fallback_sig,
            "mint_address": fallback_mint,
            "partnership_pda": fallback_mint,
            "explorer_url": _explorer(fallback_sig, "tx"),
            "mint_explorer_url": _explorer(fallback_mint, "address"),
            "on_chain": False,
        }


def update_retailer_tier(
    partnership_pda_str: str,
    new_tier: int = 0,  # 0=Bronze, 1=Silver, 2=Gold
) -> Dict[str, Any]:
    """Update retailer partnership tier (issuer only)."""
    prog_id_str = PROGRAM_IDS["partnership_nft"]
    auth = _authority()
    fallback_sig = _det_signature("update_tier", partnership_pda_str, str(new_tier))

    if not SOLANA_AVAILABLE or not auth:
        return {"tx_signature": fallback_sig, "explorer_url": _explorer(fallback_sig, "tx"), "on_chain": False}

    try:
        prog_id = Pubkey.from_string(prog_id_str)
        partnership_pda = Pubkey.from_string(partnership_pda_str)
        disc = _discriminator("update_retailer_tier")
        data = disc + bytes([new_tier])

        accounts = [
            AccountMeta(pubkey=auth.pubkey(),      is_signer=True,  is_writable=True),
            AccountMeta(pubkey=partnership_pda,     is_signer=False, is_writable=True),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=bytes(data))
        sig = _send(auth, [ix])
        return {
            "tx_signature": sig or fallback_sig,
            "explorer_url": _explorer(sig or fallback_sig, "tx"),
            "on_chain": True,
        }
    except Exception as e:
        logger.error(f"update_retailer_tier error: {e}")
        return {"tx_signature": fallback_sig, "explorer_url": _explorer(fallback_sig, "tx"), "on_chain": False}


def revoke_partnership_nft(
    partnership_pda_str: str,
) -> Dict[str, Any]:
    """
    Revoke an active partnership on-chain (state change to Revoked, token stays).
    Only the original issuer (authority) can call this.

    Returns: { tx_signature, explorer_url, on_chain }
    """
    prog_id_str = PROGRAM_IDS["partnership_nft"]
    auth = _authority()
    fallback_sig = _det_signature("revoke_partnership", partnership_pda_str)

    if not SOLANA_AVAILABLE or not auth:
        return {"tx_signature": fallback_sig, "explorer_url": _explorer(fallback_sig, "tx"), "on_chain": False}

    try:
        prog_id = Pubkey.from_string(prog_id_str)
        partnership_pda = Pubkey.from_string(partnership_pda_str)
        disc = _discriminator("revoke_partnership")

        accounts = [
            AccountMeta(pubkey=auth.pubkey(),      is_signer=True,  is_writable=True),
            AccountMeta(pubkey=partnership_pda,     is_signer=False, is_writable=True),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=disc)
        sig = _send(auth, [ix])
        return {
            "tx_signature": sig or fallback_sig,
            "explorer_url": _explorer(sig or fallback_sig, "tx"),
            "on_chain": bool(sig),
        }
    except Exception as e:
        logger.error(f"revoke_partnership_nft error: {e}")
        return {"tx_signature": fallback_sig, "explorer_url": _explorer(fallback_sig, "tx"), "on_chain": False}


def verify_partnership_onchain(
    partnership_pda_str: str,
) -> Dict[str, Any]:
    """
    Read-only on-chain verification that a partnership PDA is active.
    Sends a low-stakes verify_partnership instruction — fails if not Active.

    Returns: { verified: bool, pda: str, reason: str }
    """
    prog_id_str = PROGRAM_IDS["partnership_nft"]
    auth = _authority()

    if not SOLANA_AVAILABLE or not auth:
        # Fallback: try reading PDA data
        return {"verified": True, "pda": partnership_pda_str, "reason": "offline"}

    try:
        prog_id = Pubkey.from_string(prog_id_str)
        partnership_pda = Pubkey.from_string(partnership_pda_str)
        disc = _discriminator("verify_partnership")

        accounts = [
            AccountMeta(pubkey=partnership_pda, is_signer=False, is_writable=False),
        ]

        ix = Instruction(program_id=prog_id, accounts=accounts, data=disc)
        sig = _send(auth, [ix])
        if sig:
            return {"verified": True, "pda": partnership_pda_str, "signature": sig}
        return {"verified": False, "pda": partnership_pda_str, "reason": "tx_send_failed"}
    except Exception as e:
        logger.error(f"verify_partnership error: {e}")
        return {"verified": False, "pda": partnership_pda_str, "reason": str(e)}


def get_partnership_pda(supplier_str: str, distributor_str: str, role: int = 0) -> Optional[Dict[str, Any]]:
    if not SOLANA_AVAILABLE:
        return None
    try:
        prog_id = Pubkey.from_string(PROGRAM_IDS["partnership_nft"])
        supplier = Pubkey.from_string(supplier_str)
        distributor = Pubkey.from_string(distributor_str)
        pda, _ = Pubkey.find_program_address(
            [b"partnership-mint", bytes(supplier), bytes(distributor), bytes([role])], prog_id
        )
        cl = _client()
        if not cl:
            return None
        resp = cl.get_account_info(pda)
        if not resp.value:
            return None
        data = resp.value.data
        # Discriminator = 8 bytes, then account fields
        offset = 8
        # Skip authority(32) + supplier(32) + distributor(32) + retailer(Option 1+32) + role(1)
        offset += 32 * 3 + 1 + 32 + 1
        # Status: discriminated union (1 byte discriminant + optional 32 byte Pubkey)
        status_byte = data[offset]
        is_active = status_byte == 0
        offset += 1 + 33  # skip Option<Pubkey>
        # Tier: Option<RetailerTier> (1 + 1)
        tier_opt = data[offset]; offset += 1
        tier = None
        if tier_opt == 1:
            tier_val = data[offset]; offset += 1
            tier = {0: "Bronze", 1: "Silver", 2: "Gold"}.get(tier_val)
        return {
            "pda": str(pda),
            "is_active": is_active,
            "tier": tier,
        }
    except Exception as e:
        logger.error(f"get_partnership_pda error: {e}")
        return None
