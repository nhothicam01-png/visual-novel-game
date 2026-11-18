# Kiểm thử trình phát (Chrome headless)

Các bài test dùng kịch bản đang có trong repository, không phụ thuộc fixture đã xóa.

## Cài đặt

```bash
pip install playwright
python3 -m playwright install chromium
```

Chrome mặc định: `/usr/bin/google-chrome`. Có thể đặt `CHROME` để dùng đường dẫn khác.

## Chạy kiểm thử

```bash
python3 tests/story_contract.py
python3 tests/preview_regression.py
python3 tests/animation_webm_regression.py
python3 tests/camera_invariants.py
python3 tests/layout_checks.py
```

- `story_contract.py`: kiểm tra toàn bộ JSON truyện, nhân vật, bối cảnh, hiệu ứng, âm thanh, đạo cụ và keyframes có tham chiếu hợp lệ.
- `preview_regression.py`: Chạy / tạm dừng / tiếp tục / dừng / chạy lại và kiểm tra timeline.
- `animation_webm_regression.py`: xác nhận Pipun dùng đúng WEBM im lặng khi narration, URL không bị nhân đôi đuôi và currentTime thực sự tăng.
- `camera_invariants.py`: kiểm tra vùng camera và đường chân trên mọi dòng của `PipunBuocVaoLop`.
- `layout_checks.py`: kiểm tra bố cục đa nhân vật trên các dòng đại diện của cùng kịch bản.

Có thể ghi đè kịch bản bằng biến môi trường `STORY`, trang player bằng `PAGE`, và tốc độ giả lập tải hiệu ứng bằng `BPS` (byte/giây).
