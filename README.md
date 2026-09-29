# Bảng so sánh toàn cầu về Việt Nam

**Demo:** https://vietflexmap.github.io/sosanh/

## Tương tác chính

- Nhấn giữ **trực tiếp trên polygon Việt Nam** để kéo đi; không cần kéo một marker tâm.
- Khi thả Việt Nam lên một quốc gia, hệ thống lấy quốc gia nằm dưới **tâm hiện tại của Việt Nam** và cập nhật toàn bộ bảng so sánh.
- La bàn cho phép quay Việt Nam **0–359°** quanh tâm hiện tại.
- Góc xoay được thực hiện bằng phép quay 3D quanh trục xuyên tâm sau phép vận chuyển trên mặt cầu:

```text
P' = R_spin(theta) · R_move · P
```

Do đó hình học không bị scale/shear tùy ý.

## Hoàng Sa / Trường Sa

Trang hiển thị hai **điểm tham chiếu trực quan** có nhãn Hoàng Sa và Trường Sa. Các điểm này dùng cùng phép biến đổi 3D với polygon Việt Nam nên luôn đi cùng khi kéo và xoay.

Chúng không được mô hình hóa thành polygon ranh giới pháp lý trong ứng dụng này.

> Ranh giới và nhãn bản đồ phục vụ minh họa địa lý, không nhằm thể hiện kết luận pháp lý về chủ quyền hoặc phân định biên giới.

## Hai phép chiếu

- **Mercator:** Vietflex Map + Google Roadmap legacy tiles.
- **Equal Earth:** D3 `geoEqualEarth()`.

Cùng một geometry đã biến đổi được render qua cả hai engine.

## Chỉ số

- diện tích địa lý;
- chiều dài Bắc–Nam;
- dân số;
- mật độ dân số;
- GDP;
- GDP/người;
- population footprint ước tính;
- hệ số biến dạng Mercator;
- biểu đồ 0° / 30° / 45° / 60° / 75°.

## Dữ liệu biên giới quốc gia

Nguồn chính:

- `datasets/geo-countries/data/countries.geojson`
- 258 quốc gia và lãnh thổ
- nguồn gốc Natural Earth **1:10m**
- geometry được xử lý bằng GDAL `ogr2ogr -makevalid`
- tọa độ giữ độ chính xác 6 chữ số thập phân
- schema:
  - `name`
  - `ISO3166-1-Alpha-2`
  - `ISO3166-1-Alpha-3`

Ứng dụng ưu tiên tải từ jsDelivr, sau đó raw GitHub. Nếu cả hai nguồn 1:10m không khả dụng mới hạ xuống Natural Earth 1:110m để trang vẫn hoạt động.

Các nguồn khác:

- World Bank — population/GDP;
- Vietflex Map + Google Roadmap legacy — Mercator basemap;
- Turf.js — spatial calculations;
- D3 — Equal Earth rendering.

## License

Mã ứng dụng: MIT. Xem `THIRD_PARTY.md`.


## Vietflex Map runtime

Mercator mode now uses the pinned Vietflex 1.0.0 runtime:

```html
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/Vietflexmap/VN@6144d565fcf236727577ab3c4471bbe49f86892f/dist/vietflex.css">
<script src="https://cdn.jsdelivr.net/gh/Vietflexmap/VN@6144d565fcf236727577ab3c4471bbe49f86892f/dist/vietflex.js"></script>
```

Map initialization:

```js
const map = Vietflex.vietflexMap('map', {
  useLegacyGoogleTiles: true,
  googleMapType: 'roadmap',
  center: [17, 106],
  zoom: 4,
  minZoom: 2,
  maxZoom: 10,
  maxBounds: null,
  worldCopyJump: true,
  zoomControl: false,
  attributionControl: false
});

new Vietflex.ZoomControl({ position: 'topright' }).addTo(map);
new Vietflex.AttributionControl({ position: 'bottomright' }).addTo(map);
```

The comparator uses Vietflex native vector classes (`GeoJSON`, `CircleMarker`, `LayerGroup`) instead of loading a second Leaflet runtime. Dragging uses PointerEvent-compatible events.


## Giao diện so sánh trực quan

Bảng so sánh dùng Việt Nam làm mốc 100% và hiển thị hai cột cho từng chỉ tiêu:

- đỏ: Việt Nam;
- xanh dương: quốc gia đích;
- số liệu tuyệt đối hiển thị trên mỗi cột;
- dòng tỷ lệ cho biết quốc gia đích bằng bao nhiêu % Việt Nam và lớn hơn/nhỏ hơn bao nhiêu %.

Các chỉ tiêu gồm diện tích, chiều dài Bắc–Nam, dân số, mật độ dân số, GDP, GDP/người và dân số ước tính trong footprint Việt Nam.

La bàn xoay 360° được chuyển thành control nổi góc phải dưới có thể thu gọn. Projection switch và nút thông tin nằm ở cụm công cụ góc phải trên.
