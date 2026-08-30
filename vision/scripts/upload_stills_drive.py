#!/usr/bin/env python3
"""Upload EP001 stills PNGs to Founder Google Drive folder 01_stills."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT_FOLDER = os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "1aGyG0KCS_4q9aaGIFDO615R-47JUOE5U").strip()
STILLS = os.path.join(os.path.dirname(__file__), "..", "episodes", "EP001_Last_Delivery", "stills")
DRIVE_FILES = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"


def load_sa() -> dict:
    raw = (os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    if not raw:
        raise SystemExit("GOOGLE_SERVICE_ACCOUNT_JSON missing")
    if raw.startswith("{"):
        return json.loads(raw)
    with open(raw, encoding="utf-8") as f:
        return json.load(f)


def jwt_bearer(sa: dict) -> str:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request

    creds = service_account.Credentials.from_service_account_info(
        sa,
        scopes=["https://www.googleapis.com/auth/drive"],
    )
    creds.refresh(Request())
    return creds.token


def find_or_create_child(token: str, parent: str, name: str) -> str:
    q = (
        f"name = '{name}' and '{parent}' in parents and "
        "mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    url = DRIVE_FILES + "?q=" + urllib.parse.quote(q) + "&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        files = json.load(resp).get("files") or []
    if files:
        return files[0]["id"]
    body = json.dumps({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent],
    }).encode()
    req = urllib.request.Request(
        DRIVE_FILES + "?supportsAllDrives=true",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)["id"]


def upload_png(token: str, folder_id: str, path: str) -> str:
    name = os.path.basename(path)
    meta = json.dumps({"name": name, "parents": [folder_id]}).encode()
    with open(path, "rb") as f:
        png = f.read()
    boundary = "====vision===="
    parts = [
        f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".encode() + meta + b"\r\n",
        f"--{boundary}\r\nContent-Type: image/png\r\n\r\n".encode() + png + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    body = b"".join(parts)
    url = DRIVE_UPLOAD + "?uploadType=multipart&supportsAllDrives=true"
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp).get("id", "")


def main() -> int:
    sa = load_sa()
    print("SA email:", sa.get("client_email", "?"))
    token = jwt_bearer(sa)
    stills_id = find_or_create_child(token, ROOT_FOLDER, "01_stills")
    print("Drive 01_stills id", stills_id)
    if not os.path.isdir(STILLS):
        print("no local stills dir")
        return 1
    ok = 0
    for name in sorted(os.listdir(STILLS)):
        if not name.lower().endswith(".png"):
            continue
        path = os.path.join(STILLS, name)
        try:
            fid = upload_png(token, stills_id, path)
            print(f"uploaded {name} -> {fid}")
            ok += 1
        except urllib.error.HTTPError as e:
            print(f"FAIL {name}: HTTP {e.code} {e.read()[:400]}")
        except Exception as e:
            print(f"FAIL {name}: {e}")
    print("uploaded", ok)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
