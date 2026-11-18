# Kiểm thử trình phát (Chrome headless)

Chạy hồi quy cho nút Chạy / Tạm dừng / Tiếp tục / Dừng và chuyển cảnh trên kịch bản có sấm sét:

    pip install playwright
    python3 tests/preview_regression.py          # mạng nhanh
    BPS=800000 python3 tests/preview_regression.py   # giả lập mạng chậm (byte/giây) cho assets/HieuUng
    LOADING=1 BPS=250000 python3 tests/preview_regression.py  # bấm Chạy khi hiệu ứng còn đang tải

Biến môi trường: `CHROME` (đường dẫn Chrome, mặc định /usr/bin/google-chrome), `PAGE` (trang cần thử).
Mạng ngoài bị chặn; tài nguyên GitHub được phục vụ từ chính thư mục repo. Ở chế độ LOADING=1 kiểm tra đầu tiên ("fx layers present") dự kiến FAIL vì hiệu ứng cố ý chưa nạp xong.
