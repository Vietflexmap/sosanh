# Vietnam Global Comparator

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

- **Mercator:** Leaflet + OpenStreetMap.
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

## Dữ liệu

- Natural Earth — country boundaries;
- World Bank — population/GDP;
- OpenStreetMap — Mercator basemap;
- Turf.js — spatial calculations;
- D3 — Equal Earth rendering.

## License

Mã ứng dụng: MIT. Xem `THIRD_PARTY.md`.
