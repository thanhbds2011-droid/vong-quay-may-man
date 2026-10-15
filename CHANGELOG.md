# CHANGELOG

## V1.1.0 — 15/10/2026

### Luồng thay đổi đã CHỐT
- Vòng đầu: mọi người quay độc lập, có thể trúng cùng số; không trừ số đã xuất hiện khỏi tập số của người kế tiếp.
- Kết thúc từng vòng: phát hiện toàn bộ nhóm trùng số; người không trùng được giữ số cố định.
- Vòng phụ: chỉ người trùng tham gia, chỉ loại các số đã chốt từ vòng trước; nếu tiếp tục trùng, tạo thêm vòng phụ.
- Ô mờ biểu thị **số đã chốt**, không phải mọi số đã xuất hiện.
- Bổ sung thông báo tên và số bị trùng, nút chuyển vòng phụ, tiến độ theo từng vòng.
- Chỉ công bố người mời nước khi tất cả có số khác nhau.

### Giữ nguyên từ V1.0.0
- Phương án một thiết bị; 2–20 người, mặc định 5.
- Giao diện phong cách rực rỡ, vòng quay và âm thanh, chế độ toàn màn hình.
- Kết quả từng lượt, màn hình tổng kết, pháo giấy.
- Lưu cục bộ, lịch sử tối đa 10 vòng, chơi lại và đổi danh sách người chơi.
- Công bằng khi chọn ngẫu nhiên, tránh nhấn liên tiếp, khôi phục giữa lượt quay.
- Không cần Firebase/đăng nhập.

### Tương thích / lưu ý
- Cập nhật state lưu trữ từ `v:1` lên `v:2`, giữ lịch sử, tên người chơi, cấu hình âm thanh; vòng V1 đang dở bắt đầu lại vì luật cũ không tương thích.
- Thay tên cache Service Worker thành `tan-hiep-water-wheel-v1.1.0` và gắn version trên CSS/JS để giảm nguy cơ tải nhầm bản cũ sau deploy.

### Không thay đổi
- Không thêm đăng nhập, máy chủ, phòng chơi đa thiết bị, thanh toán, hoặc đặt nước.
