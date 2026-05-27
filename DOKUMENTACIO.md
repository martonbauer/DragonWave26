# DragonWave 2026 - Rendszer Dokumentáció

## 1. A szoftver célja

A DragonWave 2026 egy professzionális, életszerű problémára nyújt megoldást: sportversenyek (különösen vízi sportok, mint sárkányhajózás, kajak-kenu, SUP) teljes körű regisztrációs és időmérő rendszere. Lehetővé teszi a versenyzők nevezését, kategóriák szerinti indítását, az eredmények valós idejű követését és az adatok perzisztens tárolását.

## 2. Komponensek és Technológiai Stack

A rendszer egy robusztus, háromrétegű (3-tier) architektúrára épül, amely biztosítja a magas teljesítményt, a skálázhatóságot és a valós idejű működést:

### 2.1 Adatréteg (Data Layer)

- **Supabase (PostgreSQL)**: Biztosítja az adatok perzisztens, biztonságos és strukturált tárolását a felhőben.
- Rövid válaszidők és stabil elérés a verseny teljes időtartama alatt.

### 2.2 Kiszolgáló és Üzleti Logika (Service Layer)

- **Node.js & Express.js**: Villámgyors, aszinkron backend kiszolgáló, amely RESTful API-t biztosít és transzparensen kommunikál a kliensekkel.
- **Valós idejű szinkronizáció (Socket.io)**: Kétirányú kommunikációt biztosít a szerver és a böngészők között. Bármilyen adatváltozás esetén azonnal értesíti a kapcsolódó eszközöket, így minden Admin egyidejűleg a legfrissebb adatokat látja anélkül, hogy frissítené az oldalt.

### 2.3 Felhasználói Felület (UI Layer)

- **Kliens technológiák**: Modern HTML5, Vanilla CSS3 (Glassmorphism design irányzat alkalmazásával), JavaScript (ES6+).
- **Elemzések (Chart.js)**: A felület beépített diagramokkal (Doughnut chartok) biztosít azonnali statisztikai vizuális áttekintést az adminisztrátoroknak a regisztrált kategóriák és versenyállapotok arányairól.
- **Progresszív Webes Kapacitások (PWA)**: A `manifest.json` és `sw.js` (Service Worker) segítségével a rendszer asztali és mobil eszköztől függetlenül alkalmazásként "Telepíthető a kezdőképernyőre" (Add to Home Screen).

## 3. Beépített Funkciók és Iparági Standardok

A rendszer a modern versenyigazgatás és felhasználói élmény követelményeinek megfelelően a következő fejlett funkciókat biztosítja integráltan:

1. **PWA és Telepíthetőség**: App-szerű működés, asztali vagy mobil ikonként futtatható elszeparált keretrendszerben.
2. **Élő Értesítések (Push Notifications)**: Közvetlen böngészős értesítések felugrása rajt vagy egyéb adminisztratív esemény esetén.
3. **Barion Fizetési Kapu Integráció**: A nevezési folyamat éles Barion API-n keresztül végzi a bankkártyás fizetést, intelligens fallback/szimulációs réteggel kiegészítve, amely biztosítja a flow működését tesztkörnyezetben is.
4. **Valós idejű WebSockets Szinkronizáció**: Késleltetésmentes adminisztrációs felület a több felhasználó (párhuzamos ügyintézés) közötti szinkronhoz.
5. **Dinamikus Analytics Vezérlőpult**: Folyamatosan frissülő infografika az adminisztrációs kezdőfelületen, mellyel vezetői rálátás nyerhető.
6. **XLSX Export**: Egyetlen kattintással letölthető az összes regisztrált versenyző és azok végleges időeredménye professzionális Excel formába.

## 4. Működés műszaki feltételei

- **Környezet**: v16.x vagy újabb Node.js a szerver futtatásához és 3001-es port használatához.
- **Kliens**: Modern, JavaScriptet és WebSockets/PWA-t támogató webböngésző (Chrome, Safari, Edge javallott).
- **Függőségek (Backend)**: `express`, `cors`, `@supabase/supabase-js`, `dotenv`, `socket.io`. Telepítésük a gyökérmappában futtatott `npm install` paranccsal történetesíthető meg.
- **Külső Szolgáltatás**: Konfigurált Supabase adatbázis hozzáférés megadása a titkosított `.env` fájl `SUPABASE_URL` és `SUPABASE_KEY` változóiban.

## 5. Használati útmutató és Üzembe helyezés

### Rendszer Telepítése és Futtatása (Helyi Futtatás)

1. Töltse le, esetleg klónozza a projekt teljes forráskódját lokális számítógépére.
2. Nyisson egy dedikált terminált és lépjen a projekt főkönyvtárába.
3. Futtassa le az `npm install` parancsot a `.json` szintű `node_modules` csomagok automatikus telepítéséhez.
4. Adatbázis csatlakozáshoz másolja le vagy hozza létre a környezeti `.env` fájlt (_figyelem: sosem kerül feltöltésre publikus Git tárhelyre!_) és töltse fel az érvényes API kulcsokkal.
5. Indítsa el a szolgáltató állomást a `node server.js` terminál parancs kiadásával.
6. A klienseken tallózza a `http://localhost:3001` (vagy adott gép helyi IP címe:3001) URL címet böngészőből.

### Publikus Versenyzői Regisztráció

- A lenyűgöző dizájnú nyitólapon kattintson a "NEVEZÉS / REGISZTRÁCIÓ" célravezető gombra.
- Válassza ki a versenyszámot, a specifikus kategóriát, majd töltse ki saját adataival az intelligens beviteli mezőket (Név, Születési Dátum alapján kalkulált kategórialimit, Ötpróba ID opcionálisan).
- Az ÁSZF elfogadását követően átirányításra kerül a hitelesített Barion fizetési átjáróhoz, ahol biztonságosan rendezheti a nevezési díjat (teszt környezetben tranzakció szimulációval kiegészítve).
- A sikeres lezárultával Push Notifikáció érkezett üzenetet kap, és az eredménytáblára automatikusan felkerül neve 'Pendig' státuszban.

### Zártkörű Adminisztrációs Rendszer

- Irányítsa böngészőjét a központi bal oldalon található vagy linkelt Adminisztráció (`management.html`) oldalra.
- Adja meg az Adminisztrátor belépőkódot (Alapértelmezett rendszerkód megragadásnál: `dragon2026`).
- **Analitika**: Azonnal rálát a vizuális Chart.js grafikonokra behatoláskor (Adatkezelés menü), ami a résztvevők arányát szűri valósan frissülve.
- **Adatkezelés és Keresés**: Az 'Adatkezelés' menüpont valós idejű, rendkívül gyors keresővel, valamint inline (táblázaton belüli) módosítási és törlési funkcióval rendelkezik az esetleges adathibák másodpercek alatti javítására.
- **Jelenlét és Befizetés követése**: Az admin táblázatban dedikált check-box segítségével pipálható a helyszínen 'Megjelent' státusz, és automatikusan jelzi a Barion-al 'Befizetve' flaget.
- **Rajt Funkciók (Indítópult)**: Élesítheti a versenytávokat kategóriánként - a WebSocket kapcsolat miatt az indítás minden versenyző és adminisztrátor gépre századmásodpercre elterjedően rögzítve jelzi a futó tikkert (órát).
- **Élő Kontroll (Célvonal) és Tömeges Beérkeztetés**: Érkező hajók rajtszámának begépelésével regisztrálható a megállított befutó idő. A rendszer a mobilalkalmazásban támogatja a **Batch API-n keresztüli tömeges adatküldést** (akár 250 karakteres kapacitással) és beépített **idempotens felülírás-védelmet** alkalmaz a szerveroldalon. Ez biztosítja, hogy ha több bíró is beérkezteti ugyanazt a versenyzőt, mindig a leggyorsabb (elsőként rögzített) milliszekundum-pontos idő marad érvényben, kizárva a hálózati laggok miatti adatütközéseket. A rendszer ez alapján rögzíti és azonnal frissíti a hivatalos Scoreboard sorrendet.
- **Ellenőrzőpont (Checkpoint) Rögzítése**: A maratoni vagy hosszabb (pl. 22km-es) távok esetében a rendszer egy új ellenőrzőpont (11km-es forduló) hálózati rögzítését is lehetővé teszi, elkülönítve a célidőtől (`checkpoint_time`). Ez statisztikai és közvetítési szempontból is esszenciális a verseny alakulásának követéséhez. A megoldás offline/gyenge hálózati kapcsolattal is kompatibilis, Queue-t (aszinkron háttérszálat) futtat a böngésző szintjén az elküldés garantálására (Service Worker integráció).

## 6. Adatbázis Modell (Supabase / Schema)

A rendszer robusztus performanciáját a jól strukturált PosgreSQL adatbázis adja. Fő entitások:

- `registrations`: Az alapvető versenyzői adatokat, kapcsolattartási információkat és kategória-besorolást tartja nyilván. Tartalmazza a Barion tranzakció státuszát és a versenyfizetési azonosítót is.
- `race_timing`: Egy-egy a `registrations` entitással. A valós idejű óraidőket és állapotokat reprezentálja: `status` (pending, racing, finished, dns), `start_time` (rajt pillanata ms pontossággal), `checkpoint_time` (féltáv részidő), és `end_time` (hivatalos célidő).
- `checkpoints` (auditor tábla): Naplózó tábla a különböző földrajzi mérőpontokon áthaladó hajók kronológiai időpecsétjeinek rögzítésére tranzakció-biztos módon, komplex RLS biztosítási háziszabályokkal a háttérben.

## 7. Biztonság és Készültség

A DragonWave 2026 maximálisan figyelembe veszi a robusztusságot és az adatbiztonságot:

- **JWT (JSON Web Tokens) Autentikáció**: Az Admin rendszert kriptográfiai szempontból védett stateless authentikáció és authorizáció kezeli. Csak igazolt `token` birtokában hívhatók az API-k (módosítás, törlés, fizetési adatok lekérdezése).
- **Aszinkron Fájl Ingest & Biztonság**: Az admin API oldalon kezelt fájlműveletek (pl. PDF parse műveletek, Batch fájlok) aszinkron módon futnak, kiküszöbölve a CPU kiszolgáló event loopjának leállását. Eszköz a DDoS és blokkolt szálak kivédésére nagy terheltségnél.
- **Payload Strict Limits**: Maximált REST API payload nagyság és validált sémák biztosítják, hogy ne lehessen óriási adatcsomagokkal (pl. JSON bombák) lefagyasztani az egyedi szolgáltatási rétegeket felhő alapú DDOS környezetben.

## 8. Nyílt Jövőkép és Továbbfejleszthetőség

A keretrendszer az elkülönített, szolgáltatás orientált (Service-Oriented) architektúra miatt könnyedén integrálható újdonságokkal. A jövőben hardveresen az RFID chip-alapú fizikai időmérő szőnyegek, Barion éles fiókos fizetések, és extra natív mobil kliens (iOS/Android) zökkenőmentes implementációja valósítható meg mindössze a meglévő interfészek illesztésével. A rendszer a vizsgaremek keretében iparági standardokkal kidolgozott, stabil alapot biztosít további sportrendezvények kiszolgálásához is.

## 9. Tesztelés és Minőségbiztosítás (Bauer Márton)

### 9.1. Tesztelési stratégia és folyamat

A DragonWave 2026 rendszer minőségbiztosítási (Quality Assurance - QA) folyamata a modern szoftverfejlesztési iparág többszintű tesztelési piramisát (Testing Pyramid) követi, biztosítva a megbízható és hibamentes működést. A tesztelési folyamat három egymásra épülő pilléren nyugszik: első lépésként a tesztesetek és hibajegyek megtervezése és nyomon követése a Jira agilis projektmenedzsment felületén történik. Ezt követi a kód alapvető üzleti logikájának (pl. az időmérési és státuszkezelési matematikának) izolált, automatizált ellenőrzése a Jest keretrendszerrel (Unit Testing). Végül a rendszer egészének átfogó vizsgálatát a böngészőben végrehajtott manuális, funkcionális tesztek és a hálózati forgalom (Network Payload) fejlesztői eszközökkel történő monitorozása zárja.

A tesztelési folyamat lépései:

1. **Automatizált Egységtesztelés (Unit Testing)**: A kódolási fázisban a kritikus JavaScript modulokat (például az időeredmény-kalkulációs algoritmust) izoláltan teszteltük a Jest keretrendszerrel. Ennek célja az volt, hogy a programozási és matematikai hibákat a legalsó kódszinten kiszűrjük, még mielőtt a rendszer adatot küldene a REST API-n keresztül.
2. **Manuális Funkcionális és Integrációs Tesztelés**: A frontend felületen végrehajtottuk az előre definiált teszteseteket (TC-01, TC-02 stb.). Ennek során a következőket vizsgáltuk:
    - A JavaScript megfelelően manipulálja-e a DOM-ot a jogosultságok alapján (pl. admin felületek, módosító gombok elrejtése vagy megjelenítése).
    - A kliensoldali memória (átmeneti állapotkezelés) helyesen tárolja-e az adatokat, például offline szinkronizáció esetén.
    - A Supabase adatbázis megfelelően reagál-e a GET, POST és PATCH HTTP kérésekre.
3. **Hibakövetés (Bug Tracking) a Jirában**: Amennyiben a tesztelés során a rendszer hibára futott vagy a felhasználói élményt (UX) rontó tényezőt tapasztaltunk, a problémát dedikált „Bug” típusú jegyként rögzítettük a Jirában. A jegyek leírásában minden esetben rögzítettük a pontos hibajelenséget, valamint megjelöltük az érintett forráskódot (pl. `dragon.js` fájlt és a hibás függvényt) a célzott és gyorsabb javítás érdekében.

_(3. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(4. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(5. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(6. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_
_(7. sz. kép - Forrás: Saját képernyőkép a Jira projektmenedzsment felületéről)_

4. **Kódjavítás és Regressziós Tesztelés**: A forráskód javítását követően a korábban már lefutott teszteket újra elvégeztük (regressziós tesztelés). Ezzel bizonyosodtunk meg arról, hogy az új kód beemelése nem rontotta el a már meglévő, stabil funkciókat. A "Code Freeze" (kódfagyasztás) állapotának elérésekor minden teszteset sikeresen (PASS) lefutott, és a Jirában az összes teszteléshez kapcsolódó jegy "Done" (Kész) státuszba került.

### 9.2. Funkcionális tesztesetek

- **TC-01 teszteset: Versenyzői nevezés tesztelése (Publikus felület).** Eredmény: A felhasználói felület (User Interface - UI) betölt. A sikeres űrlapkitöltés után az adminisztrációs módosító gombok természetesen megszorítás alatt maradnak a külső kliens számára, az adatok biztonságosan elküldésre kerülnek az adatbázisba "Pending" státusszal. A teszt sikeres.

- **TC-02 teszteset: Bejelentkezés adminisztrátori adatokkal.** Eredmény: A menedzsment oldalon (management.html) a helyes kód megadása után a fejlesztői eszközökön (Developer Tools) látható a háttérszerver (Backend) felé indított WebSocket/REST hitelesítési kérés a Hálózat (Network) fülön, és a sikeres belépést, illetve szinkronizációt igazoló üzenet a Konzolban (Console). A vezérlő gombok megjelennek. A teszt sikeres.
  _(8. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-03 teszteset: Időmérési hiba (negatív idő) szimulálása.** Eredmény: A böngészőben futó szabályrendszer (Kliensoldali üzleti logika) helyesen felismeri a kísérletet (pl. ha a beérkezés időbélyege kisebb lenne, mint a hivatalos rajtolásé), és megakadályozza a negatív idő mentését, 0 értéknél megállítva azt, vagy hibaüzenetet adva. A teszt sikeres.
  _(9. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-04 teszteset: Tömeges beérkeztetés/mentés megszakítása mobil nézetben.** Eredmény: A megerősítő felugró ablakban (Modal) a "Mégse" gombra kattintva az eltárolt részeredmények nem kerülnek feltöltésre. A memória tartalma megmarad, adatbázis-kommunikáció nem történik, a versenybíró folytathatja a gyűjtést. A teszt sikeres.
  _(10. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

- **TC-05 teszteset: Tömeges rögzítés és hálózati szinkronizáció.** Eredmény: A tömeges frissítés (Bulk/Batch Update) sikeres hálózati szinkronizációja megtörtént a felhőalapú adatbázissal (Supabase). A Hálózat (Network) fülön látható az egyetlen szabványos webes kérésbe (REST API hívás) csomagolt adatcsomag (JSON Payload). A teszt sikeres.
  _(11. sz. kép - Forrás: Saját képernyőkép a böngésző fejlesztői eszközeiről.)_

### 9.3. A tesztekhez végzett kód és automatizált tesztelés

A vizsgakövetelményeknek megfelelően a manuális tesztek mellett az alapvető üzleti logika automatizált egységtesztelésen (Unit Test) is átesett a Jest tesztkörnyezet segítségével. Kiemelt fontosságú volt annak kódolt ellenőrzése, hogy a futam végleges versenyideje (eltelt milliszekundumokban) semmilyen adminisztrációs vagy hálózati elcsúszás körülményei között ne vehessen fel negatív értéket.

```javascript
// logic.js - Kliensoldali időmérés logika
function calculateElapsedTime(startTime, endTime) {
    const elapsed = endTime - startTime;
    return elapsed < 0 ? 0 : elapsed; // Ha negatív alá menne (hibás adatpár), akkor 0-t ad vissza
}
module.exports = { calculateElapsedTime };
```

Az automatizált teszt kódja (Jest framework):

```javascript
// logic.test.js
const { calculateElapsedTime } = require('./logic');

describe('Versenyidő kalkulációs tesztek', () => {
    test('TC-03 Kódolt teszt: Az eltelt idő nem mehet nulla alá', () => {
        const eredmeny = calculateElapsedTime(10000, 5000); // Hibás adatok: célidő kisebb a rajtnál
        expect(eredmeny).toBe(0);
    });

    test('TC-04 Kódolt teszt: Helyes versenyidő számítás', () => {
        const eredmeny = calculateElapsedTime(2000, 10000); // 8 mp telt el
        expect(eredmeny).toBe(8000);
    });

    test('TC-05 Kódolt teszt: Hosszabb táv beérkeztetési tesztje', () => {
        const eredmeny = calculateElapsedTime(50000, 200000); // 150 mp telt el
        expect(eredmeny).toBe(150000);
    });
});
```

_(12. sz. kép - Forrás: Sikeres Jest egységteszt lefutása a fejlesztői terminálban)_

**Teszteredmények dokumentációja:**
Az `npm test` parancs futtatásakor a rendszer mindhárom fenti tesztesetet sikeresen (PASS) értékelte, igazolva az üzleti logika stabilitását az adatbázisba történő írás előtt.
