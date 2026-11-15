# Anime 2D Animation Studio

Mở `index.html` bằng Chrome hoặc Edge. Giao diện dùng HTML/CSS/JavaScript thuần; bộ đọc PSD `ag-psd` tải từ jsDelivr khi mở trang nên cần Internet khi import PSD.

## Nhập nhân vật PSD
1. Bấm **Import nhân vật PSD** và chọn file.
2. Studio đọc tên layer, cây nhóm, thứ tự, vị trí, độ mờ và trạng thái ẩn/hiện.
3. Chọn nhân vật trong thư viện. Mục **Ngoại hình PSD** cho phép bật/tắt từng layer để đổi tóc, mắt, miệng, trang phục và phụ kiện.
4. Đổi layer không thay đổi ID nhân vật, vị trí, keyframe hoặc motion preset.

## Quy ước tên layer
Có thể dùng `eyeL`, `eyeR`, `lip`, `eyebrowL`, `eyebrowR`, `hairFront`, `hairBack`, `head`, `body`, `armL`, `armR`, `legL`, `legR`, `clothesTop`, `clothesBottom`, `dress`, `shoes`, `accessory`. Tên gốc được giữ nguyên. Nhiều phiên bản có thể đặt trong layer riêng rồi bật/tắt trong Ngoại hình PSD.

## Giới hạn
- ag-psd hỗ trợ PSD RGB/Grayscale/Bitmap 8-bit; PSB, CMYK, 16/32-bit và một số tính năng Photoshop không được hỗ trợ đầy đủ.
- Hiện nhập layer raster có canvas; layer chữ/vector, smart object, clipping mask, layer style và một số blend mode có thể không giống hoàn toàn Photoshop.
- Đây là bước nhập và thay layer ngoại hình, chưa phải rig xương 2D hoàn chỉnh. Motion preset và keyframe hiện tại điều khiển toàn nhân vật; chưa có IK, deform từng khớp hay lip-sync tự động.
- Project JSON nhúng từng layer dưới dạng PNG data URL nên có thể khá lớn.
