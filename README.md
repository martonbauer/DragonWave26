# DragonWave 2026 - Versenyirányító Rendszer

Erőteljes, WebSocket és Supabase technológiákkal felvértezett valós idejű nevezési rendzer integrált Barion fizetési kapuval (szimulációs réteggel) és PWA támogatással.

## 📊 Excel / CSV Importálási útmutató

A rendszer támogatja a tömeges importálást (Versenysorozat támogatással). A CSV fájl felépítése 6 oszlopos választható fejléccel:
`Név, KategóriaID, SzületésiDátum, Táv, ÖtpróbaID, Sorozat`

Példa sor:
`Kiss János, turakajak_noi_1, 1990-01-01, 11km, 123456, Igen`

### 🏆 Rajtszám Tartományok

- **Sorozat résztvevő (Igen)**: **1 - 50**
- **22 km**: 51 - 100
- **11 km**: 101 - 150
- **4 km (SUP)**: 151 - 200
- **Sárkányhajó**: 201 - 210

_Az Ötpróba ID-nál elég csak a 6 jegyű számot megadni._
