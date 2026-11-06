# Visual Novel TTS server

Dịch vụ tạo MP3 cho player `index_test.html`. Player gọi `POST /tts` để nhận audio/mpeg và trộn MP3 vào bản ghi Canvas bằng Web Audio. `GET /health` dùng để kiểm tra máy chủ.

## Deploy miễn phí trên Render

1. Đẩy thư mục `tts_server` lên GitHub (đã có `render.yaml`).
2. Trên Render chọn **New > Blueprint**, kết nối repository này và xác nhận tạo web service `visual-novel-tts`.
3. Chờ deploy xong, mở URL dạng `https://visual-novel-tts.onrender.com/health`. Kết quả đúng là JSON có `"ok": true`.
4. Mở `index_test.html`, dán URL gốc (không thêm `/tts`) vào ô **Máy chủ TTS MP3**, bấm **Lưu** rồi **Kiểm tra**.

Render Free có thể đưa dịch vụ vào trạng thái ngủ khi không có truy cập; yêu cầu đầu tiên sau thời gian ngủ có thể chậm. Dịch vụ Edge TTS dựa trên thư viện không chính thức và có thể thay đổi theo nhà cung cấp. Không đặt thông tin bí mật trong yêu cầu TTS; endpoint hiện không yêu cầu đăng nhập.

## Chạy thử cục bộ

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Sau đó đặt URL `http://127.0.0.1:8000` trong player trên cùng máy. Điện thoại không thể dùng địa chỉ localhost của máy tính; hãy deploy server công khai hoặc cấu hình mạng nội bộ riêng.
