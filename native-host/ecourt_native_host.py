#!/usr/bin/env python3
import json
import os
import struct
import sys
from datetime import datetime, timezone
from pathlib import Path

HOST_NAME = "com.xianjieng.ecourtautoscreenshot"
APP_NAME = "eCourt Auto Screenshot"


def get_real_home() -> Path:
    if os.name == 'nt':
        return Path.home()

    try:
        import pwd  # type: ignore
        return Path(pwd.getpwuid(os.getuid()).pw_dir)
    except Exception:
        return Path.home()


def get_app_support_dir(home: Path) -> Path:
    if os.name == 'nt':
        appdata = Path(os.environ.get('APPDATA') or home / 'AppData/Roaming')
        return appdata / APP_NAME
    return home / 'Library/Application Support' / APP_NAME


def get_default_data_path(home: Path) -> Path:
    if os.name == 'nt':
        documents = Path(os.environ.get('USERPROFILE') or home) / 'Documents'
        return documents / APP_NAME / 'credentials.json'
    return home / 'Documents' / APP_NAME / 'credentials.json'


REAL_HOME = get_real_home()
APP_SUPPORT_DIR = get_app_support_dir(REAL_HOME)
CONFIG_PATH = APP_SUPPORT_DIR / 'config.json'
DEFAULT_DATA_PATH = get_default_data_path(REAL_HOME)


def load_config():
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {}


def resolve_data_path():
    cfg = load_config()
    configured = cfg.get('data_path')
    if configured:
        return Path(configured).expanduser()
    return DEFAULT_DATA_PATH


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    if len(raw_length) != 4:
        raise RuntimeError('Invalid message length header')
    message_length = struct.unpack('=I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length)
    if len(message) != message_length:
        raise RuntimeError('Incomplete message body')
    return json.loads(message.decode('utf-8'))


def send_message(message):
    encoded = json.dumps(message, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def ensure_parent(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def read_store(path: Path):
    if not path.exists():
        return {'version': 1, 'updatedAt': None, 'records': []}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {'version': 1, 'updatedAt': None, 'records': []}
    if not isinstance(data, dict):
        return {'version': 1, 'updatedAt': None, 'records': []}
    if not isinstance(data.get('records'), list):
        data['records'] = []
    data.setdefault('version', 1)
    data.setdefault('updatedAt', None)
    return data


def write_store(path: Path, payload):
    ensure_parent(path)
    temp_path = path.with_suffix(path.suffix + '.tmp')
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    temp_path.replace(path)


def sanitize(value):
    return str(value or '').strip()


def append_record(message):
    record = message.get('record') or {}
    data_path = resolve_data_path()
    store = read_store(data_path)

    normalized = {
        'id': sanitize(record.get('id')) or f"{int(datetime.now(tz=timezone.utc).timestamp() * 1000)}",
        'capturedAt': sanitize(record.get('capturedAt')) or datetime.now(tz=timezone.utc).isoformat(),
        'username': sanitize(record.get('username')),
        'password': sanitize(record.get('password')),
        'screenshotFile': sanitize(record.get('screenshotFile')),
        'reason': sanitize(record.get('reason')),
        'sourceText': sanitize(record.get('sourceText')),
    }

    if not normalized['username'] and not normalized['password']:
        return {
            'ok': False,
            'error': 'username/password empty',
            'path': str(data_path)
        }

    store['records'].append(normalized)
    store['updatedAt'] = datetime.now(tz=timezone.utc).isoformat()
    write_store(data_path, store)

    return {
        'ok': True,
        'path': str(data_path),
        'count': len(store['records']),
        'saved': normalized,
    }


def get_status(_message=None):
    data_path = resolve_data_path()
    store = read_store(data_path)
    return {
        'ok': True,
        'path': str(data_path),
        'count': len(store.get('records', [])),
        'updatedAt': store.get('updatedAt'),
        'configPath': str(CONFIG_PATH),
        'host': HOST_NAME,
        'platform': os.name,
    }


def main():
    while True:
        message = read_message()
        if message is None:
            break
        action = message.get('action')
        try:
            if action == 'append_record':
                send_message(append_record(message))
            elif action == 'get_status':
                send_message(get_status(message))
            else:
                send_message({'ok': False, 'error': f'Unknown action: {action}'})
        except Exception as exc:
            send_message({'ok': False, 'error': str(exc)})


if __name__ == '__main__':
    main()
