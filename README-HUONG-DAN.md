# VÒNG QUAY MAY MẮN – AI BAO NƯỚC HÔM NAY?

**Phiên bản:** V1.1.0 — Nâng cấp từ V1.0.0 (15/10/2026)

**Đơn vị sử dụng:** Trung tâm Bảo trợ xã hội Tân Hiệp  
**Mô hình:** Một thiết bị quay chung, 2–20 người, mặc định 5 người.  
**Kiến trúc:** HTML, CSS, JavaScript thuần, localStorage; PWA có Service Worker; không cần Firebase, API hay đăng nhập.

## 1. QUY TẮC MỚI V1.1.0

- **Vòng đầu:** Mọi người quay lần lượt, nhưng mỗi lượt quay chọn độc lập một số trong toàn bộ tập 1–N. Cả hai người cùng trúng số 5 là hợp lệ ở giai đoạn này. **Không có người nào buộc phải nhận số cuối.**
- **Sau khi tất cả quay xong:** Ứng dụng mới kiểm tra số trùng. Mọi người có số không trùng được **giữ cố định** kết quả. Tất cả người trùng số được chuyển vào nhóm quay vòng phụ.
- **Vòng phụ:** Các số của người đã giữ cố định được làm mờ và không còn trúng. Người phải quay lại chọn **độc lập với nhau** trong tập số chưa chốt, kể cả khi người vừa quay trong cùng vòng phụ đã chọn số đó.
- **Cuối vòng phụ:** Tiếp tục kiểm tra. Người có số duy nhất được chốt, người còn trùng tiếp tục quay ở vòng phụ sau. Quy trình lặp đến khi mọi người giữ một số khác nhau.
- **Tổng kết:** Chỉ khi không còn số trùng, hệ thống công bố người có số nhỏ nhất là người mời nước.

**Ví dụ có 5 người:** A=5, B=5, C=3, D=1, E=2. Ứng dụng giữ số 1, 2, 3 của C/D/E. A và B cùng quay lại trong tập {4, 5}. Nếu cả hai lại cùng nhận 4 thì tiếp tục quay; nếu 4 và 5 thì kết thúc.

## 2. HƯỚNG DẪN CHƠI

1. Mở ứng dụng. Chọn số người (mặc định 5) và nhập tên; có thể bỏ trống để tự đặt Người 1, Người 2...
2. Nhấn **BẮT ĐẦU TRÒ CHƠI**.
3. Người đang đến lượt nhấn **QUAY MAY MẮN!**; vòng quay chuyển động khoảng 5 giây, sau đó hiện kết quả.
4. Nhấn **TIẾP TỤC NGƯỜI TIẾP THEO** cho đến hết nhóm.
5. Nhấn **KIỂM TRA SỐ TRÙNG**, hoặc đợi khoảng 3,2 giây để hệ thống tự kiểm tra.
6. Nếu có số trùng, màn hình chỉ rõ ai phải quay lại; nhấn **QUAY VÒNG PHỤ**. Những người không trùng giữ số đã chốt.
7. Khi hết trùng, màn hình tổng kết có pháo giấy, âm thanh và kết quả của tất cả người chơi.
8. Nhấn **CHƠI VÒNG MỚI** để giữ danh sách cũ hoặc **ĐỔI NGƯỜI CHƠI** để nhập danh sách mới.

Ứng dụng còn có **Lịch sử** (10 vòng gần nhất), **Bật/tắt âm thanh**, **Toàn màn hình**, xác nhận trước khi hủy một vòng đang chơi và ghi nhớ trạng thái sau khi tải lại trang.

## 3. CÀI VÀ CHẠY TRÊN MÁY

Cách nhanh nhất: giải nén ZIP, mở `index.html` bằng Chrome hoặc Edge để thử; không cần máy chủ.

Để có trải nghiệm PWA, cài lên màn hình chính và sử dụng ngoại tuyến đáng tin cậy, hãy triển khai qua một địa chỉ **HTTPS**. Chế độ `file://` không đăng ký Service Worker.

## 4. TRIỂN KHAI LÊN GITHUB / VERCEL

### Repo GitHub mới

1. Tạo repository GitHub, ví dụ `vong-quay-ai-bao-nuoc`.
2. Tải lên **nội dung bên trong** thư mục ứng dụng vào thư mục gốc của repository, gồm:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `sw.js`
   - thư mục `assets/` (icon)
3. Vào Vercel, chọn **Add New → Project**, import repository này.
4. Vì đây là web tĩnh, không cần framework, lệnh build, biến môi trường hay Firebase.
5. Sau khi Vercel báo deploy thành công, mở đường dẫn HTTPS và bắt đầu chơi.

Có thể dùng **GitHub Pages** thay cho Vercel: trong repository → Settings → Pages, chọn deploy từ branch chính, thư mục root, sau đó mở URL do GitHub cấp.

### Cập nhật repo từ V1.0.0 lên V1.1.0

1. Giữ nguyên repository cũ. **Thay thế** 5 file ở gốc: `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`. Bộ icon trong `assets/` có thể giữ như V1.0.0 vì chưa thay đổi.
2. Commit lên GitHub. Nếu đã kết nối Vercel, nền tảng sẽ triển khai tự động.
3. Mở ứng dụng, tải lại trang; nếu trình duyệt hiển thị mã cũ, thử `Ctrl+F5` hoặc đóng rồi mở lại PWA sau khi Service Worker cập nhật.
4. Kiểm tra dòng chân trang phải hiển thị **V1.1 · Quay độc lập, trùng số quay lại**.

**Lưu ý dữ liệu khi cập nhật:** V1.1 giữ tên người chơi, tùy chọn âm thanh và lịch sử vòng đã hoàn tất của V1.0 trên cùng trình duyệt và cùng URL. **Nếu V1.0 đang có vòng chơi chưa hoàn tất, vòng đó cần bắt đầu lại theo luật mới**; ứng dụng hiện thông báo. Dữ liệu lưu trong trình duyệt, không đồng bộ sang điện thoại/máy khác, và có thể mất nếu bạn xóa dữ liệu trình duyệt.

## 5. NGUYÊN TẮC AN TOÀN VÀ CÔNG BẰNG

- Mỗi lần quay chọn ngẫu nhiên trong các số **chưa được chốt** từ vòng trước. Các lượt trong cùng vòng dùng cùng tập lựa chọn; một lượt không ảnh hưởng đến xác suất của lượt kế tiếp.
- Web Crypto `crypto.getRandomValues` được ưu tiên để chọn chỉ số đều nhau bằng rejection sampling; `Math.random` là phương án dự phòng trên môi trường thiếu Web Crypto. Không có cơ chế gán trước cho một người cụ thể.
- Trước khi animation bắt đầu, số đã chọn được lưu. Tải lại giữa lúc quay sẽ **hiện đúng số cũ**, không chọn lại lần nữa.
- Trong khi quay, nút quay bị khóa để tránh nhấn nhiều lần.
- Nếu số chưa đủ khác nhau thì không công bố người mời nước.
- Âm thanh tạo bằng Web Audio sau khi người chơi tương tác (theo quy định trình duyệt).
- Chơi trên một thiết bị, không có đồng bộ mạng hoặc mã tham gia.

## 6. TỆP VÀ KIỂM THỬ

- `index.html`: giao diện tiếng Việt, cấu trúc màn hình.
- `styles.css`: giao diện responsive.
- `app.js`: luật quay, trạng thái, âm thanh, hiệu ứng, lưu trữ.
- `manifest.webmanifest`, `sw.js`, `assets/`: PWA.
- `tests/test_browser_v1_1.py`: thử nghiệm tự động bằng Chromium/Playwright trong sandbox (không kết nối máy chủ bên ngoài).
- `TEST-REPORT.md`: kết quả kiểm thử và giới hạn.
- `CHANGELOG.md`: nội dung thay đổi.
- `MANIFEST-SHA256.txt`: dấu kiểm tra toàn vẹn tệp mã nguồn.

**Bản V1.1.0 đã kiểm tra bằng Chromium tự động, nhưng chưa xác nhận trên môi trường HTTPS thực tế, trình duyệt Safari thực tế hoặc thiết bị của Trung tâm.**
