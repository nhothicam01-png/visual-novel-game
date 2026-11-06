# Visual Novel Offline Video Exporter (Windows)

Ứng dụng desktop thử nghiệm để dựng video MP4 từ cấu trúc Visual Novel hiện tại của repository.

## Chuẩn bị

- Windows 10/11 64-bit
- Python 3.10+ (chỉ cần khi chạy từ mã nguồn hoặc tự build EXE)
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

## Tự đóng gói thành EXE trên Windows

Nhấp đúp `build_windows.bat`. Sau khi build thành công, ứng dụng nằm tại:

`dist\VisualNovelExporter.exe`

Build EXE cần được thực hiện trên Windows. File EXE không được tạo trực tiếp trong GitHub.

## Cách dùng

1. Chọn JSON kịch bản.
2. Chọn thư mục gốc của dự án (thư mục chứa `assets`).
3. Chọn nơi lưu MP4.
4. Chọn ngang 1920×1080 hoặc dọc 1080×1920.
5. Bấm **Bắt đầu xuất video**.

## Ghi chú bản thử nghiệm

- TTS được tạo trước thành WAV bằng Windows SAPI5; không gọi dịch vụ online trong lúc xuất.
- FFmpeg dựng từng cảnh và ghép thành MP4 H.264/AAC.
- Hình nền ảnh/video, nhân vật WebM trong suốt, ảnh VFX, thoại, BGM và SFX được đọc theo tên trường JSON hiện tại.
- BGM tiếp tục xuyên qua các cảnh và chỉ chuyển khi JSON chỉ định tên nhạc nền mới.
- Giọng TTS là giọng Windows cài trên máy, không nhất thiết trùng hoàn toàn với giọng trong trình duyệt. Nếu Windows không có giọng tiếng Việt thì cần cài voice tương ứng.
- Bản đầu chưa có giao diện chọn voice/tốc độ/cao độ riêng theo nhân vật, chưa tái tạo animation CSS nói chuyện và blur chính xác như player web. Các tùy chọn âm lượng hiện đang dùng mức mặc định trong mã.
- Tốc độ dựng phụ thuộc CPU/GPU, độ phân giải và số lượng video WebM/MP4. Không thể cam kết mọi máy đều xuất nhanh hơn thời gian thực.
- Đây là bản nền để kiểm thử và hoàn thiện tiếp, chưa phải bản phát hành cuối cùng.
