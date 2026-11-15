# Anime 2D Animation Studio — HTML/CSS/JavaScript thuần

Mở trực tiếp `index.html` bằng trình duyệt hiện đại. Không cần npm, bundler, framework hoặc thư viện ngoài.

## Đã có
- Quản lý cảnh, nhân vật, phông nền và âm thanh.
- Import ảnh PNG/JPG/GIF/WebP (theo khả năng trình duyệt) và audio.
- Sắp xếp nhân vật trên sân khấu, kéo thả, chỉnh vị trí, tỉ lệ, xoay, opacity, lật, ẩn/hiện, lớp hiển thị.
- Timeline theo thời lượng cảnh, play/pause, tua và bước từng frame.
- Chuyển động preset metadata: idle/walk/run/jump/talk/listen.
- Keyframe data, lời thoại theo thời gian, hiệu ứng flash cơ bản.
- Camera zoom, grid, snapshot PNG.
- Import/export project JSON; lưu tự động thủ công trong localStorage.
- Xuất video WebM bằng MediaRecorder nếu trình duyệt hỗ trợ (chuột phải nút Xuất JSON).

## Giới hạn định dạng
Đây là ứng dụng thuần trình duyệt, không nhúng thư viện. Trình duyệt không có API gốc để giải mã cấu trúc PSD hoặc FBX. Vì vậy bản này **chưa import trực tiếp PSD/FBX** và chưa có rigging xương, retarget 3D, lip-sync tự động hay keyframe editor đầy đủ. Hãy xuất layer PSD thành PNG hoặc animation FBX thành sprite sheet/video trước khi đưa vào ứng dụng. Audio được quản lý trong thư viện; phát nhạc nền chưa được tích hợp ở bản này.

## JSON
Project export giữ asset dưới dạng Data URL, nên ảnh/âm thanh được nhúng trong JSON và không bị mất khi tải lại project. Cấu trúc project có `assets`, `scenes`, `characters`, `dialogues`, `camera` và `effects`.
