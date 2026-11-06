# Visual Novel Offline Video Exporter (Windows)

Ứng dụng desktop thử nghiệm để dựng video MP4 từ cấu trúc Visual Novel hiện tại của repository.

## Chuẩn bị

- Windows 10/11 64-bit
- Python 3.10+
- Giọng đọc Windows SAPI5 đã cài (để TTS chạy offline)
- Các thư mục tài nguyên theo cấu trúc:
  - `assets/Nen/`
  - `assets/NhanVat/<Tên nhân vật>/<Biểu cảm>.webm`
  - `assets/HieuUng/`
  - `assets/AmThanh/Nen/`
  - `assets/AmThanh/HieuUng/`

## Chạy từ mã nguồn

Mở CMD tại thư mục `desktop_exporter`:

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Chọn file JSON, thư mục gốc chứa `assets`, nơi lưu MP4 và tỷ lệ ngang/dọc.

## Ghi chú bản thử nghiệm

- TTS được tạo trước thành WAV bằng Windows SAPI5; không gọi dịch vụ online trong lúc xuất.
- FFmpeg dựng từng cảnh và ghép thành MP4 H.264/AAC.
- Hình nền ảnh, video nền, nhân vật WebM trong suốt, ảnh VFX, thoại, BGM và SFX được đọc theo tên trường JSON hiện tại.
- Giọng TTS là giọng Windows cài trên máy, không nhất thiết trùng hoàn toàn với giọng trong trình duyệt. Tốc độ đọc mặc định hiện là 180 từ/phút.
- Bản đầu chưa có giao diện chọn voice/tốc độ/cao độ riêng theo nhân vật, chưa có hiệu ứng blur/animation CSS và chưa đảm bảo BGM giữ đúng vị trí phát xuyên qua mọi cảnh. Đây là nền tảng để hoàn thiện tiếp, chưa phải bản phát hành cuối.
- Tốc độ dựng phụ thuộc CPU/GPU, độ phân giải và số lượng video WebM/MP4. Không thể cam kết mọi máy đều xuất nhanh hơn thời gian thực.
