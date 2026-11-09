# Thư viện giọng nói

Các hồ sơ giọng nhân vật được lưu trong `danh-sach-giong.json`.

## Cách cập nhật
1. Mở `tao_giong.html`, tạo hoặc chỉnh nhiều hồ sơ nhân vật.
2. Chọn **Xuất cấu hình JSON** để tải `danh-sach-giong.json`.
3. Trong GitHub, thay nội dung file này bằng JSON vừa xuất và commit vào nhánh `main`.
4. Trang `thunghiem.html` sẽ tự tải các hồ sơ từ thư mục này.

Mỗi hồ sơ chứa tên nhân vật, model Piper, ngôn ngữ, nhãn giới tính và bốn thông số xử lý: tốc độ, cao độ, độ khàn, âm lượng.

Không lưu file âm thanh WAV trong JSON; Piper sẽ tạo âm thanh từ model khi dựng thoại.
