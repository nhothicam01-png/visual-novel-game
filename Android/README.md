# Visual Novel Studio – Android

Thư mục này chứa project Android Studio độc lập. Bản web hiện tại (`thunghiem.html`) vẫn được giữ nguyên và tiếp tục chạy trên trình duyệt.

## Trạng thái

Đây là **bộ khung Android WebView + Foreground Service**, chưa phải bộ máy render native hoàn chỉnh.

- WebView mở trang dựng video đang được host trên GitHub Pages.
- Khi nhấn **Xuất video**, JavaScript bridge yêu cầu Android bật Foreground Service và hiển thị thông báo đang xuất.
- Service giữ một partial WakeLock trong lúc tác vụ được báo là đang chạy; có nút dừng từ thông báo.
- Khi trang báo hoàn tất/lỗi hoặc người dùng dừng, service được tắt.

**Giới hạn quan trọng:** Foreground Service/WakeLock không bảo đảm JavaScript trong WebView tiếp tục render khi Activity bị đưa xuống nền hoặc màn hình khóa. Android có thể throttle/tạm dừng WebView; chính sách pin của từng hãng cũng khác nhau. Vì vậy chưa được xem đây là giải pháp render nền đáng tin cậy. Muốn render thực sự độc lập cần chuyển pipeline dựng khung hình/giải mã video/âm thanh sang native worker/service (MediaCodec hoặc engine tương đương), hoặc một WebView được duy trì với kiểm thử thiết bị cụ thể.

## Mở project

1. Mở thư mục `Android/` bằng Android Studio.
2. Đồng bộ Gradle.
3. Chạy app trên thiết bị Android 8.0 trở lên.
4. Mặc định app mở:
   `https://nhothicam01-png.github.io/visual-novel-game/thunghiem.html`

Có thể đổi URL trong `app/build.gradle.kts` qua Gradle property `WEB_APP_URL`.

## Quyền

- INTERNET: tải ứng dụng web và tài nguyên.
- FOREGROUND_SERVICE: chạy thông báo tác vụ.
- FOREGROUND_SERVICE_MEDIA_PROCESSING: khai báo loại service phù hợp trên Android mới.
- WAKE_LOCK: giữ CPU hoạt động trong thời gian tác vụ được yêu cầu.

Không có khóa ký APK trong repository. Project source có thể build bằng Android Studio; APK phát hành cần cấu hình signing riêng.

## Kế hoạch tiếp theo

1. Tách dữ liệu kịch bản/tài nguyên thành snapshot bất biến.
2. Tách renderer khỏi DOM và state của trang.
3. Web: chuyển phần render thuần sang Worker + OffscreenCanvas khi trình duyệt hỗ trợ; giữ fallback cho trình duyệt không hỗ trợ.
4. Android: triển khai render engine native chạy trong service, nhận snapshot và tài nguyên từ WebView, rồi xuất MP4 độc lập với vòng đời Activity.
5. Kiểm thử nền/màn hình khóa trên thiết bị Android thật trước khi tuyên bố hỗ trợ chạy nền ổn định.
