# Chạy Visual Novel Studio trên máy tính

## Yêu cầu
- Clone repository bằng GitHub Desktop hoặc lệnh git clone. Không dùng Download ZIP nếu muốn hai nút đồng bộ hoạt động.
- Cài Node.js LTS và Git for Windows.
- Mở thư mục repository đã clone.

## Khởi động
1. Nhấp đúp start-local.bat.
2. Trình duyệt mở http://127.0.0.1:4173/.
3. Giữ cửa sổ máy chủ đang chạy trong lúc sử dụng.
4. Để dừng, đóng cửa sổ Visual Novel Studio Local.

## Đồng bộ
- Máy → GitHub: đưa toàn bộ thay đổi trong thư mục repository vào một commit rồi git push.
- GitHub → Máy: chỉ git pull --ff-only khi thư mục local sạch. Nếu có thay đổi chưa commit, hệ thống từ chối tải về để tránh ghi đè.
- Nếu push/pull báo lỗi xác thực, đăng nhập GitHub Desktop hoặc cấu hình Git Credential Manager rồi thử lại.
- Nếu GitHub không truy cập được, vẫn có thể mở và làm việc với dữ liệu hiện có trên máy; chỉ thao tác đồng bộ bị tạm ngưng.

## Phạm vi offline
Các trang, JSON, hình ảnh, WEBM, âm thanh và thao tác chỉnh sửa/lưu file trong repository được phục vụ trực tiếp từ máy. Các chức năng cần dịch vụ bên ngoài như Gemini, dịch máy trực tuyến, Edge TTS trực tuyến hoặc tải model/giọng mới vẫn cần Internet. Tài nguyên/model đã được tải và cache trước đó có thể còn dùng được tùy trình duyệt.

## Lưu ý
- Không xóa thư mục .git; thư mục này chứa lịch sử và thông tin remote để đồng bộ.
- Nút Máy → GitHub sẽ commit tất cả thay đổi trong repository, kể cả file mới/xóa. Kiểm tra file lớn hoặc file tạm trước khi bấm.
- Nút GitHub → Máy không tự merge khi hai bên lệch nhánh; chỉ fast-forward để tránh tự ghi đè. Khi có xung đột, xử lý bằng GitHub Desktop.
