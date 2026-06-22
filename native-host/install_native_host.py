#!/usr/bin/env python3
import json
import os
import pwd
import shutil
import stat
from pathlib import Path

HOST_NAME = "com.xianjieng.ecourtautoscreenshot"
EXTENSION_ID = "jpcfkpbhigneblbnckmpdjlgmjdbcife"
REAL_HOME = Path(pwd.getpwuid(os.getuid()).pw_dir)
APP_SUPPORT_DIR = REAL_HOME / "Library/Application Support/eCourt Auto Screenshot"
CHROME_HOSTS_DIR = REAL_HOME / "Library/Application Support/Google/Chrome/NativeMessagingHosts"
SCRIPT_SOURCE = Path(__file__).resolve().parent / "ecourt_native_host.py"
SCRIPT_TARGET = APP_SUPPORT_DIR / "ecourt_native_host.py"
CONFIG_PATH = APP_SUPPORT_DIR / "config.json"
MANIFEST_PATH = CHROME_HOSTS_DIR / f"{HOST_NAME}.json"
DEFAULT_DATA_PATH = REAL_HOME / "Documents/eCourt Auto Screenshot/credentials.json"


def write_text(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main():
    data_path = Path(os.environ.get("ECOURT_JSON_PATH", str(DEFAULT_DATA_PATH))).expanduser()

    APP_SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    CHROME_HOSTS_DIR.mkdir(parents=True, exist_ok=True)
    data_path.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(SCRIPT_SOURCE, SCRIPT_TARGET)
    SCRIPT_TARGET.chmod(SCRIPT_TARGET.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    config = {
        "data_path": str(data_path)
    }
    write_text(CONFIG_PATH, json.dumps(config, indent=2))

    manifest = {
        "name": HOST_NAME,
        "description": "Persistent JSON writer for eCourt Auto Screenshot",
        "path": str(SCRIPT_TARGET),
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{EXTENSION_ID}/"
        ]
    }
    write_text(MANIFEST_PATH, json.dumps(manifest, indent=2))

    if not data_path.exists():
        write_text(data_path, json.dumps({"version": 1, "updatedAt": None, "records": []}, indent=2))

    print("Installed native host successfully")
    print(f"Host manifest: {MANIFEST_PATH}")
    print(f"Helper script: {SCRIPT_TARGET}")
    print(f"Config: {CONFIG_PATH}")
    print(f"Persistent JSON file: {data_path}")
    print(f"Allowed extension id: {EXTENSION_ID}")


if __name__ == "__main__":
    main()
