# BÁO CÁO KIỂM THỬ – V1.1.0

**Ngày kiểm thử:** 15/10/2026.  
**Phương pháp:** Browser regression test trong Chromium headless bằng Playwright. Do môi trường test giới hạn điều hướng HTTP, trang được dựng bằng cách inject HTML, CSS và JS tại chỗ; thao tác chuột, nút và DOM thật qua Chromium.  
**Tệp thực thi:** `tests/test_browser_v1_1.py`.

## Kết quả: PASS

| Nhóm kiểm thử | Tình huống / kỳ vọng | Kết quả |
|---|---|---|
| Độc lập vòng đầu | 5 người quay lần lượt: 5, 5, 3, 1, 2; cùng số 5 được chấp nhận | PASS |
| Lọc trùng | Sau lượt cuối: A/B bị trùng 5, C/D/E giữ số 3/1/2 | PASS |
| Quay vòng phụ | 2 người được quay lại, chỉ chọn được số 4 và 5 | PASS |
| Trùng liên tiếp | Vòng phụ cả A/B cùng ra số 4 → tiếp tục vòng phụ khác | PASS |
| Hết trùng | Vòng phụ tiếp theo ra số 5 và 4 → 5 số khác nhau | PASS |
| Công bố cuối | Chỉ sau khi hết trùng mới hiển thị người nhận số 1 (Chị D) | PASS |
| Khôi phục giữa quay | Đã lưu pending=4 tại vòng phụ; tải lại hai lần vẫn hiện số 4 | PASS |
| Lịch sử | Ghi một vòng, lưu số vòng phụ và khôi phục kết quả sau tải lại | PASS |
| Chơi lại | Giữ tên 5 người, xóa số cũ và tạo vòng quay mới | PASS |
| Xác nhận hủy | Hủy thao tác đóng hộp thoại không ảnh hưởng vòng đang chơi | PASS |
| Dữ liệu V1 → V1.1 | Giữ tên, lịch sử, âm thanh; vòng dở quay về thiết lập | PASS |
| Giao diện di động | Viewport 390px không có tràn ngang, bật/tắt âm thanh | PASS |
| Lỗi JavaScript | Không ghi nhận pageerror trong luồng kiểm thử | PASS |

## Tệp hình minh chứng

- `tests/desktop-setup-v1.1.png`
- `tests/desktop-game-v1.1.png`
- `tests/desktop-review-v1.1.png`
- `tests/desktop-summary-v1.1.png`
- `tests/mobile-setup-v1.1.png`
- `tests/mobile-result-v1.1.png`

## Những nội dung chưa kiểm chứng trực tiếp

- Tính ổn định PWA / offline sau khi deploy trên HTTPS và sau khi chuyển Service Worker V1 → V1.1.
- Âm thanh, trạng thái nền và cài màn hình chính trên Safari/iPhone thực tế.
- Thử nghiệm nhiều người quay trực tiếp trên thiết bị của Trung tâm.
- Đánh giá phân phối xác suất bằng thống kê quy mô lớn; bài test ép kết quả chỉ nhằm kiểm chứng luồng nghiệp vụ, không chứng minh tính ngẫu nhiên thống kê.

**Khuyến nghị:** Sau khi cập nhật repo, thử một vòng đủ 5 người và cố tình kiểm tra tình huống trùng số bằng nhiều lần chơi; kiểm tra âm thanh và PWA trên thiết bị thật.
