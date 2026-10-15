# BÁO CÁO KIỂM THỬ – VÒNG QUAY MAY MẮN V1.0.0

**Ngày kiểm thử:** 15/10/2026  
**Công cụ:** Playwright + Chromium 144, chạy bộ mã HTML/CSS/JS trong môi trường kiểm thử cục bộ.  
**Phạm vi:** Luồng nghiệp vụ, đồng bộ trạng thái trong localStorage giả lập, kiểm tra trực quan desktop/mobile và lỗi JavaScript.

## Đã kiểm tra: ĐẠT

| STT | Trường hợp | Kết quả |
|---|---|---|
| 1 | Mặc định có 5 ô số, 5 ô nhập tên | Đạt |
| 2 | Nhập 5 tên, mở màn hình quay | Đạt |
| 3 | Quay đủ 5 lượt: kết quả là đúng tập {1,2,3,4,5}, không số trùng | Đạt |
| 4 | Kim quay khớp số được trả về; nhìn thấy ô được làm mờ | Đạt: quan sát ảnh chụp và kiểm tra phép quay |
| 5 | Vô hiệu nút quay trong lúc hiệu ứng đang chạy | Đạt |
| 6 | Hiện số sau mỗi lượt và cập nhật trạng thái/danh sách | Đạt |
| 7 | Công bố bảng tổng kết; số nhỏ nhất là số 01 | Đạt |
| 8 | Lưu một bản ghi lịch sử khi hoàn thành | Đạt |
| 9 | Chơi lại với danh sách cũ, làm mới số nhưng giữ tên | Đạt |
| 10 | Tải lại trang giữa lúc quay: giữ nguyên số đã chọn, không trao trùng | Đạt |
| 11 | Bấm hủy tạo vòng mới: giữ lại lượt đang chơi | Đạt |
| 12 | Bấm đồng ý tạo vòng mới: xóa trạng thái vòng đang chơi | Đạt |
| 13 | Thêm, giảm số lượng người trong màn hình thiết lập | Đạt |
| 14 | Tắt âm thanh: cập nhật trạng thái | Đạt |
| 15 | Giao diện di động ngang 390px, không tràn màn hình | Đạt |
| 16 | Không có lỗi JavaScript không được xử lý trong các luồng đã thử | Đạt |

**Chưa kiểm chứng trực tiếp trong môi trường kiểm thử này:** cài PWA/offline qua HTTPS thật, hoạt động âm thanh trên iPhone/Safari vật lý, tính đồng đều thống kê của bộ sinh số qua số lượng rất lớn vòng chơi, tải hệ thống ở thời gian dài. Cần kiểm tra tiếp khi đưa trang lên GitHub Pages/Vercel hoặc thiết bị thật.

**Cách kiểm tra lại:**

- `tests/test_browser.py`: chạy thông qua một HTTP server trên `127.0.0.1:8765` khi máy cho phép trình duyệt truy cập localhost. Cần Python + `playwright` + Chromium.
- `tests/test_browser_sandbox.py`: cách kiểm thử thay thế khi chính sách trình duyệt chặn điều hướng URL; nạp trực tiếp HTML/CSS/JS, mô phỏng localStorage cho việc thử tải lại trong lúc đang quay. Có ảnh giao diện trong thư mục `tests/`.

**Kết luận:** Bộ nguồn V1.0.0 đạt các kiểm tra nghiệp vụ cốt lõi nêu trên và sẵn sàng để thử nghiệm thực tế trên một thiết bị của Trung tâm.
