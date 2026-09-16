# Local Bridge Server RPM (Python / Node.js)

Folder ini berisi server lokal alternatif (Python & Node.js) untuk membaca data dari direktori `D:\CAS_OPERATOR` secara aman (**100% Read-Only**).

> [!IMPORTANT]
> **Jaminan Keamanan**: Server ini hanya melakukan pembacaan (*SELECT* query dan *read binary* foto snapshot). Tidak ada query `UPDATE`, `INSERT`, `DELETE`, atau modifikasi file yang dijalankan.

---

## 1. Menjalankan Server Python
Server Python ini menggunakan modul bawaan Python tanpa perlu instalasi library eksternal rumit:

```powershell
cd c:\laragon\www\monitoring_rpm\server_local
python server.py
```
Server akan berjalan di: `http://127.0.0.1:5001`

---

## 2. Menjalankan Server Node.js
Jika ingin menggunakan Node.js:

```powershell
cd c:\laragon\www\monitoring_rpm\server_local
npm install express
node server.js
```
Server akan berjalan di: `http://127.0.0.1:5002`

---

## 3. Menjalankan Langsung via Laravel (Rekomendasi)
Aplikasi web utama Laravel sudah terhubung langsung ke `D:\CAS_OPERATOR` menggunakan ekstensi SQLite PDO bawaan Laragon. Anda tidak perlu menyalakan server lokal terpisah jika sudah menjalankan Laravel:

```powershell
cd c:\laragon\www\monitoring_rpm
php artisan serve --port=5000
```
Akses web langsung di: `http://127.0.0.1:5000`
