# eCourt Auto Screenshot

Chrome extension yang otomatis screenshot popup (username/password) di eCourt. Popup muncul sebentar? Gak masalah — extension ini detect & capture sebelum ilang.

## Install

1. Download/clone repo ini
2. Buka Chrome → `chrome://extensions/`
3. Aktifkan **Developer mode** (toggle kanan atas)
4. Klik **Load unpacked** → pilih folder ini
5. Selesai! Extension aktif otomatis di `ecourt.mahkamahagung.go.id`

## Cara Pakai

### Otomatis
Buka eCourt seperti biasa. Extension memantau popup credential eCourt model `Pesan / Data user / User|username / Password`, lalu:
- auto-screenshot ke folder Downloads
- ambil teks **user** dan **password** dari popup
- simpan record JSON ke `chrome.storage.local`

### Manual
- Klik icon extension di toolbar → tombol **📸 Screenshot Sekarang**
- Atau tekan **Alt + S** di keyboard

### Scan Ulang
Kalau popup udah muncul sebelum extension aktif, klik **🔍 Scan Ulang Halaman** di popup extension.

### Export Data
- **📝 Export ke Word** → download file `.doc` yang bisa dibuka di Microsoft Word
- **🗂️ Export JSON** → download backup `.json`
- **🧹 Hapus Data Tersimpan** → kosongkan log yang ada di `chrome.storage.local`

## Cara Kerja

- **MutationObserver** — memantau perubahan DOM secara real-time, detect elemen baru yang mirip modal/popup
- **Credential extraction** — ambil teks `User/username` dan `Password` langsung dari DOM popup
- **Z-index + position** — elemen dengan z-index tinggi + position fixed/absolute otomatis terdeteksi sebagai modal
- **Cooldown 3 detik** — cegah spam screenshot untuk popup yang sama
- **Fallback html2canvas** — kalau `captureVisibleTab` gagal, tetap bisa capture via canvas rendering
- **JSON log storage** — data disimpan di `chrome.storage.local`, bukan di folder root extension (folder extension read-only saat runtime)

## File Structure

```
├── manifest.json        # Manifest V3, host permissions untuk ecourt
├── content.js           # Content script — DOM monitoring & detection
├── background.js        # Service worker — screenshot capture, download, simpan log JSON
├── popup.html           # Extension popup UI + export controls
├── popup.js             # Popup logic (toggle, manual capture, export Word/JSON)
├── html2canvas.min.js   # Fallback screenshot library
├── icon48.png           # Icon 48x48
└── icon128.png          # Icon 128x128
```

## Permissions

| Permission | Alasan |
|-----------|--------|
| `activeTab` | Capture screenshot tab aktif |
| `downloads` | Auto-download screenshot |
| `scripting` | Inject html2canvas sebagai fallback |
| `storage` | Simpan JSON log user/password dan state extension |
| `host_permissions` | Hanya aktif di `ecourt.mahkamahagung.go.id` |

## Troubleshooting

**Popup gak ke-detect?**
- Buka DevTools (F12) → inspect popup-nya
- Kirim class/id element popup-nya, bisa ditambahin ke detection rules

**Screenshot kosong / putih?**
- Coba klik **📸 Screenshot Sekarang** manual
- Pastikan tab eCourt yang aktif (bukan tab lain)

**Download gak jalan?**
- Cek Chrome Settings → Downloads → pastikan "Ask where to save" **dimatikan**

## License

MIT
