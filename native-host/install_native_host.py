#!/usr/bin/env python3
import json
import os
import shutil
import stat
import sys
from pathlib import Path

HOST_NAME = "com.xianjieng.ecourtautoscreenshot"
EXTENSION_ID = "jpcfkpbhigneblbnckmpdjlgmjdbcife"
APP_NAME = "eCourt Auto Screenshot"
SCRIPT_SOURCE = Path(__file__).resolve().parent / 'ecourt_native_host.py'


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
        userprofile = Path(os.environ.get('USERPROFILE') or home)
        return userprofile / 'Documents' / APP_NAME / 'credentials.json'
    return home / 'Documents' / APP_NAME / 'credentials.json'


def get_chrome_hosts_dir(home: Path) -> Path:
    if os.name == 'nt':
        local_appdata = Path(os.environ.get('LOCALAPPDATA') or home / 'AppData/Local')
        return local_appdata / 'Google/Chrome/User Data/NativeMessagingHosts'
    return home / 'Library/Application Support/Google/Chrome/NativeMessagingHosts'


REAL_HOME = get_real_home()
APP_SUPPORT_DIR = get_app_support_dir(REAL_HOME)
CHROME_HOSTS_DIR = get_chrome_hosts_dir(REAL_HOME)
SCRIPT_TARGET = APP_SUPPORT_DIR / 'ecourt_native_host.py'
WINDOWS_LAUNCHER = APP_SUPPORT_DIR / 'ecourt_native_host.bat'
CONFIG_PATH = APP_SUPPORT_DIR / 'config.json'
MANIFEST_PATH = CHROME_HOSTS_DIR / f'{HOST_NAME}.json'
DEFAULT_DATA_PATH = get_default_data_path(REAL_HOME)


def write_text(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def write_windows_launcher(script_path: Path, launcher_path: Path):
    content = f'''@echo off
setlocal
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "{script_path}" %*
) else (
  python "{script_path}" %*
)
'''
    write_text(launcher_path, content)


def register_windows_manifest(manifest_path: Path):
    try:
        import winreg  # type: ignore
    except ImportError as exc:
        raise RuntimeError('winreg not available; run installer on Windows') from exc

    create_key = getattr(winreg, 'CreateKey')
    hkey_current_user = getattr(winreg, 'HKEY_CURRENT_USER')
    set_value_ex = getattr(winreg, 'SetValueEx')
    reg_sz = getattr(winreg, 'REG_SZ')

    key_path = fr'Software\\Google\\Chrome\\NativeMessagingHosts\\{HOST_NAME}'
    with create_key(hkey_current_user, key_path) as key:
        set_value_ex(key, None, 0, reg_sz, str(manifest_path))


def install_windows(manifest):
    CHROME_HOSTS_DIR.mkdir(parents=True, exist_ok=True)
    write_windows_launcher(SCRIPT_TARGET, WINDOWS_LAUNCHER)
    manifest['path'] = str(WINDOWS_LAUNCHER)
    write_text(MANIFEST_PATH, json.dumps(manifest, indent=2))
    register_windows_manifest(MANIFEST_PATH)


def install_posix(manifest):
    CHROME_HOSTS_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPT_TARGET.chmod(SCRIPT_TARGET.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    manifest['path'] = str(SCRIPT_TARGET)
    write_text(MANIFEST_PATH, json.dumps(manifest, indent=2))


def main():
    data_path = Path(os.environ.get('ECOURT_JSON_PATH', str(DEFAULT_DATA_PATH))).expanduser()

    APP_SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    data_path.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(SCRIPT_SOURCE, SCRIPT_TARGET)

    config = {
        'data_path': str(data_path)
    }
    write_text(CONFIG_PATH, json.dumps(config, indent=2))

    manifest = {
        'name': HOST_NAME,
        'description': 'Persistent JSON writer for eCourt Auto Screenshot',
        'type': 'stdio',
        'allowed_origins': [
            f'chrome-extension://{EXTENSION_ID}/'
        ]
    }

    if os.name == 'nt':
        install_windows(manifest)
    else:
        install_posix(manifest)

    if not data_path.exists():
        write_text(data_path, json.dumps({'version': 1, 'updatedAt': None, 'records': []}, indent=2))

    print('Installed native host successfully')
    print(f'Platform: {os.name}')
    print(f'Host manifest: {MANIFEST_PATH}')
    if os.name == 'nt':
        print(f'Launcher: {WINDOWS_LAUNCHER}')
    print(f'Helper script: {SCRIPT_TARGET}')
    print(f'Config: {CONFIG_PATH}')
    print(f'Persistent JSON file: {data_path}')
    print(f'Allowed extension id: {EXTENSION_ID}')


if __name__ == '__main__':
    main()
