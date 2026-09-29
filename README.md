# Vietnam Global Comparator

**Demo:** https://vietflexmap.github.io/sosanh/

WebGIS tương tác lấy **Việt Nam làm đối tượng chuẩn** để so sánh với các quốc gia khác về hình dạng, diện tích, chiều dài Bắc–Nam, dân số, mật độ dân số, GDP, GDP/người và biến dạng phép chiếu.

## Điểm cốt lõi

Polygon Việt Nam không được dịch bằng cách cộng trừ kinh/vĩ độ. Ứng dụng:

1. chuyển từng đỉnh của Việt Nam sang vector đơn vị 3D;
2. tính phép quay cứng trên mặt cầu từ tâm Việt Nam tới vị trí đích;
3. quay toàn bộ polygon bằng cùng một phép biến đổi;
4. chuyển trở lại longitude/latitude;
5. render cùng dữ liệu qua hai projection khác nhau.

### Mercator

- Leaflet + OpenStreetMap.
- Bảo toàn góc cục bộ.
- Phóng đại diện tích theo vĩ độ, gần đúng:

```text
K_area ≈ sec²(φ) = 1 / cos²(φ)
```

### Equal Earth

- D3 `geoEqualEarth()`.
- Equal-area projection.
- Dùng cùng GeoJSON và cùng polygon Việt Nam đã quay trên mặt cầu.
- Cho phép chuyển tức thời Mercator ↔ Equal Earth để thấy khác biệt do projection.

## Chỉ số so sánh

- Diện tích địa lý.
- Chiều dài Bắc–Nam xấp xỉ theo hai điểm biên cực Bắc/cực Nam.
- Dân số.
- Mật độ dân số.
- GDP danh nghĩa.
- GDP/người.
- Dân số ước tính trong footprint Việt Nam khi đặt lên quốc gia đích.
- Hệ số phóng đại Mercator tại vĩ độ hiện tại.
- Biểu đồ cùng một Việt Nam tại 0°, 30°, 45°, 60°, 75°.

## World Bank API

Các indicator dùng ở runtime:

- `SP.POP.TOTL` — Population, total.
- `NY.GDP.MKTP.CD` — GDP (current US$).
- `NY.GDP.PCAP.CD` — GDP per capita (current US$).

Ứng dụng lấy bản ghi gần nhất có dữ liệu của từng quốc gia.

## Footprint population

Phiên bản hiện tại tính:

```text
estimated population
= area(Vietnam footprint ∩ target country)
× average population density(target country)
```

Đây là **ước tính cấp quốc gia**, hữu ích cho so sánh nhanh nhưng chưa phải population-on-grid.

Để nâng lên mức phân tích dân số không gian thật, nên thay module này bằng raster dân số như WorldPop hoặc GHSL và tích phân các cell nằm trong footprint.

## Dữ liệu

- Natural Earth — ranh giới quốc gia, public domain.
- World Bank — population/GDP indicators.
- OpenStreetMap — basemap Mercator.
- D3 — Equal Earth rendering.
- Turf.js — diện tích, khoảng cách, point-in-polygon và intersection.

> Ranh giới dùng cho minh họa địa lý, không nhằm thể hiện quan điểm pháp lý về chủ quyền hoặc phân định biên giới.

## Chạy local

```bash
python -m http.server 8080
```

Mở `http://localhost:8080`.

## License

Mã ứng dụng: MIT. Xem thêm `THIRD_PARTY.md`.
