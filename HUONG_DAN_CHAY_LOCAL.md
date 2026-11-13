# Chạy Visual Novel Studio từ ZIP trên Windows

## Không cần cài thêm phần mềm
- Tải ZIP của repository và giải nén toàn bộ vào một thư mục.
- Không mở trực tiếp `index.html`.
- Nhấp đúp `start-local.bat`. File này dùng Windows PowerShell có sẵn để chạy máy chủ local; không cần Node.js, Git hay GitHub Desktop.
- Trình duyệt tự mở `http://127.0.0.1:4173/`. Giữ cửa sổ PowerShell mở trong lúc dùng.
- Đóng cửa sổ PowerShell để dừng máy chủ.

## Dùng offline
Trang, JSON, hình ảnh, WEBM, âm thanh và các file có sẵn trong ZIP được đọc từ ổ đĩa. Các tính năng cần Gemini API, dịch vụ trực tuyến, tải model/giọng mới hoặc truy cập GitHub vẫn cần Internet.

## Dữ liệu và đồng bộ
- Các thay đổi lưu qua công cụ sẽ được ghi vào thư mục đã giải nén.
- Token GitHub được lưu trong localStorage của trình duyệt trên máy này; chỉ dùng token fine-grained giới hạn đúng repository với quyền Contents: Read and write.
- Khi mất Internet, bạn vẫn làm việc với dữ liệu trong máy; đồng bộ GitHub cần kết nối Internet.
- Không xóa hoặc di chuyển các thư mục tài nguyên khỏi thư mục dự án.
