# Anime 2D Animation Studio

Studio hoạt hình 2D chạy trên trình duyệt. V1 tập trung vào nhập kịch bản JSON theo timeline, quản lý nhân vật theo ID, dựng nhiều nhân vật trong cùng cảnh, nền, nhạc, thoại, hiệu ứng và camera; nhập PSD để đọc layer; nhập FBX để xem trước animation 3D.

## Chạy local
```bash
npm install
npm run dev
```
Mở URL Vite hiển thị trong terminal.

## Build
```bash
npm run build
npm run preview
```

## JSON story
Xem `examples/story.sample.json` và `docs/story-format.md`. Mốc thời gian tính bằng giây tương đối với đầu scene. Mỗi speaker/character tham chiếu `characterId`, animation tham chiếu `animationId`; đường dẫn asset tương đối với project hoặc URL mà trình duyệt truy cập được.

## Phạm vi V1 và giới hạn
- Canvas 2D dựng scene từ ảnh nền/ảnh nhân vật, timeline, nhiều nhân vật, dialogue speakers, âm thanh, camera cơ bản và hiệu ứng CSS/canvas.
- PSD đọc cấu trúc layer và hiển thị preview; layer có canvas được trích xuất thành PNG.
- FBX được nạp bằng Three.js và có panel preview riêng. FBX là dữ liệu 3D; V1 chưa tự chuyển rig 3D thành rig 2D.
- Tạo nhân vật từ đầu ở V1 là ghép các ảnh bộ phận (body/hair/outfit/face) theo layer; công cụ vẽ mesh/rig nâng cao và lip-sync phoneme sẽ được mở rộng sau.

Ứng dụng không tải file người dùng lên server; file import được xử lý trong trình duyệt. Audio/video playback phụ thuộc quyền autoplay của trình duyệt; cần bấm Play.
