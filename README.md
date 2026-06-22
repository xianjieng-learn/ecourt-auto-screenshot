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
Buka eCourt seperti biasa. Extension langsung memantau — kalau ada popup modal muncul (apapun bentuknya), langsung auto-screenshot & download ke folder Downloads.

### Manual
- Klik icon extension di toolbar → tombol **📸 Screenshot Sekarang**
- Atau tekan **Alt + S** di keyboard

### Scan Ulang
Kalau popup udah muncul sebelum extension aktif, klik **🔍 Scan Ulang Halaman** di popup extension.

## Cara Kerja

- **MutationObserver** — memantau perubahan DOM secara real-time, detect elemen baru yang mirip modal/popup
- **Keyword detection** — cari kata "username", "password", "sandi", "login", dll di dalam elemen yang terdeteksi
- **Z-index + position** — elemen dengan z-index tinggi + position fixed/absolute otomatis terdeteksi sebagai modal
- **Cooldown 3 detik** — cegah spam screenshot untuk popup yang sama
- **Fallback html2canvas** — kalau `captureVisibleTab` gagal, tetap bisa capture via canvas rendering

## File Structure

```
├── manifest.json        # Manifest V3, host permissions untuk ecourt
├── content.js           # Content script — DOM monitoring & detection
├── background.js        # Service worker — screenshot capture & download
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic (toggle, manual capture)
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
