# Việt Nam · True Size

Trang WebGIS tương tác để đưa **hình dạng Việt Nam** tới các vị trí khác nhau trên thế giới và quan sát trực tiếp biến dạng của phép chiếu Web Mercator.

**Demo dự kiến:** https://vietflexmap.github.io/sosanh/

## Mục tiêu

Khác với cách dịch polygon bằng cách cộng/trừ kinh độ và vĩ độ, dự án dùng **phép quay cứng trên mặt cầu**:

1. Chuyển mỗi đỉnh `[lon, lat]` thành vector đơn vị 3D.
2. Tính ma trận quay đưa tâm Việt Nam tới tâm/vị trí đích.
3. Áp dụng cùng phép quay cho toàn bộ polygon Việt Nam.
4. Chuyển các vector trở lại `[lon, lat]`.
5. Leaflet/Web Mercator thực hiện bước chiếu để hiển thị.

Vì phép quay trên mặt cầu không tùy ý co giãn polygon, phần thay đổi kích thước nhìn thấy trên màn hình chủ yếu đến từ **phép chiếu Mercator**.

Hệ số phóng đại diện tích Mercator trên mô hình cầu:

```text
K_area ≈ sec²(φ) = 1 / cos²(φ)
```

## Chức năng

- Việt Nam là đối tượng so sánh gốc.
- Kéo Việt Nam trực tiếp trên bản đồ.
- Bấm một quốc gia hoặc chọn từ danh sách để đưa Việt Nam tới vị trí đó.
- So sánh:
  - diện tích địa lý;
  - dân số;
  - mật độ dân số;
  - tỷ lệ so với Việt Nam;
  - hệ số phóng đại diện tích Mercator tại vĩ độ hiện tại.
- Dữ liệu dân số ưu tiên bản ghi gần nhất có dữ liệu từ World Bank.
- Nếu World Bank không truy cập được, dùng `POP_EST` trong Natural Earth làm fallback.

## Dữ liệu

- **Natural Earth** — ranh giới quốc gia, public domain.
- **World Bank** — chỉ số `SP.POP.TOTL`.
- **OpenStreetMap** — basemap.
- **TheTrueSize/natural-earth-vector** — fork Natural Earth được dùng làm URL dữ liệu trực tiếp.

> Ranh giới trong Natural Earth được dùng cho mục đích minh họa và so sánh địa lý, không nhằm thể hiện quan điểm pháp lý về chủ quyền hoặc phân định biên giới.

## Diện tích nào được hiển thị?

Con số diện tích trong bảng được tính bằng `turf.area()` từ polygon địa lý và biểu diễn diện tích trên mô hình cầu. Nó **không** được lấy từ số pixel của Web Mercator.

Do đó dự án cố ý tách:

```text
diện tích địa lý của polygon
            ≠
diện tích nhìn thấy trên màn hình Mercator
```

Đối với nghiệp vụ địa chính hoặc đo đạc pháp lý, cần dùng CRS, ellipsoid, datum và phương pháp tính diện tích theo tiêu chuẩn chuyên ngành; demo này không thay thế phép đo địa chính.

## Chạy local

Chỉ cần một HTTP server tĩnh:

```bash
python -m http.server 8080
```

Mở `http://localhost:8080`.

## GitHub Pages

Repository được thiết kế để chạy trực tiếp từ branch `main`. Trong GitHub:

`Settings → Pages → Deploy from a branch → main / root`.

## License

Mã ứng dụng: MIT.

Natural Earth: public domain, xem `THIRD_PARTY.md`.
