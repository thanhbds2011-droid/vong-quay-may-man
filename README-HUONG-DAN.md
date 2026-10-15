# VÒNG QUAY MAY MẮN – AI BAO NƯỚC HÔM NAY?

**Phiên bản:** 1.0.0 · **Đơn vị:** Trung tâm Bảo trợ xã hội Tân Hiệp · **Ngày:** 15/10/2026

Ứng dụng web giải trí **một thiết bị quay chung**, mặc định **5 người chơi**, có thể điều chỉnh **2–20 người**. Một người nhận một số khác nhau, người mang số **nhỏ nhất (số 01)** sẽ mời nước cả nhóm. Mã nguồn tĩnh, không có cơ sở dữ liệu từ xa, không có theo dõi người dùng.

## 1. Bộ mã nguồn

```text
index.html                Giao diện
styles.css                Phong cách + tương thích điện thoại/máy tính
app.js                    Quay số, âm thanh, bảo toàn lượt, lịch sử
manifest.webmanifest      Cấu hình PWA
sw.js                     Lưu tài nguyên cốt lõi cho lần mở ngoại tuyến
assets/icon-192.png       Biểu tượng nhỏ
assets/icon-512.png       Biểu tượng lớn
README-HUONG-DAN.md       Tài liệu này
TEST-REPORT.md            Kết quả kiểm thử
MANIFEST-SHA256.txt       Danh sách checksum từng tệp chính
```

Thư mục `tests/` có mã kiểm thử Playwright tham khảo. Ứng dụng **không phụ thuộc** vào tệp tests khi chạy.

## 2. Cách đưa lên GitHub Pages (đề xuất đơn giản)

1. Đăng nhập **GitHub** và tạo một repository mới, ví dụ `vong-quay-may-man-tan-hiep`. Chọn chế độ Public nếu muốn dùng GitHub Pages miễn phí trong điều kiện thông thường.
2. Giải nén file ZIP. **Đưa toàn bộ tệp/thư mục vào thư mục gốc của repository**, đặc biệt `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest` và thư mục `assets`. Không tải riêng file ZIP rồi kỳ vọng website tự giải nén.
3. Commit các tệp lên nhánh `main`.
4. Vào **Settings → Pages → Build and deployment** và chọn **Deploy from a branch**, nhánh **main**, thư mục **/(root)**, rồi lưu.
5. Sau khi GitHub hoàn tất triển khai, truy cập URL GitHub Pages mà hệ thống cung cấp (thường có dạng `https://ten-tai-khoan.github.io/ten-repository/`).
6. Dùng Chrome, Edge hoặc Safari để mở trang. Lần đầu cần kết nối mạng để tải ứng dụng.

## 3. Cách đưa lên Vercel

1. Tải mã nguồn đã giải nén lên một repository GitHub.
2. Vào Vercel, chọn **Add New → Project → Import Git Repository**.
3. Chọn repository ứng dụng. Đây là **web tĩnh HTML/CSS/JavaScript**, không cần framework hoặc lệnh build.
4. Cấu hình root directory là nơi chứa `index.html`, sau đó Deploy.
5. Mở đường dẫn Vercel tạo ra để sử dụng.

**Không cần:** Firebase, biến môi trường, Google Apps Script, tài khoản trong ứng dụng hay database.

## 4. Cách chạy thử tại máy (không cần đưa lên Internet)

Có thể mở trực tiếp `index.html` bằng trình duyệt để xem/chơi bản web cơ bản. Để kiểm tra **PWA, lưu ngoại tuyến và service worker** đúng cách, hãy mở qua HTTP localhost hoặc HTTPS.

Ví dụ nếu máy đã có Python 3:

```bash
cd duong-dan-den-thu-muc-ung-dung
python -m http.server 8765
```

Sau đó mở `http://localhost:8765/` trên máy đó. Nếu chưa có Python thì có thể sử dụng công cụ chạy web server nội bộ khác.

## 5. Hướng dẫn chơi

1. Chọn từ 2 đến 20 người bằng nút `-` và `+`. Mặc định là 5 người.
2. Nhập tên từng người. Nếu bỏ trống, hệ thống tự dùng `Người 1`, `Người 2`...
3. Nhấn **BẮT ĐẦU TRÒ CHƠI**.
4. Người chơi lần lượt nhấn **QUAY MAY MẮN!**. Hiệu ứng quay mất khoảng 5 giây và tự dừng tại một số còn lại.
5. Ứng dụng hiển thị kết quả cá nhân, đồng thời làm mờ ô số đã sử dụng.
6. Nhấn **TIẾP TỤC NGƯỜI TIẾP THEO**.
7. Sau lượt cuối, người chơi thấy số của mình; hệ thống tự hiển thị bảng tổng kết sau khoảng 3 giây (có thể bấm **XEM TỔNG KẾT NGAY**).
8. Người có số nhỏ nhất (**01**) là người mời nước. Dùng **CHƠI VÒNG MỚI** để giữ tên hoặc **ĐỔI NGƯỜI CHƠI** để chỉnh sửa.

Các tùy chọn khác: bật/tắt âm thanh, bật toàn màn hình (nếu trình duyệt hỗ trợ), xem/xóa lịch sử 10 vòng gần nhất trên thiết bị.

## 6. Công bằng và dữ liệu

- Tại mỗi lượt, hệ thống chọn **ngẫu nhiên đều giữa những số chưa được sử dụng**, dùng Web Crypto khi trình duyệt cung cấp.
- Số được quyết định và lưu trước khi chạy hoạt ảnh; kim quay được tính toán dừng đúng số được chọn.
- Người dùng không thể quay trúng một số đã trao cho người khác trong cùng vòng.
- Tải lại trang **khi đang quay** sẽ khôi phục và hiển thị kết quả đã được chốt trước đó, không tạo lượt quay khác.
- Số cuối chỉ còn một khả năng; hệ thống vẫn chạy hiệu ứng quay nhưng kết quả đã xác định.
- **Lịch sử chỉ có trên trình duyệt này**. Xóa dữ liệu trang web, dùng ẩn danh hoặc đổi thiết bị có thể làm mất lịch sử.
- Âm thanh được tạo trực tiếp bằng Web Audio trên thiết bị, không tải âm thanh từ trang bên ngoài. Trình duyệt có thể yêu cầu người dùng bấm nút trước khi cho phép phát âm thanh.
- Để tránh vô tình bỏ vòng hiện tại, khi bắt đầu vòng mới trước khi hoàn tất có hộp thoại xác nhận.

## 7. Cài như ứng dụng PWA

Trên Chrome/Edge bản hỗ trợ: mở URL **HTTPS**, tìm tùy chọn **Install / Cài ứng dụng** ở thanh địa chỉ hoặc menu trình duyệt. Trên iPhone (Safari), chọn **Chia sẻ → Thêm vào Màn hình chính** nếu khả dụng. Hỗ trợ offline thường chỉ có sau khi trang được tải đầy đủ và service worker đã cài thành công.

## 8. Giới hạn và lưu ý

- Một thiết bị, không có phòng chơi trực tuyến, không đồng bộ qua mạng.
- Không có tính năng thanh toán/mua hàng/đặt nước.
- Nếu trình duyệt chặn `localStorage` thì lượt đang chơi vẫn có thể chạy nhưng không được bảo đảm lưu sau khi tải lại.
- Phát âm thanh tùy vào cấu hình loa, âm lượng hệ điều hành và chính sách trình duyệt.
- Hiệu ứng pháo giấy giảm theo cài đặt hệ điều hành `Reduce motion`.
- Ứng dụng được thiết kế để giải trí; không dùng làm hệ thống quay thưởng tài chính hay cơ sở xác nhận giao dịch.

## 9. Thay đổi, bàn giao

V1.0.0 là bộ mã nguồn đầu tiên sau khi chốt thiết kế ngày 15/10/2026. Nếu cập nhật giao diện hoặc thuật toán ở phiên bản sau, sửa phiên bản trong `sw.js` (tên CACHE_NAME) để trình duyệt nhận tài nguyên mới và chạy lại kiểm thử.

Không cần sửa tên trung tâm hay thông tin kỹ thuật trong mã nguồn trước khi sử dụng.
